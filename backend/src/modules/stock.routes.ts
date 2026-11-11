import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { paginar, paginationQuery, parse } from '../lib/validation';

const router = Router();

const stockQuery = paginationQuery.extend({
  deposito_id: z.coerce.number().int().positive().optional(),
  bajo_minimo: z.enum(['true', 'false']).optional(),
});

/** Existencias por producto y depósito, con valorización a costo. */
router.get('/', async (req, res) => {
  const { q, page, pageSize, deposito_id, bajo_minimo } = parse(stockQuery, req.query);
  const where: string[] = ['p.activo'];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(p.codigo ILIKE $${params.length} OR p.descripcion ILIKE $${params.length})`);
  }
  if (deposito_id) {
    params.push(deposito_id);
    where.push(`d.id = $${params.length}`);
  }
  if (bajo_minimo === 'true') where.push('COALESCE(s.cantidad, 0) <= p.stock_minimo');
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const from = `FROM productos p CROSS JOIN depositos d
                LEFT JOIN stock s ON s.producto_id = p.id AND s.deposito_id = d.id
                JOIN marcas m ON m.id = p.marca_id`;
  const { limit, offset } = paginar(page, pageSize);
  const [data, agg] = await Promise.all([
    pool.query(
      `SELECT p.id AS producto_id, p.codigo, p.descripcion, m.descripcion AS marca, d.id AS deposito_id, d.descripcion AS deposito,
              COALESCE(s.cantidad, 0) AS cantidad, p.stock_minimo, p.precio_compra, p.precio_venta,
              (COALESCE(s.cantidad, 0) * p.precio_compra)::bigint AS valor_costo
         ${from} ${whereSql}
        ORDER BY p.descripcion, d.descripcion LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: number; unidades: number; valor_costo: number; valor_venta: number }>(
      `SELECT count(*)::int AS total, COALESCE(sum(COALESCE(s.cantidad, 0)), 0)::bigint AS unidades,
              COALESCE(sum(COALESCE(s.cantidad, 0) * p.precio_compra), 0)::bigint AS valor_costo,
              COALESCE(sum(COALESCE(s.cantidad, 0) * p.precio_venta), 0)::bigint AS valor_venta
         ${from} ${whereSql}`,
      params,
    ),
  ]);
  const { total, ...totales } = agg.rows[0];
  res.json({ data: data.rows, total, page, pageSize, totales });
});

const kardexQuery = paginationQuery.extend({
  producto_id: z.coerce.number().int().positive(),
  deposito_id: z.coerce.number().int().positive().optional(),
});

/** Kardex: historial de movimientos de un producto. */
router.get('/movimientos', async (req, res) => {
  const { producto_id, deposito_id, page, pageSize } = parse(kardexQuery, req.query);
  const params: unknown[] = [producto_id];
  let where = 'WHERE sm.producto_id = $1';
  if (deposito_id) {
    params.push(deposito_id);
    where += ` AND sm.deposito_id = $2`;
  }
  const { limit, offset } = paginar(page, pageSize);
  const [data, total] = await Promise.all([
    pool.query(
      `SELECT sm.id, sm.created_at, sm.tipo, sm.cantidad, sm.saldo, sm.referencia_tipo, sm.referencia_id,
              d.descripcion AS deposito, u.nombre AS usuario
         FROM stock_movimientos sm
         JOIN depositos d ON d.id = sm.deposito_id
         JOIN usuarios u ON u.id = sm.usuario_id
         ${where}
        ORDER BY sm.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM stock_movimientos sm ${where}`, params),
  ]);
  res.json({ data: data.rows, total: total.rows[0].total, page, pageSize });
});

export default router;
