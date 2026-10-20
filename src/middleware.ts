import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/** Barreira rápida (assinatura do cookie). A checagem de sessão revogada/permissão fica nas páginas e APIs (Node). */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get('cardapio_session')?.value;
  const secret = process.env.AUTH_SECRET;
  let ok = false;
  if (token && secret) {
    try { await jwtVerify(token, new TextEncoder().encode(secret)); ok = true; } catch { /* expirado/inválido */ }
  }
  if (ok) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/admin/:path*', '/kitchen/:path*', '/comanda/:path*'] };
