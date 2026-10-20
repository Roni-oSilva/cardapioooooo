import { z } from 'zod';
import { requireStaff, audit } from '@/lib/auth';
import { body, handler, HttpError, json } from '@/lib/http';
import { tx, notify } from '@/lib/db';
import { tabTotals } from '@/lib/orders';

const input = z.object({
  discount_cents: z.number().int().min(0).default(0),
  discount_reason: z.string().trim().max(200).default(''),
  payments: z.array(z.object({
    method: z.enum(['dinheiro', 'credito', 'debito', 'pix', 'vale', 'outro']),
    amount_cents: z.number().int().min(1),
    payer_label: z.string().trim().max(60).default(''),
  })).max(20).default([]),
});

/** Fecha a conta: registra pagamentos (pode dividir em várias formas/pessoas) e o desconto autorizado. */
export const POST = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const staff = await requireStaff('tables');
  const d = await body(req, input);
  if (d.discount_cents > 0) {
    if (!['admin', 'manager'].includes(staff.role)) throw new HttpError(403, 'Apenas gerente ou administrador autoriza descontos.');
    if (!d.discount_reason) throw new HttpError(400, 'Informe o motivo do desconto.');
  }
  const out = await tx(async (c) => {
    const tab = (await c.query('SELECT * FROM tabs WHERE id=$1 FOR UPDATE', [params.id])).rows[0];
    if (!tab) throw new HttpError(404, 'Conta não encontrada.');
    if (tab.status !== 'open') throw new HttpError(409, 'Esta conta já foi fechada.');
    const t = await tabTotals(params.id, c);
    if (d.discount_cents > t.orders_total) throw new HttpError(400, 'Desconto maior que o total da conta.');
    const due = t.orders_total - d.discount_cents;
    const paying = d.payments.reduce((a, p) => a + p.amount_cents, 0);
    if (due === 0 && paying === 0) {
      const active = await c.query(`SELECT 1 FROM orders WHERE tab_id=$1 AND status<>'cancelado' LIMIT 1`, [params.id]);
      const status = active.rowCount ? 'closed' : 'void';
      await c.query(`UPDATE tabs SET status=$2, closed_at=now(), closed_by=$3, discount_cents=$4, discount_reason=$5, discount_by=$6 WHERE id=$1`,
        [params.id, status, staff.id, d.discount_cents, d.discount_reason || null, d.discount_cents ? staff.id : null]);
      return { due, status };
    }
    if (paying + t.paid !== due) throw new HttpError(400, `Os pagamentos não fecham com o valor da conta (faltam ${((due - paying - t.paid) / 100).toFixed(2)}).`);
    for (const p of d.payments) {
      await c.query('INSERT INTO payments(tab_id,method,amount_cents,payer_label,created_by) VALUES ($1,$2,$3,$4,$5)', [params.id, p.method, p.amount_cents, p.payer_label, staff.id]);
    }
    await c.query(`UPDATE tabs SET status='closed', closed_at=now(), closed_by=$2, discount_cents=$3, discount_reason=$4, discount_by=$5 WHERE id=$1`,
      [params.id, staff.id, d.discount_cents, d.discount_reason || null, d.discount_cents ? staff.id : null]);
    return { due, status: 'closed' };
  });
  await audit(staff, 'tab.close', 'tab', params.id, { ...d, due: out.due });
  await notify('tab.closed', { tabId: params.id });
  return json(out);
});
