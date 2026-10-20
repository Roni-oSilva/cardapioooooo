'use client';
import { useState } from 'react';
import { api, fromCents, toCents, useLoader } from '@/lib/client';
import { brl } from '@/lib/money';
import { Thumb } from '../Thumb';
import { Sheet } from '../Sheet';
import { Empty, ErrorBox, Loading, Modal, PageHeader, Toggle, useToast } from './ui';

type Group = { name: string; required: boolean; min_select: number; max_select: number; options: { name: string; price: string; available: boolean }[] };
interface Form {
  id?: string; category_id: string; name: string; description: string; ingredients: string; price: string; image_url: string | null; prep_minutes: string;
  allergens: string; featured: boolean; available: boolean; available_from: string; available_until: string; groups: Group[];
}

const blank = (cat: string): Form => ({ category_id: cat, name: '', description: '', ingredients: '', price: '', image_url: null, prep_minutes: '', allergens: '', featured: false, available: true, available_from: '', available_until: '', groups: [] });

export function MenuAdmin() {
  const [tab, setTab] = useState<'products' | 'categories'>('products');
  const [archived, setArchived] = useState(false);
  const prods = useLoader<{ products: any[] }>(`/api/admin/products?archived=${archived ? 1 : 0}`);
  const cats = useLoader<{ categories: any[] }>('/api/admin/categories');
  const [form, setForm] = useState<Form | null>(null);
  const toast = useToast();

  const patch = async (id: string, body: object, msg: string) => { try { await api('PATCH', `/api/admin/products/${id}`, body); toast(msg); prods.reload(); } catch (e: any) { toast(e.message, 'err'); } };
  const edit = (p: any): Form => ({
    id: p.id, category_id: p.category_id, name: p.name, description: p.description, ingredients: p.ingredients, price: fromCents(p.price_cents), image_url: p.image_url,
    prep_minutes: p.prep_minutes?.toString() ?? '', allergens: p.allergens.join(', '), featured: p.featured, available: p.available,
    available_from: p.available_from?.slice(0, 5) ?? '', available_until: p.available_until?.slice(0, 5) ?? '',
    groups: p.groups.map((g: any) => ({ name: g.name, required: g.required, min_select: g.min_select, max_select: g.max_select, options: g.options.map((o: any) => ({ name: o.name, price: fromCents(o.price_cents), available: o.available })) })),
  });

  const grouped = (cats.data?.categories ?? []).map((c) => ({ ...c, items: (prods.data?.products ?? []).filter((p) => p.category_id === c.id) })).filter((c) => c.items.length);

  return (
    <>
      <PageHeader title="Cardápio" sub="Produtos, opções, acompanhamentos e categorias."
        actions={<>
          <div role="tablist" className="flex gap-1.5">{(['products', 'categories'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'btn-cream btn-sm' : 'btn-ghost btn-sm'} onClick={() => setTab(t)}>{t === 'products' ? 'Produtos' : 'Categorias'}</button>)}</div>
          {tab === 'products' && <button className="btn-primary btn-sm" disabled={!cats.data?.categories.length} onClick={() => setForm(blank(cats.data!.categories[0].id))}>+ Novo produto</button>}
        </>} />

      {tab === 'categories' ? <Categories cats={cats} /> : (
        <>
          <div className="mb-4"><Toggle checked={archived} onChange={setArchived} label="Mostrar arquivados" /></div>
          {prods.error && <ErrorBox msg={prods.error} retry={prods.reload} />}
          {prods.loading && !prods.data ? <Loading /> : !grouped.length ? <div className="panel"><Empty icon="📖" title={archived ? 'Nenhum produto arquivado' : 'Nenhum produto'}>{cats.data?.categories.length ? 'Cadastre o primeiro produto.' : 'Crie uma categoria na aba “Categorias” antes.'}</Empty></div> : (
            <div className="space-y-6">
              {grouped.map((c) => (
                <section key={c.id}>
                  <h2 className="title mb-2 text-2xl text-cream-100">{c.name}{!c.active && <span className="ml-2 text-sm normal-case text-cream-300">(categoria oculta)</span>}</h2>
                  <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {c.items.map((p: any) => (
                      <li key={p.id} className={`panel flex min-w-0 gap-4 !p-3 ${p.available ? '' : 'opacity-70'}`}>
                        <Thumb src={p.image_url} name={p.name} className="h-24 w-24 shrink-0 rounded-2xl" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-xl font-black uppercase leading-tight">{p.featured && '★ '}{p.name}</p>
                          <p className="text-sm font-bold">{brl(p.price_cents)} <span className="font-normal opacity-70">· {p.groups.length} grupo(s) de opções</span></p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {!archived && <Toggle checked={p.available} onChange={(v) => patch(p.id, { available: v }, v ? 'Disponível' : 'Marcado como indisponível')} label={p.available ? 'Disponível' : 'Indisponível'} />}
                            <span className="flex-1" />
                            <button className="btn-ghost-dark btn-sm" onClick={() => setForm(edit(p))}>Editar</button>
                            {archived ? <button className="btn-primary btn-sm" onClick={() => patch(p.id, { archived: false, available: true }, 'Produto restaurado')}>Restaurar</button>
                              : <button className="btn-ghost-dark btn-sm" onClick={() => confirm(`Arquivar "${p.name}"? Ele some do cardápio, mas o histórico de vendas é mantido.`) && patch(p.id, { archived: true, available: false }, 'Produto arquivado')}>Arquivar</button>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
      <ProductForm form={form} setForm={setForm} cats={cats.data?.categories ?? []} onSaved={() => { setForm(null); prods.reload(); }} />
    </>
  );
}

function ProductForm({ form, setForm, cats, onSaved }: { form: Form | null; setForm: (f: Form | null) => void; cats: any[]; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  if (!form) return <Sheet open={false} onClose={() => {}} title="" children={null} />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const setGroup = (i: number, g: Partial<Group>) => set('groups', form.groups.map((x, j) => (j === i ? { ...x, ...g } : x)));

  const upload = async (file: File) => {
    setUp(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      set('image_url', d.url);
    } catch (e: any) { toast(e.message, 'err'); } finally { setUp(false); }
  };

  const save = async () => {
    if (!form.name.trim()) return toast('Informe o nome do prato.', 'err');
    if (!form.price.trim()) return toast('Informe o preço.', 'err');
    const body = {
      category_id: form.category_id, name: form.name, description: form.description, ingredients: form.ingredients, price_cents: toCents(form.price), image_url: form.image_url,
      prep_minutes: form.prep_minutes ? parseInt(form.prep_minutes) : null, allergens: form.allergens.split(',').map((s) => s.trim()).filter(Boolean),
      featured: form.featured, available: form.available, available_from: form.available_from || null, available_until: form.available_until || null,
      groups: form.groups.filter((g) => g.name.trim()).map((g) => ({ name: g.name, required: g.required, min_select: g.required ? Math.max(1, g.min_select) : g.min_select, max_select: Math.max(1, g.max_select), options: g.options.filter((o) => o.name.trim()).map((o) => ({ name: o.name, price_cents: toCents(o.price), available: o.available })) })),
    };
    setBusy(true);
    try { form.id ? await api('PUT', `/api/admin/products/${form.id}`, body) : await api('POST', '/api/admin/products', body); toast('Produto salvo'); onSaved(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <Sheet open onClose={() => setForm(null)} title={form.id ? 'Editar produto' : 'Novo produto'} wide
      footer={<div className="flex justify-end gap-2"><button className="btn-ghost-dark" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar produto'}</button></div>}>
      <div className="space-y-4 pb-4">
        <div className="flex items-center gap-4">
          <Thumb src={form.image_url} name={form.name || '?'} className="h-24 w-24 shrink-0 rounded-2xl" />
          <div className="space-y-2">
            <label className="btn-primary btn-sm cursor-pointer">{up ? 'Enviando…' : form.image_url ? 'Trocar foto' : 'Enviar foto'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={up} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
            {form.image_url && <button className="btn-ghost-dark btn-sm ml-2" onClick={() => set('image_url', null)}>Remover</button>}
            <p className="text-xs opacity-70">JPG, PNG ou WebP até 5 MB.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="pn">Nome do prato</label><input id="pn" className="field" value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} /></div>
          <div><label className="label" htmlFor="pc">Categoria</label><select id="pc" className="field" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="pp">Preço (R$)</label><input id="pp" inputMode="decimal" className="field" placeholder="0,00" value={form.price} onChange={(e) => set('price', e.target.value)} /></div>
            <div><label className="label" htmlFor="pm">Preparo (min)</label><input id="pm" inputMode="numeric" className="field" value={form.prep_minutes} onChange={(e) => set('prep_minutes', e.target.value.replace(/\D/g, ''))} /></div>
          </div>
          <div className="sm:col-span-2"><label className="label" htmlFor="pd">Descrição</label><textarea id="pd" rows={3} className="field" value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="pi">Ingredientes</label><input id="pi" className="field" value={form.ingredients} onChange={(e) => set('ingredients', e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="pa">Alergênicos (separados por vírgula)</label><input id="pa" className="field" placeholder="glúten, leite, castanhas" value={form.allergens} onChange={(e) => set('allergens', e.target.value)} /></div>
          <div><label className="label" htmlFor="pf">Disponível a partir de</label><input id="pf" type="time" className="field" value={form.available_from} onChange={(e) => set('available_from', e.target.value)} /></div>
          <div><label className="label" htmlFor="pu">Disponível até</label><input id="pu" type="time" className="field" value={form.available_until} onChange={(e) => set('available_until', e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-5"><Toggle checked={form.available} onChange={(v) => set('available', v)} label="Disponível" /><Toggle checked={form.featured} onChange={(v) => set('featured', v)} label="Destaque da casa" /></div>

        <div className="rounded-2xl bg-cream-50 p-4 ring-1 ring-wine-700/10">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-extrabold uppercase text-wine-700">Opções, acompanhamentos e adicionais</h3>
            <button className="btn-primary btn-sm" onClick={() => set('groups', [...form.groups, { name: '', required: false, min_select: 0, max_select: 1, options: [{ name: '', price: '', available: true }] }])}>+ Grupo</button></div>
          {form.groups.length === 0 && <p className="text-xs opacity-70">Ex.: “Ponto da carne” (obrigatório, escolher 1), “Acompanhamento”, “Adicionais” (até 3, com valor extra).</p>}
          <div className="space-y-4">
            {form.groups.map((g, gi) => (
              <div key={gi} className="rounded-2xl bg-cream-100 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[10rem] flex-1"><label className="label">Nome do grupo</label><input className="field" value={g.name} placeholder="Ponto da carne" onChange={(e) => setGroup(gi, { name: e.target.value })} /></div>
                  <div className="w-24"><label className="label">Máx. escolhas</label><input type="number" min={1} max={20} className="field" value={g.max_select} onChange={(e) => setGroup(gi, { max_select: Math.max(1, +e.target.value || 1) })} /></div>
                  <Toggle checked={g.required} onChange={(v) => setGroup(gi, { required: v, min_select: v ? Math.max(1, g.min_select) : 0 })} label="Obrigatório" />
                  <button className="btn-ghost-dark btn-sm" aria-label="Remover grupo" onClick={() => set('groups', form.groups.filter((_, j) => j !== gi))}>✕</button>
                </div>
                <ul className="mt-3 space-y-2">
                  {g.options.map((o, oi) => (
                    <li key={oi} className="flex items-center gap-2">
                      <input aria-label="Nome da opção" className="field !py-1.5" placeholder="Opção" value={o.name} onChange={(e) => setGroup(gi, { options: g.options.map((x, j) => (j === oi ? { ...x, name: e.target.value } : x)) })} />
                      <input aria-label="Valor extra" inputMode="decimal" className="field !w-28 !py-1.5" placeholder="+ R$ 0,00" value={o.price} onChange={(e) => setGroup(gi, { options: g.options.map((x, j) => (j === oi ? { ...x, price: e.target.value } : x)) })} />
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={o.available} onChange={(e) => setGroup(gi, { options: g.options.map((x, j) => (j === oi ? { ...x, available: e.target.checked } : x)) })} />Ativa</label>
                      <button aria-label="Remover opção" className="px-1 text-wine-700" onClick={() => setGroup(gi, { options: g.options.filter((_, j) => j !== oi) })}>✕</button>
                    </li>
                  ))}
                </ul>
                <button className="btn-ghost-dark btn-sm mt-2" onClick={() => setGroup(gi, { options: [...g.options, { name: '', price: '', available: true }] })}>+ Opção</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function Categories({ cats }: { cats: ReturnType<typeof useLoader<{ categories: any[] }>> }) {
  const toast = useToast();
  const [edit, setEdit] = useState<{ id?: string; name: string; description: string; sort_order: number; active: boolean } | null>(null);
  const save = async () => {
    if (!edit) return;
    try { edit.id ? await api('PUT', `/api/admin/categories/${edit.id}`, edit) : await api('POST', '/api/admin/categories', edit); toast('Categoria salva'); setEdit(null); cats.reload(); }
    catch (e: any) { toast(e.message, 'err'); }
  };
  const del = async (c: any) => { if (!confirm(`Excluir a categoria "${c.name}"?`)) return; try { await api('DELETE', `/api/admin/categories/${c.id}`); toast('Categoria excluída'); cats.reload(); } catch (e: any) { toast(e.message, 'err'); } };
  return (
    <>
      <div className="mb-3"><button className="btn-primary btn-sm" onClick={() => setEdit({ name: '', description: '', sort_order: (cats.data?.categories.length ?? 0) * 10, active: true })}>+ Nova categoria</button></div>
      {cats.error && <ErrorBox msg={cats.error} retry={cats.reload} />}
      {cats.loading && !cats.data ? <Loading /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {cats.data?.categories.map((c) => (
            <li key={c.id} className="panel flex items-center justify-between gap-3 !p-4">
              <div><p className="font-display text-xl font-black uppercase">{c.name} {!c.active && <span className="chip">Oculta</span>}</p><p className="text-xs opacity-70">{c.products} produto(s) · ordem {c.sort_order}</p></div>
              <div className="flex gap-2"><button className="btn-ghost-dark btn-sm" onClick={() => setEdit(c)}>Editar</button><button className="btn-ghost-dark btn-sm" onClick={() => del(c)}>Excluir</button></div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar categoria' : 'Nova categoria'}
        footer={<><button className="btn-ghost-dark" onClick={() => setEdit(null)}>Cancelar</button><button className="btn-primary" onClick={save} disabled={!edit?.name.trim()}>Salvar</button></>}>
        {edit && <div className="space-y-3">
          <div><label className="label" htmlFor="cn">Nome</label><input id="cn" className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
          <div><label className="label" htmlFor="cd">Descrição (opcional)</label><input id="cd" className="field" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
          <div><label className="label" htmlFor="co">Ordem de exibição</label><input id="co" type="number" min={0} className="field" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: +e.target.value || 0 })} /></div>
          <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Visível no cardápio" />
        </div>}
      </Modal>
    </>
  );
}
