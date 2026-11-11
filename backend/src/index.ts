import { createApp } from './app';
import { env } from './config/env';
import { ensureAdminUser, runMigrations } from './db/migrate';
import { pool } from './db/pool';
import { logger } from './lib/logger';

async function waitForDatabase(retries = 30): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      logger.warn({ intento: i }, 'Esperando a PostgreSQL...');
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function main() {
  await waitForDatabase();
  await runMigrations();
  await ensureAdminUser();

  const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT }, 'API escuchando'));

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Cerrando servidor');
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'No se pudo iniciar la API');
  process.exit(1);
});
