import { Router } from 'express';
import { z } from 'zod';
import { one, pool } from '../db/pool';
import { requireRole, type Rol } from '../middleware/auth';
import { notFound } from './errors';
import { paginar, paginationQuery, parse, parseId } from './validation';

export interface CrudConfig {
  /** Nombre de tabla (constante, nunca proviene del cliente). */
  table: string;
  /** Columnas devueltas en listados y detalle. */
  columns: string[];
  searchColumns: string[];
  orderBy: string;
  schema: z.ZodObject<z.ZodRawShape>;
  /** Si es true, DELETE marca `activo = false` en lugar de borrar. */
  softDelete?: boolean;
  hasUpdatedAt?: boolean;
  writeRoles?: Rol[];
}

const listQuery = paginationQuery.extend({
  activo: z.enum(['true', 'false']).optional(),
});

/** Router REST estándar (listar, ver, crear, modificar, eliminar) para tablas maestras simples. */
export function crudRouter(cfg: CrudConfig): Router {
  const router = Router();
  const cols = cfg.columns.join(', ');
  const write = cfg.writeRoles ? [requireRole(...cfg.writeRoles)] : [];

  router.get('/', async (req, res) => {
    const { q, page, pageSize, activo } = parse(listQuery, req.query);
    const where: string[] = [];
    const params: unknown[] = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(${cfg.searchColumns.map((c) => `${c}::text ILIKE $${params.length}`).join(' OR ')})`);
    }
    if (activo) {
      params.push(activo === 'true');
      where.push(`activo = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { limit, offset } = paginar(page, pageSize);
    const [data, total] = await Promise.all([
      pool.query(`SELECT ${cols} FROM ${cfg.table} ${whereSql} ORDER BY ${cfg.orderBy} LIMIT ${limit} OFFSET ${offset}`, params),
      pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM ${cfg.table} ${whereSql}`, params),
    ]);
    res.json({ data: data.rows, total: total.rows[0].total, page, pageSize });
  });

  router.get('/:id', async (req, res) => {
    const row = await one(pool, `SELECT ${cols} FROM ${cfg.table} WHERE id = $1`, [parseId(req.params)]);
    if (!row) throw notFound();
    res.json(row);
  });

  router.post('/', ...write, async (req, res) => {
    const data = parse(cfg.schema, req.body) as Record<string, unknown>;
    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    const row = await one(
      pool,
      `INSERT INTO ${cfg.table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${cols}`,
      keys.map((k) => data[k]),
    );
    res.status(201).json(row);
  });

  router.put('/:id', ...write, async (req, res) => {
    const id = parseId(req.params);
    const data = parse(cfg.schema.partial(), req.body) as Record<string, unknown>;
    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    if (cfg.hasUpdatedAt) sets.push('updated_at = now()');
    if (!sets.length) {
      const current = await one(pool, `SELECT ${cols} FROM ${cfg.table} WHERE id = $1`, [id]);
      if (!current) throw notFound();
      res.json(current);
      return;
    }
    const row = await one(
      pool,
      `UPDATE ${cfg.table} SET ${sets.join(', ')} WHERE id = $1 RETURNING ${cols}`,
      [id, ...keys.map((k) => data[k])],
    );
    if (!row) throw notFound();
    res.json(row);
  });

  router.delete('/:id', ...write, async (req, res) => {
    const id = parseId(req.params);
    const sql = cfg.softDelete
      ? `UPDATE ${cfg.table} SET activo = false WHERE id = $1 RETURNING id`
      : `DELETE FROM ${cfg.table} WHERE id = $1 RETURNING id`;
    const row = await one(pool, sql, [id]);
    if (!row) throw notFound();
    res.status(204).end();
  });

  return router;
}
