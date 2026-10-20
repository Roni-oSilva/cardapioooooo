'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLoader } from '@/lib/client';
import { brl } from '@/lib/money';
import { BarChart } from './BarChart';
import { ErrorBox, Loading, PageHeader, Stat, Empty } from './ui';

const RANGES = [['day', 'Hoje'], ['week', '7 dias'], ['month', '30 dias']] as const;

export function Dashboard() {
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const { data, error, loading, reload } = useLoader<any>(`/api/admin/dashboard?range=${range}`, { live: true });
  return (
    <>
      <PageHeader title="Dashboard" sub="Indicadores calculados a partir dos pedidos e pagamentos reais."
        actions={<div role="tablist" className="flex gap-1.5">{RANGES.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={range === k ? 'btn-cream btn-sm' : 'btn-ghost btn-sm'}>{l}</button>))}</div>} />
      {error && <ErrorBox msg={error} retry={reload} />}
      {loading && !data ? <Loading rows={4} /> : data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Faturamento recebido" value={brl(data.received)} hint="Pagamentos lançados no período" />
            <Stat label="Pedidos" value={data.orders} hint={`${brl(data.registered)} registrados`} />
            <Stat label="Ticket médio" value={brl(data.avg_ticket)} hint="Por pedido (sem cancelados)" />
            <Stat label="A receber" value={brl(data.receivable)} hint="Contas abertas agora" tone="green" />
            <Stat label="Em andamento" value={data.in_progress} hint="Recebidos + em preparo" tone="green" />
            <Stat label="Concluídos" value={data.done} hint="Prontos ou entregues" tone="green" />
            <Stat label="Cancelados" value={data.cancelled} tone="green" />
            <Link href="/admin/pedidos" className="btn-cream h-full min-h-[88px] rounded-3xl text-base">Abrir pedidos →</Link>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <section className="panel"><h2 className="title mb-3 text-2xl">Faturamento {range === 'day' ? 'por hora' : 'por dia'}</h2>
              {data.registered === 0 && data.received === 0 ? <Empty icon="📈" title="Sem vendas no período">Assim que houver pedidos, o gráfico aparece aqui.</Empty> : <BarChart data={data.series} />}
            </section>
            <section className="panel"><h2 className="title mb-3 text-2xl">Mais vendidos</h2>
              {data.top.length === 0 ? <Empty icon="🏆" title="Sem dados" /> : (
                <ol className="space-y-2">
                  {data.top.map((p: any, i: number) => {
                    const pct = (p.qty / data.top[0].qty) * 100;
                    return (
                      <li key={p.name} className="text-sm">
                        <div className="flex justify-between gap-2"><span className="font-semibold">{i + 1}. {p.name}</span><span>{p.qty}× · {brl(p.revenue)}</span></div>
                        <div className="mt-1 h-2 rounded-full bg-wine-700/10"><div className="h-2 rounded-full bg-wine-700" style={{ width: `${pct}%` }} /></div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
