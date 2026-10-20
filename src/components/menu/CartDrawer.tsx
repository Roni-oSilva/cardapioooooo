'use client';
import { useRef, useState } from 'react';
import { Sheet } from '../Sheet';
import { brl } from '@/lib/money';
import type { CartLine } from '@/lib/cart';

type Service = 'salao' | 'retirada' | 'entrega';
interface Cart {
  lines: CartLine[]; subtotal: number; setQty: (k: string, q: number) => void; remove: (k: string) => void;
  setNotes: (k: string, n: string) => void; clear: () => void;
}
interface Props {
  open: boolean; onClose: () => void; cart: Cart;
  settings: { allow_dine_in: boolean; allow_pickup: boolean; allow_delivery: boolean; delivery_fee_cents: number; accepting_orders: boolean };
  tables: { id: string; label: string }[]; presetTable?: string;
  onDone: (o: { number: number; token: string }) => void;
}

const uuid = () => (typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`);

export function CartDrawer({ open, onClose, cart, settings, tables, presetTable, onDone }: Props) {
  const services = ([['salao', 'Salão', settings.allow_dine_in], ['retirada', 'Retirada', settings.allow_pickup], ['entrega', 'Entrega', settings.allow_delivery]] as const).filter((s) => s[2]);
  const preset = tables.find((t) => t.label === presetTable)?.id ?? '';
  const [service, setService] = useState<Service>(() => (preset ? 'salao' : ((services[0]?.[0] as Service) ?? 'salao')));
  const [tableId, setTableId] = useState(preset);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'cart' | 'review'>('cart');
  // Uma chave por conteúdo do pedido: reenviar o MESMO pedido (clique repetido, queda de rede) nunca cria duplicata.
  const keys = useRef(new Map<string, string>());

  const fee = service === 'entrega' ? settings.delivery_fee_cents : 0;
  const payload = {
    service_type: service, table_id: service === 'salao' ? tableId || null : null,
    customer_name: name, customer_phone: phone, delivery_address: service === 'entrega' ? address : '', notes,
    items: cart.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, option_ids: l.optionIds, notes: l.notes })),
  };

  const validate = () => {
    if (!cart.lines.length) return 'Seu pedido está vazio.';
    if (service === 'salao' && !tableId) return 'Selecione o número da mesa.';
    if (service === 'retirada' && !name.trim()) return 'Informe seu nome para a retirada.';
    if (service === 'entrega' && (!address.trim() || !phone.trim())) return 'Informe endereço e telefone para entrega.';
    return '';
  };

  const submit = async () => {
    if (busy) return; // trava duplo clique
    const v = validate();
    if (v) { setError(v); setStep('cart'); return; }
    setBusy(true); setError('');
    const sig = JSON.stringify(payload);
    if (!keys.current.has(sig)) keys.current.set(sig, uuid());
    try {
      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, idempotency_key: keys.current.get(sig) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível enviar o pedido.');
      cart.clear(); keys.current.clear(); setStep('cart'); setNotes('');
      onDone({ number: data.number, token: data.token });
    } catch (e: any) {
      setError(e instanceof TypeError ? 'Sem conexão. Seu pedido NÃO foi enviado — tente novamente (não será duplicado).' : e.message);
    } finally { setBusy(false); }
  };

  const empty = cart.lines.length === 0;
  return (
    <Sheet open={open} onClose={onClose} title={step === 'cart' ? 'Seu pedido' : 'Confirme o pedido'}
      footer={!empty && (
        <div className="space-y-3">
          <div className="space-y-1 text-sm">
            <Row l="Subtotal" r={brl(cart.subtotal)} />
            {fee > 0 && <Row l="Taxa de entrega" r={brl(fee)} />}
            <div className="flex items-baseline justify-between border-t border-wine-700/15 pt-2 font-display text-2xl font-black uppercase text-wine-700">
              <span>Total</span><span>{brl(cart.subtotal + fee)}</span>
            </div>
          </div>
          {error && <p role="alert" className="rounded-xl bg-ember/15 px-3 py-2 text-sm font-medium text-wine-800">{error}</p>}
          {step === 'cart'
            ? <button className="btn-primary w-full" disabled={!settings.accepting_orders} onClick={() => { const v = validate(); setError(v); if (!v) setStep('review'); }}>
                {settings.accepting_orders ? 'Revisar pedido' : 'Pedidos pausados no momento'}
              </button>
            : <div className="flex gap-2">
                <button className="btn-ghost-dark" onClick={() => setStep('cart')} disabled={busy}>Voltar</button>
                <button className="btn-primary flex-1" onClick={submit} disabled={busy}>{busy ? 'Enviando…' : 'Confirmar pedido'}</button>
              </div>}
        </div>
      )}>
      {empty ? (
        <div className="grid place-items-center gap-3 py-16 text-center text-wine-700">
          <span className="text-5xl" aria-hidden>🍽️</span>
          <p className="title text-2xl">Pedido vazio</p>
          <p className="max-w-[16rem] text-sm text-wine-800/80">Escolha seus pratos no cardápio para começar.</p>
          <button className="btn-primary mt-2" onClick={onClose}>Ver cardápio</button>
        </div>
      ) : step === 'cart' ? (
        <div className="space-y-5">
          <ul className="space-y-3">
            {cart.lines.map((l) => (
              <li key={l.key} className="rounded-2xl bg-cream-50 p-3 ring-1 ring-wine-700/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold uppercase leading-tight text-wine-700">{l.name}</p>
                    {l.optionLabels.length > 0 && <p className="mt-0.5 text-xs text-wine-800/80">{l.optionLabels.join(' · ')}</p>}
                  </div>
                  <p className="shrink-0 text-sm font-bold text-wine-700">{brl(l.unitCents * l.quantity)}</p>
                </div>
                <input value={l.notes} onChange={(e) => cart.setNotes(l.key, e.target.value)} maxLength={300} aria-label={`Observação para ${l.name}`}
                  placeholder="Observação (ex.: sem cebola)" className="field mt-2 !py-1.5 text-xs" />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center rounded-full bg-wine-700/10">
                    <button aria-label="Diminuir quantidade" className="grid h-9 w-9 place-items-center font-bold text-wine-700" onClick={() => cart.setQty(l.key, l.quantity - 1)}>−</button>
                    <span className="w-7 text-center text-sm font-bold">{l.quantity}</span>
                    <button aria-label="Aumentar quantidade" className="grid h-9 w-9 place-items-center font-bold text-wine-700" onClick={() => cart.setQty(l.key, l.quantity + 1)}>+</button>
                  </div>
                  <button className="text-xs font-semibold text-wine-700 underline-offset-2 hover:underline" onClick={() => cart.remove(l.key)}>Remover</button>
                </div>
              </li>
            ))}
          </ul>

          <section className="space-y-3">
            {services.length > 1 && (
              <div role="radiogroup" aria-label="Tipo de atendimento" className="grid grid-cols-3 gap-2">
                {services.map(([v, label]) => (
                  <button key={v} role="radio" aria-checked={service === v} onClick={() => setService(v as Service)}
                    className={`min-h-[44px] rounded-full text-sm font-semibold transition ${service === v ? 'bg-wine-700 text-cream-100' : 'bg-wine-700/10 text-wine-700 hover:bg-wine-700/20'}`}>{label}</button>
                ))}
              </div>
            )}
            {service === 'salao' && (
              <div>
                <label className="label" htmlFor="mesa">Mesa</label>
                <select id="mesa" className="field" value={tableId} onChange={(e) => setTableId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {tables.map((t) => <option key={t.id} value={t.id}>Mesa {t.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label" htmlFor="nome">Seu nome {service === 'retirada' ? '' : '(opcional)'}</label>
              <input id="nome" className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            {service !== 'salao' && (
              <div>
                <label className="label" htmlFor="tel">Telefone {service === 'entrega' ? '' : '(opcional)'}</label>
                <input id="tel" className="field" inputMode="tel" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              </div>
            )}
            {service === 'entrega' && (
              <div>
                <label className="label" htmlFor="end">Endereço de entrega</label>
                <textarea id="end" rows={2} className="field" value={address} maxLength={250} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="geral">Observações gerais</label>
              <textarea id="geral" rows={2} className="field" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: trazer os pratos juntos" />
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-4 text-wine-800">
          <ul className="space-y-2">
            {cart.lines.map((l) => (
              <li key={l.key} className="rounded-2xl bg-cream-50 p-3 text-sm ring-1 ring-wine-700/10">
                <p className="font-bold text-wine-700">{l.quantity}× {l.name}</p>
                {l.optionLabels.length > 0 && <p className="text-xs">{l.optionLabels.join(' · ')}</p>}
                {l.notes && <p className="text-xs italic">Obs.: {l.notes}</p>}
              </li>
            ))}
          </ul>
          <dl className="space-y-1 rounded-2xl bg-cream-50 p-3 text-sm ring-1 ring-wine-700/10">
            <Row l="Atendimento" r={service === 'salao' ? `Mesa ${tables.find((t) => t.id === tableId)?.label}` : service === 'retirada' ? 'Retirada' : 'Entrega'} />
            {name && <Row l="Nome" r={name} />}
            {phone && <Row l="Telefone" r={phone} />}
            {service === 'entrega' && <Row l="Endereço" r={address} />}
            {notes && <Row l="Observações" r={notes} />}
          </dl>
          <p className="text-xs text-wine-800/70">O valor final é conferido pelo restaurante com os preços atuais do cardápio.</p>
        </div>
      )}
    </Sheet>
  );
}

function Row({ l, r }: { l: string; r: string }) {
  return <div className="flex justify-between gap-4"><span className="text-wine-800/70">{l}</span><span className="text-right font-semibold text-wine-800">{r}</span></div>;
}
