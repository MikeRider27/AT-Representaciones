import compression from 'compression';
import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { pool } from './db/pool';
import { logger } from './lib/logger';
import { authenticate } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import ajustes from './modules/ajustes.routes';
import auth from './modules/auth.routes';
import caja from './modules/caja.routes';
import catalogos from './modules/catalogos.routes';
import cobranzas from './modules/cobranzas.routes';
import compras from './modules/compras.routes';
import configuracion from './modules/configuracion.routes';
import productos from './modules/productos.routes';
import reportes from './modules/reportes.routes';
import saldos from './modules/saldos.routes';
import stock from './modules/stock.routes';
import usuarios from './modules/usuarios.routes';
import ventas from './modules/ventas.routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // detrás de nginx
  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    }),
  );

  if (env.CORS_ORIGIN) {
    // Sólo para desarrollo con front y API en orígenes distintos.
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', env.CORS_ORIGIN!);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  const api = Router();

  api.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  api.use('/auth', auth);

  // Todo lo que sigue requiere sesión
  api.use(authenticate);
  api.use('/usuarios', usuarios);
  api.use('/configuracion', configuracion);
  api.use('/productos', productos);
  api.use('/stock', stock);
  api.use('/caja', caja);
  api.use('/ventas', ventas);
  api.use('/compras', compras);
  api.use('/ajustes', ajustes);
  api.use('/cobranzas', cobranzas);
  api.use('/saldos', saldos);
  api.use('/reportes', reportes);
  api.use('/', catalogos);

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
