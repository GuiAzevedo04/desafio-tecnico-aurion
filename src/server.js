import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { applySchema } from './db/schema.js';

// Shorter than Docker's default 10 s stop timeout, so the process exits on its own.
const SHUTDOWN_TIMEOUT_MS = 8_000;

await applySchema();

const server = createApp().listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
});

let shuttingDown = false;

// Stop accepting connections, let in-flight requests finish, then close the pool.
function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  // Safety net: do not hang forever on a connection that never finishes.
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();

  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
