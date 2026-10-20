import { productInput, saveGroups } from '@/lib/catalog';
import { requireStaff, audit } from '@/lib/auth';
import { body, handler, json } from '@/lib/http';
import { query, tx } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request) => {
  await requireStaff('menu');
  const showArchived = new URL(req.url).searchParams.get('archived') === '1';
  const products = await query(
    `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id
     WHERE p.archived = $1 ORDER BY c.sort_order, c.name, p.sort_order, p.name`, [showArchived]);
  const groups = await query('SELECT * FROM option_groups WHERE product_id = ANY($1) ORDER BY sort_order', [products.map((p) => p.id)]);
  const options = await query('SELECT * FROM options WHERE group_id = ANY($1) ORDER BY sort_order', [groups.map((g) => g.id)]);
  return json({ products: products.map((p) => ({ ...p, groups: groups.filter((g) => g.product_id === p.id).map((g) => ({ ...g, options: options.filter((o) => o.group_id === g.id) })) })) });
});

export const POST = handler(async (req: Request) => {
  const staff = await requireStaff('menu');
  const d = await body(req, productInput);
  const id = await tx(async (c) => {
    const r = await c.query(
      `INSERT INTO products(category_id,name,description,ingredients,price_cents,image_url,prep_minutes,allergens,featured,available,archived,available_from,available_until,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [d.category_id, d.name, d.description, d.ingredients, d.price_cents, d.image_url, d.prep_minutes, d.allergens, d.featured, d.available, d.archived, d.available_from, d.available_until, d.sort_order]);
    await saveGroups(c, r.rows[0].id, d.groups);
    return r.rows[0].id as string;
  });
  await audit(staff, 'product.create', 'product', id, { name: d.name, price_cents: d.price_cents });
  return json({ id }, 201);
});
