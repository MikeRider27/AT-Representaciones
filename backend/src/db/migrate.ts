import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { pool, withTransaction } from './pool';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');
const LOCK_ID = 727_001; // evita que dos réplicas migren en paralelo

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       varchar(200) PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      logger.info({ file }, 'Aplicando migración');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falló la migración ${file}: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

/** Crea el usuario administrador inicial si la tabla de usuarios está vacía. */
export async function ensureAdminUser(): Promise<void> {
  await withTransaction(async (db) => {
    const { rows } = await db.query<{ total: number }>('SELECT count(*)::int AS total FROM usuarios');
    if (rows[0].total > 0) return;
    const hash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
    await db.query(
      `INSERT INTO usuarios (username, nombre, password_hash, rol) VALUES ($1, 'Administrador', $2, 'ADMIN')`,
      [env.ADMIN_USERNAME, hash],
    );
    logger.warn({ username: env.ADMIN_USERNAME }, 'Usuario administrador inicial creado');
  });
}
