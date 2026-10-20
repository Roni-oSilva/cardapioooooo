import { z } from 'zod';
import { requireStaff, audit } from '@/lib/auth';
import { body, handler, json } from '@/lib/http';
import { query } from '@/lib/db';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const input = z.object({
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(120).default(''),
  about: z.string().trim().max(1500).default(''),
  logo_url: z.string().max(300).nullable().optional().transform((v) => v || null),
  hero_image_url: z.string().max(300).nullable().optional().transform((v) => v || null),
  address: z.string().trim().max(250).default(''),
  phone: z.string().trim().max(40).default(''),
  whatsapp: z.string().trim().max(40).default(''),
  hours: z.array(z.object({ label: z.string().trim().max(40), hours: z.string().trim().max(60) })).max(10).default([]),
  timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }, 'Fuso horário inválido'),
  accepting_orders: z.boolean(),
  allow_dine_in: z.boolean(),
  allow_pickup: z.boolean(),
  allow_delivery: z.boolean(),
  delivery_fee_cents: z.number().int().min(0).max(100000),
  kitchen_priority: z.enum(['fifo', 'prep_time']),
  kitchen_sound: z.boolean(),
  ticket_footer: z.string().trim().max(120).default(''),
});

export const GET = handler(async () => {
  await requireStaff('settings');
  return json({ settings: await getSettings() });
});
export const PUT = handler(async (req: Request) => {
  const staff = await requireStaff('settings');
  const d = await body(req, input);
  await query(
    `UPDATE restaurant_settings SET name=$1,tagline=$2,about=$3,logo_url=$4,hero_image_url=$5,address=$6,phone=$7,whatsapp=$8,hours=$9,timezone=$10,
       accepting_orders=$11,allow_dine_in=$12,allow_pickup=$13,allow_delivery=$14,delivery_fee_cents=$15,kitchen_priority=$16,kitchen_sound=$17,ticket_footer=$18,updated_at=now() WHERE id=1`,
    [d.name, d.tagline, d.about, d.logo_url, d.hero_image_url, d.address, d.phone, d.whatsapp, JSON.stringify(d.hours), d.timezone,
     d.accepting_orders, d.allow_dine_in, d.allow_pickup, d.allow_delivery, d.delivery_fee_cents, d.kitchen_priority, d.kitchen_sound, d.ticket_footer]);
  await audit(staff, 'settings.update', 'settings', '1', { accepting_orders: d.accepting_orders });
  return json({ ok: true });
});
