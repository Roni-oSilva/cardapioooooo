import { requireStaff } from '@/lib/auth';
import { handler, json } from '@/lib/http';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Histórico de contas de uma mesa (mais recentes primeiro). */
export const GET = handler(async (req: Request) => {
  await requireStaff('tables');
  const tableId = new URL(req.url).searchParams.get('table_id');
  const tabs = await query(
    `SELECT tb.id, tb.status, tb.opened_at, tb.closed_at, tb.discount_cents, tb.discount_reason,
            COALESCE((SELECT sum(total_cents) FROM orders o WHERE o.tab_id=tb.id AND o.status<>'cancelado'),0)::int AS orders_total,
            (SELECT count(*) FROM orders o WHERE o.tab_id=tb.id)::int AS orders_count,
            (SELECT string_agg(DISTINCT method, ', ') FROM payments p WHERE p.tab_id=tb.id) AS methods
     FROM tabs tb WHERE tb.table_id=$1 AND tb.status<>'open' ORDER BY tb.opened_at DESC LIMIT 30`, [tableId]);
  return json({ tabs });
});
