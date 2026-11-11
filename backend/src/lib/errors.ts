export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'SOLICITUD_INVALIDA', message, details);
export const unauthorized = (message = 'Sesión no válida o expirada') =>
  new AppError(401, 'NO_AUTENTICADO', message);
export const forbidden = (message = 'No tiene permisos para esta operación') =>
  new AppError(403, 'SIN_PERMISO', message);
export const notFound = (message = 'Registro no encontrado') => new AppError(404, 'NO_ENCONTRADO', message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
