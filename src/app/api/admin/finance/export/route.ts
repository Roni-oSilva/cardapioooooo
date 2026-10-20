import { requireStaff } from '@/lib/auth';
import { handler, HttpError } from '@/lib/http';
import { financeReport } from '@/lib/finance';

export const dynamic = 'force-dynamic';

const esc = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // evita injeção de fórmulas ao abrir no Excel
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const money = (c: number) => (c / 100).toFixed(2).replace('.', ',');

export const GET = handler(async (req: Request) => {
  await requireStaff('finance');
  const sp = new URL(req.url).searchParams;
  const r = await financeReport(sp.get('from'), sp.get('to'));
  const type = sp.get('type') ?? 'payments';
  let head: string[]; let rows: unknown[][];
  if (type === 'payments') { head = ['Data', 'Forma', 'Valor', 'Pagador', 'Mesa', 'Registrado por']; rows = r.payments.map((x: any) => [new Date(x.created_at).toISOString(), x.method, money(x.amount_cents), x.payer_label, x.table_label, x.by_user]); }
  else if (type === 'orders') { head = ['Pedido', 'Data', 'Status', 'Atendimento', 'Mesa', 'Total', 'Conta']; rows = r.history.map((x: any) => [x.number, new Date(x.created_at).toISOString(), x.status, x.service_type, x.table_label, money(x.total_cents), x.tab_status]); }
  else if (type === 'products') { head = ['Produto', 'Categoria', 'Quantidade', 'Faturamento']; rows = r.top.map((x: any) => [x.name, x.category, x.qty, money(x.revenue)]); }
  else if (type === 'cancellations') { head = ['Pedido', 'Total', 'Motivo', 'Cancelado por', 'Data']; rows = r.cancellations.map((x: any) => [x.number, money(x.total_cents), x.cancel_reason, x.by_user, x.cancelled_at && new Date(x.cancelled_at).toISOString()]); }
  else throw new HttpError(400, 'Tipo de relatório inválido.');
  const csv = '﻿' + [head, ...rows].map((l) => l.map(esc).join(';')).join('\r\n');
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}_${r.from}_${r.to}.csv"` } });
});
