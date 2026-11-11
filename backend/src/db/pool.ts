import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';

// BIGINT (montos en guaraníes) como number: los valores están muy por debajo de 2^53.
types.setTypeParser(types.builtins.INT8, (v) => Number(v));
types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));
// DATE como 'YYYY-MM-DD' para evitar corrimientos por zona horaria.
types.setTypeParser(types.builtins.DATE, (v) => v);

export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  options: '-c timezone=America/Asuncion',
});

pool.on('error', (err) => logger.error({ err }, 'Error inesperado en el pool de PostgreSQL'));

/** Cualquier cosa capaz de ejecutar consultas: el pool o un cliente dentro de una transacción. */
export interface Db {
  query<R extends QueryResultRow = any>(text: string, values?: any[]): Promise<QueryResult<R>>;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function one<R extends QueryResultRow = any>(db: Db, text: string, values?: any[]): Promise<R | null> {
  const { rows } = await db.query<R>(text, values);
  return rows[0] ?? null;
}
