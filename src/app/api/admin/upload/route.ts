import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireStaff, audit } from '@/lib/auth';
import { handler, HttpError, json } from '@/lib/http';

export const runtime = 'nodejs';
const MAX = 5 * 1024 * 1024;

function sniff(b: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

export const POST = handler(async (req: Request) => {
  const staff = await requireStaff('menu');
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Envie um arquivo no campo "file".');
  if (file.size > MAX) throw new HttpError(413, 'Imagem maior que 5 MB.');
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf); // valida pelo conteúdo real, não pelo nome/tipo informado
  if (!ext) throw new HttpError(415, 'Use imagens JPG, PNG ou WebP.');
  const dir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  await fs.mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, name), buf);
  await audit(staff, 'upload', 'image', name);
  return json({ url: `/api/uploads/${name}` }, 201);
});
