import { z } from 'zod';
import { body, handler, json } from '@/lib/http';
import { COOKIE, login, audit } from '@/lib/auth';

export const POST = handler(async (req: Request) => {
  const { email, password } = await body(req, z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }));
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const r = await login(email, password, ip, req.headers.get('user-agent') ?? '');
  await audit(r.user, 'login', 'session');
  const res = json({ user: r.user });
  res.cookies.set(COOKIE, r.token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: r.expires,
  });
  return res;
});
