'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { STATUS_LABEL } from '@/lib/money';

const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: 'ok' | 'err' }[]>([]);
  const push = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), kind === 'err' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto max-w-md animate-pop rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl ${t.kind === 'ok' ? 'bg-cream-100 text-wine-700' : 'bg-ember text-white'}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="title text-4xl text-cream-100 sm:text-5xl">{title}</h1>{sub && <p className="mt-1 text-sm text-cream-100/75">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  recebido: 'bg-cream-300 text-wine-800', aguardando_impressao: 'bg-ember/90 text-white', em_preparo: 'bg-[#e9a93b] text-wine-900',
  pronto: 'bg-forest-500 text-white', entregue: 'bg-forest-900 text-cream-100 ring-1 ring-cream-100/30', cancelado: 'bg-wine-700 text-cream-100 line-through',
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLE[status] ?? 'bg-cream-300'}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function Empty({ icon = '🍽️', title, children }: { icon?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 py-14 text-center">
      <span className="text-4xl" aria-hidden>{icon}</span>
      <p className="title text-2xl">{title}</p>
      {children && <p className="max-w-sm text-sm opacity-80">{children}</p>}
    </div>
  );
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3" aria-busy="true" aria-label="Carregando">{Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-20" />)}</div>;
}

export function ErrorBox({ msg, retry }: { msg: string; retry?: () => void }) {
  return <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-ember/90 px-4 py-3 text-sm font-semibold text-white"><span>{msg}</span>{retry && <button className="btn btn-sm bg-white/20" onClick={retry}>Tentar de novo</button>}</div>;
}

export function Stat({ label, value, hint, tone = 'cream' }: { label: string; value: React.ReactNode; hint?: string; tone?: 'cream' | 'green' }) {
  return (
    <div className={`rounded-3xl p-5 shadow-card ${tone === 'cream' ? 'bg-cream-100 text-wine-700' : 'bg-forest-900/80 text-cream-100 ring-1 ring-cream-100/10'}`}>
      <p className="text-[11px] font-bold uppercase tracking-widest opacity-70">{label}</p>
      <p className="title mt-1 text-3xl sm:text-4xl">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-70">{hint}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-black/60 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <button className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} tabIndex={-1} />
      <div className="relative flex max-h-[92dvh] w-full max-w-xl animate-slideUp flex-col rounded-t-[28px] bg-cream-100 text-wine-800 shadow-2xl sm:rounded-[28px]">
        <header className="flex items-center justify-between px-6 pb-2 pt-5"><h2 className="title text-2xl text-wine-700">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full bg-wine-700/10 text-wine-700">✕</button></header>
        <div className="flex-1 overflow-y-auto px-6 pb-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-wine-700/15 bg-cream-50 px-6 py-4 sm:rounded-b-[28px]">{footer}</footer>}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-forest-600' : 'bg-wine-700/25'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
      {label}
    </label>
  );
}
