import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { one, pool } from '../db/pool';
import { forbidden, unauthorized } from '../lib/errors';

export type Rol = 'ADMIN' | 'CAJERO';

export interface AuthUser {
  id: number;
  username: string;
  nombre: string;
  rol: Rol;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const SESSION_COOKIE = 'at_session';

export function signToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_HOURS * 3600 });
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token: string | undefined =
    req.cookies?.[SESSION_COOKIE] ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
  if (!token) throw unauthorized();

  let userId: number;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    userId = Number(payload.sub);
  } catch {
    throw unauthorized();
  }

  // Se consulta en cada request para que un usuario desactivado pierda el acceso de inmediato.
  const user = await one<AuthUser & { activo: boolean }>(
    pool,
    'SELECT id, username, nombre, rol, activo FROM usuarios WHERE id = $1',
    [userId],
  );
  if (!user || !user.activo) throw unauthorized();

  req.user = { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol };
  next();
}

export function requireRole(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.rol)) throw forbidden();
    next();
  };
}

/** Usuario autenticado (lanza si no existe: sólo usar detrás de `authenticate`). */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
