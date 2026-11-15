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

export async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM ordens WHERE id = $1', [id]);
  return rowCount === 1;
}
