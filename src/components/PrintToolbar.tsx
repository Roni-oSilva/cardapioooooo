'use client';
import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function PrintToolbar({ number, auto }: { number: number; auto: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const via = sp.get('via') ?? 'cozinha';
  const paper = sp.get('paper') ?? '80';
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp.toString()); n.set(k, v); n.delete('auto'); router.replace(`${path}?${n}`); };
  useEffect(() => { if (auto) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); } }, [auto]);
  const Pill = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} aria-pressed={on} className={`rounded-full px-4 py-2 text-sm font-semibold ${on ? 'bg-wine-700 text-cream-100' : 'bg-white text-wine-700 ring-1 ring-wine-700/30'}`}>{children}</button>
  );
  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-center gap-3 bg-cream-100 px-4 py-3 shadow">
      <span className="font-display text-lg font-black uppercase text-wine-700">Pedido #{number}</span>
      <div className="flex gap-1.5"><Pill on={via === 'cozinha'} onClick={() => set('via', 'cozinha')}>Via cozinha</Pill><Pill on={via === 'atendimento'} onClick={() => set('via', 'atendimento')}>Via atendimento</Pill></div>
      <div className="flex gap-1.5">{['58', '80', 'a4'].map((p) => <Pill key={p} on={paper === p} onClick={() => set('paper', p)}>{p === 'a4' ? 'A4' : `${p} mm`}</Pill>)}</div>
      <button className="btn-primary" onClick={() => window.print()}>🖨 Imprimir comanda</button>
    </div>
  );
}
