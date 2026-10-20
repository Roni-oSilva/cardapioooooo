import { z } from 'zod';
import { agentAuthorized } from '@/lib/auth';
import { body, handler, json } from '@/lib/http';
import { reportResult } from '@/lib/print';

/**
 * O agente informa o resultado. `success=true` só deve ser enviado quando o agente teve confirmação
 * (dados aceitos pela impressora/spooler e, quando suportado, status "online, com papel").
 */
export const POST = handler(async (req: Request, { params }: { params: { id: string } }) => {
  agentAuthorized(req);
  const d = await body(req, z.object({
    success: z.boolean(), error: z.string().max(500).optional(), confirmation: z.string().max(120).optional(), agent: z.string().max(60).optional(),
  }));
  await reportResult(params.id, d);
  return json({ ok: true });
});
