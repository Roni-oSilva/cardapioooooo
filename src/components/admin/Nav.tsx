'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

export interface NavItem { href: string; label: string; icon: string }

export function Nav({ items, user }: { items: NavItem[]; user: { name: string; roleLabel: string } }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const out = async () => { await api('POST', '/api/auth/logout').catch(() => {}); router.replace('/login'); router.refresh(); };
  const list = (
    <nav aria-label="Menu do painel" className="flex flex-col gap-1">
      {items.map((i) => {
        const on = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} onClick={() => setOpen(false)} aria-current={on ? 'page' : undefined}
            className={`flex min-h-[44px] items-center gap-3 rounded-2xl px-4 text-sm font-semibold transition ${on ? 'bg-cream-100 text-wine-700' : 'text-cream-100/90 hover:bg-cream-100/10'}`}>
            <span aria-hidden className="w-5 text-center">{i.icon}</span>{i.label}
          </Link>
        );
      })}
    </nav>
  );
  const foot = (
    <div className="mt-auto space-y-2 border-t border-cream-100/15 pt-4 text-sm">
      <p className="font-semibold">{user.name}</p><p className="text-xs text-cream-100/70">{user.roleLabel}</p>
      <div className="flex gap-2"><Link href="/" className="btn-ghost btn-sm" target="_blank">Ver cardápio</Link><button className="btn-ghost btn-sm" onClick={out}>Sair</button></div>
    </div>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto bg-forest-950/70 p-5 backdrop-blur lg:flex">
        <p className="title text-2xl text-cream-100">Painel</p>{list}{foot}
      </aside>
      <div className="sticky top-0 z-40 flex items-center justify-between bg-forest-950/95 px-4 py-3 backdrop-blur lg:hidden">
        <p className="title text-xl text-cream-100">Painel</p>
        <button className="btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Fechar' : 'Menu'}</button>
      </div>
      {open && <div className="fixed inset-x-0 bottom-0 top-[57px] z-30 flex flex-col gap-6 overflow-y-auto bg-forest-950 p-5 lg:hidden">{list}{foot}</div>}
    </>
  );
}
