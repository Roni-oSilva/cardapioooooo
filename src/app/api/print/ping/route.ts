import { agentAuthorized } from '@/lib/auth';
import { handler, json } from '@/lib/http';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const GET = handler(async (req: Request) => {
  agentAuthorized(req);
  const printers = await query('SELECT name, copy_type, paper, target, active FROM printers ORDER BY created_at');
  return json({ ok: true, printers });
});
