import { pool } from '../db/pool.js';

// Every query passes client input as bind parameters ($1, $2, ...). The SQL text
// never contains request data, which is what prevents SQL injection.

const COLUMNS = 'id, titulo, descricao, status, solucao, criado_em, atualizado_em';

export async function create({ titulo, descricao }) {
  const { rows } = await pool.query(
    `INSERT INTO ordens (titulo, descricao) VALUES ($1, $2) RETURNING ${COLUMNS}`,
    [titulo, descricao],
  );
  return rows[0];
}

// Oldest first; id breaks ties so the order is always the same.
export async function findAll() {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM ordens ORDER BY criado_em, id`);
  return rows;
}

export async function findById(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM ordens WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

// FOR UPDATE locks the row until the transaction ends, so a concurrent PATCH
// waits here and then reads the state this one committed.
export async function findByIdForUpdate(client, id) {
  const { rows } = await client.query(`SELECT ${COLUMNS} FROM ordens WHERE id = $1 FOR UPDATE`, [
    id,
  ]);
  return rows[0] ?? null;
}

// Writes the full editable state. It is safe to overwrite all four columns
// because the caller holds the row lock taken by findByIdForUpdate.
export async function update(client, { id, titulo, descricao, status, solucao }) {
  const { rows } = await client.query(
    `UPDATE ordens
        SET titulo = $2, descricao = $3, status = $4, solucao = $5, atualizado_em = now()
      WHERE id = $1
  RETURNING ${COLUMNS}`,
    [id, titulo, descricao, status, solucao],
  );
  return rows[0];
}

export async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM ordens WHERE id = $1', [id]);
  return rowCount === 1;
}
