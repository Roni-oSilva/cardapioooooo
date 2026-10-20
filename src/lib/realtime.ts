import { Client } from 'pg';

type Listener = (payload: string) => void;
const g = globalThis as unknown as { __rt?: { listeners: Set<Listener>; client?: Client; starting?: boolean } };
const state = (g.__rt ??= { listeners: new Set() });

async function start() {
  if (state.client || state.starting) return;
  state.starting = true;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  const restart = () => {
    state.client = undefined;
    state.starting = false;
    client.removeAllListeners();
    client.end().catch(() => {});
    if (state.listeners.size) setTimeout(start, 2000);
  };
  client.on('error', restart);
  client.on('end', restart);
  client.on('notification', (m) => state.listeners.forEach((l) => l(m.payload ?? '')));
  try {
    await client.connect();
    await client.query('LISTEN cardapio_events');
    state.client = client;
  } catch {
    restart();
  }
  state.starting = false;
}

export function subscribe(l: Listener) {
  state.listeners.add(l);
  start();
  return () => {
    state.listeners.delete(l);
    if (!state.listeners.size && state.client) {
      const c = state.client;
      state.client = undefined;
      c.end().catch(() => {});
    }
  };
}
