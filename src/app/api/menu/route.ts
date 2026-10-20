import { getPublicMenu } from '@/lib/menu';
import { handler, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => json(await getPublicMenu(), { headers: { 'Cache-Control': 'no-store' } }));
