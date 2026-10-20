import { one, query, tx, notify } from './db';
import { getOrderFull, tabTotals } from './orders';
import { getSettings } from './settings';
import { buildTicket, CopyType } from './ticket';
import { toEscPos, toPlainText } from './escpos';

export async function ticketFor(orderId: string, copy: CopyType, reprint: boolean) {
  const order = await getOrderFull(orderId);
  if (!order) return null;
  const s = await getSettings();
  const tab = copy === 'atendimento' ? await tabTotals(order.tab_id) : null;
  return {
    order,
    blocks: buildTicket({
      restaurant: { name: s.name, tagline: s.tagline, logo_url: s.logo_url, ticket_footer: s.ticket_footer, timezone: s.timezone },
      order, copy, reprint, tab: tab && { total: tab.total, paid: tab.paid, discount_cents: tab.discount_cents },
    }),
  };
}

const BACKOFF_SECONDS = [10, 30, 60, 120, 300];

/** Entrega jobs ao agente. FOR UPDATE SKIP LOCKED impede que dois agentes peguem o mesmo job. */
export async function claimJobs(limit: number, agent: string) {
  const claimed = await tx(async (c) => {
    // jobs "printing" com lock vencido (agente caiu no meio) voltam a ser elegíveis
    await c.query(
      `UPDATE print_jobs SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
              last_error = COALESCE(last_error,'') || ' [agente não respondeu]'
       WHERE status='printing' AND locked_until < now()`);
    const r = await c.query(
      `UPDATE print_jobs SET status='printing', attempts=attempts+1, locked_until=now()+interval '90 seconds',
              -- usa sempre o destino atual da impressora: corrigir o cadastro vale para jobs que já estavam na fila
              target = COALESCE((SELECT p.target FROM printers p WHERE p.id = print_jobs.printer_id AND p.active), target),
              paper  = COALESCE((SELECT p.paper  FROM printers p WHERE p.id = print_jobs.printer_id AND p.active), paper)
       WHERE id IN (SELECT id FROM print_jobs WHERE status='queued' AND next_attempt_at<=now()
                    ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED)
       RETURNING id, order_id, copy_type, paper, target, is_reprint, attempts`, [limit]);
    return r.rows;
  });
  const out = [];
  for (const j of claimed) {
    const t = await ticketFor(j.order_id, j.copy_type, j.is_reprint);
    if (!t) { await reportResult(j.id, { success: false, error: 'Pedido não encontrado', agent }); continue; }
    const escpos = j.paper !== 'a4';
    const data = escpos ? toEscPos(t.blocks, j.paper) : Buffer.from(toPlainText(t.blocks), 'utf8');
    out.push({
      id: j.id, order_number: t.order.number, copy_type: j.copy_type, paper: j.paper, target: j.target,
      kind: escpos ? 'escpos' : 'text', data_b64: data.toString('base64'), attempt: j.attempts,
    });
  }
  return out;
}

export async function reportResult(jobId: string, r: { success: boolean; error?: string; confirmation?: string; agent?: string }) {
  const orderId = await tx(async (c) => {
    const j = (await c.query('SELECT * FROM print_jobs WHERE id=$1 FOR UPDATE', [jobId])).rows[0];
    if (!j) return null;
    await c.query('INSERT INTO print_attempts(job_id, agent, success, error, confirmation) VALUES ($1,$2,$3,$4,$5)',
      [jobId, r.agent ?? null, r.success, r.error ?? null, r.confirmation ?? null]);
    if (j.status === 'failed' && j.last_error === 'Pedido cancelado') return j.order_id;
    if (r.success) {
      await c.query(`UPDATE print_jobs SET status='printed', printed_at=now(), last_error=NULL, locked_until=NULL WHERE id=$1`, [jobId]);
      if (j.copy_type === 'cozinha' && !j.is_reprint) {
        // confirmada a via da cozinha, o pedido deixa de "aguardar impressão"
        const pending = await c.query(
          `SELECT 1 FROM print_jobs WHERE order_id=$1 AND copy_type='cozinha' AND is_reprint=false AND status<>'printed'`, [j.order_id]);
        if (!pending.rowCount) {
          const u = await c.query(`UPDATE orders SET status='recebido', updated_at=now() WHERE id=$1 AND status='aguardando_impressao' RETURNING id`, [j.order_id]);
          if (u.rowCount) await c.query(
            `INSERT INTO order_status_history(order_id, from_status, to_status, note) VALUES ($1,'aguardando_impressao','recebido','Comanda impressa')`, [j.order_id]);
        }
      }
    } else {
      const exhausted = j.attempts >= j.max_attempts;
      const wait = BACKOFF_SECONDS[Math.min(j.attempts - 1, BACKOFF_SECONDS.length - 1)];
      await c.query(
        `UPDATE print_jobs SET status=$2, last_error=$3, locked_until=NULL, next_attempt_at=now()+($4 || ' seconds')::interval WHERE id=$1`,
        [jobId, exhausted ? 'failed' : 'queued', (r.error ?? 'Falha desconhecida').slice(0, 500), String(wait)]);
    }
    return j.order_id as string;
  });
  if (orderId) await notify('print.updated', { orderId, jobId });
}

export async function retryJob(jobId: string) {
  const r = await query(
    `UPDATE print_jobs SET status='queued', attempts=0, next_attempt_at=now(), last_error=NULL, locked_until=NULL
     WHERE id=$1 AND status='failed' RETURNING order_id`, [jobId]);
  if (r[0]) await notify('print.updated', { orderId: r[0].order_id, jobId });
  return r[0] ?? null;
}

export async function printSummary() {
  return one<{ queued: number; failed: number; printing: number }>(
    `SELECT count(*) FILTER (WHERE status='queued')::int AS queued, count(*) FILTER (WHERE status='failed')::int AS failed,
            count(*) FILTER (WHERE status='printing')::int AS printing FROM print_jobs`);
}
