import { z } from 'zod';
import type { PoolClient } from 'pg';
import { one, query, tx, notify } from './db';
import { HttpError } from './http';
import { getSettings, inWindow, localTime } from './settings';
import { enqueuePrint } from './print-queue';

const optionIds = z.array(z.string().uuid()).max(40).default([]);

export const orderInput = z.object({
  idempotency_key: z.string().min(8).max(100),
  service_type: z.enum(['salao', 'retirada', 'entrega']),
  table_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().trim().max(80).default(''),
  customer_phone: z.string().trim().max(30).default(''),
  delivery_address: z.string().trim().max(250).default(''),
  notes: z.string().trim().max(500).default(''),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
    option_ids: optionIds,
    notes: z.string().trim().max(300).default(''),
  })).min(1, 'Adicione ao menos um item.').max(60),
});
export type OrderInput = z.infer<typeof orderInput>;

export async function createOrder(input: OrderInput, staffId: string | null) {
  // 1) idempotência: mesmo pedido reenviado (duplo clique, falha de rede) devolve o já criado
  const existing = await one<{ id: string; number: number; public_token: string }>(
    'SELECT id, number, public_token FROM orders WHERE idempotency_key=$1', [input.idempotency_key]);
  if (existing) return { ...existing, duplicate: true };

  const s = await getSettings();
  if (!s.accepting_orders && !staffId) throw new HttpError(409, 'O restaurante não está recebendo pedidos no momento.');
  const allowed = { salao: s.allow_dine_in, retirada: s.allow_pickup, entrega: s.allow_delivery }[input.service_type];
  if (!allowed) throw new HttpError(400, 'Este tipo de atendimento não está disponível.');
  if (input.service_type === 'salao' && !input.table_id) throw new HttpError(400, 'Informe o número da mesa.');
  if (input.service_type === 'entrega' && (!input.delivery_address || !input.customer_phone)) {
    throw new HttpError(400, 'Informe endereço e telefone para entrega.');
  }
  if (input.service_type === 'retirada' && !input.customer_name) throw new HttpError(400, 'Informe seu nome para retirada.');

  // 2) preços SEMPRE recalculados a partir do banco; o cliente envia apenas IDs e quantidades
  const productIds = [...new Set(input.items.map((i) => i.product_id))];
  const prods = await query(
    `SELECT p.*, c.name AS category_name, c.active AS category_active FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id = ANY($1)`,
    [productIds]);
  const groups = await query('SELECT * FROM option_groups WHERE product_id = ANY($1)', [productIds]);
  const options = await query('SELECT * FROM options WHERE group_id = ANY($1)', [groups.map((g) => g.id)]);
  const now = localTime(s.timezone);

  let subtotal = 0;
  const lines = input.items.map((it, idx) => {
    const p = prods.find((x) => x.id === it.product_id);
    if (!p || p.archived || !p.category_active) throw new HttpError(400, 'Um dos itens não está mais no cardápio.');
    if (!p.available || !inWindow(now, p.available_from, p.available_until)) {
      throw new HttpError(409, `"${p.name}" não está disponível no momento.`);
    }
    const pGroups = groups.filter((g) => g.product_id === p.id);
    const chosen = [...new Set(it.option_ids)];
    const chosenOpts = chosen.map((id) => {
      const o = options.find((x) => x.id === id);
      const g = o && pGroups.find((x) => x.id === o.group_id);
      if (!o || !g) throw new HttpError(400, `Opção inválida em "${p.name}".`);
      if (!o.available) throw new HttpError(409, `A opção "${o.name}" está indisponível.`);
      return { o, g };
    });
    for (const g of pGroups) {
      const n = chosenOpts.filter((x) => x.g.id === g.id).length;
      const min = g.required ? Math.max(1, g.min_select) : g.min_select;
      if (n < min) throw new HttpError(400, `"${p.name}": escolha ${g.name.toLowerCase()}.`);
      if (n > g.max_select) throw new HttpError(400, `"${p.name}": máximo de ${g.max_select} em ${g.name.toLowerCase()}.`);
    }
    const unit = p.price_cents + chosenOpts.reduce((a, x) => a + x.o.price_cents, 0);
    const line = unit * it.quantity;
    subtotal += line;
    return {
      p, it, unit, line, position: idx,
      opts: chosenOpts
        .sort((a, b) => a.g.sort_order - b.g.sort_order)
        .map((x) => ({ group: x.g.name, name: x.o.name, price: x.o.price_cents })),
    };
  });
  const fee = input.service_type === 'entrega' ? s.delivery_fee_cents : 0;
  const total = subtotal + fee;

  try {
    const result = await tx(async (c) => {
      let tableId: string | null = null;
      if (input.service_type === 'salao') {
        const t = await c.query('SELECT id FROM dining_tables WHERE id=$1 AND active', [input.table_id]);
        if (!t.rowCount) throw new HttpError(400, 'Mesa não encontrada.');
        tableId = t.rows[0].id;
      }
      const tabId = await openTab(c, tableId);
      const o = await c.query(
        `INSERT INTO orders(idempotency_key, tab_id, service_type, table_id, customer_name, customer_phone, delivery_address, notes,
                            subtotal_cents, delivery_fee_cents, total_cents, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, number, public_token`,
        [input.idempotency_key, tabId, input.service_type, tableId, input.customer_name, input.customer_phone,
         input.delivery_address, input.notes, subtotal, fee, total, staffId]);
      const order = o.rows[0];
      for (const l of lines) {
        const oi = await c.query(
          `INSERT INTO order_items(order_id, product_id, product_name, category_name, quantity, unit_price_cents, line_total_cents, prep_minutes, notes, position)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [order.id, l.p.id, l.p.name, l.p.category_name, l.it.quantity, l.unit, l.line, l.p.prep_minutes, l.it.notes, l.position]);
        let pos = 0;
        for (const op of l.opts) {
          await c.query(
            'INSERT INTO order_item_options(order_item_id, group_name, option_name, price_cents, position) VALUES ($1,$2,$3,$4,$5)',
            [oi.rows[0].id, op.group, op.name, op.price, pos++]);
        }
      }
      await c.query('INSERT INTO order_status_history(order_id, from_status, to_status, changed_by, note) VALUES ($1,NULL,$2,$3,$4)',
        [order.id, 'recebido', staffId, 'Pedido criado']);
      const q = await enqueuePrint(c, order.id, { requestedBy: staffId });
      if (q.kitchen) {
        await c.query(`UPDATE orders SET status='aguardando_impressao' WHERE id=$1`, [order.id]);
        await c.query('INSERT INTO order_status_history(order_id, from_status, to_status, note) VALUES ($1,$2,$3,$4)',
          [order.id, 'recebido', 'aguardando_impressao', 'Comanda enviada para a fila de impressão']);
      }
      return order as { id: string; number: number; public_token: string };
    });
    await notify('order.created', { orderId: result.id, number: result.number });
    return { ...result, duplicate: false };
  } catch (e: any) {
    // corrida: outra requisição com a mesma chave terminou primeiro
    if (e?.code === '23505' && String(e.constraint).includes('idempotency')) {
      const again = await one<{ id: string; number: number; public_token: string }>(
        'SELECT id, number, public_token FROM orders WHERE idempotency_key=$1', [input.idempotency_key]);
      if (again) return { ...again, duplicate: true };
    }
    throw e;
  }
}

/** Devolve a conta aberta da mesa (criando se preciso) ou cria uma conta avulsa para retirada/entrega. */
export async function openTab(c: PoolClient, tableId: string | null): Promise<string> {
  if (!tableId) return (await c.query('INSERT INTO tabs DEFAULT VALUES RETURNING id')).rows[0].id;
  await c.query(
    `INSERT INTO tabs(table_id) VALUES ($1) ON CONFLICT (table_id) WHERE status='open' AND table_id IS NOT NULL DO NOTHING`, [tableId]);
  return (await c.query(`SELECT id FROM tabs WHERE table_id=$1 AND status='open'`, [tableId])).rows[0].id;
}

export async function tabTotals(tabId: string, c?: PoolClient) {
  const run = c ? (t: string, p: unknown[]) => c.query(t, p as any[]).then((r) => r.rows) : query;
  const [t] = await run(
    `SELECT t.id, t.status, t.discount_cents, t.discount_reason,
            COALESCE((SELECT sum(total_cents) FROM orders o WHERE o.tab_id=t.id AND o.status<>'cancelado'),0)::int AS orders_total,
            COALESCE((SELECT sum(amount_cents) FROM payments p WHERE p.tab_id=t.id),0)::int AS paid
     FROM tabs t WHERE t.id=$1`, [tabId]);
  const due = Math.max(0, t.orders_total - t.discount_cents);
  return { ...t, total: due, remaining: Math.max(0, due - t.paid) } as {
    id: string; status: string; discount_cents: number; discount_reason: string | null; orders_total: number; paid: number; total: number; remaining: number;
  };
}

export const VALID_TRANSITIONS: Record<string, string[]> = {
  recebido: ['aguardando_impressao', 'em_preparo', 'cancelado'],
  aguardando_impressao: ['recebido', 'em_preparo', 'cancelado'],
  em_preparo: ['pronto', 'cancelado'],
  pronto: ['entregue', 'em_preparo', 'cancelado'],
  entregue: [],
  cancelado: [],
};

export async function changeStatus(orderId: string, to: string, staff: { id: string; name: string }, reason?: string) {
  const out = await tx(async (c) => {
    const r = await c.query('SELECT status, tab_id FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
    if (!r.rowCount) throw new HttpError(404, 'Pedido não encontrado.');
    const from = r.rows[0].status as string;
    if (from === to) return { from, to };
    if (!VALID_TRANSITIONS[from]?.includes(to)) throw new HttpError(409, `Não é possível mover de "${from}" para "${to}".`);
    if (to === 'cancelado') {
      if (!reason?.trim()) throw new HttpError(400, 'Informe o motivo do cancelamento.');
      const paid = await c.query('SELECT 1 FROM tabs WHERE id=$1 AND status<>\'open\'', [r.rows[0].tab_id]);
      if (paid.rowCount) throw new HttpError(409, 'A conta deste pedido já foi fechada; cancelamento não é permitido.');
    }
    await c.query(
      `UPDATE orders SET status=$2, updated_at=now(),
         cancel_reason = CASE WHEN $2='cancelado' THEN $3 ELSE cancel_reason END,
         started_at = CASE WHEN $2='em_preparo' AND started_at IS NULL THEN now() ELSE started_at END,
         ready_at = CASE WHEN $2='pronto' THEN now() ELSE ready_at END
       WHERE id=$1`, [orderId, to, reason ?? null]);
    await c.query('INSERT INTO order_status_history(order_id, from_status, to_status, changed_by, note) VALUES ($1,$2,$3,$4,$5)',
      [orderId, from, to, staff.id, reason ?? null]);
    if (to === 'cancelado') {
      // cancelar o pedido interrompe impressões que ainda não aconteceram
      await c.query(`UPDATE print_jobs SET status='failed', last_error='Pedido cancelado' WHERE order_id=$1 AND status IN ('queued','printing')`, [orderId]);
    }
    return { from, to };
  });
  await notify('order.updated', { orderId });
  return out;
}

export async function getOrderFull(id: string) {
  const o = await one(
    `SELECT o.*, t.label AS table_label, tb.status AS tab_status, u.name AS created_by_name
     FROM orders o LEFT JOIN dining_tables t ON t.id=o.table_id JOIN tabs tb ON tb.id=o.tab_id
     LEFT JOIN staff_users u ON u.id=o.created_by WHERE o.id=$1`, [id]);
  if (!o) return null;
  const items = await query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY position', [id]);
  const opts = await query(
    'SELECT * FROM order_item_options WHERE order_item_id = ANY($1) ORDER BY position', [items.map((i) => i.id)]);
  const history = await query(
    `SELECT h.*, u.name AS user_name FROM order_status_history h LEFT JOIN staff_users u ON u.id=h.changed_by
     WHERE h.order_id=$1 ORDER BY h.id`, [id]);
  const jobs = await query(
    `SELECT id, copy_type, paper, status, attempts, max_attempts, last_error, is_reprint, created_at, printed_at
     FROM print_jobs WHERE order_id=$1 ORDER BY created_at DESC`, [id]);
  return { ...o, items: items.map((i) => ({ ...i, options: opts.filter((x) => x.order_item_id === i.id) })), history, jobs };
}
