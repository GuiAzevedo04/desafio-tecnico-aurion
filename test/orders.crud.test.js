import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api, assertError, createOrder, useTestDatabase, VALID_ORDER } from './helpers.js';

useTestDatabase();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test('POST /ordens creates an order as "aberta" and returns it with 201', async () => {
  const res = await api.post('/ordens').send(VALID_ORDER);

  assert.equal(res.status, 201);
  assert.match(res.body.id, UUID_PATTERN);
  assert.equal(res.headers.location, `/ordens/${res.body.id}`);
  assert.deepEqual(res.body, {
    id: res.body.id,
    titulo: VALID_ORDER.titulo,
    descricao: VALID_ORDER.descricao,
    status: 'aberta',
    solucao: null,
    criado_em: res.body.criado_em,
    atualizado_em: res.body.atualizado_em,
  });
  assert.equal(new Date(res.body.criado_em).toISOString(), res.body.criado_em);
  assert.equal(res.body.atualizado_em, res.body.criado_em);
});

test('POST /ordens stores titulo and descricao without surrounding whitespace', async () => {
  const res = await api.post('/ordens').send({ titulo: '  Trocar filtro  ', descricao: '\tLinha 2\n' });

  assert.equal(res.status, 201);
  assert.equal(res.body.titulo, 'Trocar filtro');
  assert.equal(res.body.descricao, 'Linha 2');
});

test('a created order is persisted and returned by GET /ordens/:id', async () => {
  const created = await createOrder();

  const res = await api.get(`/ordens/${created.id}`);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, created);
});

test('GET /ordens returns [] when there are no orders', async () => {
  const res = await api.get('/ordens');

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('GET /ordens lists every order, oldest first', async () => {
  const first = await createOrder({ titulo: 'Primeira' });
  const second = await createOrder({ titulo: 'Segunda' });
  const third = await createOrder({ titulo: 'Terceira' });

  const res = await api.get('/ordens');

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, [first, second, third]);
});

test('DELETE /ordens/:id returns 204 with an empty body and removes the order', async () => {
  const created = await createOrder();

  const res = await api.delete(`/ordens/${created.id}`);

  assert.equal(res.status, 204);
  assert.equal(res.text, '');
  assertError(await api.get(`/ordens/${created.id}`), 404, 'ORDEM_NAO_ENCONTRADA');
  assert.deepEqual((await api.get('/ordens')).body, []);
});
