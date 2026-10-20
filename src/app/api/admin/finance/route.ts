import { requireStaff } from '@/lib/auth';
import { handler, json } from '@/lib/http';
import { financeReport } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request) => {
  await requireStaff('finance');
  const sp = new URL(req.url).searchParams;
  return json(await financeReport(sp.get('from'), sp.get('to')));
});
