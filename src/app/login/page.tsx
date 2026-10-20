'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function Form() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const home = d.user.role === 'kitchen' ? '/kitchen' : d.user.role === 'waiter' ? '/admin/pedidos' : '/admin';
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : home);
      router.refresh();
    } catch (err: any) {
      setError(err instanceof TypeError ? 'Sem conexão com o servidor.' : err.message);
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <form onSubmit={submit} className="panel w-full max-w-sm space-y-4 animate-pop" aria-label="Entrar">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-wine-700/70">Acesso da equipe</p>
          <h1 className="title text-5xl">Entrar</h1>
        </div>
        <div><label className="label" htmlFor="email">E-mail</label>
          <input id="email" type="email" required autoComplete="username" className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label" htmlFor="pw">Senha</label>
          <input id="pw" type="password" required autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {error && <p role="alert" className="rounded-xl bg-ember/15 px-3 py-2 text-sm font-medium">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <Link href="/" className="block text-center text-sm text-wine-700 underline-offset-2 hover:underline">← Voltar ao cardápio</Link>
      </form>
    </main>
  );
}
export default function Login() { return <Suspense><Form /></Suspense>; }
