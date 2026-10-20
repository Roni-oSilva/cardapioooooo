import { handler, HttpError, json } from '@/lib/http';
import { one, query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request) => {
  const u = new URL(req.url);
  const number = Number(u.searchParams.get('n'));
  const token = u.searchParams.get('t') ?? '';
  const o = await one('SELECT id, number, status, service_type, total_cents, created_at FROM orders WHERE number=$1 AND public_token=$2', [number, token]);
  if (!o) throw new HttpError(404, 'Pedido não encontrado.');
  const items = await query('SELECT quantity, product_name FROM order_items WHERE order_id=$1 ORDER BY position', [o.id]);
  return json({ ...o, items });
});
