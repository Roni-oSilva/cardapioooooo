import { pageGuard } from '@/lib/guard';
import { Printing } from '@/components/admin/Printing';

export default async function Page() {
  await pageGuard('printing');
  return <Printing />;
}
