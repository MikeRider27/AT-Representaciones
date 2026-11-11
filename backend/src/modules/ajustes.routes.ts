import { Router } from 'express';
import { z } from 'zod';
import { one, pool, withTransaction } from '../db/pool';
import { notFound } from '../lib/errors';
import { paginar, paginationQuery, parse, parseId, rangoFechasQuery, requiredText } from '../lib/validation';
import { currentUser, requireRole } from '../middleware/auth';
import { moverStock, verificarSinDuplicados } from './stock.service';

const router = Router();

const ajusteSchema = z.object({
  tipo: z.enum(['ALTA', 'BAJA']),
  deposito_id: z.coerce.number().int().positive('Seleccione el depósito'),
  observacion: requiredText(200, 3),
  items: z
    .array(
      z.object({
        producto_id: z.coerce.number().int().positive(),
        cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a cero'),
      }),
    )
    .min(1, 'Agregue al menos un producto'),
});

async function obtenerAjuste(id: number) {
  const ajuste = await one(
    pool,
    `SELECT a.*, d.descripcion AS deposito, u.nombre AS usuario
       FROM ajustes a JOIN depositos d ON d.id = a.deposito_id JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.id = $1`,
    [id],
  );
  if (!ajuste) throw notFound('Ajuste no encontrado');
  const { rows: items } = await pool.query(
    `SELECT ad.id, ad.producto_id, p.codigo, p.descripcion, ad.cantidad
       FROM ajuste_detalles ad JOIN productos p ON p.id = ad.producto_id
      WHERE ad.ajuste_id = $1 ORDER BY ad.id`,
    [id],
  );
  return { ...ajuste, items };
}

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const d = parse(ajusteSchema, req.body);
  const user = currentUser(req);
  verificarSinDuplicados(d.items);
  const id = await withTransaction(async (db) => {
    const row = await one<{ id: number }>(
      db,
      'INSERT INTO ajustes (tipo, deposito_id, observacion, usuario_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [d.tipo, d.deposito_id, d.observacion, user.id],
    );
    for (const it of d.items) {
      await db.query('INSERT INTO ajuste_detalles (ajuste_id, producto_id, cantidad) VALUES ($1, $2, $3)', [
        row!.id,
        it.producto_id,
        it.cantidad,
      ]);
      await moverStock(db, {
        productoId: it.producto_id,
        depositoId: d.deposito_id,
        cantidad: d.tipo === 'ALTA' ? it.cantidad : -it.cantidad,
        tipo: d.tipo === 'ALTA' ? 'AJUSTE_ALTA' : 'AJUSTE_BAJA',
        referenciaTipo: 'AJUSTE',
        referenciaId: row!.id,
        usuarioId: user.id,
      });
    }
    return row!.id;
  });
  res.status(201).json(await obtenerAjuste(id));
});

router.get('/', async (req, res) => {
  const { page, pageSize, desde, hasta } = parse(paginationQuery.merge(rangoFechasQuery), req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  if (desde) {
    params.push(desde);
    where.push(`a.created_at::date >= $${params.length}`);
  }
  if (hasta) {
    params.push(hasta);
    where.push(`a.created_at::date <= $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { limit, offset } = paginar(page, pageSize);
  const [data, total] = await Promise.all([
    pool.query(
      `SELECT a.id, a.created_at, a.tipo, a.observacion, d.descripcion AS deposito, u.nombre AS usuario,
              (SELECT count(*) FROM ajuste_detalles ad WHERE ad.ajuste_id = a.id)::int AS items
         FROM ajustes a JOIN depositos d ON d.id = a.deposito_id JOIN usuarios u ON u.id = a.usuario_id
         ${whereSql} ORDER BY a.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM ajustes a ${whereSql}`, params),
  ]);
  res.json({ data: data.rows, total: total.rows[0].total, page, pageSize });
});

router.get('/:id', async (req, res) => {
  res.json(await obtenerAjuste(parseId(req.params)));
});

export default router;
