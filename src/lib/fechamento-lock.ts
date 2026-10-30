import type { Receita } from '@/contexts/ReceitasContext'
import type { Fechamento } from '@/contexts/FechamentosContext'
import type { ContaPagar } from '@/types'
import { formatDate, hojeISO } from '@/lib/utils'

// Data usada pra encaixar um lançamento num período: se já foi pago/recebido,
// é a data real do pagamento/recebimento — não o vencimento original. Uma
// conta paga antes de vencer precisa contar no período em que o dinheiro
// realmente saiu, senão o Financeiro (que filtra por período) fica menor que
// o total de Contas Pagas (que não filtra por período por padrão) sempre que
// existir pagamento antecipado. Vive aqui (não em fechamento-calc.ts, que
// importa de dentro dos contexts) pra ReceitasContext/ContasPagarContext
// poderem usar a mesma regra na hora de checar a trava de período fechado,
// sem criar import circular entre eles e fechamento-calc.ts.
// Recebimento com mês de competência escolhido (dataCompetencia, dia 1º)
// conta nesse mês, não no do pagamento — ex.: sinal pago em outubro de um
// evento de dezembro, que os sócios querem contabilizar em dezembro.
export function dataEfetivaReceita(r: Pick<Receita, 'status' | 'data' | 'dataRecebimento'> & { dataCompetencia?: string | null }): string {
  if (r.dataCompetencia) return r.dataCompetencia
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

// Só lançamento PAGO pesa num fechamento (fechamento-calc.ts soma apenas
// 'pago'); pendente vale R$ 0,00 em qualquer período. Então a trava só barra
// quando a mudança TIRA dinheiro reconhecido de um período fechado (`antes`
// pago lá) ou PÕE dinheiro num período fechado (`depois` pago lá). Dar baixa
// hoje numa parcela que venceu num mês já fechado não mexe nesse mês — o
// dinheiro entra no período do pagamento — e não pode ser barrado.
export interface EstadoLancamento { espaco: string | undefined; pago: boolean; data: string }
export function bloqueioPorFechamento(fechamentos: Fechamento[], antes: EstadoLancamento | null, depois: EstadoLancamento | null): Fechamento | undefined {
  if (antes?.pago) {
    const f = periodoFechado(fechamentos, antes.espaco, antes.data)
    if (f) return f
  }
  if (depois?.pago) {
    const f = periodoFechado(fechamentos, depois.espaco, depois.data)
    if (f) return f
  }
  return undefined
}

export function mensagemPeriodoFechado(f: Fechamento): string {
  return `Este lançamento está dentro de um período já fechado em ${f.espaco} (${formatDate(f.dataInicio)} a ${formatDate(f.dataFim)}). Reabra o fechamento em Financeiro para editar.`
}

// ── Período de um novo fechamento ──────────────────────────────────────────
// Contas com 'YYYY-MM-DD' sempre no calendário local: new Date('2026-08-31')
// é meia-noite UTC = 30/08 21h em Brasília, e o "dia seguinte" saía 31/08 —
// o período novo começava um dia antes e sobrepunha o anterior.
const pad = (n: number) => String(n).padStart(2, '0')
const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
function deISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function diaSeguinteISO(iso: string): string {
  const d = deISO(iso)
  d.setDate(d.getDate() + 1)
  return isoLocal(d)
}
export function ultimoDiaDoMesISO(iso: string): string {
  const d = deISO(iso)
  return isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}
export function ehMesCheio(dataInicio: string, dataFim: string): boolean {
  return !!dataInicio && dataInicio.slice(8) === '01' && dataFim === ultimoDiaDoMesISO(dataInicio)
}

// Pode fechar o mês cheio ou um período escolhido, mas sempre um período que
// JÁ terminou: fechar agosto no dia 01/09 com o período indo "até hoje" levava
// o dia 01/09 junto pra agosto. Bloqueios impedem o fechamento; avisos só
// pedem atenção.
export function problemasDoPeriodo(
  fechamentos: Fechamento[], espaco: string, dataInicio: string, dataFim: string,
): { bloqueios: string[]; avisos: string[] } {
  const bloqueios: string[] = []
  const avisos: string[] = []
  if (!dataInicio || !dataFim || dataInicio > dataFim) {
    bloqueios.push('Período inválido: escolha a data inicial e a final (a inicial antes da final).')
    return { bloqueios, avisos }
  }
  if (dataFim >= hojeISO()) {
    bloqueios.push(`O período vai até ${formatDate(dataFim)}, que ainda não terminou — os lançamentos desse dia entrariam neste fechamento. Escolha uma data final até ontem, ou feche a partir de ${formatDate(diaSeguinteISO(dataFim))}.`)
  }
  const doEspaco = fechamentos.filter(f => f.espaco === espaco)
  const sobreposto = doEspaco.find(f => dataInicio <= f.dataFim && dataFim >= f.dataInicio)
  if (sobreposto) {
    bloqueios.push(`Esse período se sobrepõe ao fechamento já feito de ${formatDate(sobreposto.dataInicio)} a ${formatDate(sobreposto.dataFim)} — os mesmos lançamentos contariam duas vezes.`)
  }
  const anterior = doEspaco.filter(f => f.dataFim < dataInicio).sort((a, b) => b.dataFim.localeCompare(a.dataFim))[0]
  if (anterior && diaSeguinteISO(anterior.dataFim) !== dataInicio) {
    avisos.push(`O último fechamento terminou em ${formatDate(anterior.dataFim)} e este começa em ${formatDate(dataInicio)} — os dias entre eles ficam sem fechamento.`)
  }
  return { bloqueios, avisos }
}
