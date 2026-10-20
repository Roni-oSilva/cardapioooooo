import { body, handler, HttpError, json } from '@/lib/http';
import { createOrder, orderInput } from '@/lib/orders';
import { getStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Limite simples por IP (memória do processo) contra spam de pedidos. Generoso porque o Wi-Fi do salão costuma compartilhar um IP.
const hits = new Map<string, number[]>();
function rateLimit(ip: string, max = 120, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw new HttpError(429, 'Muitos pedidos em pouco tempo. Aguarde alguns minutos.');
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
}

export const POST = handler(async (req: Request) => {
  rateLimit(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local');
  const input = await body(req, orderInput);
  const staff = await getStaff(); // pedidos feitos pelo garçom registram quem recebeu
  const r = await createOrder(input, staff?.id ?? null);
  return json({ id: r.id, number: r.number, token: r.public_token, duplicate: r.duplicate }, r.duplicate ? 200 : 201);
});
