import { requireStaff, audit } from '@/lib/auth';
import { body, handler, HttpError, json } from '@/lib/http';
import { one } from '@/lib/db';
import { categoryInput } from '@/lib/catalog';

export const PUT = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('menu');
  const d = await body(req, categoryInput);
  const c = await one('UPDATE categories SET name=$2, description=$3, sort_order=$4, active=$5 WHERE id=$1 RETURNING *', [params.id, d.name, d.description, d.sort_order, d.active]);
  if (!c) throw new HttpError(404, 'Categoria não encontrada.');
  await audit(staff, 'category.update', 'category', params.id, d);
  return json({ category: c });
});

export const DELETE = handler(async (_r: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('menu');
  const used = await one('SELECT 1 FROM products WHERE category_id=$1 LIMIT 1', [params.id]);
  if (used) throw new HttpError(409, 'Há produtos nesta categoria. Mova ou arquive-os, ou apenas desative a categoria.');
  await one('DELETE FROM categories WHERE id=$1', [params.id]);
  await audit(staff, 'category.delete', 'category', params.id);
  return json({ ok: true });
});
