import { z } from 'zod';
import { requireStaff, audit } from '@/lib/auth';
import { body, handler, HttpError, json } from '@/lib/http';
import { changeStatus, getOrderFull } from '@/lib/orders';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

export const GET = handler(async (_r: Request, { params }: Ctx) => {
  await requireStaff('orders');
  const o = await getOrderFull(params.id);
  if (!o) throw new HttpError(404, 'Pedido não encontrado.');
  return json({ order: o });
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaff('orders');
  const { status, reason } = await body(req, z.object({
    status: z.enum(['recebido', 'aguardando_impressao', 'em_preparo', 'pronto', 'entregue', 'cancelado']),
    reason: z.string().trim().max(300).optional(),
  }));
  // garçom/cozinha não cancelam pedidos
  if (status === 'cancelado' && !['admin', 'manager', 'waiter'].includes(staff.role)) throw new HttpError(403, 'Sem permissão para cancelar.');
  const r = await changeStatus(params.id, status, staff, reason);
  if (status === 'cancelado') await audit(staff, 'order.cancel', 'order', params.id, { reason });
  return json(r);
});
