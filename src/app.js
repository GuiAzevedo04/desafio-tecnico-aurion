import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import { pool } from './db/pool.js';
import { errorHandler, routeNotFound } from './http/error-handler.js';
import { ordersRouter } from './orders/routes.js';

// Builds the app without listening, so tests can drive it in-process.
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  // Ties a response to its server log line without exposing internals.
  app.use((req, res, next) => {
    req.id = randomUUID();
    res.set('X-Request-Id', req.id);
    next();
  });

  // Used by the container healthcheck: only healthy if the database answers.
  app.get('/health', async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use(express.json({ limit: '100kb' }));
  app.use('/ordens', ordersRouter);

  app.use(routeNotFound);
  app.use(errorHandler);

  return app;
}
