import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { crudRouter } from '../lib/crud';
import { optionalText, requiredText } from '../lib/validation';

const descripcionSchema = z.object({
  descripcion: requiredText(80).transform((v) => v.toUpperCase()),
  activo: z.boolean().optional(),
});

const simple = (table: string) =>
  crudRouter({
    table,
    columns: ['id', 'descripcion', 'activo', 'created_at'],
    searchColumns: ['descripcion'],
    orderBy: 'descripcion',
    schema: descripcionSchema,
    writeRoles: ['ADMIN'],
  });

const personaSchema = z.object({
  nombre: requiredText(120).transform((v) => v.toUpperCase()),
  ruc: requiredText(20).regex(/^[0-9A-Za-z-]+$/, 'RUC/CI inválido'),
  telefono: optionalText(60),
  direccion: optionalText(200),
  email: z
    .string()
    .trim()
    .email('Correo inválido')
    .max(120)
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  activo: z.boolean().optional(),
});

const persona = (table: string) =>
  crudRouter({
    table,
    columns: ['id', 'nombre', 'ruc', 'telefono', 'direccion', 'email', 'activo', 'created_at', 'updated_at'],
    searchColumns: ['nombre', 'ruc', 'id'],
    orderBy: 'nombre',
    schema: personaSchema,
    softDelete: true,
    hasUpdatedAt: true,
  });

const router = Router();

router.use('/marcas', simple('marcas'));
router.use('/depositos', simple('depositos'));
router.use('/cajas', simple('cajas'));
router.use('/operadoras', simple('operadoras'));
router.use('/tipos-carga', simple('tipos_carga'));
router.use('/clientes', persona('clientes'));
router.use('/proveedores', persona('proveedores'));

router.get('/impuestos', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, descripcion, tasa FROM impuestos ORDER BY tasa DESC');
  res.json({ data: rows, total: rows.length, page: 1, pageSize: rows.length });
});

export default router;
