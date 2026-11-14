import { readFile } from 'node:fs/promises';
import { pool } from './pool.js';

const SCHEMA_FILE = new URL('../../db/schema.sql', import.meta.url);

// The schema file is idempotent (IF NOT EXISTS), so it is safe to run on every startup.
export async function applySchema() {
  const sql = await readFile(SCHEMA_FILE, 'utf8');
  await pool.query(sql);
}
