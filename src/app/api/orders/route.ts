import { body, handler, json } from '@/lib/http';
import { createOrder, orderInput } from '@/lib/orders';
import { getStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req: Request) => {
  const input = await body(req, orderInput);
  const staff = await getStaff(); // pedidos feitos pelo garçom registram quem recebeu
  const r = await createOrder(input, staff?.id ?? null);
  return json({ id: r.id, number: r.number, token: r.public_token, duplicate: r.duplicate }, r.duplicate ? 200 : 201);
});
