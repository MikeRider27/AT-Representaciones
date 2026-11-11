import { Router } from 'express';
import { z } from 'zod';
import { Db, one, pool, withTransaction } from '../db/pool';
import { conflict, notFound } from '../lib/errors';
import { generarCuotas, totalizar } from '../lib/fiscal';
import { medioPago, montoPositivo, paginar, paginationQuery, parse, parseId, rangoFechasQuery, requiredText } from '../lib/validation';
import { currentUser, requireRole } from '../middleware/auth';
import { registrarMovimientoCaja, requerirSesionAbierta, revertirMovimientosCaja } from './caja.service';
import { moverStock, verificarSinDuplicados } from './stock.service';

const router = Router();

const ventaSchema = z
  .object({
    cliente_id: z.coerce.number().int().positive('Seleccione el cliente'),
    deposito_id: z.coerce.number().int().positive('Seleccione el depósito'),
    condicion: z.enum(['CONTADO', 'CREDITO']),
    medio_pago: medioPago.default('EFECTIVO'),
    cuotas: z.coerce.number().int().min(1).max(60).default(1),
    intervalo_dias: z.coerce.number().int().min(1).max(365).default(30),
    items: z
      .array(
        z.object({
          producto_id: z.coerce.number().int().positive(),
          cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a cero'),
          precio_unitario: montoPositivo,
        }),
      )
      .min(1, 'Agregue al menos un producto'),
  });

async function obtenerVenta(db: Db, id: number) {
  const venta = await one(
    db,
    `SELECT v.*, c.nombre AS cliente, c.ruc AS cliente_ruc, c.direccion AS cliente_direccion, c.telefono AS cliente_telefono,
            d.descripcion AS deposito, u.nombre AS usuario, ua.nombre AS anulada_por_nombre
       FROM ventas v
       JOIN clientes c ON c.id = v.cliente_id
       JOIN depositos d ON d.id = v.deposito_id
       JOIN usuarios u ON u.id = v.usuario_id
       LEFT JOIN usuarios ua ON ua.id = v.anulada_por
      WHERE v.id = $1`,
    [id],
  );
  if (!venta) throw notFound('Venta no encontrada');
  const [items, cuotas] = await Promise.all([
    db.query(
      `SELECT vd.id, vd.producto_id, p.codigo, p.descripcion, vd.cantidad, vd.precio_unitario, vd.tasa_iva, vd.subtotal
         FROM venta_detalles vd JOIN productos p ON p.id = vd.producto_id
        WHERE vd.venta_id = $1 ORDER BY vd.id`,
      [id],
    ),
    db.query('SELECT id, nro_cuota, vencimiento, monto, saldo, estado FROM cuentas_cobrar WHERE venta_id = $1 ORDER BY nro_cuota', [id]),
  ]);
  return { ...venta, items: items.rows, plan_cuotas: cuotas.rows };
}

router.post('/', async (req, res) => {
  const d = parse(ventaSchema, req.body);
  const user = currentUser(req);
  verificarSinDuplicados(d.items);

  const ventaId = await withTransaction(async (db) => {
    const sesion = await requerirSesionAbierta(db, user.id);

    const cliente = await one<{ activo: boolean }>(db, 'SELECT activo FROM clientes WHERE id = $1', [d.cliente_id]);
    if (!cliente?.activo) throw notFound('Cliente no encontrado o inactivo');

    const { rows: productos } = await db.query<{
      id: number;
      codigo: string;
      descripcion: string;
      precio_compra: number;
      activo: boolean;
      tasa: number;
    }>(
      `SELECT p.id, p.codigo, p.descripcion, p.precio_compra, p.activo, i.tasa
         FROM productos p JOIN impuestos i ON i.id = p.impuesto_id
        WHERE p.id = ANY($1::int[])`,
      [d.items.map((i) => i.producto_id)],
    );
    const porId = new Map(productos.map((p) => [p.id, p]));

    const lineas = d.items.map((it) => {
      const p = porId.get(it.producto_id);
      if (!p || !p.activo) throw notFound(`Producto ${it.producto_id} no encontrado o inactivo`);
      if (it.precio_unitario < p.precio_compra) {
        throw conflict(
          'PRECIO_BAJO_COSTO',
          `El precio de ${p.codigo} - ${p.descripcion} no puede ser menor al precio de compra (${p.precio_compra.toLocaleString('es-PY')} Gs.)`,
        );
      }
      return { ...it, tasa: p.tasa, costo: p.precio_compra, subtotal: it.cantidad * it.precio_unitario };
    });
    const t = totalizar(lineas);
    const credito = d.condicion === 'CREDITO';

    // Numeración fiscal correlativa: el bloqueo de la fila serializa las emisiones y un ROLLBACK no deja huecos.
    const num = await one<{ establecimiento: string; punto_expedicion: string; ultimo_numero_factura: number }>(
      db,
      `UPDATE configuracion SET ultimo_numero_factura = ultimo_numero_factura + 1
        WHERE id = 1 RETURNING establecimiento, punto_expedicion, ultimo_numero_factura`,
    );
    const nroFactura = `${num!.establecimiento}-${num!.punto_expedicion}-${String(num!.ultimo_numero_factura).padStart(7, '0')}`;

    const venta = await one<{ id: number; fecha: string }>(
      db,
      `INSERT INTO ventas (nro_factura, cliente_id, deposito_id, condicion, cuotas, intervalo_dias, medio_pago,
                           total_exenta, total_gravada5, total_gravada10, total_iva5, total_iva10, total,
                           sesion_caja_id, usuario_id)
       VALUES ($15, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, fecha`,
      [
        d.cliente_id,
        d.deposito_id,
        d.condicion,
        credito ? d.cuotas : 1,
        d.intervalo_dias,
        credito ? null : d.medio_pago,
        t.total_exenta,
        t.total_gravada5,
        t.total_gravada10,
        t.total_iva5,
        t.total_iva10,
        t.total,
        sesion.id,
        user.id,
        nroFactura,
      ],
    );
    const id = venta!.id;

    for (const l of lineas) {
      await db.query(
        `INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, tasa_iva, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, l.producto_id, l.cantidad, l.precio_unitario, l.costo, l.tasa, l.subtotal],
      );
      await moverStock(db, {
        productoId: l.producto_id,
        depositoId: d.deposito_id,
        cantidad: -l.cantidad,
        tipo: 'VENTA',
        referenciaTipo: 'VENTA',
        referenciaId: id,
        usuarioId: user.id,
      });
    }

    if (credito) {
      for (const c of generarCuotas(t.total, d.cuotas, d.intervalo_dias, venta!.fecha)) {
        await db.query(
          `INSERT INTO cuentas_cobrar (venta_id, cliente_id, nro_cuota, vencimiento, monto, saldo)
           VALUES ($1, $2, $3, $4, $5, $5)`,
          [id, d.cliente_id, c.nro_cuota, c.vencimiento, c.monto],
        );
      }
    } else {
      await registrarMovimientoCaja(db, {
        sesionId: sesion.id,
        tipo: 'INGRESO',
        concepto: 'VENTA',
        medioPago: d.medio_pago,
        monto: t.total,
        descripcion: `Factura ${nroFactura}`,
        referenciaTipo: 'VENTA',
        referenciaId: id,
        usuarioId: user.id,
      });
    }
    return id;
  });

  res.status(201).json(await obtenerVenta(pool, ventaId));
});

const listQuery = paginationQuery.merge(rangoFechasQuery).extend({
  estado: z.enum(['EMITIDA', 'ANULADA']).optional(),
  condicion: z.enum(['CONTADO', 'CREDITO']).optional(),
  cliente_id: z.coerce.number().int().positive().optional(),
});

router.get('/', async (req, res) => {
  const { q, page, pageSize, desde, hasta, estado, condicion, cliente_id } = parse(listQuery, req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (q) {
    params.push(`%${q}%`);
    where.push(`(c.nombre ILIKE $${params.length} OR c.ruc ILIKE $${params.length} OR v.nro_factura ILIKE $${params.length} OR v.id::text = $${params.length + 1})`);
    params.push(q);
  }
  if (desde) add('v.fecha >= ?', desde);
  if (hasta) add('v.fecha <= ?', hasta);
  if (estado) add('v.estado = ?', estado);
  if (condicion) add('v.condicion = ?', condicion);
  if (cliente_id) add('v.cliente_id = ?', cliente_id);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { limit, offset } = paginar(page, pageSize);
  const [data, agg] = await Promise.all([
    pool.query(
      `SELECT v.id, v.nro_factura, v.fecha, v.created_at, c.nombre AS cliente, c.ruc AS cliente_ruc, v.condicion, v.medio_pago, v.cuotas,
              v.total, v.estado, u.nombre AS usuario
         FROM ventas v JOIN clientes c ON c.id = v.cliente_id JOIN usuarios u ON u.id = v.usuario_id
         ${whereSql} ORDER BY v.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: number; monto: number }>(
      `SELECT count(*)::int AS total, COALESCE(sum(v.total) FILTER (WHERE v.estado = 'EMITIDA'), 0)::bigint AS monto
         FROM ventas v JOIN clientes c ON c.id = v.cliente_id ${whereSql}`,
      params,
    ),
  ]);
  res.json({ data: data.rows, total: agg.rows[0].total, page, pageSize, totales: { monto: agg.rows[0].monto } });
});

router.get('/:id', async (req, res) => {
  res.json(await obtenerVenta(pool, parseId(req.params)));
});

const anularSchema = z.object({ motivo: requiredText(200, 3) });

router.post('/:id/anular', requireRole('ADMIN'), async (req, res) => {
  const id = parseId(req.params);
  const { motivo } = parse(anularSchema, req.body);
  const user = currentUser(req);

  await withTransaction(async (db) => {
    const venta = await one<{ estado: string; deposito_id: number }>(
      db,
      'SELECT estado, deposito_id FROM ventas WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!venta) throw notFound('Venta no encontrada');
    if (venta.estado === 'ANULADA') throw conflict('YA_ANULADA', 'La venta ya está anulada');

    const cobrada = await one(db, `SELECT 1 FROM cuentas_cobrar WHERE venta_id = $1 AND saldo < monto AND estado <> 'ANULADA'`, [id]);
    if (cobrada) throw conflict('VENTA_CON_COBROS', 'La venta tiene cuotas cobradas. Anule primero los cobros.');

    const { rows: items } = await db.query<{ producto_id: number; cantidad: number }>(
      'SELECT producto_id, cantidad FROM venta_detalles WHERE venta_id = $1',
      [id],
    );
    for (const it of items) {
      await moverStock(db, {
        productoId: it.producto_id,
        depositoId: venta.deposito_id,
        cantidad: it.cantidad,
        tipo: 'ANULACION_VENTA',
        referenciaTipo: 'VENTA',
        referenciaId: id,
        usuarioId: user.id,
      });
    }
    await db.query(`UPDATE cuentas_cobrar SET estado = 'ANULADA' WHERE venta_id = $1`, [id]);
    await revertirMovimientosCaja(db, 'VENTA', id, user.id, `Anulación venta #${id}`);
    await db.query(
      `UPDATE ventas SET estado = 'ANULADA', anulada_at = now(), anulada_por = $2, motivo_anulacion = $3 WHERE id = $1`,
      [id, user.id, motivo],
    );
  });

  res.json(await obtenerVenta(pool, id));
});

export default router;
