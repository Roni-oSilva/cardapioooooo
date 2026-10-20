import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const json = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === 'number' ? { status: init } : init);

/** Envolve um handler convertendo erros conhecidos em respostas JSON consistentes. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
      if (e instanceof ZodError) {
        const first = e.issues[0];
        return json({ error: `${first?.path.join('.') || 'dados'}: ${first?.message ?? 'inválido'}`, issues: e.issues }, 400);
      }
      if ((e as any)?.code === '23505') return json({ error: 'Já existe um registro com esse valor.' }, 409);
      if ((e as any)?.code === '23503') return json({ error: 'Registro em uso por outros dados.' }, 409);
      console.error('[api] erro inesperado', e);
      return json({ error: 'Erro interno. Tente novamente.' }, 500);
    }
  };
}

export async function body<T>(req: Request, schema: { parse: (v: unknown) => T }): Promise<T> {
  // exigir JSON impede que formulários de outros sites disparem ações (proteção CSRF complementar ao SameSite)
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) throw new HttpError(415, 'Content-Type deve ser application/json.');
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'Corpo da requisição inválido.');
  }
  return schema.parse(raw);
}
