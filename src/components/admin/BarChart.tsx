'use client';
import { useState } from 'react';
import { brl } from '@/lib/money';

interface Point { label: string; received: number; registered: number; orders: number }

/** Gráfico de barras em SVG: recebido (sólido) x registrado (contorno). Acessível via tabela e tooltips. */
export function BarChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.received, d.registered)));
  const W = 720, H = 220, PAD = { l: 8, r: 8, t: 12, b: 26 };
  const bw = (W - PAD.l - PAD.r) / data.length;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const every = Math.ceil(data.length / 12);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Faturamento por período">
        {[0, 0.5, 1].map((t) => <line key={t} x1={PAD.l} x2={W - PAD.r} y1={y(max * t)} y2={y(max * t)} stroke="#6c170b" strokeOpacity=".12" />)}
        {data.map((d, i) => {
          const x = PAD.l + i * bw;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${d.label}: recebido ${brl(d.received)}, registrado ${brl(d.registered)}`}>
              <rect x={x} y={0} width={bw} height={H} fill="transparent" />
              <rect x={x + bw * 0.12} width={bw * 0.76} y={y(d.registered)} height={Math.max(0, H - PAD.b - y(d.registered))} rx="4" fill="none" stroke="#6c170b" strokeOpacity=".45" strokeDasharray="3 3" />
              <rect x={x + bw * 0.2} width={bw * 0.6} y={y(d.received)} height={Math.max(0, H - PAD.b - y(d.received))} rx="4" fill={hover === i ? '#d9522b' : '#6c170b'} />
              {i % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6c170b" fillOpacity=".7">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-xl bg-wine-800 px-3 py-2 text-xs text-cream-100 shadow-lg">
          <b>{data[hover].label}</b> · recebido {brl(data[hover].received)} · registrado {brl(data[hover].registered)} · {data[hover].orders} pedido(s)
        </div>
      )}
      <div className="mt-2 flex gap-4 text-xs text-wine-700/80">
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded bg-wine-700" />Recebido</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded border border-dashed border-wine-700" />Registrado (pedidos)</span>
      </div>
    </div>
  );
}
