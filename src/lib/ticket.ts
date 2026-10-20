import { brl, PAY_LABEL, SERVICE_LABEL } from './money';

/** Modelo neutro da comanda: o mesmo conteúdo é renderizado em ESC/POS, texto puro e HTML. */
export type Block =
  | { kind: 'text'; text: string; align?: 'left' | 'center'; size?: 1 | 2 | 'tall'; bold?: boolean; invert?: boolean; indent?: number }
  | { kind: 'pair'; left: string; right: string; bold?: boolean }
  | { kind: 'rule'; char: '-' | '=' }
  | { kind: 'space' }
  | { kind: 'logo'; url: string };

export type CopyType = 'cozinha' | 'atendimento';

export interface TicketData {
  restaurant: { name: string; tagline?: string; logo_url?: string | null; ticket_footer?: string; timezone: string };
  order: any; // resultado de getOrderFull
  copy: CopyType;
  reprint: boolean;
  tab?: { total: number; paid: number; discount_cents: number } | null;
}

const fmtDate = (d: Date | string, tz: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

const up = (s: string) => s.toLocaleUpperCase('pt-BR');

export function buildTicket(t: TicketData): Block[] {
  const { order: o, restaurant: r, copy } = t;
  const tz = r.timezone;
  const b: Block[] = [];
  const kitchen = copy === 'cozinha';

  if (r.logo_url) b.push({ kind: 'logo', url: r.logo_url });
  b.push({ kind: 'text', text: up(r.name), align: 'center', size: 2, bold: true });
  if (r.tagline) b.push({ kind: 'text', text: r.tagline, align: 'center' });
  b.push({ kind: 'space' });
  b.push({ kind: 'text', text: kitchen ? 'VIA COZINHA' : 'VIA ATENDIMENTO', align: 'center', bold: true, invert: true, size: 'tall' });
  if (t.reprint) {
    b.push({ kind: 'text', text: '*** REIMPRESSÃO ***', align: 'center', bold: true, size: 'tall' });
    b.push({ kind: 'text', text: `Reimpressa em ${fmtDate(new Date(), tz)}`, align: 'center' });
  }
  b.push({ kind: 'rule', char: '=' });
  b.push({ kind: 'text', text: `PEDIDO Nº ${o.number}`, size: 2, bold: true, align: 'center' });
  b.push({ kind: 'text', text: fmtDate(o.created_at, tz), align: 'center' });
  b.push({ kind: 'rule', char: '-' });

  if (o.service_type === 'salao') b.push({ kind: 'text', text: `MESA ${up(o.table_label ?? '?')}`, size: 2, bold: true, align: 'center' });
  else b.push({ kind: 'text', text: up(SERVICE_LABEL[o.service_type]), size: 2, bold: true, align: 'center' });
  b.push({ kind: 'pair', left: 'Atendimento:', right: SERVICE_LABEL[o.service_type] });
  if (o.customer_name) b.push({ kind: 'pair', left: 'Cliente:', right: o.customer_name });
  if (o.customer_phone) b.push({ kind: 'pair', left: 'Telefone:', right: o.customer_phone });
  if (o.delivery_address) b.push({ kind: 'text', text: `Endereço: ${o.delivery_address}` });
  b.push({ kind: 'pair', left: 'Recebido por:', right: o.created_by_name ?? 'Cliente (cardápio digital)' });
  b.push({ kind: 'rule', char: '=' });

  for (const it of o.items as any[]) {
    b.push({ kind: 'text', text: `${it.quantity}x ${up(it.product_name)}`, size: kitchen ? 'tall' : 1, bold: true });
    // agrupa opções de um mesmo grupo: "ACOMPANHAMENTO: A, B"
    const byGroup = new Map<string, string[]>();
    for (const op of it.options as any[]) {
      const label = !kitchen && op.price_cents > 0 ? `${op.option_name} (+${brl(op.price_cents)})` : op.option_name;
      byGroup.set(op.group_name, [...(byGroup.get(op.group_name) ?? []), label]);
    }
    for (const [g, names] of byGroup) b.push({ kind: 'text', text: `${up(g)}: ${up(names.join(', '))}`, indent: 2, bold: kitchen });
    if (it.notes) {
      b.push({ kind: 'text', text: 'OBSERVAÇÃO:', indent: 2, bold: true });
      b.push({ kind: 'text', text: up(it.notes), indent: 4, bold: true, size: kitchen ? 'tall' : 1 });
    }
    if (!kitchen) b.push({ kind: 'pair', left: `  ${it.quantity} x ${brl(it.unit_price_cents)}`, right: brl(it.line_total_cents) });
    b.push({ kind: 'rule', char: '-' });
  }

  if (o.notes) {
    b.push({ kind: 'text', text: 'OBSERVAÇÃO GERAL DO PEDIDO:', bold: true });
    b.push({ kind: 'text', text: up(o.notes), bold: true, size: kitchen ? 'tall' : 1 });
    b.push({ kind: 'rule', char: '-' });
  }

  if (!kitchen) {
    b.push({ kind: 'pair', left: 'Subtotal', right: brl(o.subtotal_cents) });
    if (o.delivery_fee_cents) b.push({ kind: 'pair', left: 'Taxa de entrega', right: brl(o.delivery_fee_cents) });
    b.push({ kind: 'pair', left: 'TOTAL DO PEDIDO', right: brl(o.total_cents), bold: true });
    if (t.tab) {
      if (t.tab.discount_cents) b.push({ kind: 'pair', left: 'Desconto da conta', right: `-${brl(t.tab.discount_cents)}` });
      b.push({ kind: 'pair', left: 'Total da conta', right: brl(t.tab.total) });
      if (t.tab.paid) b.push({ kind: 'pair', left: 'Pago', right: brl(t.tab.paid) });
    }
    b.push({ kind: 'rule', char: '-' });
  }

  b.push({ kind: 'text', text: 'FIM DA COMANDA', align: 'center', bold: true });
  if (r.ticket_footer) b.push({ kind: 'text', text: r.ticket_footer, align: 'center' });
  return b;
}

export { PAY_LABEL };

/** Quebra de linha por palavras. */
export function wrap(text: string, cols: number): string[] {
  cols = Math.max(4, Math.floor(cols)); // largura mínima: evita laço infinito com colunas ≤ 0
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (w.length > cols) {
        if (line) { out.push(line); line = ''; }
        out.push(w.slice(0, cols));
        w = w.slice(cols);
      }
      if (!line) line = w;
      else if ((line + ' ' + w).length <= cols) line += ' ' + w;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
