import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env';
import { one, pool } from '../db/pool';
import { AppError, badRequest } from '../lib/errors';
import { parse } from '../lib/validation';
import { authenticate, currentUser, SESSION_COOKIE, signToken } from '../middleware/auth';

const router = Router();

// Hash de referencia para que un usuario inexistente tarde lo mismo que uno válido (evita enumeración).
const DUMMY_HASH = bcrypt.hashSync('usuario-inexistente', 12);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'DEMASIADOS_INTENTOS', message: 'Demasiados intentos. Espere unos minutos.' } },
});

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: env.COOKIE_SECURE,
  path: '/',
  maxAge: env.JWT_EXPIRES_HOURS * 3600 * 1000,
});

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Ingrese el usuario'),
  password: z.string().min(1, 'Ingrese la contraseña'),
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = parse(loginSchema, req.body);
  const user = await one<{ id: number; username: string; nombre: string; rol: string; activo: boolean; password_hash: string }>(
    pool,
    'SELECT id, username, nombre, rol, activo, password_hash FROM usuarios WHERE lower(username) = lower($1)',
    [username],
  );
  const ok = user ? await bcrypt.compare(password, user.password_hash) : await bcrypt.compare(password, DUMMY_HASH);
  if (!user || !ok || !user.activo) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos');
  }
  res.cookie(SESSION_COOKIE, signToken(user.id), cookieOptions());
  res.json({ id: user.id, username: user.username, nombre: user.nombre, rol: user.rol });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
});

router.get('/me', authenticate, (req, res) => {
  res.json(currentUser(req));
});

const passwordSchema = z.object({
  actual: z.string().min(1),
  nueva: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres').max(100),
});

router.put('/password', authenticate, async (req, res) => {
  const { actual, nueva } = parse(passwordSchema, req.body);
  const user = currentUser(req);
  const row = await one<{ password_hash: string }>(pool, 'SELECT password_hash FROM usuarios WHERE id = $1', [user.id]);
  if (!row || !(await bcrypt.compare(actual, row.password_hash))) throw badRequest('La contraseña actual es incorrecta');
  await pool.query('UPDATE usuarios SET password_hash = $2, updated_at = now() WHERE id = $1', [user.id, await bcrypt.hash(nueva, 12)]);
  res.status(204).end();
});

export default router;
