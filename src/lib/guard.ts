import { redirect } from 'next/navigation';
import { getStaff, Staff } from './auth';
import { Area, can } from './permissions';

/** Guarda de página (servidor): sem sessão → login; sem permissão → tela inicial do perfil. */
export async function pageGuard(area: Area): Promise<Staff> {
  const s = await getStaff();
  if (!s) redirect('/login');
  if (!can(s.role, area)) redirect(s.role === 'kitchen' ? '/kitchen' : '/admin/pedidos');
  return s;
}
