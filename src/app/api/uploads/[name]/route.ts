import fs from 'node:fs/promises';
import path from 'node:path';
import { handler, HttpError } from '@/lib/http';

export const dynamic = 'force-dynamic';
const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export const GET = handler(async (_req: Request, { params }: { params: { name: string } }) => {
  const name = params.name;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(name)) throw new HttpError(404, 'Não encontrado');
  const dir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  try {
    const buf = await fs.readFile(path.join(dir, name));
    return new Response(buf, { headers: { 'Content-Type': TYPES[path.extname(name)], 'Cache-Control': 'public, max-age=31536000, immutable' } });
  } catch {
    throw new HttpError(404, 'Não encontrado');
  }
});
