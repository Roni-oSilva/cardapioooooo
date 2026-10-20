import { requireStaff } from '@/lib/auth';
import { handler, json } from '@/lib/http';
import { query } from '@/lib/db';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
const DAYS = { day: 0, week: 6, month: 29 } as const;

export const GET = handler(async (req: Request) => {
  await requireStaff('dashboard');
  const r = (new URL(req.url).searchParams.get('range') ?? 'day') as keyof typeof DAYS;
  const back = DAYS[r] ?? 0;
  const tz = (await getSettings()).timezone;
  // início do período no fuso do restaurante (meia-noite local)
  const START = `((date_trunc('day', now() AT TIME ZONE $1) - ($2 || ' days')::interval) AT TIME ZONE $1)`;
  const p = [tz, String(back)];

  const [k] = await query(
    `SELECT
       COALESCE((SELECT sum(amount_cents) FROM payments WHERE created_at >= ${START}),0)::int AS received,
       COALESCE((SELECT sum(total_cents) FROM orders WHERE status<>'cancelado' AND created_at >= ${START}),0)::int AS registered,
       (SELECT count(*) FROM orders WHERE status<>'cancelado' AND created_at >= ${START})::int AS orders,
       (SELECT count(*) FROM orders WHERE status='cancelado' AND created_at >= ${START})::int AS cancelled,
       (SELECT count(*) FROM orders WHERE status IN ('recebido','aguardando_impressao','em_preparo'))::int AS in_progress,
       (SELECT count(*) FROM orders WHERE status IN ('pronto','entregue') AND created_at >= ${START})::int AS done`, p);
  const [open] = await query(
    `SELECT COALESCE(sum(GREATEST(0, (SELECT COALESCE(sum(total_cents),0) FROM orders o WHERE o.tab_id=tb.id AND o.status<>'cancelado') - tb.discount_cents)),0)::int AS receivable
     FROM tabs tb WHERE tb.status='open'`);
  const top = await query(
    `SELECT i.product_name AS name, sum(i.quantity)::int AS qty, sum(i.line_total_cents)::int AS revenue
     FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status<>'cancelado' AND o.created_at >= ${START}
     GROUP BY i.product_name ORDER BY qty DESC, revenue DESC LIMIT 8`, p);

  // série: por hora no dia; por dia nos demais
  const unit = r === 'day' ? 'hour' : 'day';
  const series = await query(
    `WITH b AS (
       SELECT generate_series(date_trunc('${unit}', (${START}) AT TIME ZONE $1), date_trunc('${unit}', now() AT TIME ZONE $1), interval '1 ${unit}') AS t)
     SELECT to_char(b.t, '${unit === 'hour' ? 'HH24"h"' : 'DD/MM'}') AS label,
       COALESCE((SELECT sum(amount_cents) FROM payments p WHERE date_trunc('${unit}', p.created_at AT TIME ZONE $1) = b.t),0)::int AS received,
       COALESCE((SELECT sum(total_cents) FROM orders o WHERE o.status<>'cancelado' AND date_trunc('${unit}', o.created_at AT TIME ZONE $1) = b.t),0)::int AS registered,
       (SELECT count(*) FROM orders o WHERE o.status<>'cancelado' AND date_trunc('${unit}', o.created_at AT TIME ZONE $1) = b.t)::int AS orders
     FROM b ORDER BY b.t`, p);

  return json({
    range: r, ...k, receivable: open.receivable,
    avg_ticket: k.orders ? Math.round(k.registered / k.orders) : 0,
    top, series,
  });
});
