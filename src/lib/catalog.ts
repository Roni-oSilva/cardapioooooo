import { z } from 'zod';
import type { PoolClient } from 'pg';

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(80), description: z.string().trim().max(300).default(''),
  sort_order: z.number().int().min(0).max(9999).default(0), active: z.boolean().default(true),
});


const time = z.string().regex(/^\d{2}:\d{2}$/).nullable().optional().transform((v) => v || null);
export const productInput = z.object({
  category_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(''),
  ingredients: z.string().trim().max(1000).default(''),
  price_cents: z.number().int().min(0).max(10_000_000),
  image_url: z.string().max(300).nullable().optional().transform((v) => v || null),
  prep_minutes: z.number().int().min(0).max(600).nullable().optional().transform((v) => v ?? null),
  allergens: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  featured: z.boolean().default(false),
  available: z.boolean().default(true),
  archived: z.boolean().default(false),
  available_from: time,
  available_until: time,
  sort_order: z.number().int().min(0).max(9999).default(0),
  groups: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    required: z.boolean().default(false),
    min_select: z.number().int().min(0).max(20).default(0),
    max_select: z.number().int().min(1).max(20).default(1),
    options: z.array(z.object({
      name: z.string().trim().min(1).max(80),
      price_cents: z.number().int().min(0).max(1_000_000).default(0),
      available: z.boolean().default(true),
    })).max(40),
  }).refine((g) => g.min_select <= g.max_select, 'mínimo maior que máximo')).max(15).default([]),
});
export type ProductInput = z.infer<typeof productInput>;

export async function saveGroups(c: PoolClient, productId: string, groups: ProductInput['groups']) {
  // Pedidos antigos guardam cópia dos nomes/preços, então recriar os grupos não altera o histórico.
  await c.query('DELETE FROM option_groups WHERE product_id=$1', [productId]);
  let gi = 0;
  for (const g of groups) {
    const min = g.required ? Math.max(1, g.min_select) : g.min_select;
    const r = await c.query(
      'INSERT INTO option_groups(product_id,name,required,min_select,max_select,sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [productId, g.name, g.required, min, Math.max(g.max_select, min, 1), gi++]);
    let oi = 0;
    for (const o of g.options) await c.query('INSERT INTO options(group_id,name,price_cents,available,sort_order) VALUES ($1,$2,$3,$4,$5)', [r.rows[0].id, o.name, o.price_cents, o.available, oi++]);
  }
}

