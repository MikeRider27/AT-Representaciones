import { Router } from 'express';
import { z } from 'zod';
import { Db, one, pool, withTransaction } from '../db/pool';
import { conflict, notFound } from '../lib/errors';
import { totalizar } from '../lib/fiscal';
import { fechaISO, monto, paginar, paginationQuery, parse, parseId, rangoFechasQuery, requiredText } from '../lib/validation';
import { currentUser, requireRole } from '../middleware/auth';
import { moverStock, verificarSinDuplicados } from './stock.service';

const router = Router();

const compraSchema = z.object({
  proveedor_id: z.coerce.number().int().positive('Seleccione el proveedor'),
  deposito_id: z.coerce.number().int().positive('Seleccione el depósito'),
  numero_factura: requiredText(30),
  fecha: fechaISO,
  condicion: z.enum(['CONTADO', 'CREDITO']),
  actualizar_precio_compra: z.boolean().default(true),
  items: z
    .array(
      z.object({
        producto_id: z.coerce.number().int().positive(),
        cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a cero'),
        costo_unitario: monto,
      }),
    )
    .min(1, 'Agregue al menos un producto'),
});

async function obtenerCompra(db: Db, id: number) {
  const compra = await one(
    db,
    `SELECT co.*, p.nombre AS proveedor, p.ruc AS proveedor_ruc, d.descripcion AS deposito, u.nombre AS usuario,
            ua.nombre AS anulada_por_nombre
       FROM compras co
       JOIN proveedores p ON p.id = co.proveedor_id
       JOIN depositos d ON d.id = co.deposito_id
       JOIN usuarios u ON u.id = co.usuario_id
       LEFT JOIN usuarios ua ON ua.id = co.anulada_por
      WHERE co.id = $1`,
    [id],
  );
  if (!compra) throw notFound('Compra no encontrada');
  const { rows: items } = await db.query(
    `SELECT cd.id, cd.producto_id, p.codigo, p.descripcion, cd.cantidad, cd.costo_unitario, cd.tasa_iva, cd.subtotal
       FROM compra_detalles cd JOIN productos p ON p.id = cd.producto_id
      WHERE cd.compra_id = $1 ORDER BY cd.id`,
    [id],
  );
  return { ...compra, items };
}

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const d = parse(compraSchema, req.body);
  const user = currentUser(req);
  verificarSinDuplicados(d.items);

  const compraId = await withTransaction(async (db) => {
    const prov = await one<{ activo: boolean }>(db, 'SELECT activo FROM proveedores WHERE id = $1', [d.proveedor_id]);
    if (!prov?.activo) throw notFound('Proveedor no encontrado o inactivo');

    const { rows: productos } = await db.query<{ id: number; tasa: number }>(
      `SELECT p.id, i.tasa FROM productos p JOIN impuestos i ON i.id = p.impuesto_id WHERE p.id = ANY($1::int[])`,
      [d.items.map((i) => i.producto_id)],
    );
    const tasas = new Map(productos.map((p) => [p.id, p.tasa]));
    const lineas = d.items.map((it) => {
      const tasa = tasas.get(it.producto_id);
      if (tasa === undefined) throw notFound(`Producto ${it.producto_id} no encontrado`);
      return { ...it, tasa, subtotal: it.cantidad * it.costo_unitario };
    });
    const t = totalizar(lineas);
    if (t.total <= 0) throw conflict('TOTAL_INVALIDO', 'El total de la compra debe ser mayor a cero');

    const compra = await one<{ id: number }>(
      db,
      `INSERT INTO compras (numero_factura, fecha, proveedor_id, deposito_id, condicion,
                            total_exenta, total_gravada5, total_gravada10, total_iva5, total_iva10, total, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        d.numero_factura.toUpperCase(),
        d.fecha,
        d.proveedor_id,
        d.deposito_id,
        d.condicion,
        t.total_exenta,
        t.total_gravada5,
        t.total_gravada10,
        t.total_iva5,
        t.total_iva10,
        t.total,
        user.id,
      ],
    );
    const id = compra!.id;

    for (const l of lineas) {
      await db.query(
        `INSERT INTO compra_detalles (compra_id, producto_id, cantidad, costo_unitario, tasa_iva, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, l.producto_id, l.cantidad, l.costo_unitario, l.tasa, l.subtotal],
      );
      await moverStock(db, {
        productoId: l.producto_id,
        depositoId: d.deposito_id,
        cantidad: l.cantidad,
        tipo: 'COMPRA',
        referenciaTipo: 'COMPRA',
        referenciaId: id,
        usuarioId: user.id,
      });
      if (d.actualizar_precio_compra) {
        await db.query('UPDATE productos SET precio_compra = $2, updated_at = now() WHERE id = $1', [l.producto_id, l.costo_unitario]);
      }
    }
    return id;
  });

  res.status(201).json(await obtenerCompra(pool, compraId));
});

const listQuery = paginationQuery.merge(rangoFechasQuery).extend({
  estado: z.enum(['ACTIVA', 'ANULADA']).optional(),
});

router.get('/', async (req, res) => {
  const { q, page, pageSize, desde, hasta, estado } = parse(listQuery, req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (q) add('(p.nombre ILIKE ? OR co.numero_factura ILIKE ?)', `%${q}%`);
  if (desde) add('co.fecha >= ?', desde);
  if (hasta) add('co.fecha <= ?', hasta);
  if (estado) add('co.estado = ?', estado);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { limit, offset } = paginar(page, pageSize);
  const [data, agg] = await Promise.all([
    pool.query(
      `SELECT co.id, co.fecha, co.numero_factura, p.nombre AS proveedor, co.condicion, co.total, co.estado, u.nombre AS usuario
         FROM compras co JOIN proveedores p ON p.id = co.proveedor_id JOIN usuarios u ON u.id = co.usuario_id
         ${whereSql} ORDER BY co.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: number; monto: number }>(
      `SELECT count(*)::int AS total, COALESCE(sum(co.total) FILTER (WHERE co.estado = 'ACTIVA'), 0)::bigint AS monto
         FROM compras co JOIN proveedores p ON p.id = co.proveedor_id ${whereSql}`,
      params,
    ),
  ]);
  res.json({ data: data.rows, total: agg.rows[0].total, page, pageSize, totales: { monto: agg.rows[0].monto } });
});

router.get('/:id', async (req, res) => {
  res.json(await obtenerCompra(pool, parseId(req.params)));
});

router.post('/:id/anular', requireRole('ADMIN'), async (req, res) => {
  const id = parseId(req.params);
  const { motivo } = parse(z.object({ motivo: requiredText(200, 3) }), req.body);
  const user = currentUser(req);
  await withTransaction(async (db) => {
    const compra = await one<{ estado: string; deposito_id: number }>(
      db,
      'SELECT estado, deposito_id FROM compras WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!compra) throw notFound('Compra no encontrada');
    if (compra.estado === 'ANULADA') throw conflict('YA_ANULADA', 'La compra ya está anulada');
    const { rows: items } = await db.query<{ producto_id: number; cantidad: number }>(
      'SELECT producto_id, cantidad FROM compra_detalles WHERE compra_id = $1',
      [id],
    );
    for (const it of items) {
      await moverStock(db, {
        productoId: it.producto_id,
        depositoId: compra.deposito_id,
        cantidad: -it.cantidad,
        tipo: 'ANULACION_COMPRA',
        referenciaTipo: 'COMPRA',
        referenciaId: id,
        usuarioId: user.id,
      });
    }
    await db.query(
      `UPDATE compras SET estado = 'ANULADA', anulada_at = now(), anulada_por = $2, motivo_anulacion = $3 WHERE id = $1`,
      [id, user.id, motivo],
    );
  });
  res.json(await obtenerCompra(pool, id));
});

export default router;
