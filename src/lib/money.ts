export const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const STATUS_LABEL: Record<string, string> = {
  recebido: 'Recebido',
  aguardando_impressao: 'Aguardando impressão',
  em_preparo: 'Em preparação',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const SERVICE_LABEL: Record<string, string> = { salao: 'Salão', retirada: 'Retirada', entrega: 'Entrega' };
export const PAY_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', pix: 'Pix', vale: 'Vale-refeição', outro: 'Outro',
};
