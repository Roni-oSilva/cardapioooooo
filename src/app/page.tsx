import { getPublicMenu } from '@/lib/menu';
import { MenuClient } from '@/components/menu/MenuClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const { settings } = await getPublicMenu();
  return { title: `${settings.name} · Cardápio`, description: settings.tagline || 'Cardápio digital' };
}

export default async function Home({ searchParams }: { searchParams: { mesa?: string } }) {
  const m = await getPublicMenu();
  return <MenuClient settings={m.settings} categories={m.categories as any} products={m.products} tables={m.tables as any} presetTable={searchParams.mesa} />;
}
