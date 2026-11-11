import { z } from 'zod';
import { badRequest } from './errors';

export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
    throw badRequest(issues[0] ? `${issues[0].campo ? issues[0].campo + ': ' : ''}${issues[0].mensaje}` : 'Datos inválidos', issues);
  }
  return result.data;
}

export const idParam = z.object({ id: z.coerce.number().int().positive() });
export const parseId = (params: unknown) => parse(idParam, params).id;

/** Texto opcional: '' se guarda como null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const requiredText = (max: number, min = 1) => z.string().trim().min(min, 'Campo obligatorio').max(max);

export const monto = z.coerce.number().int('Debe ser un monto entero').nonnegative();
export const montoPositivo = z.coerce.number().int('Debe ser un monto entero').positive('Debe ser mayor a cero');

export const medioPago = z.enum(['EFECTIVO', 'TARJETA', 'CHEQUE', 'TRANSFERENCIA']);

export const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');

export const paginationQuery = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(25),
});

export const rangoFechasQuery = z.object({
  desde: fechaISO.optional(),
  hasta: fechaISO.optional(),
});

export function paginar(page: number, pageSize: number) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}
