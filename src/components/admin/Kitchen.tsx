'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, ago, useLoader } from '@/lib/client';
import { SERVICE_LABEL } from '@/lib/money';
import { Empty, ErrorBox, useToast } from './ui';

const LS_SOUND = 'cozinha:som';

function beep(ctx: AudioContext) {
  [0, 0.22, 0.44].forEach((t, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = i === 2 ? 1040 : 780;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
    o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
  });
}

export function Kitchen({ canPanel }: { canPanel: boolean }) {
  const { data, error, reload } = useLoader<{ orders: any[]; sound: boolean; priority: string }>('/api/admin/kitchen', { live: true, every: 10000 });
  const toast = useToast();
  const [now, setNow] = useState(Date.now());
  const [sound, setSound] = useState(true);
  const [armed, setArmed] = useState(false); // navegadores só liberam áudio após um clique
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);
  const ctx = useRef<AudioContext | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => { try { const v = localStorage.getItem(LS_SOUND); if (v !== null) setSound(v === '1'); else if (data) setSound(data.sound); } catch {} }, [data?.sound]); // eslint-disable-line react-hooks/exhaustive-deps

  // detecta pedidos novos entre uma atualização e outra
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.orders.map((o) => o.id));
    if (seen.current) {
      const added = data.orders.filter((o) => !seen.current!.has(o.id) && ['recebido', 'aguardando_impressao'].includes(o.status)).map((o) => o.id);
      if (added.length) {
        setFresh((f) => new Set([...f, ...added]));
        if (sound && ctx.current) beep(ctx.current);
      }
    }
    seen.current = ids;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const arm = () => { try { ctx.current ??= new (window.AudioContext || (window as any).webkitAudioContext)(); ctx.current.resume(); beep(ctx.current); setArmed(true); } catch { toast('Seu navegador bloqueou o áudio.', 'err'); } };
  const toggleSound = () => { const v = !sound; setSound(v); try { localStorage.setItem(LS_SOUND, v ? '1' : '0'); } catch {} if (v && !armed) arm(); };

  const move = async (id: string, to: string) => {
    setFresh((f) => { const n = new Set(f); n.delete(id); return n; });
    try { await api('PATCH', `/api/admin/orders/${id}`, { status: to }); reload(); } catch (e: any) { toast(e.message, 'err'); }
  };

  const cols = [
    { key: 'new', title: 'Novos', filter: (s: string) => s === 'recebido' || s === 'aguardando_impressao', act: { to: 'em_preparo', label: 'Iniciar preparo' } },
    { key: 'prep', title: 'Em preparo', filter: (s: string) => s === 'em_preparo', act: { to: 'pronto', label: 'Pronto ✓' } },
    { key: 'ready', title: 'Prontos', filter: (s: string) => s === 'pronto', act: { to: 'entregue', label: 'Entregue' } },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-forest-950/70 text-cream-100">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <h1 className="title text-3xl sm:text-4xl">Cozinha</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button className={sound ? 'btn-cream btn-sm' : 'btn-ghost btn-sm'} onClick={toggleSound} aria-pressed={sound}>{sound ? '🔔 Som ligado' : '🔕 Som desligado'}</button>
          {sound && !armed && <button className="btn-danger btn-sm animate-flash" onClick={arm}>Toque para ativar o som</button>}
          {canPanel && <Link href="/admin/pedidos" className="btn-ghost btn-sm">Painel</Link>}
          <button className="btn-ghost btn-sm" onClick={async () => { await api('POST', '/api/auth/logout').catch(() => {}); location.href = '/login'; }}>Sair</button>
        </div>
      </header>
      {error && <div className="px-5"><ErrorBox msg={error} retry={reload} /></div>}
      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-3">
        {cols.map((c) => {
          const list = (data?.orders ?? []).filter((o) => c.filter(o.status));
          return (
            <section key={c.key} aria-label={c.title} className="flex flex-col gap-3 rounded-[28px] bg-forest-900/70 p-3 ring-1 ring-cream-100/10">
              <h2 className="flex items-center justify-between px-2 title text-2xl">{c.title}<span className="grid h-8 min-w-8 place-items-center rounded-full bg-cream-100 px-2 text-base text-wine-700">{list.length}</span></h2>
              {list.length === 0 && <div className="py-10 text-center text-sm text-cream-100/60"><Empty icon="✔" title="Tudo em dia" /></div>}
              {list.map((o) => {
                const mins = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
                const late = c.key !== 'ready' && mins >= (o.prep_minutes || 20) + 10;
                const warn = c.key !== 'ready' && mins >= Math.max(10, o.prep_minutes || 15);
                const isFresh = fresh.has(o.id);
                return (
                  <article key={o.id} onClick={() => isFresh && setFresh((f) => { const n = new Set(f); n.delete(o.id); return n; })}
                    className={`rounded-3xl bg-cream-100 p-4 text-wine-800 shadow-card ${isFresh ? 'animate-flash ring-4 ring-ember' : ''} ${late ? 'outline outline-4 outline-ember' : ''}`}>
                    <header className="flex items-start justify-between gap-2">
                      <div>
                        <p className="title text-5xl text-wine-700">{o.service_type === 'salao' ? `Mesa ${o.table_label}` : SERVICE_LABEL[o.service_type]}</p>
                        <p className="mt-1 text-sm font-semibold">Pedido #{o.number}{o.customer_name ? ` · ${o.customer_name}` : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className={`rounded-full px-3 py-1 text-lg font-black ${late ? 'bg-ember text-white' : warn ? 'bg-[#e9a93b] text-wine-900' : 'bg-forest-900 text-cream-100'}`} title="Tempo de espera">⏱ {ago(o.created_at, now)}</p>
                        {isFresh && <p className="mt-1 text-xs font-black uppercase text-ember">Novo!</p>}
                        {o.kitchen_print?.status === 'failed' && <p className="mt-1 text-[11px] font-bold text-ember" title={o.kitchen_print.error}>⚠ comanda não impressa</p>}
                      </div>
                    </header>
                    <ul className="mt-3 space-y-2.5 border-t-2 border-dashed border-wine-700/30 pt-3">
                      {o.items.map((i: any) => (
                        <li key={i.id}>
                          <p className="text-2xl font-extrabold uppercase leading-tight text-wine-800"><span className="mr-2 rounded-lg bg-wine-700 px-2 text-cream-100">{i.quantity}×</span>{i.product_name}</p>
                          {i.options.map((op: any, k: number) => <p key={k} className="ml-1 text-lg font-semibold uppercase text-wine-700"><span className="opacity-60">{op.g}:</span> {op.n}</p>)}
                          {i.notes && <p className="mt-1 rounded-xl bg-ember px-3 py-1.5 text-lg font-black uppercase text-white">⚠ {i.notes}</p>}
                        </li>
                      ))}
                    </ul>
                    {o.notes && <p className="mt-3 rounded-xl bg-ember/90 px-3 py-2 text-lg font-black uppercase text-white">OBS: {o.notes}</p>}
                    <button className="btn-primary mt-4 w-full !min-h-[56px] text-lg" onClick={(e) => { e.stopPropagation(); move(o.id, c.act.to); }}>{c.act.label}</button>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
