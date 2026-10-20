import { requireStaff } from '@/lib/auth';
import { handler, json } from '@/lib/http';
import { query } from '@/lib/db';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireStaff('kitchen');
  const s = await getSettings();
  const orders = await query(
    `SELECT o.id, o.number, o.status, o.service_type, o.customer_name, o.notes, o.created_at, o.started_at, o.ready_at, t.label AS table_label,
            COALESCE((SELECT max(prep_minutes) FROM order_items WHERE order_id=o.id),0) AS prep_minutes,
            (SELECT json_build_object('status', j.status, 'error', j.last_error) FROM print_jobs j WHERE j.order_id=o.id AND j.copy_type='cozinha' ORDER BY j.created_at DESC LIMIT 1) AS kitchen_print
     FROM orders o LEFT JOIN dining_tables t ON t.id=o.table_id
     WHERE o.status IN ('recebido','aguardando_impressao','em_preparo','pronto') ORDER BY o.created_at`);
  const items = await query(
    `SELECT i.id, i.order_id, i.quantity, i.product_name, i.notes,
            COALESCE((SELECT json_agg(json_build_object('g', x.group_name, 'n', x.option_name) ORDER BY x.position) FROM order_item_options x WHERE x.order_item_id=i.id),'[]') AS options
     FROM order_items i WHERE i.order_id = ANY($1) ORDER BY i.position`, [orders.map((o) => o.id)]);
  const list = orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }));
  if (s.kitchen_priority === 'prep_time') list.sort((a, b) => b.prep_minutes - a.prep_minutes || +new Date(a.created_at) - +new Date(b.created_at));
  return json({ orders: list, sound: s.kitchen_sound, priority: s.kitchen_priority });
});
