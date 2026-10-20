import { getStaff } from '@/lib/auth';
import { handler, json } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const GET = handler(async () => {
  const s = await getStaff();
  return s ? json({ user: { id: s.id, name: s.name, email: s.email, role: s.role } }) : json({ error: 'Não autenticado' }, 401);
});
