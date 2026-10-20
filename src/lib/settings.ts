import { one } from './db';

export interface Settings {
  name: string; tagline: string; about: string; logo_url: string | null; hero_image_url: string | null;
  address: string; phone: string; whatsapp: string; hours: { label: string; hours: string }[]; timezone: string;
  accepting_orders: boolean; allow_dine_in: boolean; allow_pickup: boolean; allow_delivery: boolean;
  delivery_fee_cents: number; kitchen_priority: 'fifo' | 'prep_time'; kitchen_sound: boolean; ticket_footer: string;
}

export async function getSettings(): Promise<Settings> {
  return (await one<Settings>('SELECT * FROM restaurant_settings WHERE id=1'))!;
}

/** Hora local (HH:MM) no fuso do restaurante, para disponibilidade por horário. */
export function localTime(tz: string, d = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

export function inWindow(now: string, from: string | null, until: string | null): boolean {
  if (!from && !until) return true;
  const f = (from ?? '00:00').slice(0, 5);
  const u = (until ?? '23:59').slice(0, 5);
  return f <= u ? now >= f && now <= u : now >= f || now <= u; // janela que cruza a meia-noite
}
