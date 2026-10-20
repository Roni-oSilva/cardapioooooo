import { pageGuard } from '@/lib/guard';
import { Audit } from '@/components/admin/Audit';

export default async function Page() {
  await pageGuard('audit');
  return <Audit />;
}
