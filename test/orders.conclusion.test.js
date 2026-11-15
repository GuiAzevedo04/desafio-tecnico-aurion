import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import { pool } from '../src/db/pool.js';
import { api, assertError, createOrder, useTestDatabase } from './helpers.js';

useTestDatabase();

async function createConcludedOrder() {
  const order = await createOrder();
  const res = await api
    .patch(`/ordens/${order.id}`)
    .send({ status: 'concluida', solucao: 'Vedação substituída.' });
  assert.equal(res.status, 200);
  return res.body;
}

async function fetchOrder(id) {
  const res = await api.get(`/ordens/${id}`);
  assert.equal(res.status, 200);
  return res.body;
}

async function waitUntilAQueryIsBlockedOnALock() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS blocked FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if (rows[0].blocked > 0) {
      return;
    }
    await wait(10);
  }
  assert.fail('no query became blocked on a lock');
}

test('concluding an order without a solution is rejected and changes nothing', async () => {
  const order = await createOrder();

  const res = await api.patch(`/ordens/${order.id}`).send({ status: 'concluida' });

  assertError(res, 400, 'REGRA_DE_CONCLUSAO');
  assert.deepEqual(await fetchOrder(order.id), order);
});

test('concluding an order with status and solution in the same request is accepted', async () => {
  const order = await createOrder();

  const res = await api
    .patch(`/ordens/${order.id}`)
    .send({ status: 'concluida', solucao: 'feito' });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'concluida');
  assert.equal(res.body.solucao, 'feito');
  assert.deepEqual(await fetchOrder(order.id), res.body);
});

test('concluding an order that already has a solution needs only the status', async () => {
  const order = await createOrder();
  await api.patch(`/ordens/${order.id}`).send({ solucao: 'Vedação substituída.' });

  const res = await api.patch(`/ordens/${order.id}`).send({ status: 'concluida' });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'concluida');
  assert.equal(res.body.solucao, 'Vedação substituída.');
});

test('concluding an order with a whitespace-only solution is rejected', async () => {
  const order = await createOrder();

  const res = await api
    .patch(`/ordens/${order.id}`)
    .send({ status: 'concluida', solucao: ' \t\n ' });

  assertError(res, 400, 'REGRA_DE_CONCLUSAO');
  assert.deepEqual(await fetchOrder(order.id), order);
});

test('a whitespace-only solution does not replace the solution an order already has when concluding', async () => {
  const order = await createOrder();
  const withSolution = await api.patch(`/ordens/${order.id}`).send({ solucao: 'feito' });

  const res = await api.patch(`/ordens/${order.id}`).send({ status: 'concluida', solucao: '   ' });

  assertError(res, 400, 'REGRA_DE_CONCLUSAO');
  assert.deepEqual(await fetchOrder(order.id), withSolution.body);
});

test('blanking the solution of a concluded order is rejected and keeps it concluded', async () => {
  const concluded = await createConcludedOrder();

  const res = await api.patch(`/ordens/${concluded.id}`).send({ solucao: '   ' });

  assertError(res, 400, 'REGRA_DE_CONCLUSAO');
  assert.deepEqual(await fetchOrder(concluded.id), concluded);
});

test('clearing the solution of a concluded order with null is rejected', async () => {
  const concluded = await createConcludedOrder();

  const res = await api.patch(`/ordens/${concluded.id}`).send({ solucao: null });

  assertError(res, 400, 'REGRA_DE_CONCLUSAO');
  assert.deepEqual(await fetchOrder(concluded.id), concluded);
});

test('a concluded order can be reopened, and its solution can be cleared in the same request', async () => {
  const concluded = await createConcludedOrder();

  const res = await api
    .patch(`/ordens/${concluded.id}`)
    .send({ status: 'em_andamento', solucao: null });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'em_andamento');
  assert.equal(res.body.solucao, null);
});

test('a concluded order keeps its solution when only the status changes', async () => {
  const concluded = await createConcludedOrder();

  const res = await api.patch(`/ordens/${concluded.id}`).send({ status: 'aberta' });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'aberta');
  assert.equal(res.body.solucao, concluded.solucao);
});

test('a concluded order can have its other fields and its solution text edited', async () => {
  const concluded = await createConcludedOrder();

  const res = await api
    .patch(`/ordens/${concluded.id}`)
    .send({ titulo: 'Título revisado', solucao: '  Vedação e anel substituídos.  ' });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'concluida');
  assert.equal(res.body.titulo, 'Título revisado');
  assert.equal(res.body.solucao, 'Vedação e anel substituídos.');
});

test('a blank solution on an order that is not concluded is stored as null', async () => {
  const order = await createOrder();
  await api.patch(`/ordens/${order.id}`).send({ solucao: 'rascunho' });

  const res = await api.patch(`/ordens/${order.id}`).send({ solucao: '   ' });

  assert.equal(res.status, 200);
  assert.equal(res.body.solucao, null);
});

test('a PATCH waits for a concurrent update of the same order and applies the rule to its result', async () => {
  const order = await createOrder();
  await api.patch(`/ordens/${order.id}`).send({ solucao: 'feito' });

  // Plays the part of another request that is halfway through clearing the solution.
  const concurrent = await pool.connect();
  try {
    await concurrent.query('BEGIN');
    await concurrent.query('UPDATE ordens SET solucao = NULL WHERE id = $1', [order.id]);

    const pending = Promise.resolve(api.patch(`/ordens/${order.id}`).send({ status: 'concluida' }));
    await waitUntilAQueryIsBlockedOnALock();
    await concurrent.query('COMMIT');

    // Had the PATCH read the order before the other update finished, it would
    // have seen a solution and concluded an order that no longer has one.
    assertError(await pending, 400, 'REGRA_DE_CONCLUSAO');
  } finally {
    await concurrent.query('ROLLBACK');
    concurrent.release();
  }

  const stored = await fetchOrder(order.id);
  assert.equal(stored.status, 'aberta');
  assert.equal(stored.solucao, null);
});
