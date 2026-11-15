import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  api,
  assertError,
  createOrder,
  rejectedFields,
  UNKNOWN_ID,
  useTestDatabase,
  VALID_ORDER,
} from './helpers.js';

useTestDatabase();

async function assertNothingWasCreated() {
  assert.deepEqual((await api.get('/ordens')).body, []);
}

describe('POST /ordens with invalid input', () => {
  test('rejects a body without titulo', async () => {
    const res = await api.post('/ordens').send({ descricao: VALID_ORDER.descricao });

    assertError(res, 400, 'ENTRADA_INVALIDA');
    assert.deepEqual(res.body.erro.detalhes, [{ campo: 'titulo', mensagem: 'campo obrigatório' }]);
    await assertNothingWasCreated();
  });

  test('rejects a body without descricao', async () => {
    const res = await api.post('/ordens').send({ titulo: VALID_ORDER.titulo });

    assertError(res, 400, 'ENTRADA_INVALIDA');
    assert.deepEqual(rejectedFields(res), ['descricao']);
  });

  test('rejects an empty object and reports both required fields', async () => {
    const res = await api.post('/ordens').send({});

    assertError(res, 400, 'ENTRADA_INVALIDA');
    assert.deepEqual(rejectedFields(res), ['descricao', 'titulo']);
  });

  test('rejects titulo and descricao that are empty or only whitespace', async () => {
    const res = await api.post('/ordens').send({ titulo: '', descricao: ' \t\n ' });

    assertError(res, 400, 'ENTRADA_INVALIDA');
    assert.deepEqual(rejectedFields(res), ['descricao', 'titulo']);
    await assertNothingWasCreated();
  });

  for (const [label, value] of [
    ['a number', 42],
    ['a boolean', true],
    ['null', null],
    ['an object', { texto: 'x' }],
    ['an array', ['x']],
  ]) {
    test(`rejects ${label} as titulo`, async () => {
      const res = await api.post('/ordens').send({ ...VALID_ORDER, titulo: value });

      assertError(res, 400, 'ENTRADA_INVALIDA');
      assert.deepEqual(res.body.erro.detalhes, [
        { campo: 'titulo', mensagem: 'deve ser um texto' },
      ]);
    });
  }

  test('rejects a titulo longer than 200 characters and accepts exactly 200', async () => {
    const tooLong = await api.post('/ordens').send({ ...VALID_ORDER, titulo: 'a'.repeat(201) });
    const atLimit = await api.post('/ordens').send({ ...VALID_ORDER, titulo: 'a'.repeat(200) });

    assertError(tooLong, 400, 'ENTRADA_INVALIDA');
    assert.deepEqual(rejectedFields(tooLong), ['titulo']);
    assert.equal(atLimit.status, 201);
  });

  test('rejects a descricao longer than 5000 characters', async () => {
    const res = await api.post('/ordens').send({ ...VALID_ORDER, descricao: 'a'.repeat(5001) });

    assertError(res, 400, 'ENTRADA_INVALIDA');
    assert.deepEqual(rejectedFields(res), ['descricao']);
  });

  test('rejects text containing the NUL character, which PostgreSQL cannot store', async () => {
    const res = await api.post('/ordens').send({ ...VALID_ORDER, titulo: 'a\u0000b' });

    assertError(res, 400, 'ENTRADA_INVALIDA');
    assert.deepEqual(rejectedFields(res), ['titulo']);
  });

  for (const field of ['id', 'status', 'solucao', 'criado_em', 'atualizado_em', 'extra']) {
    test(`rejects the field "${field}", which is outside the contract`, async () => {
      const res = await api.post('/ordens').send({ ...VALID_ORDER, [field]: 'aberta' });

      assertError(res, 400, 'ENTRADA_INVALIDA');
      assert.deepEqual(res.body.erro.detalhes, [{ campo: field, mensagem: 'campo não permitido' }]);
      await assertNothingWasCreated();
    });
  }

  test('rejects a JSON array as body', async () => {
    const res = await api.post('/ordens').send([VALID_ORDER]);

    assertError(res, 400, 'ENTRADA_INVALIDA');
  });

  test('rejects a request without a JSON body', async () => {
    const res = await api.post('/ordens').type('text/plain').send('titulo=x');

    assertError(res, 400, 'ENTRADA_INVALIDA');
  });

  for (const [label, payload] of [
    ['malformed JSON', '{"titulo": "x", '],
    ['a JSON string', '"texto"'],
    ['a JSON number', '42'],
    ['JSON null', 'null'],
  ]) {
    test(`rejects ${label} as body`, async () => {
      const res = await api.post('/ordens').type('application/json').send(payload);

      assertError(res, 400, 'JSON_INVALIDO');
    });
  }
});

describe('PATCH /ordens/:id with invalid input', () => {
  async function assertRejectedAndUnchanged(order, body, expectedFields) {
    const res = await api.patch(`/ordens/${order.id}`).send(body);

    assertError(res, 400, 'ENTRADA_INVALIDA');
    assert.deepEqual(rejectedFields(res), expectedFields);
    assert.deepEqual((await api.get(`/ordens/${order.id}`)).body, order);
  }

  test('rejects an empty object', async () => {
    await assertRejectedAndUnchanged(await createOrder(), {}, []);
  });

  test('rejects a field outside the contract, even next to valid ones', async () => {
    await assertRejectedAndUnchanged(await createOrder(), { titulo: 'Novo', prioridade: 1 }, [
      'prioridade',
    ]);
  });

  for (const field of ['id', 'criado_em', 'atualizado_em']) {
    test(`rejects an attempt to change "${field}"`, async () => {
      await assertRejectedAndUnchanged(await createOrder(), { [field]: UNKNOWN_ID }, [field]);
    });
  }

  for (const [label, value] of [
    ['an unknown value', 'cancelada'],
    ['different letter case', 'ABERTA'],
    ['a number', 1],
    ['null', null],
  ]) {
    test(`rejects ${label} as status`, async () => {
      await assertRejectedAndUnchanged(await createOrder(), { status: value }, ['status']);
    });
  }

  test('rejects titulo and descricao that are only whitespace', async () => {
    await assertRejectedAndUnchanged(await createOrder(), { titulo: '   ', descricao: '' }, [
      'descricao',
      'titulo',
    ]);
  });

  test('rejects null for titulo, which cannot be cleared', async () => {
    await assertRejectedAndUnchanged(await createOrder(), { titulo: null }, ['titulo']);
  });

  test('rejects a solucao that is not text', async () => {
    await assertRejectedAndUnchanged(await createOrder(), { solucao: 123 }, ['solucao']);
  });

  test('rejects a solucao longer than 5000 characters', async () => {
    await assertRejectedAndUnchanged(await createOrder(), { solucao: 'a'.repeat(5001) }, [
      'solucao',
    ]);
  });

  test('rejects a JSON array as body', async () => {
    const order = await createOrder();

    const res = await api.patch(`/ordens/${order.id}`).send([{ titulo: 'Novo' }]);

    assertError(res, 400, 'ENTRADA_INVALIDA');
  });

  test('rejects malformed JSON', async () => {
    const order = await createOrder();

    const res = await api.patch(`/ordens/${order.id}`).type('application/json').send('{"titulo":');

    assertError(res, 400, 'JSON_INVALIDO');
  });
});

describe('order ids', () => {
  for (const [method, body] of [
    ['get', undefined],
    ['patch', { titulo: 'Novo' }],
    ['delete', undefined],
  ]) {
    test(`${method.toUpperCase()} returns 404 for a valid id that has no order`, async () => {
      const res = await api[method](`/ordens/${UNKNOWN_ID}`).send(body);

      assertError(res, 404, 'ORDEM_NAO_ENCONTRADA');
    });

    for (const malformedId of ['123', 'abc', `${UNKNOWN_ID}0`, UNKNOWN_ID.replaceAll('-', '')]) {
      test(`${method.toUpperCase()} returns 400 for the malformed id "${malformedId}"`, async () => {
        const res = await api[method](`/ordens/${malformedId}`).send(body);

        assertError(res, 400, 'ID_INVALIDO');
      });
    }
  }

  test('an id in uppercase finds the same order', async () => {
    const order = await createOrder();

    const res = await api.get(`/ordens/${order.id.toUpperCase()}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, order.id);
  });
});

describe('order of checks in PATCH /ordens/:id', () => {
  test('a malformed id is reported before an invalid body', async () => {
    const res = await api.patch('/ordens/123').send({ extra: true });

    assertError(res, 400, 'ID_INVALIDO');
  });

  test('an invalid body is reported before a missing order', async () => {
    const res = await api.patch(`/ordens/${UNKNOWN_ID}`).send({ status: 'invalido' });

    assertError(res, 400, 'ENTRADA_INVALIDA');
  });

  test('a missing order is reported before the conclusion rule', async () => {
    const res = await api.patch(`/ordens/${UNKNOWN_ID}`).send({ status: 'concluida' });

    assertError(res, 404, 'ORDEM_NAO_ENCONTRADA');
  });
});
