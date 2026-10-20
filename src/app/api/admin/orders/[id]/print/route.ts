import { z } from 'zod';
import { requireStaff, audit } from '@/lib/auth';
import { body, handler, json } from '@/lib/http';
import { tx, notify } from '@/lib/db';
import { enqueuePrint } from '@/lib/print-queue';

/** Reimpressão: enfileira novos jobs marcados como reimpressão. A impressão pelo navegador usa /comanda/[id]. */
export const POST = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('orders');
  const { copy_type } = await body(req, z.object({ copy_type: z.enum(['cozinha', 'atendimento']).optional() }));
  const n = await tx((c) => enqueuePrint(c, params.id, { reprint: true, requestedBy: staff.id, copyType: copy_type }));
  await audit(staff, 'order.reprint', 'order', params.id, { copy_type, jobs: n.count });
  await notify('print.updated', { orderId: params.id });
  return json({ queued: n.count });
});
