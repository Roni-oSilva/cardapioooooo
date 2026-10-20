// Teste de integração ponta a ponta. Cria um banco limpo (cardapio_test), sobe o servidor
// (precisa de `npm run build` antes), roda o agente de impressão de verdade e confere cada requisito.
import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { loadEnv } from './env.mjs';

loadEnv();
const ADMIN_URL = process.env.DATABASE_URL;
const TEST_DB = 'cardapio_test';
const TEST_URL = ADMIN_URL.replace(/\/[^/]+$/, `/${TEST_DB}`);
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const TOKEN = 'e2e-agent-token-123456';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cardapio-e2e-'));
const env = { ...process.env, DATABASE_URL: TEST_URL, PRINT_AGENT_TOKEN: TOKEN, UPLOAD_DIR: path.join(tmp, 'up'), SEED_ADMIN_PASSWORD: 'admin12345', PORT: String(PORT) };

let passed = 0, failed = 0;
const ok = (cond, msg, extra) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg, extra ?? ''); } };
const section = (s) => console.log('\n' + s);

// ---- banco limpo ----
const root = new pg.Client({ connectionString: ADMIN_URL }); await root.connect();
await root.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`); await root.query(`CREATE DATABASE ${TEST_DB}`); await root.end();
for (const s of ['migrate', 'seed']) {
  const r = spawnSync('node', [`scripts/${s}.mjs`], { env, encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); process.exit(1); }
}
const db = new pg.Client({ connectionString: TEST_URL }); await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;

// ---- servidor ----
const server = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', (d) => (serverLog += d)); server.stderr.on('data', (d) => (serverLog += d));
const cleanup = async () => { server.kill('SIGTERM'); fakePrinter.close(); await db.end().catch(() => {}); fs.rmSync(tmp, { recursive: true, force: true }); };
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/api/menu')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

let cookie = '';
const api = async (method, url, body, { auth = true, headers = {}, raw = false } = {}) => {
  const res = await fetch(BASE + url, {
    method, headers: { ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), ...(auth && cookie ? { cookie } : {}), ...headers },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body), redirect: 'manual',
  });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, res };
};
const loginAs = async (email, password) => {
  const r = await api('POST', '/api/auth/login', { email, password }, { auth: false });
  return { r, cookie: (r.res.headers.get('set-cookie') || '').split(';')[0] };
};
const agent = (extra = {}) => spawnSync('node', ['agent/print-agent.mjs', '--once'], { env: { ...process.env, ALLOW_FILE_DIR: tmp, SERVER_URL: BASE, PRINT_AGENT_TOKEN: TOKEN, ...extra }, encoding: 'utf8' });

// agente assíncrono (o servidor falso de impressora vive neste mesmo processo, então não pode bloquear)
const agentAsync = (extra = {}) => new Promise((resolve) => {
  const c = spawn('node', ['agent/print-agent.mjs', '--once'], { env: { ...process.env, ALLOW_FILE_DIR: tmp, SERVER_URL: BASE, PRINT_AGENT_TOKEN: TOKEN, ...extra } });
  let out = ''; c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (out += d)); c.on('close', () => resolve(out));
});
// impressora térmica de rede falsa: responde às consultas de status ESC/POS (DLE EOT n) e guarda o que recebe
let fakeMode = 'online'; const fakeReceived = []; const fakeQueries = [];
const fakePrinter = net.createServer((sock) => {
  sock.on('data', (b) => {
    if (b.length === 3 && b[0] === 0x10 && b[1] === 0x04) {
      fakeQueries.push(b[2]);
      if (fakeMode === 'mute') return;
      if (b[2] === 1) return sock.write(Buffer.from([fakeMode === 'offline' ? 0x1a : 0x12]));
      if (b[2] === 4) return sock.write(Buffer.from([fakeMode === 'paper-out' ? 0x72 : 0x12]));
    } else fakeReceived.push(b);
  });
});
await new Promise((r) => fakePrinter.listen(9199, '127.0.0.1', r));

try {
  section('Autenticação e permissões');
  ok((await api('GET', '/api/admin/orders', undefined, { auth: false })).status === 401, 'API do painel exige login');
  ok((await api('GET', '/admin', undefined, { auth: false })).status === 307, 'página /admin redireciona para o login');
  ok((await loginAs('admin@restaurante.com', 'senha-errada')).r.status === 401, 'senha errada é recusada');
  const adm = await loginAs('admin@restaurante.com', 'admin12345');
  ok(adm.r.status === 200 && adm.cookie, 'admin entra'); cookie = adm.cookie;
  const wUser = await api('POST', '/api/admin/users', { name: 'Garçom', email: 'garcom@x.com', password: 'garcom1234', role: 'waiter' });
  ok(wUser.status === 201, 'admin cria usuário garçom');
  const waiter = await loginAs('garcom@x.com', 'garcom1234');
  const asWaiter = (m, u, b) => api(m, u, b, { headers: { cookie: waiter.cookie }, auth: false });
  ok((await asWaiter('GET', '/api/admin/finance')).status === 403, 'garçom não acessa financeiro');
  ok((await asWaiter('GET', '/api/admin/users')).status === 403, 'garçom não gerencia usuários');
  ok((await asWaiter('GET', '/api/admin/tables')).status === 200, 'garçom acessa mesas');

  section('Cardápio público');
  const menu = (await api('GET', '/api/menu', undefined, { auth: false })).data;
  ok(menu.products.length >= 10 && menu.categories.length >= 5, 'cardápio carregado do banco');
  const fm = menu.products.find((p) => p.name === 'Filé-mignon');
  const salmao = menu.products.find((p) => p.name === 'Salmão grelhado');
  const g = (p, n) => p.groups.find((x) => x.name === n);
  const opt = (p, gn, on) => g(p, gn).options.find((o) => o.name === on).id;
  ok(!JSON.stringify(menu).includes('password'), 'resposta pública não vaza dados sensíveis');

  section('Impressoras (cadastro)');
  const kitchenFile = path.join(tmp, 'cozinha.bin'), serviceFile = path.join(tmp, 'atendimento.bin');
  ok((await api('POST', '/api/admin/printers', { name: 'Cozinha 80mm', copy_type: 'cozinha', paper: '80', target: 'file:' + kitchenFile })).status === 201, 'cadastra impressora da cozinha (80mm)');
  ok((await api('POST', '/api/admin/printers', { name: 'Caixa 58mm', copy_type: 'atendimento', paper: '58', target: 'file:' + serviceFile })).status === 201, 'cadastra impressora de atendimento (58mm)');
  ok((await api('POST', '/api/admin/printers', { name: 'x', copy_type: 'cozinha', paper: '80', target: 'rm -rf /' })).status === 400, 'recusa destino de impressora malformado');

  section('Criação de pedido');
  const mesa = menu.tables.find((t) => t.label === '5').id;
  const mk = (extra = {}) => ({
    idempotency_key: crypto.randomUUID(), service_type: 'salao', table_id: mesa, customer_name: 'Maria',
    items: [
      { product_id: fm.id, quantity: 2, notes: 'SEM CEBOLA', option_ids: [opt(fm, 'Ponto da carne', 'Ao ponto'), opt(fm, 'Acompanhamento', 'Risoto de funghi'), opt(fm, 'Adicionais', 'Molho da casa')] },
      { product_id: salmao.id, quantity: 1, notes: 'POUCO SAL', option_ids: [opt(salmao, 'Acompanhamento', 'Legumes')] },
    ], ...extra,
  });
  const body1 = mk({ notes: 'Trazer pães' });
  // tentativa de fraudar preço: campos extras são ignorados e o total vem do banco
  const tampered = { ...body1, items: body1.items.map((i) => ({ ...i, price_cents: 1, unit_price_cents: 1 })), total_cents: 1 };
  const o1 = await api('POST', '/api/orders', tampered, { auth: false });
  ok(o1.status === 201 && o1.data.number >= 1001, 'pedido criado com número único', o1.data);
  const row = (await q('SELECT * FROM orders WHERE id=$1', [o1.data.id]))[0];
  const expected = 2 * (14800 + 800) + 11200;
  ok(row.total_cents === expected, `total calculado no servidor (R$ ${expected / 100}) ignora preço do cliente`, row.total_cents);
  const items = await q(`SELECT oi.product_name, oi.quantity, oi.notes, (SELECT string_agg(group_name||'='||option_name, ';' ORDER BY position) FROM order_item_options x WHERE x.order_item_id=oi.id) AS opts FROM order_items oi WHERE order_id=$1 ORDER BY position`, [row.id]);
  ok(items[0].opts === 'Ponto da carne=Ao ponto;Acompanhamento=Risoto de funghi;Adicionais=Molho da casa' && items[0].notes === 'SEM CEBOLA', 'opções e observações do item gravadas', items[0]);
  ok(row.status === 'aguardando_impressao', 'pedido fica "aguardando impressão" com impressoras configuradas', row.status);
  ok((await q('SELECT count(*)::int c FROM print_jobs WHERE order_id=$1', [row.id]))[0].c === 2, 'duas vias enfileiradas (cozinha + atendimento)');

  const dup = await api('POST', '/api/orders', body1, { auth: false });
  const dup2 = await api('POST', '/api/orders', tampered, { auth: false });
  ok(dup.data.duplicate === true && dup.data.number === o1.data.number, 'reenvio com a mesma chave devolve o mesmo pedido (sem duplicar)');
  const racy = mk(); const rs = await Promise.all(Array.from({ length: 8 }, () => api('POST', '/api/orders', racy, { auth: false })));
  ok(new Set(rs.map((r) => r.data.number)).size === 1 && rs.every((r) => r.status < 300), '8 cliques simultâneos geram 1 único pedido', rs.map((r) => r.data.number));
  ok((await q('SELECT count(*)::int c FROM orders'))[0].c === 2, 'banco com exatamente 2 pedidos até aqui');

  const bad = mk(); bad.items[0].option_ids = [opt(fm, 'Acompanhamento', 'Risoto de funghi')];
  const r400 = await api('POST', '/api/orders', bad, { auth: false });
  ok(r400.status === 400 && /ponto/i.test(r400.data.error), 'recusa grupo obrigatório ausente (ponto da carne)', r400.data);
  const bad2 = mk(); bad2.items[0].option_ids.push(opt(salmao, 'Acompanhamento', 'Legumes'));
  ok((await api('POST', '/api/orders', bad2, { auth: false })).status === 400, 'recusa opção de outro produto');
  ok((await api('POST', '/api/orders', mk({ table_id: null }), { auth: false })).status === 400, 'salão sem mesa é recusado');
  ok((await api('POST', '/api/orders', mk({ items: [] }), { auth: false })).status === 400, 'pedido sem itens é recusado');
  ok((await api('POST', '/api/orders', mk({ service_type: 'entrega', table_id: null }), { auth: false })).status === 400, 'entrega desabilitada/sem endereço é recusada');

  section('Impressão automática via agente');
  const dry = agent({ PRINT_AGENT_TOKEN: 'token-errado-xyz-123' });
  ok(/401|inválido/i.test(dry.stdout + dry.stderr), 'agente com token errado é recusado');
  const run1 = agent();
  ok(run1.status === 0, 'agente executa', run1.stderr);
  const jobs = await q('SELECT copy_type, status, attempts, is_reprint FROM print_jobs WHERE order_id=$1 ORDER BY copy_type', [row.id]);
  ok(jobs.every((j) => j.status === 'printed' && j.attempts === 1), 'os dois jobs ficam "printed" com 1 tentativa', jobs);
  ok((await q('SELECT status FROM orders WHERE id=$1', [row.id]))[0].status === 'recebido', 'após imprimir a via da cozinha o pedido volta a "recebido"');
  ok((await q('SELECT count(*)::int c FROM print_attempts WHERE success')).at(0).c >= 2, 'tentativas de impressão registradas');
  const kb = fs.readFileSync(kitchenFile); const kt = kb.toString('latin1');
  ok(kb[0] === 0x1b && kb[1] === 0x40, 'via cozinha começa com ESC @ (ESC/POS)');
  ok(kt.includes('2x FIL') && kt.includes('PONTO DA CARNE: AO PONTO') && kt.includes('RISOTO DE FUNGHI') && kt.includes('MOLHO DA CASA') && kt.includes('SEM CEBOLA'), 'via cozinha traz quantidade, ponto, acompanhamento, adicional e observação');
  ok(!/R\$|\d+,\d{2}/.test(kt), 'via cozinha NÃO exibe preços');
  ok(kt.includes('MESA 5') && kt.includes('VIA COZINHA') && kt.includes('PEDIDO N'), 'via cozinha traz mesa e número do pedido');
  ok(kb.includes(Buffer.from([0x1d, 0x56, 0x42])), 'via cozinha termina com comando de corte');
  const st = fs.readFileSync(serviceFile).toString('latin1');
  ok(st.includes('TOTAL DO PEDIDO') && st.includes('VIA ATENDIMENTO') && /R\$\s*\d/.test(st), 'via atendimento mostra valores');
  ok(Math.max(...st.split('\n').map((l) => l.replace(/[\x00-\x1f\x1d][^\n]{0,3}/g, '').length)) <= 40, 'via 58mm respeita largura (sem linhas estouradas)');

  section('Falha de impressão, nova tentativa e reimpressão');
  const badFile = path.join(tmp, 'nao-existe', 'lp0');
  await q(`UPDATE printers SET target=$1 WHERE copy_type='cozinha'`, ['file:' + badFile]);
  const o2 = await api('POST', '/api/orders', mk({ customer_name: 'João', table_id: mesa }), { auth: false });
  const id2 = o2.data.id;
  const failRun = agent();
  const j2 = (await q(`SELECT status, attempts, last_error, next_attempt_at > now() AS backoff FROM print_jobs WHERE order_id=$1 AND copy_type='cozinha'`, [id2]))[0];
  ok(j2.status === 'queued' && j2.attempts === 1 && j2.last_error && j2.backoff, 'falha é registrada e re-agendada com espera', j2);
  ok((await q('SELECT status FROM orders WHERE id=$1', [id2]))[0].status === 'aguardando_impressao', 'pedido NÃO é marcado como impresso quando falha');
  ok((await q(`SELECT count(*)::int c FROM print_attempts WHERE NOT success`))[0].c >= 1, 'tentativa com erro fica no histórico');
  await q(`UPDATE print_jobs SET attempts=max_attempts-1, next_attempt_at=now() WHERE order_id=$1 AND copy_type='cozinha'`, [id2]);
  agent();
  const j3 = (await q(`SELECT id, status FROM print_jobs WHERE order_id=$1 AND copy_type='cozinha'`, [id2]))[0];
  ok(j3.status === 'failed', 'esgotadas as tentativas o job fica "failed"');
  const retry = await api('POST', `/api/admin/print-jobs/${j3.id}/retry`);
  ok(retry.status === 200, 'admin pode tentar novamente');
  await q(`UPDATE printers SET target=$1 WHERE copy_type='cozinha'`, ['file:' + kitchenFile]);
  agent();
  ok((await q('SELECT status FROM print_jobs WHERE id=$1', [j3.id]))[0].status === 'printed', 'após corrigir a impressora a nova tentativa imprime');
  ok((await q('SELECT status FROM orders WHERE id=$1', [id2]))[0].status === 'recebido', 'pedido sai de "aguardando impressão" só após impressão confirmada');
  const rp = await api('POST', `/api/admin/orders/${id2}/print`, { copy_type: 'cozinha' });
  ok(rp.data.queued === 1, 'reimpressão enfileirada');
  agent();
  ok(fs.readFileSync(kitchenFile).toString('latin1').includes('REIMPRESS'), 'comanda reimpressa traz identificação "REIMPRESSÃO"');
  ok((await q(`SELECT count(*)::int c FROM print_jobs WHERE order_id=$1 AND is_reprint`, [id2]))[0].c === 1, 'reimpressão marcada no banco');

  section('Páginas de impressão (navegador)');
  const html80 = await api('GET', `/comanda/${id2}?via=cozinha&paper=80`);
  ok(html80.status === 200 && /@page/.test(html80.data) && /80mm/.test(html80.data) && /FIL/.test(html80.data), 'comanda HTML 80mm com CSS de impressão');
  const htmlA4 = await api('GET', `/comanda/${id2}?via=atendimento&paper=a4`);
  ok(htmlA4.status === 200 && /A4/i.test(htmlA4.data), 'comanda HTML A4');
  ok((await api('GET', `/comanda/${id2}`, undefined, { auth: false })).status === 307, 'comanda exige login');

  section('Lista e filtros de pedidos');
  const all = await api('GET', '/api/admin/orders');
  ok(all.status === 200 && all.data.orders.length >= 3 && all.data.orders[0].items.length > 0, 'lista de pedidos sem filtros', all.data);
  const byTable = await api('GET', `/api/admin/orders?table=${mesa}&status=recebido`);
  ok(byTable.status === 200 && byTable.data.orders.every((o) => o.table_label === '5' && o.status === 'recebido'), 'filtra por mesa e status');
  const byNum = await api('GET', `/api/admin/orders?q=${o1.data.number}`);
  ok(byNum.data.orders.length === 1 && byNum.data.orders[0].number === o1.data.number, 'filtra por número do pedido');
  const today = new Date().toISOString().slice(0, 10);
  ok((await api('GET', `/api/admin/orders?from=${today}&to=${today}`)).data.orders.length >= 3, 'filtra por período');
  ok((await api('GET', '/api/admin/orders?from=2000-01-01&to=2000-01-02')).data.orders.length === 0, 'período sem pedidos devolve lista vazia');

  section('Fluxo de status e cozinha');
  const k = (await api('GET', '/api/admin/kitchen')).data;
  ok(k.orders.length === 3 && k.orders[0].items.length === 2 && k.orders[0].table_label === '5', 'monitor da cozinha lista pedidos com itens e mesa');
  ok((await api('PATCH', `/api/admin/orders/${id2}`, { status: 'pronto' })).status === 409, 'não pula etapas de status');
  ok((await api('PATCH', `/api/admin/orders/${id2}`, { status: 'em_preparo' })).status === 200, 'inicia preparo');
  ok((await api('PATCH', `/api/admin/orders/${id2}`, { status: 'pronto' })).status === 200, 'marca pronto');
  ok((await api('PATCH', `/api/admin/orders/${id2}`, { status: 'entregue' })).status === 200, 'marca entregue');
  const full = (await api('GET', `/api/admin/orders/${id2}`)).data.order;
  ok(full.history.length >= 5 && full.items[0].options.length === 3 && full.jobs.length >= 3, 'histórico, opções e jobs de impressão no detalhe do pedido', full.history.map((h) => h.to_status));
  const kitchenUser = await api('POST', '/api/admin/users', { name: 'Chef', email: 'chef@x.com', password: 'chef12345', role: 'kitchen' });
  const chef = await loginAs('chef@x.com', 'chef12345');
  ok((await api('PATCH', `/api/admin/orders/${row.id}`, { status: 'cancelado', reason: 'x' }, { headers: { cookie: chef.cookie }, auth: false })).status === 403, 'cozinha não cancela pedidos');
  ok((await api('PATCH', `/api/admin/orders/${row.id}`, { status: 'em_preparo' }, { headers: { cookie: chef.cookie }, auth: false })).status === 200, 'cozinha atualiza status');

  section('Mesas, conta, pagamento e financeiro');
  const tabs = (await api('GET', '/api/admin/tables')).data.tables;
  const t5 = tabs.find((t) => t.label === '5');
  ok(t5.occupied && t5.orders_count === 3 && t5.orders_total === expected * 3, 'mesa 5 ocupada com os 2 pedidos na mesma conta', t5);
  const o3 = await api('POST', '/api/orders', mk({ table_id: mesa, items: [{ product_id: menu.products.find((p) => p.name === 'Tiramisù').id, quantity: 1, option_ids: [], notes: '' }] }), { auth: false });
  const cancelled = await api('PATCH', `/api/admin/orders/${o3.data.id}`, { status: 'cancelado' });
  ok(cancelled.status === 400, 'cancelamento exige motivo');
  ok((await api('PATCH', `/api/admin/orders/${o3.data.id}`, { status: 'cancelado', reason: 'Cliente desistiu' })).status === 200, 'cancela com motivo');
  const detail = (await api('GET', `/api/admin/tabs/${t5.tab_id}`)).data;
  ok(detail.totals.orders_total === expected * 3 && detail.orders.length === 4, 'pedido cancelado não entra no total da conta', detail.totals);
  const total = detail.totals.orders_total;
  const wClose = await asWaiter('POST', `/api/admin/tabs/${t5.tab_id}/close`, { discount_cents: 1000, discount_reason: 'cortesia', payments: [] });
  ok(wClose.status === 403, 'garçom não autoriza desconto');
  ok((await api('POST', `/api/admin/tabs/${t5.tab_id}/close`, { payments: [{ method: 'pix', amount_cents: 100 }] })).status === 400, 'pagamentos que não fecham a conta são recusados');
  ok((await api('POST', `/api/admin/tabs/${t5.tab_id}/close`, { discount_cents: 500, payments: [] })).status === 400, 'desconto exige motivo');
  const due = total - 1000;
  const closed = await api('POST', `/api/admin/tabs/${t5.tab_id}/close`, { discount_cents: 1000, discount_reason: 'Cortesia da casa', payments: [{ method: 'pix', amount_cents: 20000, payer_label: 'Maria' }, { method: 'credito', amount_cents: due - 20000, payer_label: 'João' }] });
  ok(closed.status === 200 && closed.data.due === due, 'conta dividida em duas formas de pagamento é fechada', closed.data);
  ok((await api('POST', `/api/admin/tabs/${t5.tab_id}/close`, { payments: [] })).status === 409, 'conta fechada não fecha de novo');
  ok((await api('PATCH', `/api/admin/orders/${row.id}`, { status: 'cancelado', reason: 'tarde demais' })).status === 409, 'não cancela pedido de conta já paga');
  const tabsAfter = (await api('GET', '/api/admin/tables')).data.tables;
  ok(!tabsAfter.find((t) => t.label === '5').occupied, 'mesa fica livre após fechar a conta');
  // pedido de retirada sem pagamento = registrado mas não recebido
  const pick = await api('POST', '/api/orders', { idempotency_key: crypto.randomUUID(), service_type: 'retirada', customer_name: 'Ana', items: [{ product_id: menu.products.find((p) => p.name === 'Petit gâteau').id, quantity: 2, option_ids: [], notes: '' }] }, { auth: false });
  const fin = (await api('GET', '/api/admin/finance')).data;
  ok(fin.received === due, `faturamento recebido = pagamentos (R$ ${due / 100})`, fin.received);
  ok(fin.registered_total === expected * 3 + 7600, 'pedidos registrados incluem o não pago (retirada)', fin.registered_total);
  ok(fin.receivable === 7600, 'valor a receber = conta aberta da retirada', fin.receivable);
  ok(fin.cancelled_count === 1 && fin.cancellations[0].cancel_reason === 'Cliente desistiu', 'cancelamentos com motivo no relatório');
  ok(fin.discounts.length === 1 && fin.discounts[0].discount_cents === 1000 && fin.discounts[0].authorized_by === 'Administrador', 'desconto autorizado registrado com responsável');
  ok(fin.byMethod.find((m) => m.method === 'pix').total === 20000, 'totais por forma de pagamento');
  const dash = (await api('GET', '/api/admin/dashboard?range=week')).data;
  ok(dash.received === due && dash.orders === 4 && dash.cancelled === 1 && dash.avg_ticket === Math.round(dash.registered / 4), 'dashboard calcula a partir dos dados reais', { r: dash.received, o: dash.orders });
  ok(dash.top[0].name === 'Filé-mignon' && dash.top[0].qty === 6, 'produtos mais vendidos', dash.top[0]);
  ok(dash.series.length === 7 && dash.series.reduce((a, s) => a + s.received, 0) === due, 'série por dia soma o faturamento');
  const csv = await api('GET', '/api/admin/finance/export?type=payments');
  ok(csv.status === 200 && /pix;200,00/.test(csv.data), 'exportação CSV de pagamentos', [csv.status, String(csv.data).slice(0, 300)]);

  section('Cardápio: administração, upload e disponibilidade');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const fd = new FormData(); fd.append('file', new Blob([png], { type: 'image/png' }), 'x.png');
  const up = await fetch(BASE + '/api/admin/upload', { method: 'POST', body: fd, headers: { cookie } });
  const upj = await up.json();
  ok(up.status === 201 && /^\/api\/uploads\/[\w-]+\.png$/.test(upj.url), 'upload de imagem válida');
  const served = await fetch(BASE + upj.url);
  ok(served.status === 200 && served.headers.get('content-type') === 'image/png', 'imagem é servida publicamente');
  const fd2 = new FormData(); fd2.append('file', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'x.png');
  ok((await fetch(BASE + '/api/admin/upload', { method: 'POST', body: fd2, headers: { cookie } })).status === 415, 'recusa arquivo que não é imagem mesmo com tipo falsificado');
  const cat = (await api('POST', '/api/admin/categories', { name: 'Especiais do chef', sort_order: 99 })).data.category;
  const np = await api('POST', '/api/admin/products', { category_id: cat.id, name: 'Prato teste', description: 'd', price_cents: 5000, image_url: upj.url, prep_minutes: 12, allergens: ['glúten'], featured: true,
    groups: [{ name: 'Molho', required: true, min_select: 1, max_select: 1, options: [{ name: 'Madeira', price_cents: 300 }, { name: 'Mostarda', price_cents: 0 }] }] });
  ok(np.status === 201, 'cria produto com grupo de opções');
  let m2 = (await api('GET', '/api/menu', undefined, { auth: false })).data;
  const pt = m2.products.find((p) => p.name === 'Prato teste');
  ok(pt && pt.groups[0].options.length === 2 && pt.image_url === upj.url, 'produto novo aparece no cardápio público');
  await api('PATCH', `/api/admin/products/${np.data.id}`, { available: false });
  m2 = (await api('GET', '/api/menu', undefined, { auth: false })).data;
  ok(m2.products.find((p) => p.name === 'Prato teste').orderable === false, 'produto indisponível aparece como não pedível');
  const na = await api('POST', '/api/orders', { idempotency_key: crypto.randomUUID(), service_type: 'retirada', customer_name: 'Z', items: [{ product_id: np.data.id, quantity: 1, option_ids: [], notes: '' }] }, { auth: false });
  ok(na.status === 409, 'servidor recusa pedir produto indisponível', na.data);
  await api('PATCH', `/api/admin/products/${np.data.id}`, { available: true });
  await q(`UPDATE products SET available_from='00:00', available_until='00:01' WHERE id=$1`, [np.data.id]);
  m2 = (await api('GET', '/api/menu', undefined, { auth: false })).data;
  const hr = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  ok(m2.products.find((p) => p.name === 'Prato teste').orderable === (hr <= '00:01'), 'disponibilidade por horário respeitada');
  await api('DELETE', `/api/admin/products/${np.data.id}`);
  m2 = (await api('GET', '/api/menu', undefined, { auth: false })).data;
  ok(!m2.products.find((p) => p.name === 'Prato teste'), 'produto arquivado some do cardápio');
  const audit = (await api('GET', '/api/admin/audit')).data.log.map((l) => l.action);
  ok(['product.create', 'tab.close', 'order.cancel', 'order.reprint', 'login'].every((a) => audit.includes(a)), 'ações administrativas registradas no log de auditoria', audit);

  section('Acompanhamento do cliente e tempo real');
  ok((await api('GET', `/api/orders/track?n=${pick.data.number}&t=${pick.data.token}`, undefined, { auth: false })).status === 200, 'cliente acompanha pedido com o token');
  ok((await api('GET', `/api/orders/track?n=${pick.data.number}&t=0000`, undefined, { auth: false })).status === 404, 'token errado não revela o pedido');
  const sse = await fetch(BASE + '/api/realtime', { headers: { cookie } });
  const reader = sse.body.getReader();
  const waitEvent = (async () => { const dec = new TextDecoder(); let buf = ''; const t0 = Date.now(); while (Date.now() - t0 < 8000) { const { value } = await reader.read(); buf += dec.decode(value || new Uint8Array()); if (buf.includes('order.created')) return true; } return false; })();
  await new Promise((r) => setTimeout(r, 400));
  await api('POST', '/api/orders', { idempotency_key: crypto.randomUUID(), service_type: 'retirada', customer_name: 'Rt', items: [{ product_id: menu.products.find((p) => p.name === 'Tiramisù').id, quantity: 1, option_ids: [], notes: '' }] }, { auth: false });
  ok(await waitEvent, 'novo pedido chega em tempo real (SSE/LISTEN-NOTIFY)');
  reader.cancel().catch(() => {});

  section('Impressora de rede (TCP/ESC-POS) e CUPS');
  const mkOrder = async () => (await api('POST', '/api/orders', mk({ customer_name: 'TCP' }), { auth: false })).data;
  const jobOf = async (orderId, type) => (await q(`SELECT status, attempts, last_error, id FROM print_jobs WHERE order_id=$1 AND copy_type=$2 AND NOT is_reprint`, [orderId, type]))[0];
  await q(`UPDATE printers SET target='tcp://127.0.0.1:9199' WHERE copy_type='cozinha'`);
  await q(`UPDATE printers SET active=false WHERE copy_type='atendimento'`);
  let ord = await mkOrder(); fakeReceived.length = 0; fakeQueries.length = 0; fakeMode = 'online';
  let log = await agentAsync();
  ok((await jobOf(ord.id, 'cozinha')).status === 'printed' && /status ok/.test(log), 'TCP: impressora online → impresso com status confirmado', log);
  ok(fakeQueries.includes(1) && fakeQueries.includes(4), 'TCP: agente consultou status e sensor de papel antes de imprimir');
  const tcpBytes = Buffer.concat(fakeReceived);
  ok(tcpBytes[0] === 0x1b && tcpBytes.toString('latin1').includes('MESA 5'), 'TCP: impressora recebeu a comanda ESC/POS completa');
  ord = await mkOrder(); fakeMode = 'offline'; fakeReceived.length = 0;
  log = await agentAsync(); let jb = await jobOf(ord.id, 'cozinha');
  ok(jb.status === 'queued' && /offline/.test(jb.last_error) && fakeReceived.length === 0, 'TCP: impressora offline → NÃO imprime e NÃO marca como impresso', jb);
  await q(`UPDATE print_jobs SET next_attempt_at=now() WHERE id=$1`, [jb.id]); fakeMode = 'paper-out';
  await agentAsync(); jb = await jobOf(ord.id, 'cozinha');
  ok(jb.status === 'queued' && /papel/.test(jb.last_error), 'TCP: sem papel é detectado e registrado', jb.last_error);
  await q(`UPDATE print_jobs SET next_attempt_at=now() WHERE id=$1`, [jb.id]); fakeMode = 'mute';
  await agentAsync({ PRINT_CONFIRM: 'status' }); jb = await jobOf(ord.id, 'cozinha');
  ok(jb.status === 'queued' && /status/.test(jb.last_error), 'TCP: modo estrito recusa impressora que não responde ao status', jb.last_error);
  await q(`UPDATE print_jobs SET next_attempt_at=now() WHERE id=$1`, [jb.id]);
  log = await agentAsync(); jb = await jobOf(ord.id, 'cozinha');
  ok(jb.status === 'printed' && /sem resposta de status/.test(log), 'TCP: modo padrão imprime e registra que não houve status', log);
  ok((await q(`SELECT confirmation FROM print_attempts WHERE job_id=$1 AND success`, [jb.id]))[0].confirmation.includes('sem resposta'), 'nível de confirmação fica gravado no histórico');

  // CUPS com comandos lp/lpstat/cancel simulados
  const bin = path.join(tmp, 'bin'); fs.mkdirSync(bin);
  const capture = path.join(tmp, 'cups.bin');
  fs.writeFileSync(path.join(bin, 'lp'), `#!/bin/sh\ncat > "${capture}"\necho "$@" > "${capture}.args"\necho "request id is FAKE-42 (1 file(s))"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'lpstat'), `#!/bin/sh\ncase "$*" in *not-completed*) :;; *completed*) echo "FAKE-42 root 1024 Tue";; esac\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'cancel'), `#!/bin/sh\nexit 0\n`, { mode: 0o755 });
  await q(`UPDATE printers SET target='cups:FAKE', paper='a4', active=true WHERE copy_type='atendimento'`);
  await q(`UPDATE printers SET active=false WHERE copy_type='cozinha'`);
  ord = await mkOrder();
  log = await agentAsync({ PATH: `${bin}:${process.env.PATH}` });
  jb = await jobOf(ord.id, 'atendimento');
  ok(jb.status === 'printed' && /cups: job FAKE-42 concluído/.test(log), 'CUPS: job concluído é confirmado e marcado como impresso', log);
  ok(fs.readFileSync(capture, 'utf8').includes('TOTAL DO PEDIDO') && !fs.readFileSync(capture).includes(0x1b), 'CUPS/A4: envia texto simples (não ESC/POS) com valores');
  fs.writeFileSync(path.join(bin, 'lpstat'), `#!/bin/sh\ncase "$*" in *not-completed*) :;; esac\n`, { mode: 0o755 }); // some da fila mas não consta como concluído
  ord = await mkOrder(); await agentAsync({ PATH: `${bin}:${process.env.PATH}` });
  jb = await jobOf(ord.id, 'atendimento');
  ok(jb.status === 'queued' && /não consta como concluído/.test(jb.last_error), 'CUPS: job que some sem concluir NÃO é marcado como impresso', jb.last_error);
  await q(`UPDATE printers SET active=true, target=$1, paper='80' WHERE copy_type='cozinha'`, ['file:' + kitchenFile]);
  await q(`UPDATE printers SET target=$1, paper='58' WHERE copy_type='atendimento'`, ['file:' + serviceFile]);
  await q(`UPDATE print_jobs SET status='printed' WHERE status IN ('queued','printing','failed')`);

  section('Logout');
  await api('POST', '/api/auth/logout');
  ok((await api('GET', '/api/admin/orders')).status === 401, 'sessão revogada no logout deixa de valer (mesmo com o cookie antigo)');
} catch (e) {
  failed++; console.error('ERRO NO TESTE:', e);
  console.error(serverLog.slice(-2000));
} finally {
  await cleanup();
}
console.log(`\n${passed} verificações ok, ${failed} falhas`);
process.exit(failed ? 1 : 0);
