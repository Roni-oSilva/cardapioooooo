'use client';
import { useEffect, useState } from 'react';
import { api, fromCents, toCents, useLoader } from '@/lib/client';
import { Thumb } from '../Thumb';
import { ErrorBox, Loading, PageHeader, Toggle, useToast } from './ui';

export function SettingsForm() {
  const { data, error, loading, reload } = useLoader<{ settings: any }>('/api/admin/settings');
  const [s, setS] = useState<any>(null);
  const [fee, setFee] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { if (data) { setS(data.settings); setFee(fromCents(data.settings.delivery_fee_cents)); } }, [data]);

  const upload = async (key: 'logo_url' | 'hero_image_url', f: File) => {
    const fd = new FormData(); fd.append('file', f);
    const r = await fetch('/api/admin/upload', { method: 'POST', body: fd }); const d = await r.json();
    if (!r.ok) return toast(d.error, 'err');
    setS((x: any) => ({ ...x, [key]: d.url }));
  };
  const save = async () => {
    setBusy(true);
    try { await api('PUT', '/api/admin/settings', { ...s, delivery_fee_cents: toCents(fee), hours: s.hours.filter((h: any) => h.label.trim()) }); toast('Configurações salvas'); reload(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  if (error) return <ErrorBox msg={error} retry={reload} />;
  if (loading || !s) return <Loading />;
  const set = (k: string, v: any) => setS({ ...s, [k]: v });
  return (
    <>
      <PageHeader title="Configurações" sub="Identidade, contato e regras de atendimento." actions={<button className="btn-cream" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar alterações'}</button>} />
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="panel space-y-3"><h2 className="title text-2xl">Restaurante</h2>
          <div><label className="label" htmlFor="sn">Nome</label><input id="sn" className="field" value={s.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div><label className="label" htmlFor="st">Frase de destaque</label><input id="st" className="field" value={s.tagline} onChange={(e) => set('tagline', e.target.value)} /></div>
          <div><label className="label" htmlFor="sa">Apresentação</label><textarea id="sa" rows={4} className="field" value={s.about} onChange={(e) => set('about', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            {([['logo_url', 'Logotipo'], ['hero_image_url', 'Imagem de destaque']] as const).map(([k, l]) => (
              <div key={k}><p className="label">{l}</p><Thumb src={s[k]} name={s.name} className="mb-2 h-24 w-full rounded-2xl" />
                <label className="btn-primary btn-sm cursor-pointer">Enviar<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(k, e.target.files[0])} /></label>
                {s[k] && <button className="btn-ghost-dark btn-sm ml-2" onClick={() => set(k, null)}>Remover</button>}</div>))}
          </div>
        </section>
        <section className="panel space-y-3"><h2 className="title text-2xl">Contato e horários</h2>
          <div><label className="label" htmlFor="sd">Endereço</label><input id="sd" className="field" value={s.address} onChange={(e) => set('address', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="sp">Telefone</label><input id="sp" className="field" value={s.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            <div><label className="label" htmlFor="sw">WhatsApp</label><input id="sw" className="field" value={s.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></div></div>
          <p className="label">Horários de funcionamento</p>
          {s.hours.map((h: any, i: number) => (
            <div key={i} className="flex gap-2"><input aria-label="Dias" className="field" placeholder="Seg a Qui" value={h.label} onChange={(e) => set('hours', s.hours.map((x: any, j: number) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input aria-label="Horário" className="field" placeholder="12h às 23h" value={h.hours} onChange={(e) => set('hours', s.hours.map((x: any, j: number) => (j === i ? { ...x, hours: e.target.value } : x)))} />
              <button aria-label="Remover" className="px-2" onClick={() => set('hours', s.hours.filter((_: any, j: number) => j !== i))}>✕</button></div>))}
          <button className="btn-ghost-dark btn-sm" onClick={() => set('hours', [...s.hours, { label: '', hours: '' }])}>+ Horário</button>
          <div><label className="label" htmlFor="tz">Fuso horário</label><input id="tz" className="field" value={s.timezone} onChange={(e) => set('timezone', e.target.value)} /></div>
        </section>
        <section className="panel space-y-3"><h2 className="title text-2xl">Atendimento</h2>
          <Toggle checked={s.accepting_orders} onChange={(v) => set('accepting_orders', v)} label="Recebendo pedidos pelo cardápio digital" />
          <Toggle checked={s.allow_dine_in} onChange={(v) => set('allow_dine_in', v)} label="Salão (pedido na mesa)" />
          <Toggle checked={s.allow_pickup} onChange={(v) => set('allow_pickup', v)} label="Retirada" />
          <Toggle checked={s.allow_delivery} onChange={(v) => set('allow_delivery', v)} label="Entrega" />
          <div className="max-w-[10rem]"><label className="label" htmlFor="sf">Taxa de entrega (R$)</label><input id="sf" inputMode="decimal" className="field" value={fee} onChange={(e) => setFee(e.target.value)} /></div>
        </section>
        <section className="panel space-y-3"><h2 className="title text-2xl">Cozinha e comandas</h2>
          <div><label className="label" htmlFor="kp">Prioridade no monitor da cozinha</label>
            <select id="kp" className="field" value={s.kitchen_priority} onChange={(e) => set('kitchen_priority', e.target.value)}><option value="fifo">Ordem de chegada</option><option value="prep_time">Maior tempo de preparo primeiro</option></select></div>
          <Toggle checked={s.kitchen_sound} onChange={(v) => set('kitchen_sound', v)} label="Alerta sonoro padrão para novos pedidos" />
          <div><label className="label" htmlFor="tf">Rodapé da comanda</label><input id="tf" className="field" maxLength={120} value={s.ticket_footer} onChange={(e) => set('ticket_footer', e.target.value)} /></div>
        </section>
      </div>
    </>
  );
}
