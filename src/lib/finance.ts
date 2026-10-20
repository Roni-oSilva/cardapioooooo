import { query } from './db';
import { getSettings } from './settings';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Período em datas locais (fuso do restaurante). Padrão: últimos 30 dias. */
export async function financeReport(from: string | null, to: string | null) {
  const tz = (await getSettings()).timezone;
  const [d] = await query(`SELECT ((now() AT TIME ZONE $1)::date)::text AS today, ((now() AT TIME ZONE $1)::date - 29)::text AS start`, [tz]);
  const f = from && DATE.test(from) ? from : d.start;
  const t = to && DATE.test(to) ? to : d.today;
  const P = [tz, f, t];
  const inRange = (col: string) => `(${col} AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date`;

  const byMethod = await query(`SELECT method, sum(amount_cents)::int AS total, count(*)::int AS count FROM payments WHERE ${inRange('created_at')} GROUP BY method ORDER BY total DESC`, P);
  const [orders] = await query(
    `SELECT count(*) FILTER (WHERE status<>'cancelado')::int AS registered_count,
            COALESCE(sum(total_cents) FILTER (WHERE status<>'cancelado'),0)::int AS registered_total,
            count(*) FILTER (WHERE status='cancelado')::int AS cancelled_count,
            COALESCE(sum(total_cents) FILTER (WHERE status='cancelado'),0)::int AS cancelled_total
     FROM orders WHERE ${inRange('created_at')}`, P);
  const [recv] = await query(`SELECT COALESCE(sum(amount_cents),0)::int AS received FROM payments WHERE ${inRange('created_at')}`, P);
  const [open] = await query(
    `SELECT COALESCE(sum(GREATEST(0,(SELECT COALESCE(sum(total_cents),0) FROM orders o WHERE o.tab_id=tb.id AND o.status<>'cancelado') - tb.discount_cents)),0)::int AS receivable, count(*)::int AS tabs
     FROM tabs tb WHERE tb.status='open'`);
  const cancellations = await query(
    `SELECT o.number, o.total_cents, o.cancel_reason, o.created_at, h.created_at AS cancelled_at, u.name AS by_user
     FROM orders o LEFT JOIN LATERAL (SELECT * FROM order_status_history WHERE order_id=o.id AND to_status='cancelado' ORDER BY id DESC LIMIT 1) h ON true
     LEFT JOIN staff_users u ON u.id=h.changed_by WHERE o.status='cancelado' AND ${inRange('o.created_at')} ORDER BY o.created_at DESC LIMIT 200`, P);
  const discounts = await query(
    `SELECT tb.id, tb.discount_cents, tb.discount_reason, tb.closed_at, u.name AS authorized_by, t.label AS table_label
     FROM tabs tb LEFT JOIN staff_users u ON u.id=tb.discount_by LEFT JOIN dining_tables t ON t.id=tb.table_id
     WHERE tb.discount_cents>0 AND tb.closed_at IS NOT NULL AND ${inRange('tb.closed_at')} ORDER BY tb.closed_at DESC LIMIT 200`, P);
  const top = await query(
    `SELECT i.product_name AS name, i.category_name AS category, sum(i.quantity)::int AS qty, sum(i.line_total_cents)::int AS revenue
     FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status<>'cancelado' AND ${inRange('o.created_at')}
     GROUP BY i.product_name, i.category_name ORDER BY qty DESC, revenue DESC LIMIT 50`, P);
  const payments = await query(
    `SELECT p.created_at, p.method, p.amount_cents, p.payer_label, t.label AS table_label, u.name AS by_user
     FROM payments p JOIN tabs tb ON tb.id=p.tab_id LEFT JOIN dining_tables t ON t.id=tb.table_id LEFT JOIN staff_users u ON u.id=p.created_by
     WHERE ${inRange('p.created_at')} ORDER BY p.created_at DESC LIMIT 500`, P);
  const history = await query(
    `SELECT o.number, o.status, o.service_type, o.total_cents, o.created_at, t.label AS table_label, tb.status AS tab_status
     FROM orders o JOIN tabs tb ON tb.id=o.tab_id LEFT JOIN dining_tables t ON t.id=o.table_id
     WHERE ${inRange('o.created_at')} ORDER BY o.created_at DESC LIMIT 500`, P);
  return { from: f, to: t, received: recv.received, ...orders, receivable: open.receivable, open_tabs: open.tabs, byMethod, cancellations, discounts, top, payments, history };
}
