import { query } from './db';
import { getSettings, inWindow, localTime } from './settings';

export interface PublicOption { id: string; name: string; price_cents: number }
export interface PublicGroup { id: string; name: string; required: boolean; min_select: number; max_select: number; options: PublicOption[] }
export interface PublicProduct {
  id: string; category_id: string; name: string; description: string; ingredients: string; price_cents: number;
  image_url: string | null; prep_minutes: number | null; allergens: string[]; featured: boolean; orderable: boolean; groups: PublicGroup[];
}

/** Cardápio público: só categorias ativas e produtos não arquivados. `orderable` considera disponibilidade e horário. */
export async function getPublicMenu() {
  const settings = await getSettings();
  const now = localTime(settings.timezone);
  const categories = await query('SELECT id,name,description FROM categories WHERE active ORDER BY sort_order, name');
  const prods = await query(
    `SELECT p.* FROM products p JOIN categories c ON c.id=p.category_id
     WHERE c.active AND NOT p.archived ORDER BY p.sort_order, p.name`);
  const groups = await query(
    `SELECT g.* FROM option_groups g WHERE g.product_id = ANY($1) ORDER BY g.sort_order, g.name`, [prods.map((p) => p.id)]);
  const options = await query(
    `SELECT o.* FROM options o WHERE o.group_id = ANY($1) AND o.available ORDER BY o.sort_order, o.name`, [groups.map((g) => g.id)]);
  const products: PublicProduct[] = prods.map((p) => ({
    id: p.id, category_id: p.category_id, name: p.name, description: p.description, ingredients: p.ingredients,
    price_cents: p.price_cents, image_url: p.image_url, prep_minutes: p.prep_minutes, allergens: p.allergens, featured: p.featured,
    orderable: p.available && inWindow(now, p.available_from, p.available_until),
    groups: groups.filter((g) => g.product_id === p.id).map((g) => ({
      id: g.id, name: g.name, required: g.required, min_select: g.min_select, max_select: g.max_select,
      options: options.filter((o) => o.group_id === g.id).map((o) => ({ id: o.id, name: o.name, price_cents: o.price_cents })),
    })),
  }));
  const tables = await query('SELECT id,label FROM dining_tables WHERE active ORDER BY label');
  return { settings, categories, products, tables };
}
