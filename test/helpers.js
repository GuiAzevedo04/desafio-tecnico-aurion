import assert from 'node:assert/strict';
import { after, before, beforeEach } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { pool } from '../src/db/pool.js';
import { applySchema } from '../src/db/schema.js';

// The suite drops and truncates the table, so it refuses to run on anything
// that is not explicitly a test database.
if (!config.db.database.endsWith('_test')) {
  throw new Error(`Refusing to run tests against database "${config.db.database}"`);
}

export const api = request(createApp());

// Well-formed UUID that no order will ever have.
export const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

export const VALID_ORDER = {
  titulo: 'Inspeção da válvula VLV-OS-7F3A',
  descricao: 'Verificar vedação e registrar o resultado da inspeção.',
};

// Registers the database lifecycle for the calling test file: a fresh schema
// once, and an empty table before each test so tests do not depend on order.
export function useTestDatabase() {
  before(async () => {
    await pool.query('DROP TABLE IF EXISTS ordens');
    await applySchema();
  });
  beforeEach(() => pool.query('TRUNCATE ordens'));
  after(() => pool.end());
}

export async function createOrder(fields = {}) {
  const res = await api.post('/ordens').send({ ...VALID_ORDER, ...fields });
  assert.equal(res.status, 201);
  return res.body;
}

export function assertError(res, status, codigo) {
  assert.equal(res.status, status);
  assert.deepEqual(Object.keys(res.body), ['erro']);
  assert.deepEqual(Object.keys(res.body.erro), ['codigo', 'mensagem', 'detalhes']);
  assert.equal(res.body.erro.codigo, codigo);
  assert.equal(typeof res.body.erro.mensagem, 'string');
  assert.ok(Array.isArray(res.body.erro.detalhes));
}

// Fields reported in `detalhes`, for asserting which inputs were rejected.
export function rejectedFields(res) {
  return res.body.erro.detalhes.map((detail) => detail.campo).sort();
}
