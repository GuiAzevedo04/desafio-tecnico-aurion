import pg from 'pg';
import { config } from '../config.js';

export const pool = new pg.Pool(config.db);

// Without this listener, an error on an idle connection (e.g. the database
// restarting) is emitted as an unhandled 'error' event and crashes the process.
pool.on('error', (err) => {
  console.error('Unexpected error on idle database connection', err);
});

// Runs `work` on a single connection inside BEGIN/COMMIT, rolling back on any error.
export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
