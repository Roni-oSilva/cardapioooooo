import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getStaff } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ticketFor } from '@/lib/print';
import { TicketView } from '@/components/TicketView';
import { PrintToolbar } from '@/components/PrintToolbar';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Comanda', robots: { index: false } };

const PAPER = {
  '58': { size: '58mm auto', margin: '2mm 2mm', width: '54mm', font: 11 },
  '80': { size: '80mm auto', margin: '3mm 3mm', width: '74mm', font: 13 },
  a4: { size: 'A4', margin: '14mm', width: '150mm', font: 15 },
} as const;

export default async function Comanda({ params, searchParams }: { params: { id: string }; searchParams: { via?: string; paper?: string; reprint?: string; auto?: string } }) {
  if (!(await getStaff())) redirect('/login');
  const via = searchParams.via === 'atendimento' ? 'atendimento' : 'cozinha';
  const paper = (['58', '80', 'a4'].includes(searchParams.paper ?? '') ? searchParams.paper : '80') as keyof typeof PAPER;
  const t = await ticketFor(params.id, via, searchParams.reprint === '1');
  if (!t) notFound();
  const p = PAPER[paper];
  const css = `
    @page { size: ${p.size}; margin: ${p.margin}; }
    .sheet { width: ${p.width}; font-size: ${p.font}px; }
    .ticket { color: #000; font-family: 'Poppins', Arial, sans-serif; line-height: 1.25; }
    .t-text { white-space: pre-wrap; overflow-wrap: anywhere; margin: .1em 0; }
    .t-lg { font-size: 1.35em; line-height: 1.15; } .t-xl { font-size: 1.7em; line-height: 1.1; font-family: 'Archivo Variable', Arial Black, sans-serif; }
    .t-invert { background: #000; color: #fff; padding: .15em .3em; margin: .3em 0; }
    .t-pair { display: flex; justify-content: space-between; align-items: baseline; gap: .6em; margin: .1em 0; } .t-pair span:first-child { white-space: nowrap; flex-shrink: 0; } .t-pair span:last-child { text-align: right; min-width: 0; overflow-wrap: anywhere; }
    .t-rule { border: 0; border-top: 1px dashed #000; margin: .45em 0; } .t-rule-strong { border: 0; border-top: 2px solid #000; margin: .5em 0; }
    .t-space { height: .5em; } .t-logo { display: block; margin: 0 auto .4em; max-height: 3.2em; filter: grayscale(1) contrast(1.4); }
    @media screen { .paper-bg { background: #d9d5cb; min-height: 100dvh; } .sheet { background: #fff; margin: 1.5rem auto; padding: 1rem; box-shadow: 0 8px 30px rgba(0,0,0,.25); } }
    @media print { html, body { background: #fff !important; } .no-print { display: none !important; } .paper-bg { background: #fff; } .sheet { margin: 0; padding: 0; box-shadow: none; } }
  `;
  return (
    <div className="paper-bg fixed inset-0 z-[100] overflow-auto print:static print:overflow-visible">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <Suspense><PrintToolbar number={t.order.number} auto={searchParams.auto === '1'} /></Suspense>
      <div className="sheet"><TicketView blocks={t.blocks} /></div>
    </div>
  );
}
