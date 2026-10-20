'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method, headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined, cache: 'no-store' });
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique a internet e tente novamente.');
  }
  if (res.status === 401 && !url.startsWith('/api/auth')) { window.location.href = `/login?next=${encodeURIComponent(location.pathname)}`; throw new Error('Sessão expirada.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

/** Carrega dados e recarrega quando o servidor avisa (SSE) — com recarga periódica como rede de segurança. */
export function useLoader<T>(url: string | null, opts: { live?: boolean; every?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const my = ++seq.current;
    try {
      const d = await api<T>('GET', url);
      if (my === seq.current) { setData(d); setError(''); }
    } catch (e: any) { if (my === seq.current) setError(e.message); }
    finally { if (my === seq.current) setLoading(false); }
  }, [url]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useLive(opts.live ? load : null, opts.every ?? 30000);
  return { data, error, loading, reload: load, setData };
}

/** Assina /api/realtime. Em caso de queda usa polling; reconecta sozinho. */
export function useLive(cb: ((e: { type: string; [k: string]: any }) => void) | null, pollMs = 15000) {
  const ref = useRef(cb);
  ref.current = cb;
  const active = !!cb;
  useEffect(() => {
    if (!active) return;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = (e: any) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => ref.current?.(e), 150); // junta rajadas de eventos
    };
    try {
      es = new EventSource('/api/realtime');
      es.onmessage = (m) => { try { fire(JSON.parse(m.data)); } catch { fire({ type: 'unknown' }); } };
    } catch { /* usa só polling */ }
    const poll = setInterval(() => ref.current?.({ type: 'poll' }), pollMs);
    const onVis = () => { if (document.visibilityState === 'visible') ref.current?.({ type: 'visible' }); };
    document.addEventListener('visibilitychange', onVis);
    return () => { es?.close(); clearInterval(poll); document.removeEventListener('visibilitychange', onVis); if (timer) clearTimeout(timer); };
  }, [active, pollMs]);
}

export const toCents = (v: string) => Math.round(parseFloat(v.replace(/\./g, '').replace(',', '.') || '0') * 100) || 0;
export const fromCents = (c: number) => (c / 100).toFixed(2).replace('.', ',');
export const ago = (iso: string, now = Date.now()) => {
  const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'agora' : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};
export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const dmyhm = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
