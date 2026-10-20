import { Block, wrap } from './ticket';

// CP850 (página de código 2 na maioria das térmicas): acentos do português.
const CP850: Record<string, number> = Object.fromEntries(
  Object.entries({
    'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'ç': 0x87, 'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b,
    'î': 0x8c, 'ì': 0x8d, 'Ä': 0x8e, 'É': 0x90, 'ô': 0x93, 'ö': 0x94, 'ò': 0x95, 'û': 0x96, 'ù': 0x97, 'Ö': 0x99, 'Ü': 0x9a,
    '£': 0x9c, 'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5, 'ª': 0xa6, 'º': 0xa7, '¿': 0xa8, '¡': 0xad,
    'Á': 0xb5, 'Â': 0xb6, 'À': 0xb7, 'ã': 0xc6, 'Ã': 0xc7, 'Ê': 0xd2, 'Ë': 0xd3, 'È': 0xd4, 'Í': 0xd6, 'Î': 0xd7, 'Ï': 0xd8,
    'Ó': 0xe0, 'Ô': 0xe2, 'Ò': 0xe3, 'õ': 0xe4, 'Õ': 0xe5, 'Ú': 0xe9, 'Û': 0xea, 'Ù': 0xeb, '°': 0xf8, '²': 0xfd,
    '—': 0x2d, '–': 0x2d, '•': 0x2a, '“': 0x22, '”': 0x22, '‘': 0x27, '’': 0x27, '×': 0x78,
  }),
);

export function encodeCp850(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (CP850[ch] !== undefined) out.push(CP850[ch]);
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      out.push(base.codePointAt(0)! < 0x80 && base ? base.charCodeAt(0) : 0x3f);
    }
  }
  return out;
}

export const COLS = { '58': 32, '80': 48, a4: 80 } as const;
export type Paper = keyof typeof COLS;

const ESC = 0x1b, GS = 0x1d, LF = 0x0a;

/** Gera os bytes ESC/POS para impressoras térmicas de 58 mm (32 colunas) e 80 mm (48 colunas). */
export function toEscPos(blocks: Block[], paper: '58' | '80'): Buffer {
  const cols = COLS[paper];
  const bytes: number[] = [ESC, 0x40, ESC, 0x74, 0x02]; // reset + CP850
  const push = (...b: number[]) => bytes.push(...b);
  const line = (txt: string) => { bytes.push(...encodeCp850(txt)); push(LF); };

  for (const bl of blocks) {
    if (bl.kind === 'logo') continue;
    if (bl.kind === 'space') { push(LF); continue; }
    if (bl.kind === 'rule') { push(ESC, 0x61, 0); line(bl.char.repeat(cols)); continue; }
    if (bl.kind === 'pair') {
      push(ESC, 0x61, 0, ESC, 0x45, bl.bold ? 1 : 0);
      const gap = 1;
      let l = bl.left, r = bl.right;
      if (l.length + r.length + gap > cols) {
        const rows = wrap(l, cols - r.length - gap - 1);
        rows.slice(0, -1).forEach(line);
        l = rows[rows.length - 1] ?? '';
        if (l.length + r.length + gap > cols) { line(l); l = ''; }
      }
      line(l + ' '.repeat(Math.max(gap, cols - l.length - r.length)) + r);
      push(ESC, 0x45, 0);
      continue;
    }
    const wide = bl.size === 2;
    const sizeByte = bl.size === 2 ? 0x11 : bl.size === 'tall' ? 0x01 : 0x00;
    const eff = wide ? Math.floor(cols / 2) : cols;
    push(ESC, 0x61, bl.align === 'center' ? 1 : 0, ESC, 0x45, bl.bold ? 1 : 0, GS, 0x21, sizeByte, GS, 0x42, bl.invert ? 1 : 0);
    const indent = bl.indent ?? 0;
    for (const row of wrap(bl.text, eff - indent)) line(' '.repeat(indent) + row);
    push(GS, 0x42, 0, GS, 0x21, 0, ESC, 0x45, 0, ESC, 0x61, 0);
  }
  push(ESC, 0x64, 4, GS, 0x56, 0x42, 0x03); // avanço + corte parcial
  return Buffer.from(bytes);
}

/** Texto puro (UTF-8) para impressoras convencionais via spooler (CUPS/Windows). */
export function toPlainText(blocks: Block[], cols = 64): string {
  const out: string[] = [];
  for (const bl of blocks) {
    if (bl.kind === 'logo') continue;
    if (bl.kind === 'space') out.push('');
    else if (bl.kind === 'rule') out.push(bl.char.repeat(cols));
    else if (bl.kind === 'pair') out.push(bl.left + ' '.repeat(Math.max(1, cols - bl.left.length - bl.right.length)) + bl.right);
    else {
      const eff = bl.size === 2 ? Math.floor(cols / 2) : cols;
      for (const row of wrap(bl.text, eff - (bl.indent ?? 0))) {
        const t = ' '.repeat(bl.indent ?? 0) + row;
        out.push(bl.align === 'center' ? ' '.repeat(Math.max(0, Math.floor((cols - t.length) / 2))) + t : t);
      }
    }
  }
  return out.join('\n') + '\n\n\n';
}
