import { pageGuard } from '@/lib/guard';
import { can } from '@/lib/permissions';
import { Tables } from '@/components/admin/Tables';

export default async function Page() {
  const s = await pageGuard('tables');
  return <Tables canManage={can(s.role, 'menu')} canDiscount={['admin', 'manager'].includes(s.role)} />;
}
