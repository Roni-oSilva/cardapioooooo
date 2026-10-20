'use client';
import { useEffect, useRef } from 'react';

/** Painel modal: gaveta lateral no desktop, "bottom sheet" no celular. Fecha com Esc ou clique fora. */
export function Sheet({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Fechar" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} tabIndex={-1} />
      <div ref={ref} tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full animate-slideUp flex-col rounded-t-[28px] bg-cream-100 text-wine-800 shadow-2xl outline-none sm:max-h-none sm:rounded-none sm:rounded-l-[28px] ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <h2 className="title text-2xl text-wine-700">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full bg-wine-700/10 text-wine-700 transition hover:bg-wine-700/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <footer className="border-t border-wine-700/15 bg-cream-50 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}
