import { requireStaff, audit } from '@/lib/auth';
import { body, handler, HttpError, json } from '@/lib/http';
import { one } from '@/lib/db';
import { z } from 'zod';

const input = z.object({
  name: z.string().trim().min(1).max(60),
  copy_type: z.enum(['cozinha', 'atendimento']),
  paper: z.enum(['58', '80', 'a4']),
  target: z.string().trim().regex(/^(tcp:\/\/[\w.\-]+:\d{2,5}|cups:[\w.\-]+|file:\/[\w\/.\-]+)$/, 'Use tcp://IP:9100, cups:NOME ou file:/dev/usb/lp0'),
  active: z.boolean(),
});
export const PUT = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('printing');
  const d = await body(req, input);
  const p = await one('UPDATE printers SET name=$2,copy_type=$3,paper=$4,target=$5,active=$6 WHERE id=$1 RETURNING *', [params.id, d.name, d.copy_type, d.paper, d.target, d.active]);
  if (!p) throw new HttpError(404, 'Impressora não encontrada.');
  await audit(staff, 'printer.update', 'printer', params.id, d);
  return json({ printer: p });
});
export const DELETE = handler(async (_r: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('printing');
  await one('DELETE FROM printers WHERE id=$1', [params.id]);
  await audit(staff, 'printer.delete', 'printer', params.id);
  return json({ ok: true });
});
