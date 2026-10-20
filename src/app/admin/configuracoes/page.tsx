import { pageGuard } from '@/lib/guard';
import { SettingsForm } from '@/components/admin/SettingsForm';

export default async function Page() {
  await pageGuard('settings');
  return <SettingsForm />;
}
