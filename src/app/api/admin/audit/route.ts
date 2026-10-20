import { requireStaff } from '@/lib/auth';
import { handler, json } from '@/lib/http';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const GET = handler(async () => {
  await requireStaff('audit');
  return json({ log: await query('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200') });
});
