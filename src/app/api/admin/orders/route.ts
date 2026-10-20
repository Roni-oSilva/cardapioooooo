import { requireStaff } from '@/lib/auth';
import { handler, json } from '@/lib/http';
import { query } from '@/lib/db';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request) => {
  await requireStaff('orders');
  const sp = new URL(req.url).searchParams;
  const s = await getSettings();
  const where: string[] = [];
  const p: unknown[] = [s.timezone];
  const add = (sql: string, v: unknown) => { p.push(v); where.push(sql.replace('?', `$${p.length}`)); };
  const status = sp.get('status'); if (status) add('o.status = ?', status);
  const table = sp.get('table'); if (table) add('o.table_id = ?', table);
  const q = sp.get('q'); if (q && /^\d+$/.test(q)) add('o.number = ?', Number(q));
  const from = sp.get('from'); if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) add(`(o.created_at AT TIME ZONE $1)::date >= ?::date`, from);
  const to = sp.get('to'); if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) add(`(o.created_at AT TIME ZONE $1)::date <= ?::date`, to);
  const rows = await query(
    `SELECT o.id, o.number, o.status, o.service_type, o.customer_name, o.total_cents, o.created_at, o.notes, o.tab_id,
            t.label AS table_label, tb.status AS tab_status,
            (SELECT json_agg(json_build_object('q', i.quantity, 'n', i.product_name) ORDER BY i.position) FROM order_items i WHERE i.order_id=o.id) AS items,
            (SELECT json_build_object('status', j.status, 'error', j.last_error) FROM print_jobs j WHERE j.order_id=o.id AND j.copy_type='cozinha' ORDER BY j.created_at DESC LIMIT 1) AS kitchen_print
     FROM orders o LEFT JOIN dining_tables t ON t.id=o.table_id JOIN tabs tb ON tb.id=o.tab_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.created_at DESC LIMIT 200`, p);
  return json({ orders: rows });
});
