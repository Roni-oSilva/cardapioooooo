import { pageGuard } from '@/lib/guard';
import { MenuAdmin } from '@/components/admin/MenuAdmin';

export default async function Page() {
  await pageGuard('menu');
  return <MenuAdmin />;
}
