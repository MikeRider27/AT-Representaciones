import type { Db } from '../db/pool';
import { conflict } from '../lib/errors';

export type Cuenta = 'RECARGA' | 'BILLETERA';

export interface MovimientoSaldo {
  operadoraId: number;
  cuenta: Cuenta;
  /** Positivo acredita, negativo debita. */
  monto: number;
  tipo: string;
  referenciaTipo?: string | null;
  referenciaId?: number | null;
  observacion?: string | null;
  usuarioId: number;
}

/** Acredita/debita el saldo de una operadora con bloqueo de fila y deja traza en `saldo_movimientos`. */
export async function moverSaldo(db: Db, m: MovimientoSaldo): Promise<number> {
  await db.query('INSERT INTO saldos_operadora (operadora_id, cuenta) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
    m.operadoraId,
    m.cuenta,
  ]);
  const { rows } = await db.query<{ saldo: number; operadora: string }>(
    `SELECT s.saldo, o.descripcion AS operadora
       FROM saldos_operadora s JOIN operadoras o ON o.id = s.operadora_id
      WHERE s.operadora_id = $1 AND s.cuenta = $2
      FOR UPDATE OF s`,
    [m.operadoraId, m.cuenta],
  );
  const nuevo = rows[0].saldo + m.monto;
  if (nuevo < 0) {
    const etiqueta = m.cuenta === 'RECARGA' ? 'saldo de recargas' : 'saldo de billetera';
    throw conflict(
      'SALDO_INSUFICIENTE',
      `${rows[0].operadora}: ${etiqueta} insuficiente (disponible ${rows[0].saldo.toLocaleString('es-PY')} Gs.)`,
    );
  }
  await db.query('UPDATE saldos_operadora SET saldo = $3, updated_at = now() WHERE operadora_id = $1 AND cuenta = $2', [
    m.operadoraId,
    m.cuenta,
    nuevo,
  ]);
  await db.query(
    `INSERT INTO saldo_movimientos
       (operadora_id, cuenta, tipo, monto, saldo_resultante, referencia_tipo, referencia_id, observacion, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [m.operadoraId, m.cuenta, m.tipo, m.monto, nuevo, m.referenciaTipo ?? null, m.referenciaId ?? null, m.observacion ?? null, m.usuarioId],
  );
  return nuevo;
}
