'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { STATUS_LABEL, brl } from '@/lib/money';

const STEPS = ['recebido', 'em_preparo', 'pronto', 'entregue'];
const MSG: Record<string, string> = {
  recebido: 'Recebemos seu pedido.', aguardando_impressao: 'Recebemos seu pedido.', em_preparo: 'A cozinha está preparando seu pedido.',
  pronto: 'Seu pedido está pronto!', entregue: 'Pedido entregue. Bom apetite!', cancelado: 'Este pedido foi cancelado. Fale com a nossa equipe.',
};

export default function Track() {
  const { number } = useParams<{ number: string }>();
  const t = useSearchParams().get('t') ?? '';
  const [o, setO] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/orders/track?n=${number}&t=${t}`, { cache: 'no-store' });
        const d = await r.json();
        if (!live) return;
        if (!r.ok) setErr(d.error); else { setO(d); setErr(''); }
      } catch { /* mantém o último estado e tenta de novo */ }
    };
    load();
    const id = setInterval(load, 8000);
    return () => { live = false; clearInterval(id); };
  }, [number, t]);

  const status = o?.status === 'aguardando_impressao' ? 'recebido' : o?.status;
  const idx = STEPS.indexOf(status);
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 py-10">
      <div className="panel w-full">
        {err ? (
          <div className="py-8 text-center"><p className="title text-3xl">Pedido não encontrado</p><p className="mt-2 text-sm">{err}</p></div>
        ) : !o ? <div className="skeleton h-48" /> : (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-wine-700/70">Pedido</p>
            <h1 className="title text-6xl">#{o.number}</h1>
            <p className="mt-3 text-lg font-semibold">{MSG[o.status]}</p>
            {o.status !== 'cancelado' && (
              <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Andamento">
                {STEPS.map((s, i) => (
                  <li key={s} className="text-center">
                    <div className={`mx-auto h-2 rounded-full transition-all ${i <= idx ? 'bg-wine-700' : 'bg-wine-700/20'}`} />
                    <span className={`mt-1 block text-[10px] font-semibold uppercase ${i === idx ? 'text-wine-700' : 'text-wine-700/50'}`}>{STATUS_LABEL[s]}</span>
                  </li>
                ))}
              </ol>
            )}
            <ul className="mt-5 space-y-1 border-t border-wine-700/15 pt-4 text-sm">
              {o.items.map((i: any, k: number) => <li key={k}>{i.quantity}× {i.product_name}</li>)}
            </ul>
            <p className="mt-3 flex justify-between border-t border-wine-700/15 pt-3 font-bold"><span>Total</span><span>{brl(o.total_cents)}</span></p>
          </>
        )}
        <Link href="/" className="btn-primary mt-6 w-full">Voltar ao cardápio</Link>
      </div>
    </main>
  );
}
