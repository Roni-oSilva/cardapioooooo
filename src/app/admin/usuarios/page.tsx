import { pageGuard } from '@/lib/guard';
import { Users } from '@/components/admin/Users';

export default async function Page() {
  await pageGuard('users');
  return <Users />;
}
