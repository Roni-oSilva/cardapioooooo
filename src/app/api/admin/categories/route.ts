import { categoryInput } from '@/lib/catalog';
import { requireStaff, audit } from '@/lib/auth';
import { body, handler, json } from '@/lib/http';
import { one, query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const GET = handler(async () => {
  await requireStaff('menu');
  return json({ categories: await query(`SELECT c.*, (SELECT count(*) FROM products p WHERE p.category_id=c.id AND NOT p.archived)::int AS products FROM categories c ORDER BY sort_order, name`) });
});
export const POST = handler(async (req: Request) => {
  const staff = await requireStaff('menu');
  const d = await body(req, categoryInput);
  const c = await one('INSERT INTO categories(name,description,sort_order,active) VALUES ($1,$2,$3,$4) RETURNING *', [d.name, d.description, d.sort_order, d.active]);
  await audit(staff, 'category.create', 'category', c!.id, d);
  return json({ category: c }, 201);
});
