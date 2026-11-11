import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { one, pool } from '../db/pool';
import { badRequest, notFound } from '../lib/errors';
import { monto, paginar, paginationQuery, parse, parseId, requiredText } from '../lib/validation';
import { requireRole } from '../middleware/auth';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(badRequest('Formato de imagen no permitido (PNG, JPG, WEBP o GIF)'));
  },
});

const SELECT = `
  SELECT p.id, p.codigo, p.descripcion, p.marca_id, m.descripcion AS marca, p.impuesto_id, i.tasa AS tasa_iva,
         p.precio_compra, p.precio_venta, p.stock_minimo, p.activo, (p.imagen IS NOT NULL) AS tiene_imagen,
         COALESCE((SELECT sum(s.cantidad) FROM stock s WHERE s.producto_id = p.id), 0)::int AS stock_total,
         p.created_at, p.updated_at
    FROM productos p
    JOIN marcas m ON m.id = p.marca_id
    JOIN impuestos i ON i.id = p.impuesto_id`;

const listQuery = paginationQuery.extend({
  activo: z.enum(['true', 'false']).optional(),
  marca_id: z.coerce.number().int().positive().optional(),
  deposito_id: z.coerce.number().int().positive().optional(),
});

router.get('/', async (req, res) => {
  const { q, page, pageSize, activo, marca_id, deposito_id } = parse(listQuery, req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(p.codigo ILIKE $${params.length} OR p.descripcion ILIKE $${params.length} OR m.descripcion ILIKE $${params.length})`);
  }
  if (activo) {
    params.push(activo === 'true');
    where.push(`p.activo = $${params.length}`);
  }
  if (marca_id) {
    params.push(marca_id);
    where.push(`p.marca_id = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  // Stock en el depósito indicado (para pickers de venta/ajuste)
  let stockDeposito = '';
  if (deposito_id) {
    params.push(deposito_id);
    stockDeposito = `, COALESCE((SELECT s.cantidad FROM stock s WHERE s.producto_id = x.id AND s.deposito_id = $${params.length}), 0)::int AS stock_deposito`;
  }
  const { limit, offset } = paginar(page, pageSize);
  const [data, total] = await Promise.all([
    pool.query(`SELECT x.* ${stockDeposito} FROM (${SELECT} ${whereSql}) x ORDER BY x.descripcion LIMIT ${limit} OFFSET ${offset}`, params),
    pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM productos p JOIN marcas m ON m.id = p.marca_id ${whereSql}`,
      deposito_id ? params.slice(0, -1) : params,
    ),
  ]);
  res.json({ data: data.rows, total: total.rows[0].total, page, pageSize });
});

router.get('/:id', async (req, res) => {
  const row = await one(pool, `${SELECT} WHERE p.id = $1`, [parseId(req.params)]);
  if (!row) throw notFound('Producto no encontrado');
  const { rows: stock } = await pool.query(
    `SELECT d.id AS deposito_id, d.descripcion AS deposito, COALESCE(s.cantidad, 0) AS cantidad
       FROM depositos d LEFT JOIN stock s ON s.deposito_id = d.id AND s.producto_id = $1
      ORDER BY d.descripcion`,
    [row.id],
  );
  res.json({ ...row, stock });
});

router.get('/:id/imagen', async (req, res) => {
  const row = await one<{ imagen: Buffer | null; imagen_mime: string | null }>(
    pool,
    'SELECT imagen, imagen_mime FROM productos WHERE id = $1',
    [parseId(req.params)],
  );
  if (!row?.imagen) throw notFound('El producto no tiene imagen');
  res.setHeader('Content-Type', row.imagen_mime ?? 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(row.imagen);
});

const schema = z
  .object({
    codigo: requiredText(50).transform((v) => v.toUpperCase()),
    descripcion: requiredText(150).transform((v) => v.toUpperCase()),
    marca_id: z.coerce.number().int().positive('Seleccione una marca'),
    impuesto_id: z.coerce.number().int().positive('Seleccione el impuesto'),
    precio_compra: monto,
    precio_venta: monto,
    stock_minimo: z.coerce.number().int().nonnegative().default(0),
    activo: z.boolean().optional(),
  })
  .refine((d) => d.precio_venta >= d.precio_compra, {
    message: 'El precio de venta no puede ser menor al precio de compra',
    path: ['precio_venta'],
  });

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const d = parse(schema, req.body);
  const row = await one<{ id: number }>(
    pool,
    `INSERT INTO productos (codigo, descripcion, marca_id, impuesto_id, precio_compra, precio_venta, stock_minimo, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [d.codigo, d.descripcion, d.marca_id, d.impuesto_id, d.precio_compra, d.precio_venta, d.stock_minimo, d.activo ?? true],
  );
  res.status(201).json(await one(pool, `${SELECT} WHERE p.id = $1`, [row!.id]));
});

router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = parseId(req.params);
  const d = parse(schema, req.body);
  const row = await one(
    pool,
    `UPDATE productos SET codigo=$2, descripcion=$3, marca_id=$4, impuesto_id=$5, precio_compra=$6, precio_venta=$7,
            stock_minimo=$8, activo=$9, updated_at=now()
      WHERE id = $1 RETURNING id`,
    [id, d.codigo, d.descripcion, d.marca_id, d.impuesto_id, d.precio_compra, d.precio_venta, d.stock_minimo, d.activo ?? true],
  );
  if (!row) throw notFound('Producto no encontrado');
  res.json(await one(pool, `${SELECT} WHERE p.id = $1`, [id]));
});

router.put('/:id/imagen', requireRole('ADMIN'), upload.single('imagen'), async (req, res) => {
  const id = parseId(req.params);
  if (!req.file) throw badRequest('Adjunte una imagen en el campo "imagen"');
  const row = await one(pool, 'UPDATE productos SET imagen = $2, imagen_mime = $3, updated_at = now() WHERE id = $1 RETURNING id', [
    id,
    req.file.buffer,
    req.file.mimetype,
  ]);
  if (!row) throw notFound('Producto no encontrado');
  res.status(204).end();
});

router.delete('/:id/imagen', requireRole('ADMIN'), async (req, res) => {
  await pool.query('UPDATE productos SET imagen = NULL, imagen_mime = NULL, updated_at = now() WHERE id = $1', [parseId(req.params)]);
  res.status(204).end();
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const row = await one(pool, 'UPDATE productos SET activo = false, updated_at = now() WHERE id = $1 RETURNING id', [parseId(req.params)]);
  if (!row) throw notFound('Producto no encontrado');
  res.status(204).end();
});

export default router;
