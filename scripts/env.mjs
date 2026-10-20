import fs from 'node:fs';

// Carrega .env/.env.local sem depender de pacotes externos (não sobrescreve variáveis já definidas).
export function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
export function sslOption() {
  return process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined;
}
