import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { one, pool } from '../db/pool';
import { badRequest, notFound } from '../lib/errors';
import { paginar, paginationQuery, parse, parseId, requiredText } from '../lib/validation';
import { currentUser, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireRole('ADMIN'));

const COLS = 'id, username, nombre, rol, activo, created_at, updated_at';

const baseSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Sólo letras, números, punto, guion y guion bajo'),
  nombre: requiredText(120),
  rol: z.enum(['ADMIN', 'CAJERO']),
  activo: z.boolean().optional(),
});
const createSchema = baseSchema.extend({ password: z.string().min(8, 'Mínimo 8 caracteres').max(100) });

router.get('/', async (req, res) => {
  const { q, page, pageSize } = parse(paginationQuery, req.query);
  const { limit, offset } = paginar(page, pageSize);
  const params = q ? [`%${q}%`] : [];
  const where = q ? 'WHERE username ILIKE $1 OR nombre ILIKE $1' : '';
  const [data, total] = await Promise.all([
    pool.query(`SELECT ${COLS} FROM usuarios ${where} ORDER BY username LIMIT ${limit} OFFSET ${offset}`, params),
    pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM usuarios ${where}`, params),
  ]);
  res.json({ data: data.rows, total: total.rows[0].total, page, pageSize });
});

router.post('/', async (req, res) => {
  const d = parse(createSchema, req.body);
  const row = await one(
    pool,
    `INSERT INTO usuarios (username, nombre, rol, activo, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING ${COLS}`,
    [d.username, d.nombre, d.rol, d.activo ?? true, await bcrypt.hash(d.password, 12)],
  );
  res.status(201).json(row);
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params);
  const d = parse(baseSchema, req.body);
  if (id === currentUser(req).id && (d.rol !== 'ADMIN' || d.activo === false)) {
    throw badRequest('No puede quitarse a sí mismo el rol de administrador ni desactivarse');
  }
  const row = await one(
    pool,
    `UPDATE usuarios SET username = $2, nombre = $3, rol = $4, activo = $5, updated_at = now() WHERE id = $1 RETURNING ${COLS}`,
    [id, d.username, d.nombre, d.rol, d.activo ?? true],
  );
  if (!row) throw notFound();
  res.json(row);
});

router.put('/:id/password', async (req, res) => {
  const id = parseId(req.params);
  const { password } = parse(z.object({ password: z.string().min(8, 'Mínimo 8 caracteres').max(100) }), req.body);
  const row = await one(pool, 'UPDATE usuarios SET password_hash = $2, updated_at = now() WHERE id = $1 RETURNING id', [
    id,
    await bcrypt.hash(password, 12),
  ]);
  if (!row) throw notFound();
  res.status(204).end();
});

export default router;
