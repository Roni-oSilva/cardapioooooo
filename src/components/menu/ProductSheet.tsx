'use client';
import { useMemo, useState } from 'react';
import { Sheet } from '../Sheet';
import { Thumb } from '../Thumb';
import { brl } from '@/lib/money';
import type { PublicProduct } from '@/lib/menu';
import type { CartLine } from '@/lib/cart';

export function ProductSheet({ product, onClose, onAdd, canOrder }: {
  product: PublicProduct | null; onClose: () => void; onAdd: (l: Omit<CartLine, 'key'>) => void; canOrder: boolean;
}) {
  return (
    <Sheet open={!!product} onClose={onClose} title={product?.name ?? ''} wide>
      {product && <Body key={product.id} product={product} onClose={onClose} onAdd={onAdd} canOrder={canOrder} />}
    </Sheet>
  );
}

function Body({ product: p, onClose, onAdd, canOrder }: { product: PublicProduct; onClose: () => void; onAdd: (l: Omit<CartLine, 'key'>) => void; canOrder: boolean }) {
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);

  const chosen = useMemo(() => p.groups.flatMap((g) => g.options.filter((o) => sel[g.id]?.includes(o.id))), [p, sel]);
  const unit = p.price_cents + chosen.reduce((a, o) => a + o.price_cents, 0);
  const errors = p.groups.map((g) => {
    const n = sel[g.id]?.length ?? 0;
    const min = g.required ? Math.max(1, g.min_select) : g.min_select;
    return n < min ? `Escolha ${min === 1 ? 'uma opção' : `ao menos ${min}`}` : null;
  });
  const invalid = errors.some(Boolean);

  const toggle = (gid: string, oid: string, max: number) =>
    setSel((s) => {
      const cur = s[gid] ?? [];
      if (cur.includes(oid)) return { ...s, [gid]: cur.filter((x) => x !== oid) };
      if (max === 1) return { ...s, [gid]: [oid] };
      if (cur.length >= max) return s;
      return { ...s, [gid]: [...cur, oid] };
    });

  const submit = () => {
    setTried(true);
    if (invalid) return;
    onAdd({ productId: p.id, name: p.name, unitCents: unit, quantity: qty, optionIds: chosen.map((o) => o.id), optionLabels: chosen.map((o) => o.name), notes: notes.trim() });
    onClose();
  };

  return (
    <div className="space-y-5 pb-2">
      <Thumb src={p.image_url} name={p.name} className="h-56 w-full rounded-3xl sm:h-72" />
      <div>
        {p.description && <p className="text-sm leading-relaxed text-wine-800/90">{p.description}</p>}
        {p.ingredients && <p className="mt-2 text-xs text-wine-700/80"><b>Ingredientes:</b> {p.ingredients}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {p.prep_minutes ? <span className="chip">⏱ ~{p.prep_minutes} min</span> : null}
          {p.allergens.map((a) => <span key={a} className="chip !bg-ember/15 !text-wine-800" title="Alergênico">⚠ {a}</span>)}
        </div>
      </div>

      {p.groups.map((g, gi) => (
        <fieldset key={g.id} className="rounded-2xl bg-cream-50 p-4 ring-1 ring-wine-700/10">
          <legend className="sr-only">{g.name}</legend>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-base font-extrabold uppercase text-wine-700">{g.name}</h3>
            <span className="text-[11px] font-semibold uppercase text-wine-700/70">
              {g.required ? 'Obrigatório' : 'Opcional'}{g.max_select > 1 ? ` · até ${g.max_select}` : ''}
            </span>
          </div>
          <div className="space-y-1.5">
            {g.options.map((o) => {
              const on = sel[g.id]?.includes(o.id) ?? false;
              return (
                <label key={o.id} className={`flex min-h-[46px] cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition ${on ? 'bg-wine-700 text-cream-100' : 'bg-cream-100 text-wine-800 hover:bg-cream-200'}`}>
                  <span className="flex items-center gap-3">
                    <input type={g.max_select === 1 ? 'radio' : 'checkbox'} name={g.id} checked={on} onChange={() => toggle(g.id, o.id, g.max_select)} className="h-4 w-4 accent-wine-700" />
                    {o.name}
                  </span>
                  {o.price_cents > 0 && <span className="text-xs font-semibold">+ {brl(o.price_cents)}</span>}
                </label>
              );
            })}
          </div>
          {tried && errors[gi] && <p role="alert" className="mt-2 text-xs font-semibold text-ember">{errors[gi]}</p>}
        </fieldset>
      ))}

      <div>
        <label htmlFor="obs" className="label">Observações para este prato</label>
        <textarea id="obs" rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className="field" placeholder="Ex.: sem cebola, pouco sal, alergia a…" />
      </div>

      <div className="sticky bottom-0 -mx-5 flex items-center gap-3 border-t border-wine-700/15 bg-cream-50 px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center rounded-full bg-wine-700/10">
          <button aria-label="Diminuir" className="grid h-11 w-11 place-items-center text-xl font-bold text-wine-700 disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
          <span className="w-8 text-center font-bold text-wine-800" aria-live="polite">{qty}</span>
          <button aria-label="Aumentar" className="grid h-11 w-11 place-items-center text-xl font-bold text-wine-700" onClick={() => setQty(Math.min(99, qty + 1))}>+</button>
        </div>
        <button className="btn-primary flex-1" onClick={submit} disabled={!canOrder}>
          {canOrder ? <>Adicionar · {brl(unit * qty)}</> : 'Indisponível no momento'}
        </button>
      </div>
    </div>
  );
}
