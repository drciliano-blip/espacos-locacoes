import type { Receita } from '@/contexts/ReceitasContext'
import type { Fechamento } from '@/contexts/FechamentosContext'
import type { ContaPagar } from '@/types'
import { formatDate } from '@/lib/utils'

// Data usada pra encaixar um lançamento num período: se já foi pago/recebido,
// é a data real do pagamento/recebimento — não o vencimento original. Uma
// conta paga antes de vencer precisa contar no período em que o dinheiro
// realmente saiu, senão o Financeiro (que filtra por período) fica menor que
// o total de Contas Pagas (que não filtra por período por padrão) sempre que
// existir pagamento antecipado. Vive aqui (não em fechamento-calc.ts, que
// importa de dentro dos contexts) pra ReceitasContext/ContasPagarContext
// poderem usar a mesma regra na hora de checar a trava de período fechado,
// sem criar import circular entre eles e fechamento-calc.ts.
export function dataEfetivaReceita(r: Pick<Receita, 'status' | 'data' | 'dataRecebimento'>): string {
  return r.status === 'pago' && r.dataRecebimento ? r.dataRecebimento : r.data
}
export function dataEfetivaConta(c: Pick<ContaPagar, 'status' | 'dataVencimento' | 'dataPagamento'>): string {
  return c.status === 'pago' && c.dataPagamento ? c.dataPagamento : c.dataVencimento
}

// Um espaço pode ter vários fechamentos (meses diferentes) — acha o que
// cobre essa data específica, se existir.
export function periodoFechado(fechamentos: Fechamento[], espaco: string | undefined, data: string): Fechamento | undefined {
  if (!espaco) return undefined
  return fechamentos.find(f => f.espaco === espaco && data >= f.dataInicio && data <= f.dataFim)
}

export function mensagemPeriodoFechado(f: Fechamento): string {
  return `Este lançamento está dentro de um período já fechado em ${f.espaco} (${formatDate(f.dataInicio)} a ${formatDate(f.dataFim)}). Reabra o fechamento em Financeiro para editar.`
}
