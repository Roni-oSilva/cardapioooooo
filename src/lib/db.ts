import { Pool, PoolClient, QueryResultRow } from 'pg';

const g = globalThis as unknown as { __pool?: Pool };

export const pool: Pool =
  g.__pool ??
  (g.__pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
    max: 10,
  }));

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query<T>(text, params as any[]);
  return r.rows;
}

export async function one<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Publica um evento para as telas em tempo real (LISTEN/NOTIFY do Postgres). */
export async function notify(type: string, data: Record<string, unknown> = {}) {
  try {
    await pool.query('SELECT pg_notify($1, $2)', ['cardapio_events', JSON.stringify({ type, ...data })]);
  } catch (e) {
    console.error('[notify] falhou', e);
  }
}
