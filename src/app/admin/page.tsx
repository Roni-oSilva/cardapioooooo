import { redirect } from 'next/navigation';
import { getStaff } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { Dashboard } from '@/components/admin/Dashboard';

export default async function AdminHome() {
  const s = await getStaff();
  if (!s) redirect('/login');
  if (!can(s.role, 'dashboard')) redirect(s.role === 'kitchen' ? '/kitchen' : '/admin/pedidos');
  return <Dashboard />;
}
