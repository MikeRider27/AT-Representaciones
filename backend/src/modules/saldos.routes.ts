import { Router } from 'express';
import { z } from 'zod';
import { one, pool, withTransaction } from '../db/pool';
import { conflict, notFound } from '../lib/errors';
import { comision as calcularComision } from '../lib/fiscal';
import { monto, montoPositivo, optionalText, paginar, paginationQuery, parse, parseId, rangoFechasQuery, requiredText } from '../lib/validation';
import { currentUser, requireRole } from '../middleware/auth';
import { registrarMovimientoCaja, requerirSesionAbierta, revertirMovimientosCaja } from './caja.service';
import { obtenerConfiguracion } from './configuracion.routes';
import { moverSaldo } from './saldos.service';

const router = Router();
const cuenta = z.enum(['RECARGA', 'BILLETERA']);

function filtroFechas(campo: string, desde?: string, hasta?: string, params: unknown[] = []) {
  const where: string[] = [];
  if (desde) {
    params.push(desde);
    where.push(`${campo}::date >= $${params.length}`);
  }
  if (hasta) {
    params.push(hasta);
    where.push(`${campo}::date <= $${params.length}`);
  }
  return where;
}

// ------------------------------------------------------------ saldos --------
/** Saldo actual de cada operadora (recargas y billetera). */
router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT o.id AS operadora_id, o.descripcion AS operadora,
            COALESCE(max(s.saldo) FILTER (WHERE s.cuenta = 'RECARGA'), 0)::bigint   AS saldo_recarga,
            COALESCE(max(s.saldo) FILTER (WHERE s.cuenta = 'BILLETERA'), 0)::bigint AS saldo_billetera
       FROM operadoras o LEFT JOIN saldos_operadora s ON s.operadora_id = o.id
      WHERE o.activo
      GROUP BY o.id ORDER BY o.descripcion`,
  );
  res.json(rows);
});

const cargaSchema = z.object({
  operadora_id: z.coerce.number().int().positive('Seleccione la operadora'),
  cuenta,
  monto: montoPositivo,
  observacion: optionalText(200),
});

/** Compra de saldo (cuenta RECARGA) o carga de billetera (cuenta BILLETERA). */
router.post('/cargas', requireRole('ADMIN'), async (req, res) => {
  const d = parse(cargaSchema, req.body);
  const user = currentUser(req);
  const saldo = await withTransaction((db) =>
    moverSaldo(db, {
      operadoraId: d.operadora_id,
      cuenta: d.cuenta,
      monto: d.monto,
      tipo: d.cuenta === 'RECARGA' ? 'COMPRA_SALDO' : 'CARGA_BILLETERA',
      observacion: d.observacion,
      usuarioId: user.id,
    }),
  );
  res.status(201).json({ saldo });
});

const movQuery = paginationQuery.merge(rangoFechasQuery).extend({
  operadora_id: z.coerce.number().int().positive().optional(),
  cuenta: cuenta.optional(),
  tipo: z.string().max(30).optional(),
});

router.get('/movimientos', async (req, res) => {
  const { page, pageSize, desde, hasta, operadora_id, cuenta: c, tipo } = parse(movQuery, req.query);
  const params: unknown[] = [];
  const where = filtroFechas('sm.created_at', desde, hasta, params);
  if (operadora_id) {
    params.push(operadora_id);
    where.push(`sm.operadora_id = $${params.length}`);
  }
  if (c) {
    params.push(c);
    where.push(`sm.cuenta = $${params.length}`);
  }
  if (tipo) {
    params.push(tipo);
    where.push(`sm.tipo = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { limit, offset } = paginar(page, pageSize);
  const [data, total] = await Promise.all([
    pool.query(
      `SELECT sm.id, sm.created_at, o.descripcion AS operadora, sm.cuenta, sm.tipo, sm.monto, sm.saldo_resultante,
              sm.referencia_tipo, sm.referencia_id, sm.observacion, u.nombre AS usuario
         FROM saldo_movimientos sm JOIN operadoras o ON o.id = sm.operadora_id JOIN usuarios u ON u.id = sm.usuario_id
         ${whereSql} ORDER BY sm.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM saldo_movimientos sm ${whereSql}`, params),
  ]);
  res.json({ data: data.rows, total: total.rows[0].total, page, pageSize });
});

// ------------------------------------------------------ venta de saldo ------
const ventaSaldoSchema = z.object({
  operadora_id: z.coerce.number().int().positive('Seleccione la operadora'),
  tipo_carga_id: z.coerce.number().int().positive('Seleccione el tipo de carga'),
  numero_destino: z.string().trim().regex(/^\d{6,15}$/, 'Número de línea inválido'),
  monto: montoPositivo,
});

router.post('/ventas', async (req, res) => {
  const d = parse(ventaSaldoSchema, req.body);
  const user = currentUser(req);
  const id = await withTransaction(async (db) => {
    const sesion = await requerirSesionAbierta(db, user.id);
    const venta = await one<{ id: number }>(
      db,
      `INSERT INTO ventas_saldo (operadora_id, tipo_carga_id, numero_destino, monto, sesion_caja_id, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [d.operadora_id, d.tipo_carga_id, d.numero_destino, d.monto, sesion.id, user.id],
    );
    await moverSaldo(db, {
      operadoraId: d.operadora_id,
      cuenta: 'RECARGA',
      monto: -d.monto,
      tipo: 'VENTA_SALDO',
      referenciaTipo: 'VENTA_SALDO',
      referenciaId: venta!.id,
      usuarioId: user.id,
    });
    await registrarMovimientoCaja(db, {
      sesionId: sesion.id,
      tipo: 'INGRESO',
      concepto: 'VENTA_SALDO',
      monto: d.monto,
      descripcion: `Recarga ${d.numero_destino}`,
      referenciaTipo: 'VENTA_SALDO',
      referenciaId: venta!.id,
      usuarioId: user.id,
    });
    return venta!.id;
  });
  res.status(201).json(await one(pool, 'SELECT * FROM ventas_saldo WHERE id = $1', [id]));
});

router.get('/ventas', async (req, res) => {
  const { q, page, pageSize, desde, hasta } = parse(paginationQuery.merge(rangoFechasQuery), req.query);
  const params: unknown[] = [];
  const where = filtroFechas('v.created_at', desde, hasta, params);
  if (q) {
    params.push(`%${q}%`);
    where.push(`v.numero_destino ILIKE $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { limit, offset } = paginar(page, pageSize);
  const [data, agg] = await Promise.all([
    pool.query(
      `SELECT v.id, v.created_at, o.descripcion AS operadora, t.descripcion AS tipo_carga, v.numero_destino, v.monto,
              v.estado, u.nombre AS usuario
         FROM ventas_saldo v
         JOIN operadoras o ON o.id = v.operadora_id
         JOIN tipos_carga t ON t.id = v.tipo_carga_id
         JOIN usuarios u ON u.id = v.usuario_id
         ${whereSql} ORDER BY v.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: number; monto: number }>(
      `SELECT count(*)::int AS total, COALESCE(sum(v.monto) FILTER (WHERE v.estado = 'ACTIVA'), 0)::bigint AS monto
         FROM ventas_saldo v ${whereSql}`,
      params,
    ),
  ]);
  res.json({ data: data.rows, total: agg.rows[0].total, page, pageSize, totales: { monto: agg.rows[0].monto } });
});

router.post('/ventas/:id/anular', requireRole('ADMIN'), async (req, res) => {
  const id = parseId(req.params);
  const user = currentUser(req);
  await withTransaction(async (db) => {
    const v = await one<{ estado: string; operadora_id: number; monto: number }>(
      db,
      'SELECT estado, operadora_id, monto FROM ventas_saldo WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!v) throw notFound('Venta de saldo no encontrada');
    if (v.estado === 'ANULADA') throw conflict('YA_ANULADA', 'La venta de saldo ya está anulada');
    await moverSaldo(db, {
      operadoraId: v.operadora_id,
      cuenta: 'RECARGA',
      monto: v.monto,
      tipo: 'ANULACION_VENTA_SALDO',
      referenciaTipo: 'VENTA_SALDO',
      referenciaId: id,
      usuarioId: user.id,
    });
    await revertirMovimientosCaja(db, 'VENTA_SALDO', id, user.id, `Anulación venta de saldo #${id}`);
    await db.query(`UPDATE ventas_saldo SET estado = 'ANULADA', anulada_at = now(), anulada_por = $2 WHERE id = $1`, [id, user.id]);
  });
  res.status(204).end();
});

// --------------------------------------------------------- billetera --------
const billeteraSchema = z.object({
  operadora_id: z.coerce.number().int().positive('Seleccione la operadora'),
  tipo: z.enum(['ENVIO', 'RETIRO', 'CARGA', 'PAGO_SERVICIO']),
  nro_boleta: optionalText(40),
  nro_envia: optionalText(20),
  nro_recibe: optionalText(20),
  nombre: optionalText(120),
  ci: optionalText(20),
  servicio: optionalText(120),
  referencia: optionalText(100),
  monto: montoPositivo,
  /** Sólo se usa para tipos distintos de ENVIO (en ENVIO se calcula con el % configurado). */
  comision: monto.default(0),
});

/**
 * Efecto de cada tipo de operación:
 * - ENVIO / CARGA / PAGO_SERVICIO: el cliente entrega efectivo (monto + comisión) y se debita la billetera.
 * - RETIRO: se entrega efectivo al cliente y se acredita la billetera.
 */
router.post('/billetera', async (req, res) => {
  const d = parse(billeteraSchema, req.body);
  const user = currentUser(req);
  if (d.tipo === 'PAGO_SERVICIO' && !d.servicio) throw conflict('DATOS_INCOMPLETOS', 'Indique el servicio a pagar');
  if ((d.tipo === 'ENVIO' || d.tipo === 'CARGA') && !d.nro_recibe) {
    throw conflict('DATOS_INCOMPLETOS', 'Indique el número que recibe');
  }

  const id = await withTransaction(async (db) => {
    const sesion = await requerirSesionAbierta(db, user.id);
    const cfg = await obtenerConfiguracion(db);
    const comision = d.tipo === 'ENVIO' ? calcularComision(d.monto, cfg.comision_envio_pct) : d.tipo === 'RETIRO' ? 0 : d.comision;
    const total = d.monto + comision;
    const retiro = d.tipo === 'RETIRO';

    const mov = await one<{ id: number }>(
      db,
      `INSERT INTO movimientos_billetera (operadora_id, tipo, nro_boleta, nro_envia, nro_recibe, nombre, ci, servicio, referencia,
                                          monto, comision, total, sesion_caja_id, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
      [d.operadora_id, d.tipo, d.nro_boleta, d.nro_envia, d.nro_recibe, d.nombre, d.ci, d.servicio, d.referencia, d.monto, comision, total, sesion.id, user.id],
    );
    await moverSaldo(db, {
      operadoraId: d.operadora_id,
      cuenta: 'BILLETERA',
      monto: retiro ? d.monto : -d.monto,
      tipo: d.tipo,
      referenciaTipo: 'BILLETERA',
      referenciaId: mov!.id,
      usuarioId: user.id,
    });
    await registrarMovimientoCaja(db, {
      sesionId: sesion.id,
      tipo: retiro ? 'EGRESO' : 'INGRESO',
      concepto: `BILLETERA_${d.tipo}`,
      monto: retiro ? d.monto : total,
      descripcion: `Billetera ${d.tipo.replace('_', ' ').toLowerCase()} #${mov!.id}`,
      referenciaTipo: 'BILLETERA',
      referenciaId: mov!.id,
      usuarioId: user.id,
    });
    return mov!.id;
  });
  res.status(201).json(await one(pool, 'SELECT * FROM movimientos_billetera WHERE id = $1', [id]));
});

const billeteraQuery = paginationQuery.merge(rangoFechasQuery).extend({
  tipo: z.enum(['ENVIO', 'RETIRO', 'CARGA', 'PAGO_SERVICIO']).optional(),
  operadora_id: z.coerce.number().int().positive().optional(),
});

router.get('/billetera', async (req, res) => {
  const { q, page, pageSize, desde, hasta, tipo, operadora_id } = parse(billeteraQuery, req.query);
  const params: unknown[] = [];
  const where = filtroFechas('b.created_at', desde, hasta, params);
  if (q) {
    params.push(`%${q}%`);
    const n = params.length;
    where.push(`(b.nombre ILIKE $${n} OR b.ci ILIKE $${n} OR b.nro_recibe ILIKE $${n} OR b.nro_envia ILIKE $${n} OR b.nro_boleta ILIKE $${n})`);
  }
  if (tipo) {
    params.push(tipo);
    where.push(`b.tipo = $${params.length}`);
  }
  if (operadora_id) {
    params.push(operadora_id);
    where.push(`b.operadora_id = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { limit, offset } = paginar(page, pageSize);
  const [data, agg] = await Promise.all([
    pool.query(
      `SELECT b.id, b.created_at, o.descripcion AS operadora, b.tipo, b.nro_boleta, b.nro_envia, b.nro_recibe, b.nombre, b.ci,
              b.servicio, b.monto, b.comision, b.total, b.estado, u.nombre AS usuario
         FROM movimientos_billetera b JOIN operadoras o ON o.id = b.operadora_id JOIN usuarios u ON u.id = b.usuario_id
         ${whereSql} ORDER BY b.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: number; comisiones: number }>(
      `SELECT count(*)::int AS total, COALESCE(sum(b.comision) FILTER (WHERE b.estado = 'ACTIVO'), 0)::bigint AS comisiones
         FROM movimientos_billetera b ${whereSql}`,
      params,
    ),
  ]);
  res.json({ data: data.rows, total: agg.rows[0].total, page, pageSize, totales: { comisiones: agg.rows[0].comisiones } });
});

router.post('/billetera/:id/anular', requireRole('ADMIN'), async (req, res) => {
  const id = parseId(req.params);
  const { motivo } = parse(z.object({ motivo: requiredText(200, 3).optional() }), req.body ?? {});
  const user = currentUser(req);
  await withTransaction(async (db) => {
    const m = await one<{ estado: string; operadora_id: number; monto: number; tipo: string }>(
      db,
      'SELECT estado, operadora_id, monto, tipo FROM movimientos_billetera WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!m) throw notFound('Movimiento de billetera no encontrado');
    if (m.estado === 'ANULADO') throw conflict('YA_ANULADO', 'El movimiento ya está anulado');
    await moverSaldo(db, {
      operadoraId: m.operadora_id,
      cuenta: 'BILLETERA',
      monto: m.tipo === 'RETIRO' ? -m.monto : m.monto,
      tipo: `ANULACION_${m.tipo}`,
      referenciaTipo: 'BILLETERA',
      referenciaId: id,
      observacion: motivo ?? null,
      usuarioId: user.id,
    });
    await revertirMovimientosCaja(db, 'BILLETERA', id, user.id, `Anulación billetera #${id}`);
    await db.query(`UPDATE movimientos_billetera SET estado = 'ANULADO', anulado_at = now(), anulado_por = $2 WHERE id = $1`, [id, user.id]);
  });
  res.status(204).end();
});

export default router;
