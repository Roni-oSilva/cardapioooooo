'use client';
import { useEffect, useState } from 'react';
import { api, dmyhm, fromCents, hhmm, toCents, useLoader } from '@/lib/client';
import { brl, PAY_LABEL } from '@/lib/money';
import { Sheet } from '../Sheet';
import { Empty, ErrorBox, Loading, Modal, PageHeader, StatusBadge, Toggle, useToast } from './ui';

export function Tables({ canManage, canDiscount }: { canManage: boolean; canDiscount: boolean }) {
  const { data, error, loading, reload } = useLoader<{ tables: any[] }>('/api/admin/tables', { live: true });
  const [open, setOpen] = useState<any | null>(null);
  const [edit, setEdit] = useState<{ id?: string; label: string; seats: number; active: boolean } | null>(null);
  const toast = useToast();
  const saveTable = async () => {
    if (!edit) return;
    try { edit.id ? await api('PUT', `/api/admin/tables/${edit.id}`, edit) : await api('POST', '/api/admin/tables', edit); toast('Mesa salva'); setEdit(null); reload(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const delTable = async () => {
    if (!edit?.id || !confirm('Excluir esta mesa?')) return;
    try { await api('DELETE', `/api/admin/tables/${edit.id}`); toast('Mesa excluída'); setEdit(null); reload(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const tables = data?.tables ?? [];
  return (
    <>
      <PageHeader title="Mesas e contas" sub="Toque em uma mesa para ver o que foi pedido, adicionar itens e fechar a conta."
        actions={canManage && <button className="btn-primary btn-sm" onClick={() => setEdit({ label: String(tables.length + 1), seats: 4, active: true })}>+ Nova mesa</button>} />
      <div className="mb-4 flex gap-4 text-xs text-cream-100/80"><span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-cream-100" />Livre</span><span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-[#e9a93b]" />Ocupada</span></div>
      {error && <ErrorBox msg={error} retry={reload} />}
      {loading && !data ? <Loading /> : !tables.length ? <div className="panel"><Empty icon="🪑" title="Nenhuma mesa cadastrada">{canManage ? 'Cadastre as mesas do salão.' : 'Peça a um gerente para cadastrar as mesas.'}</Empty></div> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {tables.map((t) => (
            <li key={t.id}>
              <button onClick={() => setOpen(t)} className={`flex h-full w-full flex-col justify-between rounded-3xl p-4 text-left shadow-card transition hover:-translate-y-0.5 ${t.occupied ? 'bg-[#e9a93b] text-wine-900' : 'bg-cream-100 text-wine-700'} ${t.active ? '' : 'opacity-50'}`}>
                <span className="flex items-start justify-between"><span className="title text-5xl">{t.label}</span>{canManage && <span role="button" tabIndex={0} className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold" onClick={(e) => { e.stopPropagation(); setEdit(t); }} onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), setEdit(t))}>editar</span>}</span>
                <span className="mt-4 block text-xs font-semibold">{t.occupied ? <>{t.orders_count} pedido(s)<br /><b className="text-base">{brl(Math.max(0, t.orders_total - t.discount_cents))}</b></> : t.active ? `Livre · ${t.seats} lugares` : 'Inativa'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <TableSheet table={open} onClose={() => setOpen(null)} canDiscount={canDiscount} onChange={reload} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar mesa' : 'Nova mesa'}
        footer={<>{edit?.id && <button className="btn-ghost-dark mr-auto" onClick={delTable}>Excluir</button>}<button className="btn-ghost-dark" onClick={() => setEdit(null)}>Cancelar</button><button className="btn-primary" disabled={!edit?.label.trim()} onClick={saveTable}>Salvar</button></>}>
        {edit && <div className="space-y-3">
          <div><label className="label" htmlFor="tl">Número / identificação</label><input id="tl" className="field" value={edit.label} maxLength={20} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></div>
          <div><label className="label" htmlFor="ts">Lugares</label><input id="ts" type="number" min={1} className="field" value={edit.seats} onChange={(e) => setEdit({ ...edit, seats: +e.target.value || 1 })} /></div>
          <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Ativa (aparece no cardápio)" />
          {edit.id && <p className="text-xs opacity-70">Link/QR da mesa: <code className="rounded bg-wine-700/10 px-1">{typeof window !== 'undefined' ? window.location.origin : ''}/?mesa={edit.label}</code></p>}
        </div>}
      </Modal>
    </>
  );
}

function TableSheet({ table, onClose, canDiscount, onChange }: { table: any | null; onClose: () => void; canDiscount: boolean; onChange: () => void }) {
  const tabId = table?.tab_id;
  const tab = useLoader<any>(tabId ? `/api/admin/tabs/${tabId}` : null, { live: true });
  const hist = useLoader<{ tabs: any[] }>(table ? `/api/admin/tabs?table_id=${table.id}` : null);
  const [closing, setClosing] = useState(false);
  const d = tabId ? tab.data : null;
  return (
    <Sheet open={!!table} onClose={onClose} title={table ? `Mesa ${table.label}` : ''} wide>
      {table && (
        <div className="space-y-5 pb-4">
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary btn-sm" target="_blank" rel="noreferrer" href={`/?mesa=${encodeURIComponent(table.label)}`}>+ Adicionar pedido nesta mesa</a>
            {d && d.tab.status === 'open' && d.orders.length > 0 && <button className="btn-cream btn-sm" onClick={() => setClosing(true)}>Fechar conta</button>}
          </div>
          {!tabId ? <p className="rounded-2xl bg-cream-50 p-4 text-sm">Mesa livre. Use “Adicionar pedido” para abrir uma conta.</p> : tab.error ? <ErrorBox msg={tab.error} retry={tab.reload} /> : !d ? <Loading rows={2} /> : (
            <>
              <ul className="space-y-3">
                {d.orders.map((o: any) => (
                  <li key={o.id} className={`rounded-2xl bg-cream-50 p-3 ring-1 ring-wine-700/10 ${o.status === 'cancelado' ? 'opacity-50' : ''}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-wine-700">#{o.number} · {hhmm(o.created_at)}</p><StatusBadge status={o.status} /></div>
                    <ul className="mt-1 space-y-1 text-sm">
                      {o.items.map((i: any) => (
                        <li key={i.id}><b>{i.quantity}× {i.product_name}</b> <span className="float-right">{brl(i.line_total_cents)}</span>
                          {i.options.length > 0 && <span className="block text-xs opacity-80">{i.options.map((x: any) => x.option_name).join(' · ')}</span>}
                          {i.notes && <span className="block text-xs font-bold text-ember">OBS: {i.notes}</span>}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <dl className="space-y-1 rounded-2xl bg-cream-50 p-4 text-sm ring-1 ring-wine-700/10">
                <div className="flex justify-between"><dt>Pedidos</dt><dd>{brl(d.totals.orders_total)}</dd></div>
                {d.totals.discount_cents > 0 && <div className="flex justify-between"><dt>Desconto</dt><dd>-{brl(d.totals.discount_cents)}</dd></div>}
                <div className="flex justify-between border-t border-wine-700/15 pt-2 font-display text-2xl font-black uppercase text-wine-700"><dt>Total</dt><dd>{brl(d.totals.total)}</dd></div>
              </dl>
            </>
          )}
          <section><h3 className="mb-2 text-sm font-extrabold uppercase text-wine-700">Histórico da mesa</h3>
            {!hist.data?.tabs.length ? <p className="text-xs opacity-70">Sem contas anteriores.</p> : (
              <ul className="space-y-1 text-xs">{hist.data.tabs.map((t) => <li key={t.id} className="flex justify-between gap-2 rounded-xl bg-cream-50 px-3 py-2"><span>{dmyhm(t.opened_at)} · {t.orders_count} pedido(s) · {t.methods ?? (t.status === 'void' ? 'anulada' : '—')}</span><b>{brl(Math.max(0, t.orders_total - t.discount_cents))}</b></li>)}</ul>)}
          </section>
        </div>
      )}
      {d && <CloseTab open={closing} onClose={() => setClosing(false)} tabId={tabId} total={d.totals.orders_total} canDiscount={canDiscount} onDone={() => { setClosing(false); onChange(); onClose(); }} />}
    </Sheet>
  );
}

type Line = { method: string; amount: string; payer: string };

export function CloseTab({ open, onClose, tabId, total, canDiscount, onDone }: { open: boolean; onClose: () => void; tabId: string; total: number; canDiscount: boolean; onDone: () => void }) {
  const toast = useToast();
  const [discount, setDiscount] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<Line[]>([{ method: 'pix', amount: '', payer: '' }]);
  const [people, setPeople] = useState(2);
  const [busy, setBusy] = useState(false);
  const disc = toCents(discount);
  const due = Math.max(0, total - disc);
  const paying = lines.reduce((a, l) => a + toCents(l.amount), 0);
  const diff = due - paying;
  useEffect(() => { if (open) { setDiscount(''); setReason(''); setLines([{ method: 'pix', amount: fromCents(total), payer: '' }]); } }, [open, total]);

  // divide o total (já com desconto) em N partes sem perder centavos
  const split = () => {
    const base = Math.floor(due / people), extra = due - base * people;
    setLines(Array.from({ length: people }, (_, i) => ({ method: lines[i]?.method ?? 'pix', amount: fromCents(base + (i < extra ? 1 : 0)), payer: lines[i]?.payer || `Pessoa ${i + 1}` })));
  };
  const submit = async () => {
    setBusy(true);
    try {
      await api('POST', `/api/admin/tabs/${tabId}/close`, { discount_cents: disc, discount_reason: reason, payments: lines.filter((l) => toCents(l.amount) > 0).map((l) => ({ method: l.method, amount_cents: toCents(l.amount), payer_label: l.payer })) });
      toast('Conta fechada e pagamento registrado'); onDone();
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Fechar conta"
      footer={<><button className="btn-ghost-dark" onClick={onClose}>Voltar</button><button className="btn-primary" disabled={busy || (due > 0 && diff !== 0) || (disc > 0 && !reason.trim())} onClick={submit}>{busy ? 'Registrando…' : `Confirmar ${brl(due)}`}</button></>}>
      <div className="space-y-4">
        <p className="flex justify-between text-sm"><span>Total dos pedidos</span><b>{brl(total)}</b></p>
        {canDiscount ? (
          <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
            <div><label className="label" htmlFor="dc">Desconto (R$)</label><input id="dc" className="field" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" /></div>
            <div><label className="label" htmlFor="dr">Motivo do desconto</label><input id="dr" className="field" disabled={!disc} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Obrigatório se houver desconto" /></div>
          </div>
        ) : <p className="text-xs opacity-70">Descontos só podem ser autorizados por gerente ou administrador.</p>}
        <p className="flex justify-between font-display text-2xl font-black uppercase text-wine-700"><span>A pagar</span><span>{brl(due)}</span></p>

        <div className="flex items-end gap-2 rounded-2xl bg-cream-50 p-3 ring-1 ring-wine-700/10">
          <div className="w-24"><label className="label" htmlFor="np">Dividir por</label><input id="np" type="number" min={2} max={20} className="field" value={people} onChange={(e) => setPeople(Math.min(20, Math.max(2, +e.target.value || 2)))} /></div>
          <button className="btn-ghost-dark btn-sm" onClick={split}>Dividir igualmente</button>
        </div>
        <ul className="space-y-2">
          {lines.map((l, i) => (
            <li key={i} className="grid grid-cols-[1fr_6.5rem_auto] items-center gap-2 sm:grid-cols-[8rem_1fr_7rem_auto]">
              <select aria-label="Forma de pagamento" className="field !py-2" value={l.method} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>{Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input aria-label="Quem pagou" className="field !py-2 max-sm:hidden" placeholder="Quem pagou (opcional)" value={l.payer} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, payer: e.target.value } : x)))} />
              <input aria-label="Valor" inputMode="decimal" className="field !py-2" placeholder="0,00" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
              <button aria-label="Remover pagamento" disabled={lines.length === 1} className="px-1 text-wine-700 disabled:opacity-30" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>
            </li>
          ))}
        </ul>
        <button className="btn-ghost-dark btn-sm" onClick={() => setLines([...lines, { method: 'pix', amount: diff > 0 ? fromCents(diff) : '', payer: '' }])}>+ Outra forma de pagamento</button>
        {due > 0 && <p role="status" className={`rounded-xl px-3 py-2 text-sm font-semibold ${diff === 0 ? 'bg-forest-600/20 text-forest-800' : 'bg-ember/15 text-wine-800'}`}>{diff === 0 ? '✓ Pagamentos fecham com o total' : diff > 0 ? `Faltam ${brl(diff)}` : `Excede em ${brl(-diff)}`}</p>}
      </div>
    </Modal>
  );
}
