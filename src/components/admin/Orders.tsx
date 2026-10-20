'use client';
import { useMemo, useState } from 'react';
import { api, dmyhm, hhmm, useLoader } from '@/lib/client';
import { brl, SERVICE_LABEL, STATUS_LABEL } from '@/lib/money';
import { Empty, ErrorBox, Loading, Modal, PageHeader, StatusBadge, useToast } from './ui';
import { Sheet } from '../Sheet';
import { CloseTab } from './Tables';

const NEXT: Record<string, { to: string; label: string } | undefined> = {
  recebido: { to: 'em_preparo', label: 'Iniciar preparo' },
  aguardando_impressao: { to: 'em_preparo', label: 'Iniciar preparo' },
  em_preparo: { to: 'pronto', label: 'Marcar pronto' },
  pronto: { to: 'entregue', label: 'Marcar entregue' },
};
const FINAL = ['entregue', 'cancelado'];

export function Orders({ role }: { role: string }) {
  const [f, setF] = useState({ status: '', table: '', q: '', from: '', to: '' });
  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(), [f]);
  const { data, error, loading, reload } = useLoader<{ orders: any[] }>(`/api/admin/orders?${qs}`, { live: true });
  const tables = useLoader<{ tables: any[] }>('/api/admin/tables');
  const [openId, setOpenId] = useState<string | null>(null);
  const toast = useToast();

  const quick = async (id: string, to: string) => {
    try { await api('PATCH', `/api/admin/orders/${id}`, { status: to }); reload(); } catch (e: any) { toast(e.message, 'err'); }
  };

  return (
    <>
      <PageHeader title="Pedidos" sub="Atualiza sozinho quando chega um pedido ou muda um status." />
      <form className="panel mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => e.preventDefault()} aria-label="Filtros">
        <div><label className="label" htmlFor="fq">Nº do pedido</label><input id="fq" inputMode="numeric" className="field" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value.replace(/\D/g, '') })} placeholder="1001" /></div>
        <div><label className="label" htmlFor="fs">Status</label>
          <select id="fs" className="field" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Todos</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label" htmlFor="ft">Mesa</label>
          <select id="ft" className="field" value={f.table} onChange={(e) => setF({ ...f, table: e.target.value })}><option value="">Todas</option>{tables.data?.tables.map((t) => <option key={t.id} value={t.id}>Mesa {t.label}</option>)}</select></div>
        <div><label className="label" htmlFor="ff">De</label><input id="ff" type="date" className="field" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
        <div><label className="label" htmlFor="fe">Até</label><input id="fe" type="date" className="field" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
      </form>

      {error && <ErrorBox msg={error} retry={reload} />}
      {loading && !data ? <Loading /> : data && (data.orders.length === 0 ? (
        <div className="panel"><Empty icon="🧾" title="Nenhum pedido">Ajuste os filtros ou aguarde novos pedidos.</Empty></div>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {data.orders.map((o) => (
            <li key={o.id} className="panel !p-4">
              <button className="flex w-full flex-wrap items-start justify-between gap-3 text-left" onClick={() => setOpenId(o.id)} aria-label={`Pedido ${o.number}, ver detalhes`}>
                <div>
                  <p className="title text-3xl">#{o.number} <span className="text-xl text-wine-700/70">{o.service_type === 'salao' ? `· Mesa ${o.table_label}` : `· ${SERVICE_LABEL[o.service_type]}`}</span></p>
                  <p className="text-xs text-wine-800/70">{dmyhm(o.created_at)}{o.customer_name ? ` · ${o.customer_name}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1"><StatusBadge status={o.status} /><span className="font-bold">{brl(o.total_cents)}</span></div>
              </button>
              <p className="mt-2 line-clamp-2 text-sm text-wine-800/90">{o.items?.map((i: any) => `${i.q}× ${i.n}`).join(' · ')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {o.kitchen_print && <PrintChip p={o.kitchen_print} />}
                <span className="chip">{o.tab_status === 'open' ? 'Conta aberta' : o.tab_status === 'closed' ? 'Paga' : 'Conta anulada'}</span>
                <span className="flex-1" />
                {NEXT[o.status] && <button className="btn-primary btn-sm" onClick={() => quick(o.id, NEXT[o.status]!.to)}>{NEXT[o.status]!.label}</button>}
              </div>
            </li>
          ))}
        </ul>
      ))}
      <OrderSheet id={openId} onClose={() => setOpenId(null)} role={role} onChange={reload} />
    </>
  );
}

export function PrintChip({ p }: { p: { status: string; error?: string } }) {
  const m: Record<string, [string, string]> = {
    printed: ['🖨 Impressa', 'bg-forest-600 text-white'], queued: ['🖨 Na fila', 'bg-cream-300 text-wine-800'],
    printing: ['🖨 Imprimindo…', 'bg-[#e9a93b] text-wine-900'], failed: ['⚠ Falha na impressão', 'bg-ember text-white'],
  };
  const [label, cls] = m[p.status] ?? [p.status, 'bg-cream-300'];
  return <span title={p.error || undefined} className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>{label}</span>;
}

function OrderSheet({ id, onClose, role, onChange }: { id: string | null; onClose: () => void; role: string; onChange: () => void }) {
  const { data, error, reload } = useLoader<{ order: any }>(id ? `/api/admin/orders/${id}` : null, { live: true });
  const o = id ? data?.order : null;
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [paper, setPaper] = useState('80');
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); reload(); onChange(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const canCancel = ['admin', 'manager', 'waiter'].includes(role);
  const openPrint = (via: string) => window.open(`/comanda/${id}?via=${via}&paper=${paper}&auto=1${o?.jobs?.some((j: any) => j.status === 'printed') ? '&reprint=1' : ''}`, '_blank');

  return (
    <Sheet open={!!id} onClose={onClose} title={o ? `Pedido #${o.number}` : 'Pedido'} wide>
      {error && <ErrorBox msg={error} retry={reload} />}
      {!o ? <Loading rows={2} /> : (
        <div className="space-y-5 pb-4">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={o.status} />
            <span className="chip">{o.service_type === 'salao' ? `Mesa ${o.table_label}` : SERVICE_LABEL[o.service_type]}</span>
            <span className="text-xs text-wine-800/70">{dmyhm(o.created_at)} · recebido por {o.created_by_name ?? 'cliente (cardápio digital)'}</span></div>
          {(o.customer_name || o.customer_phone || o.delivery_address) && (
            <p className="rounded-2xl bg-cream-50 p-3 text-sm ring-1 ring-wine-700/10">{[o.customer_name, o.customer_phone, o.delivery_address].filter(Boolean).join(' · ')}</p>)}

          <ul className="space-y-2">
            {o.items.map((i: any) => (
              <li key={i.id} className="rounded-2xl bg-cream-50 p-3 ring-1 ring-wine-700/10">
                <div className="flex justify-between gap-3"><p className="font-extrabold uppercase text-wine-700">{i.quantity}× {i.product_name}</p><p className="text-sm font-semibold">{brl(i.line_total_cents)}</p></div>
                {i.options.map((op: any) => <p key={op.id} className="text-xs"><b>{op.group_name}:</b> {op.option_name}{op.price_cents ? ` (+${brl(op.price_cents)})` : ''}</p>)}
                {i.notes && <p className="mt-1 rounded-lg bg-ember/15 px-2 py-1 text-xs font-bold text-wine-800">OBS: {i.notes}</p>}
              </li>
            ))}
          </ul>
          {o.notes && <p className="rounded-2xl bg-ember/15 p-3 text-sm font-semibold">Obs. geral: {o.notes}</p>}
          <div className="flex justify-between border-t border-wine-700/15 pt-3 font-display text-2xl font-black uppercase text-wine-700"><span>Total</span><span>{brl(o.total_cents)}</span></div>

          {!FINAL.includes(o.status) && (
            <div className="flex flex-wrap gap-2">
              {NEXT[o.status] && <button className="btn-primary" disabled={busy} onClick={() => run(() => api('PATCH', `/api/admin/orders/${id}`, { status: NEXT[o.status]!.to }), 'Status atualizado')}>{NEXT[o.status]!.label}</button>}
              {o.status === 'pronto' && <button className="btn-ghost-dark" disabled={busy} onClick={() => run(() => api('PATCH', `/api/admin/orders/${id}`, { status: 'em_preparo' }), 'Voltou para preparo')}>Voltar ao preparo</button>}
              {canCancel && o.tab_status === 'open' && <button className="btn-ghost-dark" onClick={() => setCancelOpen(true)}>Cancelar pedido</button>}
            </div>
          )}
          {o.tab_status === 'open' && o.service_type !== 'salao' && o.status !== 'cancelado' && (
            <button className="btn-cream" onClick={() => setPaying(true)}>💳 Registrar pagamento</button>
          )}
          {o.tab_status === 'closed' && <p className="rounded-2xl bg-forest-600/20 p-3 text-sm font-semibold text-forest-800">✓ Conta paga</p>}
          {o.cancel_reason && <p className="rounded-2xl bg-wine-700 p-3 text-sm text-cream-100">Cancelado: {o.cancel_reason}</p>}

          <section className="rounded-2xl bg-cream-50 p-4 ring-1 ring-wine-700/10" aria-label="Impressão">
            <h3 className="mb-2 text-sm font-extrabold uppercase text-wine-700">Impressão da comanda</h3>
            {o.jobs.length === 0 ? <p className="text-xs text-wine-800/70">Nenhuma impressora automática configurada. Use “Imprimir comanda” abaixo.</p> : (
              <ul className="mb-3 space-y-1.5">
                {o.jobs.map((j: any) => (
                  <li key={j.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <PrintChip p={{ status: j.status, error: j.last_error }} />
                    <span>{j.copy_type === 'cozinha' ? 'Cozinha' : 'Atendimento'} · {j.paper === 'a4' ? 'A4' : `${j.paper} mm`}{j.is_reprint ? ' · reimpressão' : ''} · tentativa {j.attempts}/{j.max_attempts}</span>
                    {j.last_error && <span className="font-semibold text-ember">{j.last_error}</span>}
                    {j.status === 'failed' && <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api('POST', `/api/admin/print-jobs/${j.id}/retry`), 'Reenviado para a fila')}>Tentar novamente</button>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Papel" className="field !w-auto !py-1.5 text-xs" value={paper} onChange={(e) => setPaper(e.target.value)}><option value="58">58 mm</option><option value="80">80 mm</option><option value="a4">A4</option></select>
              <button className="btn-primary btn-sm" onClick={() => openPrint('cozinha')}>🖨 Imprimir comanda (cozinha)</button>
              <button className="btn-ghost-dark btn-sm" onClick={() => openPrint('atendimento')}>Via atendimento</button>
              <button className="btn-ghost-dark btn-sm" disabled={busy} onClick={() => run(async () => { const r = await api('POST', `/api/admin/orders/${id}/print`, {}); if (!r.queued) throw new Error('Nenhuma impressora automática ativa.'); }, 'Reimpressão enviada ao agente')}>Reimprimir (automática)</button>
            </div>
          </section>

          <section aria-label="Histórico">
            <h3 className="mb-2 text-sm font-extrabold uppercase text-wine-700">Histórico</h3>
            <ol className="space-y-1 border-l-2 border-wine-700/20 pl-4 text-xs">
              {o.history.map((h: any) => (
                <li key={h.id}><b>{hhmm(h.created_at)}</b> · {h.from_status ? `${STATUS_LABEL[h.from_status]} → ` : ''}<b>{STATUS_LABEL[h.to_status]}</b>{h.user_name ? ` · ${h.user_name}` : ''}{h.note ? ` · ${h.note}` : ''}</li>
              ))}
            </ol>
          </section>
        </div>
      )}
      {o && <CloseTab open={paying} onClose={() => setPaying(false)} tabId={o.tab_id} total={o.total_cents} canDiscount={['admin', 'manager'].includes(role)} onDone={() => { setPaying(false); reload(); onChange(); }} />}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar pedido"
        footer={<><button className="btn-ghost-dark" onClick={() => setCancelOpen(false)}>Voltar</button>
          <button className="btn-danger" disabled={!reason.trim() || busy} onClick={() => run(async () => { await api('PATCH', `/api/admin/orders/${id}`, { status: 'cancelado', reason }); setCancelOpen(false); setReason(''); }, 'Pedido cancelado')}>Confirmar cancelamento</button></>}>
        <label className="label" htmlFor="rs">Motivo (obrigatório)</label>
        <textarea id="rs" className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: cliente desistiu, prato indisponível…" />
      </Modal>
    </Sheet>
  );
}
