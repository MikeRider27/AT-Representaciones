import type { Db } from '../db/pool';
import { conflict } from '../lib/errors';

export type TipoMovStock = 'COMPRA' | 'VENTA' | 'AJUSTE_ALTA' | 'AJUSTE_BAJA' | 'ANULACION_VENTA' | 'ANULACION_COMPRA';

export interface MovimientoStock {
  productoId: number;
  depositoId: number;
  /** Positivo suma, negativo resta. */
  cantidad: number;
  tipo: TipoMovStock;
  referenciaTipo: string;
  referenciaId: number;
  usuarioId: number;
}

/**
 * Aplica un movimiento de stock bloqueando la fila (SELECT ... FOR UPDATE) y lo registra en el kardex.
 * Debe ejecutarse dentro de una transacción.
 */
export async function moverStock(db: Db, m: MovimientoStock): Promise<number> {
  await db.query(
    'INSERT INTO stock (producto_id, deposito_id, cantidad) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING',
    [m.productoId, m.depositoId],
  );
  const { rows } = await db.query<{ cantidad: number; codigo: string; descripcion: string }>(
    `SELECT s.cantidad, p.codigo, p.descripcion
       FROM stock s JOIN productos p ON p.id = s.producto_id
      WHERE s.producto_id = $1 AND s.deposito_id = $2
      FOR UPDATE OF s`,
    [m.productoId, m.depositoId],
  );
  const actual = rows[0];
  const nuevo = actual.cantidad + m.cantidad;
  if (nuevo < 0) {
    throw conflict(
      'STOCK_INSUFICIENTE',
      `Stock insuficiente para ${actual.codigo} - ${actual.descripcion} (disponible: ${actual.cantidad}, requerido: ${-m.cantidad})`,
    );
  }
  await db.query('UPDATE stock SET cantidad = $3 WHERE producto_id = $1 AND deposito_id = $2', [
    m.productoId,
    m.depositoId,
    nuevo,
  ]);
  await db.query(
    `INSERT INTO stock_movimientos (producto_id, deposito_id, tipo, cantidad, saldo, referencia_tipo, referencia_id, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [m.productoId, m.depositoId, m.tipo, m.cantidad, nuevo, m.referenciaTipo, m.referenciaId, m.usuarioId],
  );
  return nuevo;
}

/** Verifica que no haya productos repetidos en un detalle. */
export function verificarSinDuplicados(items: { producto_id: number }[]): void {
  const vistos = new Set<number>();
  for (const it of items) {
    if (vistos.has(it.producto_id)) throw conflict('PRODUCTO_DUPLICADO', 'Hay productos repetidos en el detalle');
    vistos.add(it.producto_id);
  }
}
