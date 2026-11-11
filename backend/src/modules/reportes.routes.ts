import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { fechaISO, parse } from '../lib/validation';

const router = Router();

const rango = z.object({ desde: fechaISO, hasta: fechaISO }).refine((r) => r.desde <= r.hasta, {
  message: 'La fecha desde no puede ser mayor que hasta',
  path: ['desde'],
});

/** Indicadores para la pantalla principal. */
router.get('/dashboard', async (_req, res) => {
  const [hoy, mes, cobrar, stockBajo, saldos, serie, cajas] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS cantidad, COALESCE(sum(total), 0)::bigint AS total
         FROM ventas WHERE estado = 'EMITIDA' AND fecha = current_date`,
    ),
    pool.query(
      `SELECT count(*)::int AS cantidad, COALESCE(sum(total), 0)::bigint AS total
         FROM ventas WHERE estado = 'EMITIDA' AND date_trunc('month', fecha) = date_trunc('month', current_date)`,
    ),
    pool.query(
      `SELECT COALESCE(sum(saldo), 0)::bigint AS total,
              COALESCE(sum(saldo) FILTER (WHERE vencimiento < current_date), 0)::bigint AS vencido
         FROM cuentas_cobrar WHERE estado = 'PENDIENTE'`,
    ),
    pool.query(
      `SELECT p.id, p.codigo, p.descripcion, p.stock_minimo, COALESCE(sum(s.cantidad), 0)::int AS stock
         FROM productos p LEFT JOIN stock s ON s.producto_id = p.id
        WHERE p.activo
        GROUP BY p.id HAVING COALESCE(sum(s.cantidad), 0) <= p.stock_minimo
        ORDER BY stock, p.descripcion LIMIT 8`,
    ),
    pool.query(
      `SELECT o.descripcion AS operadora,
              COALESCE(max(s.saldo) FILTER (WHERE s.cuenta = 'RECARGA'), 0)::bigint   AS saldo_recarga,
              COALESCE(max(s.saldo) FILTER (WHERE s.cuenta = 'BILLETERA'), 0)::bigint AS saldo_billetera
         FROM operadoras o LEFT JOIN saldos_operadora s ON s.operadora_id = o.id
        WHERE o.activo GROUP BY o.id ORDER BY o.descripcion`,
    ),
    pool.query(
      `SELECT d::date AS fecha,
              COALESCE((SELECT sum(total) FROM ventas v WHERE v.estado = 'EMITIDA' AND v.fecha = d::date), 0)::bigint AS ventas,
              COALESCE((SELECT sum(monto) FROM ventas_saldo vs WHERE vs.estado = 'ACTIVA' AND vs.created_at::date = d::date), 0)::bigint AS recargas
         FROM generate_series(current_date - 13, current_date, interval '1 day') d
        ORDER BY d`,
    ),
    pool.query(
      `SELECT s.id, c.descripcion AS caja, u.nombre AS usuario, s.abierta_at
         FROM sesiones_caja s JOIN cajas c ON c.id = s.caja_id JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.estado = 'ABIERTA' ORDER BY s.abierta_at`,
    ),
  ]);
  res.json({
    ventas_hoy: hoy.rows[0],
    ventas_mes: mes.rows[0],
    cuentas_cobrar: cobrar.rows[0],
    stock_bajo: stockBajo.rows,
    saldos: saldos.rows,
    serie_14_dias: serie.rows,
    cajas_abiertas: cajas.rows,
  });
});

/** Ventas por día y totales del período (con margen bruto sobre costo). */
router.get('/ventas', async (req, res) => {
  const { desde, hasta } = parse(rango, req.query);
  const [porDia, resumen, porCondicion] = await Promise.all([
    pool.query(
      `SELECT v.fecha, count(*)::int AS cantidad, sum(v.total)::bigint AS total,
              sum(v.total_iva5 + v.total_iva10)::bigint AS iva
         FROM ventas v WHERE v.estado = 'EMITIDA' AND v.fecha BETWEEN $1 AND $2
        GROUP BY v.fecha ORDER BY v.fecha`,
      [desde, hasta],
    ),
    pool.query(
      `SELECT count(DISTINCT v.id)::int AS cantidad,
              COALESCE(sum(vd.subtotal), 0)::bigint AS total,
              COALESCE(sum(vd.cantidad * vd.costo_unitario), 0)::bigint AS costo,
              COALESCE(sum(vd.subtotal - vd.cantidad * vd.costo_unitario), 0)::bigint AS margen
         FROM ventas v JOIN venta_detalles vd ON vd.venta_id = v.id
        WHERE v.estado = 'EMITIDA' AND v.fecha BETWEEN $1 AND $2`,
      [desde, hasta],
    ),
    pool.query(
      `SELECT condicion, count(*)::int AS cantidad, sum(total)::bigint AS total
         FROM ventas WHERE estado = 'EMITIDA' AND fecha BETWEEN $1 AND $2 GROUP BY condicion`,
      [desde, hasta],
    ),
  ]);
  res.json({ por_dia: porDia.rows, resumen: resumen.rows[0], por_condicion: porCondicion.rows });
});

router.get('/productos-mas-vendidos', async (req, res) => {
  const { desde, hasta } = parse(rango, req.query);
  const { rows } = await pool.query(
    `SELECT p.id, p.codigo, p.descripcion, m.descripcion AS marca,
            sum(vd.cantidad)::int AS cantidad, sum(vd.subtotal)::bigint AS total,
            sum(vd.subtotal - vd.cantidad * vd.costo_unitario)::bigint AS margen
       FROM venta_detalles vd
       JOIN ventas v ON v.id = vd.venta_id
       JOIN productos p ON p.id = vd.producto_id
       JOIN marcas m ON m.id = p.marca_id
      WHERE v.estado = 'EMITIDA' AND v.fecha BETWEEN $1 AND $2
      GROUP BY p.id, m.descripcion ORDER BY cantidad DESC LIMIT 50`,
    [desde, hasta],
  );
  res.json(rows);
});

/** Recargas y billetera por operadora. */
router.get('/servicios', async (req, res) => {
  const { desde, hasta } = parse(rango, req.query);
  const [recargas, billetera] = await Promise.all([
    pool.query(
      `SELECT o.descripcion AS operadora, t.descripcion AS tipo_carga, count(*)::int AS cantidad, sum(v.monto)::bigint AS total
         FROM ventas_saldo v JOIN operadoras o ON o.id = v.operadora_id JOIN tipos_carga t ON t.id = v.tipo_carga_id
        WHERE v.estado = 'ACTIVA' AND v.created_at::date BETWEEN $1 AND $2
        GROUP BY o.descripcion, t.descripcion ORDER BY o.descripcion, total DESC`,
      [desde, hasta],
    ),
    pool.query(
      `SELECT o.descripcion AS operadora, b.tipo, count(*)::int AS cantidad, sum(b.monto)::bigint AS monto,
              sum(b.comision)::bigint AS comision
         FROM movimientos_billetera b JOIN operadoras o ON o.id = b.operadora_id
        WHERE b.estado = 'ACTIVO' AND b.created_at::date BETWEEN $1 AND $2
        GROUP BY o.descripcion, b.tipo ORDER BY o.descripcion, b.tipo`,
      [desde, hasta],
    ),
  ]);
  res.json({ recargas: recargas.rows, billetera: billetera.rows });
});

export default router;
