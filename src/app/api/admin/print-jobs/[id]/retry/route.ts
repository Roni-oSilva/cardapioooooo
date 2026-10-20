import { requireStaff, audit } from '@/lib/auth';
import { handler, HttpError, json } from '@/lib/http';
import { retryJob } from '@/lib/print';

export const POST = handler(async (_r: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('orders');
  const r = await retryJob(params.id);
  if (!r) throw new HttpError(409, 'Só é possível tentar novamente jobs que falharam.');
  await audit(staff, 'print.retry', 'print_job', params.id);
  return json({ ok: true });
});
