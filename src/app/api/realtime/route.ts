import { requireStaff } from '@/lib/auth';
import { handler } from '@/lib/http';
import { subscribe } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Server-Sent Events: avisa as telas de equipe quando pedidos/impressões mudam. */
export const GET = handler(async (req: Request) => {
  await requireStaff();
  const enc = new TextEncoder();
  let unsub = () => {};
  let ping: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    start(ctrl) {
      const send = (s: string) => { try { ctrl.enqueue(enc.encode(s)); } catch { /* fechado */ } };
      send('retry: 3000\n\n');
      unsub = subscribe((p) => send(`data: ${p}\n\n`));
      ping = setInterval(() => send(': ping\n\n'), 20000);
      req.signal.addEventListener('abort', () => { unsub(); clearInterval(ping); try { ctrl.close(); } catch {} });
    },
    cancel() { unsub(); clearInterval(ping); },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  });
});
