import { pageGuard } from '@/lib/guard';
import { can } from '@/lib/permissions';
import { Kitchen } from '@/components/admin/Kitchen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const s = await pageGuard('kitchen');
  return <Kitchen canPanel={can(s.role, 'orders') && s.role !== 'kitchen'} />;
}
