import { requireStaff } from '@/lib/auth';
import { handler, HttpError, json } from '@/lib/http';
import { one, query } from '@/lib/db';
import { tabTotals } from '@/lib/orders';

export const dynamic = 'force-dynamic';

/** Detalhe da conta: todos os pedidos (com itens e opções) e pagamentos já lançados. */
export const GET = handler(async (_r: Request, { params }: { params: { id: string } }) => {
  await requireStaff('tables');
  const tab = await one(`SELECT tb.*, t.label AS table_label FROM tabs tb LEFT JOIN dining_tables t ON t.id=tb.table_id WHERE tb.id=$1`, [params.id]);
  if (!tab) throw new HttpError(404, 'Conta não encontrada.');
  const orders = await query('SELECT id, number, status, notes, total_cents, created_at, customer_name FROM orders WHERE tab_id=$1 ORDER BY created_at', [params.id]);
  const items = await query('SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY position', [orders.map((o) => o.id)]);
  const opts = await query('SELECT * FROM order_item_options WHERE order_item_id = ANY($1) ORDER BY position', [items.map((i) => i.id)]);
  const payments = await query('SELECT * FROM payments WHERE tab_id=$1 ORDER BY created_at', [params.id]);
  return json({
    tab, totals: await tabTotals(params.id), payments,
    orders: orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id).map((i) => ({ ...i, options: opts.filter((x) => x.order_item_id === i.id) })) })),
  });
});
