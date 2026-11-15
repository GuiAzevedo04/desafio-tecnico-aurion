import { Router } from 'express';
import { HttpError } from '../http/errors.js';
import * as repository from './repository.js';
import { assertValidId, parseCreateBody } from './validation.js';

export const ordersRouter = Router();

function orderNotFound() {
  return new HttpError(404, 'ORDEM_NAO_ENCONTRADA', 'Ordem de serviço não encontrada.');
}

// Runs before every handler that has :id, so a malformed id never reaches the database.
ordersRouter.param('id', (req, res, next, id) => {
  assertValidId(id);
  next();
});

// Express 5 forwards errors thrown by async handlers to the error handler,
// so the handlers below need no try/catch.

ordersRouter.post('/', async (req, res) => {
  const order = await repository.create(parseCreateBody(req.body));
  res.status(201).location(`/ordens/${order.id}`).json(order);
});

ordersRouter.get('/', async (req, res) => {
  res.json(await repository.findAll());
});

ordersRouter.get('/:id', async (req, res) => {
  const order = await repository.findById(req.params.id);
  if (!order) {
    throw orderNotFound();
  }
  res.json(order);
});

ordersRouter.delete('/:id', async (req, res) => {
  const removed = await repository.remove(req.params.id);
  if (!removed) {
    throw orderNotFound();
  }
  res.status(204).end();
});
