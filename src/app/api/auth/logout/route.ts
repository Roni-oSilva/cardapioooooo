import { COOKIE, getStaff, logout } from '@/lib/auth';
import { handler, json } from '@/lib/http';

export const POST = handler(async () => {
  const s = await getStaff();
  if (s) await logout(s.sid);
  const res = json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
});
