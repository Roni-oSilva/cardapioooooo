import { redirect } from 'next/navigation';
import { getStaff } from '@/lib/auth';
import { can, ROLE_LABEL, Area } from '@/lib/permissions';
import { Nav, NavItem } from '@/components/admin/Nav';
import { ToastProvider } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Painel', robots: { index: false } };

const ITEMS: (NavItem & { area: Area })[] = [
  { href: '/admin', label: 'Dashboard', icon: '▦', area: 'dashboard' },
  { href: '/admin/pedidos', label: 'Pedidos', icon: '🧾', area: 'orders' },
  { href: '/kitchen', label: 'Monitor da cozinha', icon: '👨‍🍳', area: 'kitchen' },
  { href: '/admin/mesas', label: 'Mesas e contas', icon: '🪑', area: 'tables' },
  { href: '/admin/cardapio', label: 'Cardápio', icon: '📖', area: 'menu' },
  { href: '/admin/financeiro', label: 'Financeiro', icon: '💰', area: 'finance' },
  { href: '/admin/impressao', label: 'Impressão', icon: '🖨', area: 'printing' },
  { href: '/admin/configuracoes', label: 'Configurações', icon: '⚙', area: 'settings' },
  { href: '/admin/usuarios', label: 'Equipe', icon: '👥', area: 'users' },
  { href: '/admin/auditoria', label: 'Auditoria', icon: '🛡', area: 'audit' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  if (!staff) redirect('/login');
  const items = ITEMS.filter((i) => can(staff.role, i.area));
  return (
    <ToastProvider>
      <div className="min-h-dvh lg:flex">
        <Nav items={items} user={{ name: staff.name, roleLabel: ROLE_LABEL[staff.role] }} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
