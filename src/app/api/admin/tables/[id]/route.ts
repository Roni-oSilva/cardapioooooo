import { z } from 'zod';
import { requireStaff, audit } from '@/lib/auth';
import { body, handler, HttpError, json } from '@/lib/http';
import { one } from '@/lib/db';

const input = z.object({ label: z.string().trim().min(1).max(20), seats: z.number().int().min(1).max(50), active: z.boolean() });
export const PUT = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('menu');
  const d = await body(req, input);
  const t = await one('UPDATE dining_tables SET label=$2, seats=$3, active=$4 WHERE id=$1 RETURNING *', [params.id, d.label, d.seats, d.active]);
  if (!t) throw new HttpError(404, 'Mesa não encontrada.');
  await audit(staff, 'table.update', 'table', params.id, d);
  return json({ table: t });
});
export const DELETE = handler(async (_r: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('menu');
  const used = await one('SELECT 1 FROM tabs WHERE table_id=$1 LIMIT 1', [params.id]);
  if (used) throw new HttpError(409, 'A mesa tem histórico de contas. Desative-a em vez de excluir.');
  await one('DELETE FROM dining_tables WHERE id=$1', [params.id]);
  await audit(staff, 'table.delete', 'table', params.id);
  return json({ ok: true });
});
