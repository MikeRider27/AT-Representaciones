import { Router } from 'express';
import { z } from 'zod';
import { one, pool, withTransaction } from '../db/pool';
import { conflict, notFound } from '../lib/errors';
import { medioPago, montoPositivo, paginar, paginationQuery, parse, parseId, rangoFechasQuery } from '../lib/validation';
import { currentUser, requireRole } from '../middleware/auth';
import { registrarMovimientoCaja, requerirSesionAbierta, revertirMovimientosCaja } from './caja.service';

const router = Router();

/** Resumen de deuda por cliente. */
router.get('/deudores', async (req, res) => {
  const { q, page, pageSize } = parse(paginationQuery, req.query);
  const params: unknown[] = [];
  let filtro = '';
  if (q) {
    params.push(`%${q}%`);
    filtro = 'AND (c.nombre ILIKE $1 OR c.ruc ILIKE $1)';
  }
  const { limit, offset } = paginar(page, pageSize);
  const base = `FROM cuentas_cobrar cc JOIN clientes c ON c.id = cc.cliente_id
                WHERE cc.estado = 'PENDIENTE' ${filtro}`;
  const [data, agg] = await Promise.all([
    pool.query(
      `SELECT c.id AS cliente_id, c.nombre, c.ruc, c.telefono,
              count(*)::int AS cuotas_pendientes,
              sum(cc.saldo)::bigint AS deuda_total,
              COALESCE(sum(cc.saldo) FILTER (WHERE cc.vencimiento < current_date), 0)::bigint AS deuda_vencida,
              min(cc.vencimiento) AS proximo_vencimiento
         ${base}
        GROUP BY c.id ORDER BY deuda_vencida DESC, deuda_total DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: number; deuda_total: number; deuda_vencida: number }>(
      `SELECT count(DISTINCT c.id)::int AS total, COALESCE(sum(cc.saldo), 0)::bigint AS deuda_total,
              COALESCE(sum(cc.saldo) FILTER (WHERE cc.vencimiento < current_date), 0)::bigint AS deuda_vencida
         ${base}`,
      params,
    ),
  ]);
  const { total, ...totales } = agg.rows[0];
  res.json({ data: data.rows, total, page, pageSize, totales });
});

/** Cuotas pendientes de un cliente. */
router.get('/clientes/:id/cuotas', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT cc.id, cc.venta_id, v.fecha AS fecha_venta, cc.nro_cuota, v.cuotas AS total_cuotas, cc.vencimiento,
            cc.monto, cc.saldo, (current_date - cc.vencimiento) AS dias_atraso
       FROM cuentas_cobrar cc JOIN ventas v ON v.id = cc.venta_id
      WHERE cc.cliente_id = $1 AND cc.estado = 'PENDIENTE'
      ORDER BY cc.vencimiento, cc.venta_id, cc.nro_cuota`,
    [parseId(req.params)],
  );
  res.json(rows);
});

const cobroSchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  medio_pago: medioPago.default('EFECTIVO'),
  pagos: z
    .array(z.object({ cuenta_cobrar_id: z.coerce.number().int().positive(), monto: montoPositivo }))
    .min(1, 'Seleccione al menos una cuota'),
});

router.post('/', async (req, res) => {
  const d = parse(cobroSchema, req.body);
  const user = currentUser(req);
  const cobroId = await withTransaction(async (db) => {
    const sesion = await requerirSesionAbierta(db, user.id);
    const total = d.pagos.reduce((a, p) => a + p.monto, 0);
    const cobro = await one<{ id: number }>(
      db,
      `INSERT INTO cobros (cliente_id, total, medio_pago, sesion_caja_id, usuario_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [d.cliente_id, total, d.medio_pago, sesion.id, user.id],
    );
    for (const p of d.pagos) {
      const cuota = await one<{ cliente_id: number; saldo: number; estado: string; nro_cuota: number; venta_id: number }>(
        db,
        'SELECT cliente_id, saldo, estado, nro_cuota, venta_id FROM cuentas_cobrar WHERE id = $1 FOR UPDATE',
        [p.cuenta_cobrar_id],
      );
      if (!cuota || cuota.cliente_id !== d.cliente_id) throw notFound('Cuota no encontrada para el cliente');
      if (cuota.estado !== 'PENDIENTE') throw conflict('CUOTA_NO_PENDIENTE', `La cuota ${cuota.nro_cuota} de la venta #${cuota.venta_id} no está pendiente`);
      if (p.monto > cuota.saldo) {
        throw conflict('MONTO_EXCEDE_SALDO', `El monto supera el saldo de la cuota ${cuota.nro_cuota} de la venta #${cuota.venta_id}`);
      }
      const nuevoSaldo = cuota.saldo - p.monto;
      await db.query('UPDATE cuentas_cobrar SET saldo = $2, estado = $3 WHERE id = $1', [
        p.cuenta_cobrar_id,
        nuevoSaldo,
        nuevoSaldo === 0 ? 'PAGADA' : 'PENDIENTE',
      ]);
      await db.query('INSERT INTO cobro_detalles (cobro_id, cuenta_cobrar_id, monto) VALUES ($1, $2, $3)', [
        cobro!.id,
        p.cuenta_cobrar_id,
        p.monto,
      ]);
    }
    await registrarMovimientoCaja(db, {
      sesionId: sesion.id,
      tipo: 'INGRESO',
      concepto: 'COBRO_CUOTA',
      medioPago: d.medio_pago,
      monto: total,
      descripcion: `Cobro #${cobro!.id}`,
      referenciaTipo: 'COBRO',
      referenciaId: cobro!.id,
      usuarioId: user.id,
    });
    return cobro!.id;
  });
  res.status(201).json(await obtenerCobro(cobroId));
});

async function obtenerCobro(id: number) {
  const cobro = await one(
    pool,
    `SELECT co.*, c.nombre AS cliente, c.ruc AS cliente_ruc, u.nombre AS usuario
       FROM cobros co JOIN clientes c ON c.id = co.cliente_id JOIN usuarios u ON u.id = co.usuario_id
      WHERE co.id = $1`,
    [id],
  );
  if (!cobro) throw notFound('Cobro no encontrado');
  const { rows: detalles } = await pool.query(
    `SELECT cd.id, cd.monto, cc.venta_id, cc.nro_cuota, cc.vencimiento
       FROM cobro_detalles cd JOIN cuentas_cobrar cc ON cc.id = cd.cuenta_cobrar_id
      WHERE cd.cobro_id = $1 ORDER BY cc.venta_id, cc.nro_cuota`,
    [id],
  );
  return { ...cobro, detalles };
}

router.get('/', async (req, res) => {
  const { q, page, pageSize, desde, hasta } = parse(paginationQuery.merge(rangoFechasQuery), req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(c.nombre ILIKE $${params.length} OR c.ruc ILIKE $${params.length})`);
  }
  if (desde) {
    params.push(desde);
    where.push(`co.created_at::date >= $${params.length}`);
  }
  if (hasta) {
    params.push(hasta);
    where.push(`co.created_at::date <= $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { limit, offset } = paginar(page, pageSize);
  const [data, total] = await Promise.all([
    pool.query(
      `SELECT co.id, co.created_at, c.nombre AS cliente, co.total, co.medio_pago, co.estado, u.nombre AS usuario
         FROM cobros co JOIN clientes c ON c.id = co.cliente_id JOIN usuarios u ON u.id = co.usuario_id
         ${whereSql} ORDER BY co.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM cobros co JOIN clientes c ON c.id = co.cliente_id ${whereSql}`, params),
  ]);
  res.json({ data: data.rows, total: total.rows[0].total, page, pageSize });
});

router.get('/:id', async (req, res) => {
  res.json(await obtenerCobro(parseId(req.params)));
});

router.post('/:id/anular', requireRole('ADMIN'), async (req, res) => {
  const id = parseId(req.params);
  const user = currentUser(req);
  await withTransaction(async (db) => {
    const cobro = await one<{ estado: string }>(db, 'SELECT estado FROM cobros WHERE id = $1 FOR UPDATE', [id]);
    if (!cobro) throw notFound('Cobro no encontrado');
    if (cobro.estado === 'ANULADO') throw conflict('YA_ANULADO', 'El cobro ya está anulado');
    const { rows } = await db.query<{ cuenta_cobrar_id: number; monto: number }>(
      'SELECT cuenta_cobrar_id, monto FROM cobro_detalles WHERE cobro_id = $1',
      [id],
    );
    for (const det of rows) {
      await db.query(
        `UPDATE cuentas_cobrar SET saldo = saldo + $2, estado = 'PENDIENTE' WHERE id = $1 AND estado <> 'ANULADA'`,
        [det.cuenta_cobrar_id, det.monto],
      );
    }
    await revertirMovimientosCaja(db, 'COBRO', id, user.id, `Anulación cobro #${id}`);
    await db.query(`UPDATE cobros SET estado = 'ANULADO', anulado_at = now(), anulado_por = $2 WHERE id = $1`, [id, user.id]);
  });
  res.json(await obtenerCobro(id));
});

export default router;
