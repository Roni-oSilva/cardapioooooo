// Aplica as migrações de db/migrations em ordem, registrando as já executadas.
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, sslOption } from './env.mjs';

loadEnv();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: sslOption() });
await client.connect();
await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
const dir = path.resolve('db/migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
for (const f of files) {
  const done = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f]);
  if (done.rowCount) continue;
  console.log('aplicando', f);
  await client.query('BEGIN');
  try {
    await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('falhou em', f, e.message);
    process.exit(1);
  }
}
console.log('migrações em dia');
await client.end();
