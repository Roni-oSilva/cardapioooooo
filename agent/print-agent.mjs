#!/usr/bin/env node
/**
 * Agente local de impressão. Roda no computador ligado à impressora (ou na mesma rede dela).
 * Sem dependências: precisa apenas de Node 18+.
 *
 * Funcionamento: pergunta ao servidor por comandas na fila (/api/print/claim), imprime e informa o
 * resultado. Só reporta "impresso" quando houve confirmação — veja confirmFor* abaixo.
 *
 * Variáveis de ambiente:
 *   SERVER_URL         URL do sistema (ex.: https://cardapio.seurestaurante.com)
 *   PRINT_AGENT_TOKEN  mesmo valor configurado no servidor
 *   AGENT_NAME         nome deste agente (aparece no histórico de impressão)
 *   POLL_MS            intervalo de consulta (padrão 2000)
 *   PRINT_CONFIRM      "transport" (padrão) ou "status". Em "status", impressoras de rede que não
 *                      respondem à consulta ESC/POS de status são tratadas como falha.
 */
import net from 'node:net';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import pathMod from 'node:path';

const sh = promisify(execFile);

// carrega .env simples da pasta atual
for (const f of ['.env.agent', '.env']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const SERVER = (process.env.SERVER_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKEN = process.env.PRINT_AGENT_TOKEN;
const NAME = process.env.AGENT_NAME || os.hostname();
const POLL_MS = Number(process.env.POLL_MS || 2000);
const STRICT = (process.env.PRINT_CONFIRM || 'transport') === 'status';
const ONCE = process.argv.includes('--once');

if (!TOKEN) { console.error('Defina PRINT_AGENT_TOKEN.'); process.exit(1); }

const log = (...a) => console.log(new Date().toISOString(), ...a);

async function api(path, body, method = 'POST') {
  const res = await fetch(SERVER + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ---------- Impressão por TCP (porta 9100, padrão das térmicas de rede) ----------
function tcpPrint(host, port, data) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port, timeout: 6000 });
    let settled = false;
    const done = (err, conf) => { if (settled) return; settled = true; sock.destroy(); err ? reject(err) : resolve(conf); };
    const query = (bytes, wait = 1500) => new Promise((res) => {
      const onData = (b) => { clearTimeout(t); sock.off('data', onData); res(b[0]); };
      const t = setTimeout(() => { sock.off('data', onData); res(null); }, wait);
      sock.on('data', onData);
      sock.write(Buffer.from(bytes));
    });
    sock.on('timeout', () => done(new Error('tempo esgotado ao falar com a impressora')));
    sock.on('error', (e) => done(new Error(`conexão com a impressora falhou: ${e.message}`)));
    sock.on('connect', async () => {
      try {
        // DLE EOT 1: status da impressora. Bit 3 (0x08) = offline.  DLE EOT 4: sensor de papel. Bits 5-6 (0x60) = papel acabou.
        const st = data.__escpos ? await query([0x10, 0x04, 0x01]) : null;
        let conf = 'tcp: dados aceitos (impressora sem resposta de status)';
        if (st !== null) {
          if (st & 0x08) return done(new Error('impressora offline (tampa aberta, erro ou sem papel)'));
          const paper = await query([0x10, 0x04, 0x04]);
          if (paper !== null && paper & 0x60) return done(new Error('papel acabou'));
          conf = 'tcp: status ok, dados aceitos';
        } else if (STRICT && data.__escpos) {
          return done(new Error('impressora não respondeu à consulta de status (PRINT_CONFIRM=status)'));
        }
        sock.write(data, (err) => {
          if (err) return done(err);
          // aguarda o buffer ser entregue e fecha de forma ordenada
          sock.end(() => setTimeout(() => done(null, conf), 300));
        });
      } catch (e) { done(e); }
    });
  });
}

// ---------- CUPS (Linux/macOS) ----------
async function cupsPrint(queue, data, kind) {
  const args = ['-d', queue, ...(kind === 'escpos' ? ['-o', 'raw'] : [])];
  const child = execFile('lp', args);
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  const err = await new Promise((res) => {
    let e = '';
    child.stderr.on('data', (d) => (e += d));
    child.on('close', (code) => res(code === 0 ? null : e || `lp saiu com código ${code}`));
    child.stdin.end(data);
  });
  if (err) throw new Error(`lp falhou: ${String(err).trim()}`);
  const id = out.match(/request id is (\S+)/)?.[1];
  if (!id) throw new Error('lp não devolveu o número do job');
  // confirma: o job precisa sair da fila de pendentes sem erro
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const { stdout } = await sh('lpstat', ['-W', 'not-completed', '-o', queue]).catch(() => ({ stdout: '' }));
    if (!stdout.includes(id)) {
      const done = await sh('lpstat', ['-W', 'completed', '-o', queue]).catch(() => ({ stdout: '' }));
      if (done.stdout.includes(id)) return `cups: job ${id} concluído`;
      throw new Error(`job ${id} não consta como concluído (cancelado ou com erro no CUPS)`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  await sh('cancel', [id]).catch(() => {}); // evita impressão tardia duplicada
  throw new Error(`job ${id} não terminou em 60s; cancelado (verifique papel/conexão da impressora)`);
}

// ---------- Dispositivo/arquivo (ex.: /dev/usb/lp0) ----------
async function filePrint(path, data) {
  // Segurança: o conteúdo da comanda inclui textos digitados por clientes, então nunca gravamos em arquivos comuns.
  // Só dispositivos (/dev/...) ou uma pasta liberada explicitamente em ALLOW_FILE_DIR (útil para testes).
  const resolved = pathMod.resolve(path);
  const allowDir = process.env.ALLOW_FILE_DIR ? pathMod.resolve(process.env.ALLOW_FILE_DIR) + pathMod.sep : null;
  if (!(resolved.startsWith('/dev/') || (allowDir && resolved.startsWith(allowDir)))) {
    throw new Error(`destino de arquivo não permitido: ${path} (use /dev/... ou defina ALLOW_FILE_DIR)`);
  }
  await fs.promises.appendFile(path, data);
  return `dispositivo: ${data.length} bytes gravados em ${path}`;
}

async function print(job) {
  const data = Buffer.from(job.data_b64, 'base64');
  const t = job.target;
  if (t.startsWith('tcp://')) {
    const u = new URL(t);
    data.__escpos = job.kind === 'escpos';
    return tcpPrint(u.hostname, Number(u.port || 9100), data);
  }
  if (t.startsWith('cups:')) return cupsPrint(t.slice(5), data, job.kind);
  if (t.startsWith('file:')) return filePrint(t.slice(5), data);
  throw new Error(`destino desconhecido: ${t}`);
}

// Jobs já impressos por este processo cujo resultado ainda não chegou ao servidor.
// Evita imprimir duas vezes caso o servidor devolva o job (lock vencido) antes de recebermos o "ok".
const printed = new Map();

async function report(id, payload) {
  for (let i = 0; i < 6; i++) {
    try { await api(`/api/print/jobs/${id}/result`, { ...payload, agent: NAME }); return true; }
    catch (e) { log('não consegui reportar resultado, tentando de novo:', e.message); await new Promise((r) => setTimeout(r, 2000 * (i + 1))); }
  }
  return false;
}

async function tick() {
  const { jobs } = await api('/api/print/claim', { agent: NAME, limit: 5 });
  for (const job of jobs) {
    if (printed.has(job.id)) { await report(job.id, { success: true, confirmation: printed.get(job.id) }); printed.delete(job.id); continue; }
    log(`imprimindo pedido #${job.order_number} (${job.copy_type}, ${job.paper}) → ${job.target}`);
    try {
      const confirmation = await print(job);
      printed.set(job.id, confirmation);
      log(`  ok: ${confirmation}`);
      if (await report(job.id, { success: true, confirmation })) printed.delete(job.id);
    } catch (e) {
      log(`  falhou: ${e.message}`);
      await report(job.id, { success: false, error: e.message });
    }
  }
  return jobs.length;
}

let stop = false;
process.on('SIGINT', () => { stop = true; });
process.on('SIGTERM', () => { stop = true; });

try {
  const ping = await api('/api/print/ping', null, 'GET');
  log(`conectado a ${SERVER} como "${NAME}". Impressoras cadastradas: ${ping.printers.length}`);
} catch (e) { console.error('Não foi possível validar a conexão:', e.message); if (ONCE) process.exit(1); }

do {
  try { await tick(); } catch (e) { log('erro:', e.message); }
  if (ONCE) break;
  await new Promise((r) => setTimeout(r, POLL_MS));
} while (!stop);
