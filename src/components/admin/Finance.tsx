'use client';
import { useState } from 'react';
import { useLoader, dmyhm } from '@/lib/client';
import { brl, PAY_LABEL, SERVICE_LABEL, STATUS_LABEL } from '@/lib/money';
import { Empty, ErrorBox, Loading, PageHeader, Stat } from './ui';

export function Finance() {
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const qs = new URLSearchParams(Object.entries(range).filter(([, v]) => v)).toString();
  const { data, error, loading, reload } = useLoader<any>(`/api/admin/finance?${qs}`, { live: true, every: 60000 });
  const exp = (type: string) => `/api/admin/finance/export?type=${type}&from=${data?.from ?? ''}&to=${data?.to ?? ''}`;
  return (
    <>
      <PageHeader title="Financeiro" sub="Recebido, registrado e a receber são coisas diferentes: só pagamentos lançados contam como faturamento recebido."
        actions={data && <div className="flex flex-wrap gap-2">{[['payments', 'Pagamentos'], ['orders', 'Pedidos'], ['products', 'Produtos'], ['cancellations', 'Cancelamentos']].map(([t, l]) => <a key={t} className="btn-ghost btn-sm" href={exp(t)}>⬇ {l} (CSV)</a>)}</div>} />
      <form className="panel mb-5 flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()} aria-label="Período">
        <div><label className="label" htmlFor="df">De</label><input id="df" type="date" className="field" value={range.from || data?.from || ''} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div><label className="label" htmlFor="dt">Até</label><input id="dt" type="date" className="field" value={range.to || data?.to || ''} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
      </form>
      {error && <ErrorBox msg={error} retry={reload} />}
      {loading && !data ? <Loading rows={4} /> : data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Recebido (pago)" value={brl(data.received)} hint="Pagamentos no período" />
            <Stat label="Pedidos registrados" value={brl(data.registered_total)} hint={`${data.registered_count} pedido(s), sem cancelados`} />
            <Stat label="A receber agora" value={brl(data.receivable)} hint={`${data.open_tabs} conta(s) aberta(s)`} tone="green" />
            <Stat label="Cancelados" value={brl(data.cancelled_total)} hint={`${data.cancelled_count} pedido(s)`} tone="green" />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="panel"><h2 className="title mb-3 text-2xl">Por forma de pagamento</h2>
              {!data.byMethod.length ? <Empty icon="💳" title="Sem pagamentos" /> : <ul className="space-y-2 text-sm">{data.byMethod.map((m: any) => <li key={m.method} className="flex justify-between border-b border-wine-700/10 pb-1.5"><span className="font-semibold">{PAY_LABEL[m.method]} <span className="opacity-60">({m.count})</span></span><b>{brl(m.total)}</b></li>)}</ul>}
            </section>
            <section className="panel"><h2 className="title mb-3 text-2xl">Produtos mais vendidos</h2>
              {!data.top.length ? <Empty icon="🏆" title="Sem vendas" /> : <ol className="space-y-1.5 text-sm">{data.top.slice(0, 10).map((p: any, i: number) => <li key={p.name} className="flex justify-between"><span>{i + 1}. {p.name}</span><span>{p.qty}× · {brl(p.revenue)}</span></li>)}</ol>}
            </section>
            <section className="panel"><h2 className="title mb-3 text-2xl">Descontos autorizados</h2>
              {!data.discounts.length ? <p className="text-sm opacity-70">Nenhum desconto no período.</p> : <ul className="space-y-2 text-sm">{data.discounts.map((d: any) => <li key={d.id}><b>{brl(d.discount_cents)}</b> · {d.discount_reason} <span className="block text-xs opacity-70">{d.table_label ? `Mesa ${d.table_label} · ` : ''}{dmyhm(d.closed_at)} · autorizado por {d.authorized_by}</span></li>)}</ul>}
            </section>
            <section className="panel"><h2 className="title mb-3 text-2xl">Cancelamentos</h2>
              {!data.cancellations.length ? <p className="text-sm opacity-70">Nenhum cancelamento no período.</p> : <ul className="space-y-2 text-sm">{data.cancellations.map((c: any) => <li key={c.number}><b>#{c.number}</b> · {brl(c.total_cents)} · {c.cancel_reason} <span className="block text-xs opacity-70">{c.by_user ?? '—'}{c.cancelled_at ? ` · ${dmyhm(c.cancelled_at)}` : ''}</span></li>)}</ul>}
            </section>
          </div>
          <section className="panel overflow-x-auto"><h2 className="title mb-3 text-2xl">Histórico de pedidos</h2>
            <table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-wine-700/20 text-xs uppercase opacity-70"><th className="py-2">Pedido</th><th>Data</th><th>Atendimento</th><th>Status</th><th>Conta</th><th className="text-right">Total</th></tr></thead>
              <tbody>{data.history.map((h: any) => <tr key={h.number} className="border-b border-wine-700/10"><td className="py-2 font-bold">#{h.number}</td><td>{dmyhm(h.created_at)}</td><td>{h.table_label ? `Mesa ${h.table_label}` : SERVICE_LABEL[h.service_type]}</td><td>{STATUS_LABEL[h.status]}</td><td>{h.tab_status === 'closed' ? 'Paga' : h.tab_status === 'open' ? 'Aberta' : 'Anulada'}</td><td className="text-right font-semibold">{brl(h.total_cents)}</td></tr>)}</tbody></table>
            {!data.history.length && <Empty icon="🧾" title="Sem pedidos no período" />}
          </section>
        </div>
      )}
    </>
  );
}
