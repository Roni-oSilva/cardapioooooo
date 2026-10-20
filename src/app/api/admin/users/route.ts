import { z } from 'zod';
import { requireStaff, audit, hashPassword } from '@/lib/auth';
import { body, handler, json } from '@/lib/http';
import { one, query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireStaff('users');
  return json({ users: await query('SELECT id,name,email,role,active,created_at FROM staff_users ORDER BY created_at') });
});
export const POST = handler(async (req: Request) => {
  const staff = await requireStaff('users');
  const d = await body(req, z.object({
    name: z.string().trim().min(1).max(80), email: z.string().email().max(200),
    password: z.string().min(8, 'mínimo de 8 caracteres').max(200), role: z.enum(['admin', 'manager', 'waiter', 'kitchen']),
  }));
  const u = await one('INSERT INTO staff_users(name,email,password_hash,role) VALUES ($1,lower($2),$3,$4) RETURNING id,name,email,role,active',
    [d.name, d.email, await hashPassword(d.password), d.role]);
  await audit(staff, 'user.create', 'user', u!.id, { email: d.email, role: d.role });
  return json({ user: u }, 201);
});
