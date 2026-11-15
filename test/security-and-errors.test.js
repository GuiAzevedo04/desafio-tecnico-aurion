import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { pool } from '../src/db/pool.js';
import { api, assertError, createOrder, useTestDatabase, VALID_ORDER } from './helpers.js';

useTestDatabase();

const INJECTION_PAYLOADS = ["' OR '1'='1", "'; DROP TABLE ordens;--", '1; DELETE FROM ordens'];

describe('SQL injection attempts', () => {
  for (const payload of INJECTION_PAYLOADS) {
    test(`as an id, "${payload}" is rejected with 400 and no order is touched`, async () => {
      const order = await createOrder();
      const path = `/ordens/${encodeURIComponent(payload)}`;

      assertError(await api.get(path), 400, 'ID_INVALIDO');
      assertError(await api.patch(path).send({ titulo: 'x' }), 400, 'ID_INVALIDO');
      assertError(await api.delete(path), 400, 'ID_INVALIDO');

      assert.deepEqual((await api.get('/ordens')).body, [order]);
    });

    test(`as text, "${payload}" is stored literally and the table keeps working`, async () => {
      const other = await createOrder();

      const created = await api.post('/ordens').send({ titulo: payload, descricao: payload });
      const updated = await api.patch(`/ordens/${created.body.id}`).send({ solucao: payload });

      assert.equal(created.status, 201);
      assert.equal(created.body.titulo, payload);
      assert.equal(updated.status, 200);
      assert.equal(updated.body.solucao, payload);
      assert.deepEqual((await api.get('/ordens')).body, [other, updated.body]);
    });
  }

  test('as a status, an injection payload is rejected by the enum check', async () => {
    const order = await createOrder();

    const res = await api.patch(`/ordens/${order.id}`).send({ status: "aberta' OR '1'='1" });

    assertError(res, 400, 'ENTRADA_INVALIDA');
  });
});

describe('error responses', () => {
  test('an unknown route returns the standard 404 body', async () => {
    assertError(await api.get('/nao-existe'), 404, 'ROTA_NAO_ENCONTRADA');
  });

  test('an unsupported method on a known route returns the standard 404 body', async () => {
    assertError(await api.put('/ordens').send(VALID_ORDER), 404, 'ROTA_NAO_ENCONTRADA');
  });

  test('a malformed percent-encoding in the id returns the standard 400 body', async () => {
    assertError(await api.get('/ordens/%E0%A4%A'), 400, 'REQUISICAO_INVALIDA');
  });

  test('a body above the size limit returns the standard 413 body', async () => {
    const res = await api.post('/ordens').send({ ...VALID_ORDER, descricao: 'a'.repeat(200_000) });

    assertError(res, 413, 'CORPO_MUITO_GRANDE');
  });

  test('error responses are JSON and carry a request id header', async () => {
    const res = await api.get('/ordens/123');

    assert.match(res.headers['content-type'], /^application\/json/);
    assert.match(res.headers['x-request-id'], /^[0-9a-f-]{36}$/);
  });

  test('responses do not advertise the framework', async () => {
    const res = await api.get('/ordens');

    assert.equal(res.headers['x-powered-by'], undefined);
  });

  test('an unexpected failure returns a generic 500 and keeps the details in the server log', async (t) => {
    const internalDetail = 'relation "ordens" does not exist';
    t.mock.method(pool, 'query', async () => {
      throw new Error(internalDetail);
    });
    const logged = t.mock.method(console, 'error', () => {});

    const res = await api.get('/ordens');

    assertError(res, 500, 'ERRO_INTERNO');
    assert.deepEqual(res.body.erro.detalhes, []);
    assert.ok(!JSON.stringify(res.body).includes('ordens'));

    assert.equal(logged.mock.callCount(), 1);
    const [context, error] = logged.mock.calls[0].arguments;
    assert.ok(context.includes(res.headers['x-request-id']));
    assert.equal(error.message, internalDetail);
  });
});

describe('health check', () => {
  test('GET /health returns 200 while the database answers', async () => {
    const res = await api.get('/health');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
  });
});
