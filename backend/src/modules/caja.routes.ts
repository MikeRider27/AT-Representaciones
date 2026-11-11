import { Router } from 'express';
import { z } from 'zod';
import { one, pool, withTransaction } from '../db/pool';
import { conflict, forbidden, notFound } from '../lib/errors';
import { medioPago, monto, montoPositivo, optionalText, paginar, paginationQuery, parse, parseId, rangoFechasQuery, requiredText } from '../lib/validation';
import { currentUser } from '../middleware/auth';
import { registrarMovimientoCaja, requerirSesionAbierta, resumenSesion, sesionAbiertaDe } from './caja.service';

const router = Router();

/** Sesión abierta del usuario actual con su resumen (null si no tiene caja abierta). */
router.get('/actual', async (req, res) => {
  const sesion = await sesionAbiertaDe(pool, currentUser(req).id);
  if (!sesion) {
    res.json(null);
    return;
  }
  res.json({ ...sesion, resumen: await resumenSesion(pool, sesion.id, sesion.monto_apertura) });
});

const aperturaSchema = z.object({
  caja_id: z.coerce.number().int().positive('Seleccione la caja'),
  monto_apertura: monto,
});

router.post('/apertura', async (req, res) => {
  const d = parse(aperturaSchema, req.body);
  const user = currentUser(req);
  const sesion = await withTransaction(async (db) => {
    if (await sesionAbiertaDe(db, user.id)) throw conflict('CAJA_YA_ABIERTA', 'Ya tiene una caja abierta');
    const ocupada = await one(db, `SELECT 1 FROM sesiones_caja WHERE caja_id = $1 AND estado = 'ABIERTA'`, [d.caja_id]);
    if (ocupada) throw conflict('CAJA_OCUPADA', 'La caja seleccionada ya está abierta por otro usuario');
    const caja = await one<{ activo: boolean }>(db, 'SELECT activo FROM cajas WHERE id = $1', [d.caja_id]);
    if (!caja?.activo) throw notFound('Caja no encontrada o inactiva');
    await db.query('INSERT INTO sesiones_caja (caja_id, usuario_id, monto_apertura) VALUES ($1, $2, $3)', [
      d.caja_id,
      user.id,
      d.monto_apertura,
    ]);
    return sesionAbiertaDe(db, user.id);
  });
  res.status(201).json(sesion);
});

const movimientoSchema = z.object({
  tipo: z.enum(['INGRESO', 'EGRESO']),
  medio_pago: medioPago.default('EFECTIVO'),
  monto: montoPositivo,
  descripcion: requiredText(200),
});

/** Ingresos/egresos manuales (gastos varios, retiros de efectivo, etc.). */
router.post('/movimientos', async (req, res) => {
  const d = parse(movimientoSchema, req.body);
  const user = currentUser(req);
  await withTransaction(async (db) => {
    const sesion = await requerirSesionAbierta(db, user.id);
    await registrarMovimientoCaja(db, {
      sesionId: sesion.id,
      tipo: d.tipo,
      concepto: d.tipo === 'INGRESO' ? 'INGRESO_MANUAL' : 'EGRESO_MANUAL',
      medioPago: d.medio_pago,
      monto: d.monto,
      descripcion: d.descripcion,
      usuarioId: user.id,
    });
  });
  res.status(201).end();
});

const cierreSchema = z.object({
  declarado_efectivo: monto,
  declarado_tarjeta: monto.default(0),
  declarado_cheque: monto.default(0),
  declarado_transferencia: monto.default(0),
  observacion: optionalText(300),
});

router.post('/sesiones/:id/cierre', async (req, res) => {
  const id = parseId(req.params);
  const d = parse(cierreSchema, req.body);
  const user = currentUser(req);
  await withTransaction(async (db) => {
    const sesion = await one<{ id: number; usuario_id: number; estado: string; monto_apertura: number }>(
      db,
      'SELECT id, usuario_id, estado, monto_apertura FROM sesiones_caja WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!sesion) throw notFound('Sesión de caja no encontrada');
    if (sesion.estado !== 'ABIERTA') throw conflict('CAJA_CERRADA', 'La caja ya fue cerrada');
    if (sesion.usuario_id !== user.id && user.rol !== 'ADMIN') throw forbidden('Sólo puede cerrar su propia caja');

    const resumen = await resumenSesion(db, id, sesion.monto_apertura);
    const totalDeclarado = d.declarado_efectivo + d.declarado_tarjeta + d.declarado_cheque + d.declarado_transferencia;
    await db.query(
      `UPDATE sesiones_caja
          SET estado = 'CERRADA', cerrada_at = now(), cerrada_por = $2,
              declarado_efectivo = $3, declarado_tarjeta = $4, declarado_cheque = $5, declarado_transferencia = $6,
              total_esperado = $7, total_declarado = $8, diferencia = $9, observacion = $10
        WHERE id = $1`,
      [
        id,
        user.id,
        d.declarado_efectivo,
        d.declarado_tarjeta,
        d.declarado_cheque,
        d.declarado_transferencia,
        resumen.total_esperado,
        totalDeclarado,
        totalDeclarado - resumen.total_esperado,
        d.observacion,
      ],
    );
  });
  res.json(await detalleSesion(id));
});

const listQuery = paginationQuery.merge(rangoFechasQuery).extend({
  estado: z.enum(['ABIERTA', 'CERRADA']).optional(),
});

router.get('/sesiones', async (req, res) => {
  const { page, pageSize, desde, hasta, estado } = parse(listQuery, req.query);
  const user = currentUser(req);
  const where: string[] = [];
  const params: unknown[] = [];
  if (user.rol !== 'ADMIN') {
    params.push(user.id);
    where.push(`s.usuario_id = $${params.length}`);
  }
  if (desde) {
    params.push(desde);
    where.push(`s.abierta_at::date >= $${params.length}`);
  }
  if (hasta) {
    params.push(hasta);
    where.push(`s.abierta_at::date <= $${params.length}`);
  }
  if (estado) {
    params.push(estado);
    where.push(`s.estado = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { limit, offset } = paginar(page, pageSize);
  const [data, total] = await Promise.all([
    pool.query(
      `SELECT s.id, c.descripcion AS caja, u.nombre AS usuario, s.estado, s.abierta_at, s.cerrada_at, s.monto_apertura,
              s.total_esperado, s.total_declarado, s.diferencia
         FROM sesiones_caja s JOIN cajas c ON c.id = s.caja_id JOIN usuarios u ON u.id = s.usuario_id
         ${whereSql} ORDER BY s.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM sesiones_caja s ${whereSql}`, params),
  ]);
  res.json({ data: data.rows, total: total.rows[0].total, page, pageSize });
});

async function detalleSesion(id: number) {
  const sesion = await one(
    pool,
    `SELECT s.*, c.descripcion AS caja, u.nombre AS usuario, uc.nombre AS cerrada_por_nombre
       FROM sesiones_caja s
       JOIN cajas c ON c.id = s.caja_id
       JOIN usuarios u ON u.id = s.usuario_id
       LEFT JOIN usuarios uc ON uc.id = s.cerrada_por
      WHERE s.id = $1`,
    [id],
  );
  if (!sesion) throw notFound('Sesión de caja no encontrada');
  const { rows: movimientos } = await pool.query(
    `SELECT m.id, m.created_at, m.tipo, m.concepto, m.medio_pago, m.monto, m.descripcion, m.referencia_tipo, m.referencia_id,
            m.anulado, u.nombre AS usuario
       FROM movimientos_caja m JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.sesion_caja_id = $1 ORDER BY m.id`,
    [id],
  );
  return { ...sesion, movimientos, resumen: await resumenSesion(pool, id, sesion.monto_apertura) };
}

router.get('/sesiones/:id', async (req, res) => {
  const id = parseId(req.params);
  const detalle = await detalleSesion(id);
  const user = currentUser(req);
  if (user.rol !== 'ADMIN' && detalle.usuario_id !== user.id) throw forbidden();
  res.json(detalle);
});

export default router;
