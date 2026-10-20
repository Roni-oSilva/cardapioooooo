'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Thumb } from '../Thumb';
import { ProductSheet } from './ProductSheet';
import { CartDrawer } from './CartDrawer';
import { useCart } from '@/lib/cart';
import { brl } from '@/lib/money';
import type { PublicProduct } from '@/lib/menu';
import type { Settings } from '@/lib/settings';

interface Props {
  settings: Settings;
  categories: { id: string; name: string; description: string }[];
  products: PublicProduct[];
  tables: { id: string; label: string }[];
  presetTable?: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function MenuClient({ settings, categories, products, tables, presetTable }: Props) {
  const cart = useCart();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<PublicProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [done, setDone] = useState<{ number: number; token: string } | null>(null);
  const [active, setActive] = useState(categories[0]?.id);
  const navRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const n = norm(q.trim());
    return n ? products.filter((p) => norm(`${p.name} ${p.description} ${p.ingredients}`).includes(n)) : products;
  }, [q, products]);
  const featured = useMemo(() => (q ? [] : products.filter((p) => p.featured && p.orderable)), [q, products]);
  const sections = categories.map((c) => ({ ...c, items: visible.filter((p) => p.category_id === c.id) })).filter((c) => c.items.length);

  // destaca a categoria visível na barra
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(`cat-${s.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((es) => {
      const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (v) setActive(v.target.id.replace('cat-', ''));
    }, { rootMargin: '-120px 0px -60% 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections.map((s) => s.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>(`[data-cat="${active}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [active]);

  const canOrder = settings.accepting_orders;

  return (
    <>
      {/* ---------- topo ---------- */}
      <header className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-8 sm:px-6 sm:pt-12">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {settings.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={settings.logo_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-cream-100/40" />
                : <span className="grid h-12 w-12 place-items-center rounded-full bg-cream-100 font-display text-xl font-black text-wine-700">{settings.name.charAt(0)}</span>}
              <span className="font-display text-sm font-extrabold uppercase tracking-[.18em] text-cream-100/90">{settings.name}</span>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${canOrder ? 'bg-cream-100 text-wine-700' : 'bg-ember text-white'}`}>
              {canOrder ? 'Recebendo pedidos' : 'Pedidos pausados'}
            </span>
          </div>

          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <h1 className="title text-[clamp(3.4rem,13vw,8.5rem)] text-cream-100">Nosso<br />cardápio</h1>
              {settings.tagline && <p className="mt-4 max-w-md text-base font-medium text-cream-100/90 sm:text-lg">{settings.tagline}</p>}
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#cardapio" className="btn-cream">Ver pratos</a>
                <a href="#info" className="btn-ghost">Horários e endereço</a>
              </div>
            </div>
            {settings.hero_image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={settings.hero_image_url} alt={`Pratos do ${settings.name}`} className="aspect-[4/3] w-full rounded-[36px] object-cover shadow-card" />
              : null}
          </div>
        </div>
      </header>

      {/* ---------- barra de busca + categorias ---------- */}
      <div className="sticky top-0 z-30 border-b border-cream-100/10 bg-forest-900/95 backdrop-blur" id="cardapio">
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-3 sm:px-6">
          <div className="relative">
            <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cream-100/60" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pratos, ingredientes…" aria-label="Buscar pratos" className="field-dark !rounded-full pl-11" />
          </div>
          <nav ref={navRef} aria-label="Categorias" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {sections.map((c) => (
              <a key={c.id} data-cat={c.id} href={`#cat-${c.id}`} aria-current={active === c.id ? 'true' : undefined}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${active === c.id ? 'bg-cream-100 text-wine-700' : 'bg-cream-100/10 text-cream-100 hover:bg-cream-100/20'}`}>
                {c.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-14 px-4 pb-40 pt-10 sm:px-6">
        {!canOrder && (
          <p role="status" className="rounded-2xl bg-ember px-4 py-3 text-center text-sm font-semibold text-white">
            No momento não estamos recebendo pedidos pelo cardápio digital. Você pode consultar os pratos normalmente.
          </p>
        )}

        {featured.length > 0 && (
          <section aria-labelledby="destaques">
            <h2 id="destaques" className="title mb-5 text-4xl text-cream-100 sm:text-5xl">Destaques <span className="text-cream-300">da casa</span></h2>
            <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
              {featured.slice(0, 3).map((p) => (
                <button key={p.id} onClick={() => setOpen(p)} className="group w-[78%] shrink-0 snap-start overflow-hidden rounded-[28px] bg-cream-100 text-left shadow-card transition hover:-translate-y-1 sm:w-auto">
                  <Thumb src={p.image_url} name={p.name} className="h-44 w-full transition duration-500 group-hover:scale-[1.03]" />
                  <div className="flex items-center justify-between gap-3 p-4">
                    <h3 className="title text-xl text-wine-700">{p.name}</h3>
                    <span className="price shrink-0 !text-base">{brl(p.price_cents)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {!sections.length && (
          <div className="panel-green grid place-items-center gap-2 py-16 text-center">
            <p className="title text-3xl">Nada encontrado</p>
            <p className="text-sm text-cream-100/80">Tente outro termo de busca.</p>
            <button className="btn-cream mt-3" onClick={() => setQ('')}>Limpar busca</button>
          </div>
        )}

        {sections.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-36" aria-labelledby={`h-${c.id}`}>
            <h2 id={`h-${c.id}`} className="title mb-2 text-4xl text-cream-100 sm:text-5xl">{c.name}</h2>
            {c.description && <p className="mb-5 text-sm text-cream-100/80">{c.description}</p>}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {c.items.map((p) => (
                <article key={p.id} className={`group relative flex overflow-hidden rounded-[28px] bg-cream-100 text-wine-800 shadow-card transition hover:-translate-y-0.5 ${p.orderable ? '' : 'opacity-60'}`}>
                  <button onClick={() => setOpen(p)} className="flex w-full items-stretch text-left" aria-label={`${p.name}, ${brl(p.price_cents)}. Ver detalhes`}>
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-5">
                      <div>
                        <h3 className="title text-[1.65rem] text-wine-700 sm:text-3xl">{p.name}</h3>
                        <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-wine-800/90">{p.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="price">{brl(p.price_cents)}</span>
                        {p.prep_minutes ? <span className="text-xs font-medium text-wine-700/80">⏱ {p.prep_minutes} min</span> : null}
                        {!p.orderable && <span className="chip">Indisponível</span>}
                      </div>
                    </div>
                    <Thumb src={p.image_url} name={p.name} className="h-auto w-36 shrink-0 sm:w-44" />
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* ---------- informações ---------- */}
        <section id="info" className="grid gap-4 md:grid-cols-2" aria-label="Informações do restaurante">
          <div className="panel">
            <h2 className="title text-4xl">Sobre a casa</h2>
            <p className="mt-3 text-sm leading-relaxed">{settings.about || settings.tagline}</p>
          </div>
          <div className="panel space-y-4">
            <div>
              <h2 className="title text-3xl">Horários</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {settings.hours.map((h) => <li key={h.label} className="flex justify-between gap-4"><span className="font-semibold">{h.label}</span><span>{h.hours}</span></li>)}
              </ul>
            </div>
            <div className="space-y-1 text-sm">
              {settings.address && <p>📍 {settings.address}</p>}
              {settings.phone && <p>📞 <a className="underline" href={`tel:${settings.phone.replace(/\D/g, '')}`}>{settings.phone}</a></p>}
              {settings.whatsapp && <p>💬 <a className="underline" href={`https://wa.me/55${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp {settings.whatsapp}</a></p>}
            </div>
          </div>
        </section>
        <footer className="pb-6 text-center text-xs text-cream-100/60">
          © {new Date().getFullYear()} {settings.name} · <Link href="/login" className="underline-offset-2 hover:underline">Acesso da equipe</Link>
        </footer>
      </main>

      {/* ---------- barra do carrinho ---------- */}
      {cart.ready && cart.count > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={() => setCartOpen(true)} className="mx-auto flex w-full max-w-xl animate-slideUp items-center justify-between gap-4 rounded-full bg-wine-700 px-6 py-4 text-cream-100 shadow-2xl ring-1 ring-cream-100/20 transition hover:bg-wine-600">
            <span className="flex items-center gap-3 font-semibold">
              <span className="grid h-8 min-w-8 place-items-center rounded-full bg-cream-100 px-2 text-sm font-black text-wine-700">{cart.count}</span>
              Ver pedido
            </span>
            <span className="font-display text-xl font-black">{brl(cart.subtotal)}</span>
          </button>
        </div>
      )}

      <ProductSheet product={open} onClose={() => setOpen(null)} onAdd={cart.add} canOrder={!!open?.orderable && canOrder} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} settings={settings} tables={tables} presetTable={presetTable}
        onDone={(o) => { setCartOpen(false); setDone(o); }} />

      {done && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" role="alertdialog" aria-modal="true" aria-label="Pedido confirmado">
          <div className="panel w-full max-w-sm animate-pop text-center">
            <p className="text-5xl" aria-hidden>✅</p>
            <h2 className="title mt-2 text-4xl">Pedido enviado!</h2>
            <p className="mt-3 text-sm">Seu número de pedido é</p>
            <p className="title text-6xl">#{done.number}</p>
            <p className="mt-2 text-sm text-wine-800/80">Já está com a nossa cozinha.</p>
            <div className="mt-5 grid gap-2">
              <Link href={`/pedido/${done.number}?t=${done.token}`} className="btn-primary">Acompanhar pedido</Link>
              <button className="btn-ghost-dark" onClick={() => setDone(null)}>Fazer outro pedido</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
