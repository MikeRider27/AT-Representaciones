import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

interface PgError {
  code?: string;
  constraint?: string;
  detail?: string;
}

function fromPostgres(err: PgError): AppError | null {
  switch (err.code) {
    case '23505':
      return new AppError(409, 'DUPLICADO', 'Ya existe un registro con esos datos', { constraint: err.constraint });
    case '23503':
      return new AppError(409, 'EN_USO', 'El registro está relacionado con otros datos y no puede modificarse/eliminarse', {
        constraint: err.constraint,
      });
    case '23514':
      return new AppError(422, 'RESTRICCION', 'Los datos no cumplen las reglas del sistema', { constraint: err.constraint });
    case '22P02':
    case '22003':
      return new AppError(400, 'SOLICITUD_INVALIDA', 'Valor numérico inválido');
    default:
      return null;
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'RUTA_NO_ENCONTRADA', message: `No existe ${req.method} ${req.path}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let appErr: AppError | null = null;

  if (err instanceof AppError) appErr = err;
  else if (err instanceof MulterError)
    appErr = new AppError(400, 'ARCHIVO_INVALIDO', err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera 2 MB' : err.message);
  else if (err && typeof err === 'object' && 'code' in err) appErr = fromPostgres(err as PgError);
  else if (err && typeof err === 'object' && (err as { type?: string }).type === 'entity.parse.failed')
    appErr = new AppError(400, 'JSON_INVALIDO', 'El cuerpo de la solicitud no es JSON válido');

  if (!appErr) {
    req.log?.error({ err }, 'Error no controlado');
    if (!req.log) logger.error({ err }, 'Error no controlado');
    res.status(500).json({ error: { code: 'ERROR_INTERNO', message: 'Ocurrió un error inesperado' } });
    return;
  }

  if (appErr.status >= 500) req.log?.error({ err }, appErr.message);
  res.status(appErr.status).json({ error: { code: appErr.code, message: appErr.message, details: appErr.details } });
}
