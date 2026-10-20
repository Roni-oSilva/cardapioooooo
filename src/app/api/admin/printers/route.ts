import { z } from 'zod';
import { requireStaff, audit } from '@/lib/auth';
import { body, handler, json } from '@/lib/http';
import { one, query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const printerInput = z.object({
  name: z.string().trim().min(1).max(60),
  copy_type: z.enum(['cozinha', 'atendimento']),
  paper: z.enum(['58', '80', 'a4']),
  // tcp://192.168.0.50:9100 | cups:NOME_DA_FILA | file:/dev/usb/lp0
  target: z.string().trim().regex(/^(tcp:\/\/[\w.\-]+:\d{2,5}|cups:[\w.\-]+|file:\/[\w\/.\-]+)$/, 'Use tcp://IP:9100, cups:NOME ou file:/dev/usb/lp0'),
  active: z.boolean().default(true),
});

export const GET = handler(async () => {
  await requireStaff('printing');
  return json({ printers: await query('SELECT * FROM printers ORDER BY created_at') });
});
export const POST = handler(async (req: Request) => {
  const staff = await requireStaff('printing');
  const d = await body(req, printerInput);
  const p = await one('INSERT INTO printers(name,copy_type,paper,target,active) VALUES ($1,$2,$3,$4,$5) RETURNING *', [d.name, d.copy_type, d.paper, d.target, d.active]);
  await audit(staff, 'printer.create', 'printer', p!.id, d);
  return json({ printer: p }, 201);
});
