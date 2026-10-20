import { z } from 'zod';
import { requireStaff, audit, hashPassword } from '@/lib/auth';
import { body, handler, HttpError, json } from '@/lib/http';
import { one, query } from '@/lib/db';

export const PUT = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('users');
  const d = await body(req, z.object({
    name: z.string().trim().min(1).max(80), role: z.enum(['admin', 'manager', 'waiter', 'kitchen']), active: z.boolean(),
    password: z.string().min(8).max(200).optional(),
  }));
  if (params.id === staff.id && (!d.active || d.role !== 'admin')) throw new HttpError(400, 'Você não pode desativar nem rebaixar o próprio acesso.');
  const u = await one('UPDATE staff_users SET name=$2, role=$3, active=$4 WHERE id=$1 RETURNING id', [params.id, d.name, d.role, d.active]);
  if (!u) throw new HttpError(404, 'Usuário não encontrado.');
  if (d.password) await query('UPDATE staff_users SET password_hash=$2 WHERE id=$1', [params.id, await hashPassword(d.password)]);
  // mudanças de acesso valem imediatamente: derruba as sessões abertas
  if (d.password || !d.active) await query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [params.id]);
  await audit(staff, 'user.update', 'user', params.id, { role: d.role, active: d.active, password_changed: !!d.password });
  return json({ ok: true });
});
