function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Read once at startup so a missing variable fails fast instead of on the first request.
export const config = {
  port: Number(process.env.PORT) || 3000,
  db: {
    host: requireEnv('PGHOST'),
    port: Number(process.env.PGPORT) || 5432,
    user: requireEnv('PGUSER'),
    password: requireEnv('PGPASSWORD'),
    database: requireEnv('PGDATABASE'),
  },
};
