'use client';
import { useCallback, useEffect, useState } from 'react';

export interface CartLine {
  key: string;
  productId: string;
  name: string;
  unitCents: number; // estimativa para exibição; o servidor recalcula tudo
  quantity: number;
  optionIds: string[];
  optionLabels: string[];
  notes: string;
}

const KEY = 'cardapio:cart:v1';

export function lineKey(productId: string, optionIds: string[], notes: string) {
  return [productId, [...optionIds].sort().join(','), notes.trim().toLowerCase()].join('|');
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setLines(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { /* sem storage: segue vazio */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* ignore */ }
  }, [lines, ready]);

  const add = useCallback((l: Omit<CartLine, 'key'>) => {
    const key = lineKey(l.productId, l.optionIds, l.notes);
    setLines((cur) => {
      const i = cur.findIndex((x) => x.key === key);
      if (i >= 0) return cur.map((x, j) => (j === i ? { ...x, quantity: Math.min(99, x.quantity + l.quantity) } : x));
      return [...cur, { ...l, key }];
    });
  }, []);
  const setQty = useCallback((key: string, q: number) =>
    setLines((cur) => (q <= 0 ? cur.filter((x) => x.key !== key) : cur.map((x) => (x.key === key ? { ...x, quantity: Math.min(99, q) } : x)))), []);
  const remove = useCallback((key: string) => setLines((cur) => cur.filter((x) => x.key !== key)), []);
  const setNotes = useCallback((key: string, notes: string) => setLines((cur) => cur.map((x) => (x.key === key ? { ...x, notes } : x))), []);
  const clear = useCallback(() => setLines([]), []);

  const count = lines.reduce((a, l) => a + l.quantity, 0);
  const subtotal = lines.reduce((a, l) => a + l.quantity * l.unitCents, 0);
  return { lines, ready, add, setQty, remove, setNotes, clear, count, subtotal };
}
