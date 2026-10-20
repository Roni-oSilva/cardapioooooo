import { z } from 'zod';
import { requireStaff, audit } from '@/lib/auth';
import { body, handler, json } from '@/lib/http';
import { one, query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireStaff('tables');
  const tables = await query(
    `SELECT t.*, tb.id AS tab_id, tb.opened_at,
            COALESCE((SELECT sum(o.total_cents) FROM orders o WHERE o.tab_id=tb.id AND o.status<>'cancelado'),0)::int AS orders_total,
            COALESCE((SELECT count(*) FROM orders o WHERE o.tab_id=tb.id AND o.status<>'cancelado'),0)::int AS orders_count,
            COALESCE(tb.discount_cents,0) AS discount_cents
     FROM dining_tables t LEFT JOIN tabs tb ON tb.table_id=t.id AND tb.status='open' ORDER BY length(t.label), t.label`);
  return json({ tables: tables.map((t) => ({ ...t, occupied: !!t.tab_id && t.orders_count > 0 })) });
});

const input = z.object({ label: z.string().trim().min(1).max(20), seats: z.number().int().min(1).max(50).default(4), active: z.boolean().default(true) });
export const POST = handler(async (req: Request) => {
  const staff = await requireStaff('menu');
  const d = await body(req, input);
  const t = await one('INSERT INTO dining_tables(label,seats,active) VALUES ($1,$2,$3) RETURNING *', [d.label, d.seats, d.active]);
  await audit(staff, 'table.create', 'table', t!.id, d);
  return json({ table: t }, 201);
});
