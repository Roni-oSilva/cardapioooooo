import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { one, query } from './db';
import { HttpError } from './http';
import { Area, Role, can } from './permissions';

export const COOKIE = 'cardapio_session';
const TTL_HOURS = 12;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET ausente ou curto demais (mínimo 32 caracteres).');
  return new TextEncoder().encode(s);
}

export interface Staff { id: string; name: string; email: string; role: Role; sid: string }

export const hashPassword = (p: string) => bcrypt.hash(p, 11);

// Limitação simples de tentativas por e-mail+IP (em memória; para vários servidores use Redis/DB).
const attempts = new Map<string, { n: number; until: number }>();

export async function login(email: string, password: string, ip: string, ua: string) {
  const key = `${email.toLowerCase()}|${ip}`;
  const a = attempts.get(key);
  if (a && a.until > Date.now() && a.n >= 5) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos.');
  const u = await one<{ id: string; name: string; email: string; role: Role; password_hash: string; active: boolean }>(
    'SELECT id,name,email,role,password_hash,active FROM staff_users WHERE lower(email)=lower($1)', [email]);
  // compara sempre para não revelar se o e-mail existe pelo tempo de resposta
  const ok = await bcrypt.compare(password, u?.password_hash ?? '$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
  if (!u || !ok || !u.active) {
    const cur = attempts.get(key);
    attempts.set(key, { n: (cur && cur.until > Date.now() ? cur.n : 0) + 1, until: Date.now() + 15 * 60_000 });
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }
  attempts.delete(key);
  const expires = new Date(Date.now() + TTL_HOURS * 3600_000);
  const s = await one<{ id: string }>(
    'INSERT INTO sessions(user_id, expires_at, ip, user_agent) VALUES ($1,$2,$3,$4) RETURNING id',
    [u.id, expires, ip, ua.slice(0, 250)]);
  const token = await new SignJWT({ uid: u.id, sid: s!.id, role: u.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${TTL_HOURS}h`)
    .sign(secret());
  return { token, expires, user: { id: u.id, name: u.name, email: u.email, role: u.role } };
}

/** Lê o cookie, valida a assinatura e confirma no banco que a sessão não foi revogada. */
export async function getStaff(): Promise<Staff | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const row = await one<{ id: string; name: string; email: string; role: Role }>(
      `SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN staff_users u ON u.id=s.user_id
       WHERE s.id=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.active`, [payload.sid]);
    return row ? { ...row, sid: String(payload.sid) } : null;
  } catch {
    return null;
  }
}

export async function requireStaff(area?: Area): Promise<Staff> {
  const s = await getStaff();
  if (!s) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  if (area && !can(s.role, area)) throw new HttpError(403, 'Você não tem permissão para esta ação.');
  return s;
}

export async function logout(sid: string) {
  await query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [sid]);
}

export async function audit(staff: Pick<Staff, 'id' | 'name'> | null, action: string, entity: string, entityId?: string, details: object = {}) {
  await query('INSERT INTO audit_log(user_id,user_name,action,entity,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)',
    [staff?.id ?? null, staff?.name ?? null, action, entity, entityId ?? null, JSON.stringify(details)]);
}

export function agentAuthorized(req: Request) {
  const t = process.env.PRINT_AGENT_TOKEN;
  if (!t || t.length < 12) throw new HttpError(503, 'PRINT_AGENT_TOKEN não configurado no servidor.');
  const h = req.headers.get('authorization') ?? '';
  const given = h.startsWith('Bearer ') ? h.slice(7) : '';
  // comparação em tempo constante
  let diff = given.length ^ t.length;
  for (let i = 0; i < Math.max(given.length, t.length); i++) diff |= (given.charCodeAt(i) || 0) ^ (t.charCodeAt(i) || 0);
  if (diff !== 0) throw new HttpError(401, 'Token do agente inválido.');
}
