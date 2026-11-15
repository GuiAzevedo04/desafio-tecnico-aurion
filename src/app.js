import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { pool } from './db/pool.js';
import { errorHandler, routeNotFound } from './http/error-handler.js';
import { ordersRouter } from './orders/routes.js';

const OPENAPI_FILE = fileURLToPath(new URL('../openapi.yaml', import.meta.url));

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

  // Interactive documentation: Swagger UI loads the static OpenAPI document.
  app.get('/openapi.yaml', (req, res) => res.sendFile(OPENAPI_FILE));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(null, { swaggerUrl: '/openapi.yaml' }));

  app.use(express.json({ limit: '100kb' }));
  app.use('/ordens', ordersRouter);

  app.use(routeNotFound);
  app.use(errorHandler);

  return app;
}
