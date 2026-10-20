import { z } from 'zod';
import { agentAuthorized } from '@/lib/auth';
import { body, handler, json } from '@/lib/http';
import { claimJobs } from '@/lib/print';

export const dynamic = 'force-dynamic';

/** O agente local pergunta "tem algo para imprimir?" (long-poll curto). */
export const POST = handler(async (req: Request) => {
  agentAuthorized(req);
  const { agent, limit } = await body(req, z.object({ agent: z.string().max(60).default('agente'), limit: z.number().int().min(1).max(10).default(5) }));
  return json({ jobs: await claimJobs(limit, agent) });
});
