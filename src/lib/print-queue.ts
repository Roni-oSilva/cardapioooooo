import type { PoolClient } from 'pg';

/**
 * Cria um job por impressora ativa. Retorna quantos jobs foram enfileirados.
 * Sem impressoras configuradas nada é enfileirado — a comanda continua disponível pelo botão "Imprimir comanda".
 */
export async function enqueuePrint(
  c: PoolClient, orderId: string, opts: { reprint?: boolean; requestedBy?: string | null; copyType?: 'cozinha' | 'atendimento' } = {},
) {
  const r = await c.query(
    `INSERT INTO print_jobs(order_id, printer_id, copy_type, paper, target, is_reprint, requested_by)
     SELECT $1, p.id, p.copy_type, p.paper, p.target, $2, $3 FROM printers p
     WHERE p.active AND ($4::text IS NULL OR p.copy_type = $4)
     RETURNING id, copy_type`,
    [orderId, !!opts.reprint, opts.requestedBy ?? null, opts.copyType ?? null]);
  return { count: r.rowCount ?? 0, kitchen: r.rows.some((x) => x.copy_type === 'cozinha') };
}
