/* eslint-disable @next/next/no-img-element */
import type { Block } from '@/lib/ticket';

/** Renderiza o mesmo modelo da comanda usado no ESC/POS, em HTML. */
export function TicketView({ blocks }: { blocks: Block[] }) {
  return (
    <div className="ticket">
      {blocks.map((b, i) => {
        if (b.kind === 'space') return <div key={i} className="t-space" />;
        if (b.kind === 'rule') return <hr key={i} className={b.char === '=' ? 't-rule-strong' : 't-rule'} />;
        if (b.kind === 'logo') return <img key={i} src={b.url} alt="" className="t-logo" />;
        if (b.kind === 'pair') return <div key={i} className="t-pair" style={{ fontWeight: b.bold ? 800 : 500 }}><span>{b.left}</span><span>{b.right}</span></div>;
        return (
          <div key={i} className={`t-text ${b.invert ? 't-invert' : ''} ${b.size === 2 ? 't-xl' : b.size === 'tall' ? 't-lg' : ''}`}
            style={{ textAlign: b.align ?? 'left', fontWeight: b.bold ? 800 : 500, paddingLeft: b.indent ? `${b.indent * 0.45}em` : undefined }}>
            {b.text}
          </div>
        );
      })}
    </div>
  );
}
