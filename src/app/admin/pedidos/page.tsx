import { pageGuard } from '@/lib/guard';
import { Orders } from '@/components/admin/Orders';

export default async function Page() {
  const s = await pageGuard('orders');
  return <Orders role={s.role} />;
}
