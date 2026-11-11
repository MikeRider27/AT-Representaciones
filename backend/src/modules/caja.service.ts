import type { Db } from '../db/pool';
import { conflict } from '../lib/errors';

export type MedioPago = 'EFECTIVO' | 'TARJETA' | 'CHEQUE' | 'TRANSFERENCIA';
export const MEDIOS_PAGO: MedioPago[] = ['EFECTIVO', 'TARJETA', 'CHEQUE', 'TRANSFERENCIA'];

export interface SesionCaja {
  id: number;
  caja_id: number;
  caja: string;
  usuario_id: number;
  usuario: string;
  estado: 'ABIERTA' | 'CERRADA';
  abierta_at: string;
  monto_apertura: number;
}

export async function sesionAbiertaDe(db: Db, usuarioId: number): Promise<SesionCaja | null> {
  const { rows } = await db.query<SesionCaja>(
    `SELECT s.id, s.caja_id, c.descripcion AS caja, s.usuario_id, u.nombre AS usuario, s.estado, s.abierta_at, s.monto_apertura
       FROM sesiones_caja s
       JOIN cajas c ON c.id = s.caja_id
       JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.usuario_id = $1 AND s.estado = 'ABIERTA'`,
    [usuarioId],
  );
  return rows[0] ?? null;
}

/** Devuelve la sesión abierta del usuario o lanza un error de negocio (equivale a "Realizar Apertura de Caja"). */
export async function requerirSesionAbierta(db: Db, usuarioId: number): Promise<SesionCaja> {
  const sesion = await sesionAbiertaDe(db, usuarioId);
  if (!sesion) throw conflict('CAJA_CERRADA', 'Debe realizar la apertura de caja antes de operar');
  return sesion;
}

export interface NuevoMovimientoCaja {
  sesionId: number;
  tipo: 'INGRESO' | 'EGRESO';
  concepto: string;
  medioPago?: MedioPago;
  monto: number;
  descripcion?: string | null;
  referenciaTipo?: string | null;
  referenciaId?: number | null;
  usuarioId: number;
}

export async function registrarMovimientoCaja(db: Db, m: NuevoMovimientoCaja): Promise<void> {
  await db.query(
    `INSERT INTO movimientos_caja
       (sesion_caja_id, tipo, concepto, medio_pago, monto, descripcion, referencia_tipo, referencia_id, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      m.sesionId,
      m.tipo,
      m.concepto,
      m.medioPago ?? 'EFECTIVO',
      m.monto,
      m.descripcion ?? null,
      m.referenciaTipo ?? null,
      m.referenciaId ?? null,
      m.usuarioId,
    ],
  );
}

/**
 * Revierte el efecto en caja de una operación anulada.
 * - Si la sesión original sigue abierta, el movimiento se marca como anulado.
 * - Si ya fue cerrada, se registra el movimiento inverso en la sesión abierta del usuario.
 */
export async function revertirMovimientosCaja(
  db: Db,
  referenciaTipo: string,
  referenciaId: number,
  usuarioId: number,
  descripcion: string,
): Promise<void> {
  const { rows } = await db.query<{
    id: number;
    tipo: 'INGRESO' | 'EGRESO';
    concepto: string;
    medio_pago: MedioPago;
    monto: number;
    sesion_estado: string;
  }>(
    `SELECT m.id, m.tipo, m.concepto, m.medio_pago, m.monto, s.estado AS sesion_estado
       FROM movimientos_caja m JOIN sesiones_caja s ON s.id = m.sesion_caja_id
      WHERE m.referencia_tipo = $1 AND m.referencia_id = $2 AND NOT m.anulado
      FOR UPDATE OF m`,
    [referenciaTipo, referenciaId],
  );

  for (const mov of rows) {
    if (mov.sesion_estado === 'ABIERTA') {
      await db.query('UPDATE movimientos_caja SET anulado = true WHERE id = $1', [mov.id]);
    } else {
      const sesion = await requerirSesionAbierta(db, usuarioId);
      await registrarMovimientoCaja(db, {
        sesionId: sesion.id,
        tipo: mov.tipo === 'INGRESO' ? 'EGRESO' : 'INGRESO',
        concepto: 'ANULACION',
        medioPago: mov.medio_pago,
        monto: mov.monto,
        descripcion,
        referenciaTipo,
        referenciaId,
        usuarioId,
      });
    }
  }
}

export interface ResumenMedio {
  medio_pago: MedioPago;
  ingresos: number;
  egresos: number;
  esperado: number;
}

/** Totales por medio de pago de una sesión. El efectivo esperado incluye el monto de apertura. */
export async function resumenSesion(db: Db, sesionId: number, montoApertura: number) {
  const { rows } = await db.query<{ medio_pago: MedioPago; ingresos: number; egresos: number }>(
    `SELECT medio_pago,
            COALESCE(sum(monto) FILTER (WHERE tipo = 'INGRESO'), 0)::bigint AS ingresos,
            COALESCE(sum(monto) FILTER (WHERE tipo = 'EGRESO'), 0)::bigint  AS egresos
       FROM movimientos_caja
      WHERE sesion_caja_id = $1 AND NOT anulado
      GROUP BY medio_pago`,
    [sesionId],
  );
  const medios: ResumenMedio[] = MEDIOS_PAGO.map((medio) => {
    const r = rows.find((x) => x.medio_pago === medio);
    const ingresos = r?.ingresos ?? 0;
    const egresos = r?.egresos ?? 0;
    const apertura = medio === 'EFECTIVO' ? montoApertura : 0;
    return { medio_pago: medio, ingresos, egresos, esperado: apertura + ingresos - egresos };
  });
  return {
    monto_apertura: montoApertura,
    medios,
    total_ingresos: medios.reduce((a, m) => a + m.ingresos, 0),
    total_egresos: medios.reduce((a, m) => a + m.egresos, 0),
    total_esperado: medios.reduce((a, m) => a + m.esperado, 0),
  };
}
