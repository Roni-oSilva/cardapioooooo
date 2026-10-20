'use client';
import { dmyhm, useLoader } from '@/lib/client';
import { Empty, ErrorBox, Loading, PageHeader } from './ui';

export function Audit() {
  const { data, error, loading, reload } = useLoader<{ log: any[] }>('/api/admin/audit');
  return (
    <>
      <PageHeader title="Auditoria" sub="Ações administrativas relevantes (últimas 200)." />
      {error && <ErrorBox msg={error} retry={reload} />}
      {loading && !data ? <Loading /> : !data?.log.length ? <div className="panel"><Empty icon="🛡" title="Sem registros" /></div> : (
        <div className="panel overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-wine-700/20 text-xs uppercase opacity-70"><th className="py-2">Quando</th><th>Quem</th><th>Ação</th><th>Detalhes</th></tr></thead>
          <tbody>{data.log.map((l) => <tr key={l.id} className="border-b border-wine-700/10 align-top"><td className="whitespace-nowrap py-2">{dmyhm(l.created_at)}</td><td>{l.user_name ?? '—'}</td><td className="font-mono text-xs">{l.action}</td><td className="max-w-md truncate font-mono text-[11px] opacity-70" title={JSON.stringify(l.details)}>{JSON.stringify(l.details)}</td></tr>)}</tbody></table></div>
      )}
    </>
  );
}
