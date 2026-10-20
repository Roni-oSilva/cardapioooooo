import { requireStaff } from '@/lib/auth';
import { handler, json } from '@/lib/http';
import { query } from '@/lib/db';
import { printSummary } from '@/lib/print';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request) => {
  await requireStaff('orders');
  const status = new URL(req.url).searchParams.get('status');
  const jobs = await query(
    `SELECT j.id, j.status, j.copy_type, j.paper, j.target, j.attempts, j.max_attempts, j.last_error, j.is_reprint, j.created_at, j.printed_at, j.next_attempt_at,
            o.number, o.id AS order_id,
            (SELECT json_agg(json_build_object('ok', a.success, 'error', a.error, 'confirmation', a.confirmation, 'agent', a.agent, 'at', a.created_at) ORDER BY a.id DESC) FROM print_attempts a WHERE a.job_id=j.id) AS attempts_log
     FROM print_jobs j JOIN orders o ON o.id=j.order_id WHERE ($1::text IS NULL OR j.status=$1) ORDER BY j.created_at DESC LIMIT 100`, [status]);
  return json({ jobs, summary: await printSummary() });
});
