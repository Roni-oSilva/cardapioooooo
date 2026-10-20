import { requireStaff, audit } from '@/lib/auth';
import { body, handler, HttpError, json } from '@/lib/http';
import { one, tx } from '@/lib/db';
import { productInput, saveGroups } from '@/lib/catalog';
import { z } from 'zod';

export const PUT = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('menu');
  const d = await body(req, productInput);
  const before = await one('SELECT price_cents FROM products WHERE id=$1', [params.id]);
  if (!before) throw new HttpError(404, 'Produto não encontrado.');
  await tx(async (c) => {
    await c.query(
      `UPDATE products SET category_id=$2,name=$3,description=$4,ingredients=$5,price_cents=$6,image_url=$7,prep_minutes=$8,allergens=$9,
         featured=$10,available=$11,archived=$12,available_from=$13,available_until=$14,sort_order=$15,updated_at=now() WHERE id=$1`,
      [params.id, d.category_id, d.name, d.description, d.ingredients, d.price_cents, d.image_url, d.prep_minutes, d.allergens, d.featured, d.available, d.archived, d.available_from, d.available_until, d.sort_order]);
    await saveGroups(c, params.id, d.groups);
  });
  await audit(staff, before.price_cents !== d.price_cents ? 'product.price_change' : 'product.update', 'product', params.id,
    { name: d.name, old_price: before.price_cents, new_price: d.price_cents });
  return json({ ok: true });
});

// Atalhos rápidos: disponível/indisponível, destaque, arquivar.
export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('menu');
  const d = await body(req, z.object({ available: z.boolean().optional(), featured: z.boolean().optional(), archived: z.boolean().optional() }));
  const r = await one(
    `UPDATE products SET available=COALESCE($2,available), featured=COALESCE($3,featured), archived=COALESCE($4,archived), updated_at=now() WHERE id=$1 RETURNING id`,
    [params.id, d.available ?? null, d.featured ?? null, d.archived ?? null]);
  if (!r) throw new HttpError(404, 'Produto não encontrado.');
  await audit(staff, 'product.patch', 'product', params.id, d);
  return json({ ok: true });
});

// Produtos com histórico de vendas nunca são apagados de verdade: são arquivados.
export const DELETE = handler(async (_r: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('menu');
  await one('UPDATE products SET archived=true, available=false, updated_at=now() WHERE id=$1', [params.id]);
  await audit(staff, 'product.archive', 'product', params.id);
  return json({ ok: true });
});
