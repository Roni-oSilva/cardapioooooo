'use client';
import { useEffect, useState } from 'react';
import { api, dmyhm, useLoader } from '@/lib/client';
import { Empty, ErrorBox, Loading, Modal, PageHeader, Stat, Toggle, useToast } from './ui';
import { PrintChip } from './Orders';

type P = { id?: string; name: string; copy_type: 'cozinha' | 'atendimento'; paper: '58' | '80' | 'a4'; target: string; active: boolean };
const blank: P = { name: '', copy_type: 'cozinha', paper: '80', target: 'tcp://192.168.0.50:9100', active: true };

export function Printing() {
  const printers = useLoader<{ printers: any[] }>('/api/admin/printers');
  const jobs = useLoader<{ jobs: any[]; summary: any }>('/api/admin/print-jobs', { live: true, every: 10000 });
  const [edit, setEdit] = useState<P | null>(null);
  const toast = useToast();

  const save = async () => {
    if (!edit) return;
    try { edit.id ? await api('PUT', `/api/admin/printers/${edit.id}`, edit) : await api('POST', '/api/admin/printers', edit); toast('Impressora salva'); setEdit(null); printers.reload(); }
    catch (e: any) { toast(e.message, 'err'); }
  };
  const del = async () => { if (!edit?.id || !confirm('Remover esta impressora?')) return; try { await api('DELETE', `/api/admin/printers/${edit.id}`); setEdit(null); printers.reload(); } catch (e: any) { toast(e.message, 'err'); } };
  const retry = async (id: string) => { try { await api('POST', `/api/admin/print-jobs/${id}/retry`); toast('Reenviado para a fila'); jobs.reload(); } catch (e: any) { toast(e.message, 'err'); } };
  const s = jobs.data?.summary;
  const [origin, setOrigin] = useState('https://seu-dominio');
  useEffect(() => setOrigin(window.location.origin), []); // só no cliente: evita divergência na hidratação

  return (
    <>
      <PageHeader title="Impressão" sub="Impressoras automáticas, fila de comandas e histórico de tentativas." actions={<button className="btn-primary btn-sm" onClick={() => setEdit(blank)}>+ Impressora</button>} />
      {s && <div className="mb-5 grid grid-cols-3 gap-3"><Stat label="Na fila" value={s.queued} /><Stat label="Imprimindo" value={s.printing} tone="green" /><Stat label="Falharam" value={s.failed} hint={s.failed ? 'Veja abaixo e tente novamente' : undefined} tone="green" /></div>}

      <section className="panel mb-5"><h2 className="title mb-3 text-2xl">Impressoras</h2>
        {printers.error && <ErrorBox msg={printers.error} retry={printers.reload} />}
        {printers.loading && !printers.data ? <Loading rows={1} /> : !printers.data?.printers.length ? (
          <Empty icon="🖨" title="Nenhuma impressora automática">Sem impressora cadastrada, os pedidos continuam funcionando e a comanda é impressa pelo botão “Imprimir comanda” (janela de impressão do navegador).</Empty>
        ) : <ul className="grid gap-3 md:grid-cols-2">{printers.data.printers.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream-50 p-3 ring-1 ring-wine-700/10">
            <div className="min-w-0"><p className="font-bold">{p.name} {!p.active && <span className="chip">Inativa</span>}</p><p className="truncate text-xs opacity-70">Via {p.copy_type} · {p.paper === 'a4' ? 'A4' : `${p.paper} mm`} · {p.target}</p></div>
            <button className="btn-ghost-dark btn-sm" onClick={() => setEdit(p)}>Editar</button>
          </li>))}</ul>}
      </section>

      <details className="panel mb-5">
        <summary className="cursor-pointer font-display text-xl font-black uppercase">Como ligar a impressão automática</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          <li>No computador ligado à impressora (ou na mesma rede), instale o Node 18+ e copie a pasta <code>agent/</code> do projeto.</li>
          <li>Crie o arquivo <code>.env.agent</code> ao lado do agente com <code>SERVER_URL={origin}</code> e <code>PRINT_AGENT_TOKEN=</code> o mesmo token do servidor.</li>
          <li>Execute <code>node agent/print-agent.mjs</code> (deixe rodando; use pm2/systemd/Agendador de Tarefas para iniciar com o computador).</li>
          <li>Cadastre a impressora acima. Destinos: <code>tcp://IP:9100</code> (térmica de rede), <code>cups:NOME_DA_FILA</code> (Linux/macOS) ou <code>file:/dev/usb/lp0</code> (USB no Linux).</li>
        </ol>
        <p className="mt-3 rounded-xl bg-cream-50 p-3 text-xs">Um job só vira “Impresso” quando o agente confirma: dados aceitos pela impressora (com consulta de status ESC/POS quando ela responde) ou job concluído no CUPS. Se não houver confirmação, ele é reagendado e, esgotadas as tentativas, fica como falha para você tentar de novo.</p>
      </details>

      <section className="panel overflow-x-auto"><h2 className="title mb-3 text-2xl">Fila e histórico</h2>
        {jobs.error && <ErrorBox msg={jobs.error} retry={jobs.reload} />}
        {jobs.loading && !jobs.data ? <Loading rows={2} /> : !jobs.data?.jobs.length ? <Empty icon="📭" title="Nada na fila" /> : (
          <table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-wine-700/20 text-xs uppercase opacity-70"><th className="py-2">Pedido</th><th>Via</th><th>Status</th><th>Tentativas</th><th>Detalhe</th><th /></tr></thead>
            <tbody>{jobs.data.jobs.map((j) => (
              <tr key={j.id} className="border-b border-wine-700/10 align-top"><td className="py-2 font-bold">#{j.number}{j.is_reprint && <span className="chip ml-1">reimp.</span>}</td>
                <td>{j.copy_type === 'cozinha' ? 'Cozinha' : 'Atendimento'} · {j.paper === 'a4' ? 'A4' : `${j.paper}mm`}</td><td><PrintChip p={{ status: j.status }} /></td><td>{j.attempts}/{j.max_attempts}</td>
                <td className="max-w-xs text-xs">{j.status === 'printed' ? <span className="text-forest-800">{j.attempts_log?.[0]?.confirmation ?? 'Impresso'} · {dmyhm(j.printed_at)}</span> : <span className="font-semibold text-ember">{j.last_error}</span>}{j.status === 'queued' && j.last_error && <span className="block opacity-70">nova tentativa {dmyhm(j.next_attempt_at)}</span>}</td>
                <td>{j.status === 'failed' && <button className="btn-primary btn-sm" onClick={() => retry(j.id)}>Tentar de novo</button>}</td></tr>))}</tbody></table>
        )}
      </section>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar impressora' : 'Nova impressora'}
        footer={<>{edit?.id && <button className="btn-ghost-dark mr-auto" onClick={del}>Remover</button>}<button className="btn-ghost-dark" onClick={() => setEdit(null)}>Cancelar</button><button className="btn-primary" onClick={save} disabled={!edit?.name.trim()}>Salvar</button></>}>
        {edit && <div className="space-y-3">
          <div><label className="label" htmlFor="in">Nome</label><input id="in" className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Cozinha" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="iv">Via</label><select id="iv" className="field" value={edit.copy_type} onChange={(e) => setEdit({ ...edit, copy_type: e.target.value as P['copy_type'] })}><option value="cozinha">Cozinha (sem preços)</option><option value="atendimento">Atendimento (com valores)</option></select></div>
            <div><label className="label" htmlFor="ip">Papel</label><select id="ip" className="field" value={edit.paper} onChange={(e) => setEdit({ ...edit, paper: e.target.value as P['paper'] })}><option value="58">Térmica 58 mm</option><option value="80">Térmica 80 mm</option><option value="a4">A4 (convencional)</option></select></div>
          </div>
          <div><label className="label" htmlFor="it">Destino</label><input id="it" className="field font-mono text-xs" value={edit.target} onChange={(e) => setEdit({ ...edit, target: e.target.value })} /><p className="mt-1 text-xs opacity-70">tcp://IP:9100 · cups:NOME_DA_FILA · file:/dev/usb/lp0</p></div>
          <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Ativa" />
        </div>}
      </Modal>
    </>
  );
}
