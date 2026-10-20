'use client';
import { useState } from 'react';
import { api, useLoader } from '@/lib/client';
import { ROLE_LABEL } from '@/lib/permissions';
import { ErrorBox, Loading, Modal, PageHeader, Toggle, useToast } from './ui';

type U = { id?: string; name: string; email: string; role: string; active: boolean; password: string };

export function Users() {
  const { data, error, loading, reload } = useLoader<{ users: any[] }>('/api/admin/users');
  const [edit, setEdit] = useState<U | null>(null);
  const toast = useToast();
  const save = async () => {
    if (!edit) return;
    try {
      edit.id ? await api('PUT', `/api/admin/users/${edit.id}`, { name: edit.name, role: edit.role, active: edit.active, ...(edit.password ? { password: edit.password } : {}) })
        : await api('POST', '/api/admin/users', { name: edit.name, email: edit.email, role: edit.role, password: edit.password });
      toast('Usuário salvo'); setEdit(null); reload();
    } catch (e: any) { toast(e.message, 'err'); }
  };
  return (
    <>
      <PageHeader title="Equipe" sub="Quem acessa o painel e o que cada perfil pode fazer." actions={<button className="btn-primary btn-sm" onClick={() => setEdit({ name: '', email: '', role: 'waiter', active: true, password: '' })}>+ Novo usuário</button>} />
      {error && <ErrorBox msg={error} retry={reload} />}
      {loading && !data ? <Loading /> : (
        <ul className="grid gap-3 md:grid-cols-2">{data?.users.map((u) => (
          <li key={u.id} className="panel flex items-center justify-between gap-3 !p-4">
            <div><p className="font-bold">{u.name} {!u.active && <span className="chip">Inativo</span>}</p><p className="text-xs opacity-70">{u.email} · {ROLE_LABEL[u.role as keyof typeof ROLE_LABEL]}</p></div>
            <button className="btn-ghost-dark btn-sm" onClick={() => setEdit({ ...u, password: '' })}>Editar</button>
          </li>))}</ul>
      )}
      <div className="panel mt-6 text-sm"><h2 className="title mb-2 text-2xl">Perfis</h2>
        <ul className="space-y-1"><li><b>Administrador</b> — tudo, inclusive usuários e configurações.</li><li><b>Gerente</b> — cardápio, financeiro, impressão, descontos e cancelamentos.</li><li><b>Garçom</b> — pedidos, mesas e contas (sem descontos).</li><li><b>Cozinha</b> — monitor da cozinha e andamento dos pedidos.</li></ul></div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar usuário' : 'Novo usuário'}
        footer={<><button className="btn-ghost-dark" onClick={() => setEdit(null)}>Cancelar</button><button className="btn-primary" onClick={save} disabled={!edit?.name.trim() || (!edit?.id && (!edit?.email || edit.password.length < 8))}>Salvar</button></>}>
        {edit && <div className="space-y-3">
          <div><label className="label" htmlFor="un">Nome</label><input id="un" className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
          {!edit.id && <div><label className="label" htmlFor="ue">E-mail</label><input id="ue" type="email" className="field" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>}
          <div><label className="label" htmlFor="ur">Perfil</label><select id="ur" className="field" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="label" htmlFor="up">{edit.id ? 'Nova senha (deixe vazio para manter)' : 'Senha (mín. 8 caracteres)'}</label><input id="up" type="password" autoComplete="new-password" className="field" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></div>
          {edit.id && <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Acesso ativo" />}
        </div>}
      </Modal>
    </>
  );
}
