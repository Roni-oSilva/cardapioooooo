import { pageGuard } from '@/lib/guard';
import { Finance } from '@/components/admin/Finance';

export default async function Page() {
  await pageGuard('finance');
  return <Finance />;
}
