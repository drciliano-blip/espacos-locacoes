import { isReceitaOperacional } from '@/contexts/ReceitasContext'
import { isDespesaOperacional, isDespesaObra } from '@/contexts/ContasPagarContext'
import { SOCIOS_OBRA, INVESTIMENTOS_SOCIETARIOS, type InvestimentoSocietario } from '@/lib/socios-config'
import type { Receita } from '@/contexts/ReceitasContext'
import type { ContaPagar } from '@/types'

// Lógica compartilhada entre Relatórios (RelatorioMensalSection) e a aba
// Fechamento — extraída aqui pra garantir que as duas telas SEMPRE mostrem os
// mesmos números (Resultado Operacional, Obra, Fundo de Caixa). Nunca duplicar
// esses cálculos direto num componente — sempre passar por aqui.

interface FiltroFechamento {
  selectedSpaces?: string[]
  dataInicio?: string
  dataFim?: string
}

function somaPaga<T>(arr: T[], pred: (x: T) => boolean, valor: (x: T) => number, status: (x: T) => string): number {
  return arr.reduce((s, x) => s + (pred(x) && status(x) === 'pago' ? valor(x) : 0), 0)
}

export interface ObraEspacoResumo {
  nome: string
  totalDespesas: number
  totalAportes: number
  saldo: number
  porSocio: { nome: string; valor: number }[]
  despesasCount: number
  aportesCount: number
  investimentos: InvestimentoSocietario[]
}

export interface FechamentoResultado {
  // Resultado Operacional (período filtrado)
  entradasOperacionais: Receita[]
  totalEntradas: number
  despesasOperacionais: ContaPagar[]
  totalSaidas: number
  totalPorCategoriaDespesa: (categoria: string) => number
  resultado: number

  // Movimentações Societárias (período filtrado)
  aportes: Receita[]
  totalAportes: number
  retiradasSocio: ContaPagar[]
  totalRetiradasSocio: number

  // Controle de Caixa (período filtrado)
  outrasEntradas: Receita[]
  totalOutrasEntradas: number
  transferenciasFundo: ContaPagar[]
  totalTransferenciasFundo: number
  retornosFundo: Receita[]
  totalRetornosFundo: number

  // Obra (período filtrado) — despesa de obra e aporte pra obra nunca contam
  // como despesa/receita operacional.
  aportesObra: Receita[]
  despesasObra: ContaPagar[]

  // Fundo de Caixa — acumulado desde o início, só respeita filtro de espaço
  // (não período), porque é saldo de reserva, não resultado de um mês.
  saldoFundoAtual: number
  saldoDisponivelForaFundo: number

  // Disponível para Distribuição (período filtrado) — só esse valor deve
  // alimentar o cálculo de repasse aos sócios, nunca o Resultado bruto.
  disponivelParaDistribuicao: number

  // Fechamento da Obra — acumulado desde o início, só por espaço com obra.
  obraPorEspaco: ObraEspacoResumo[]
}

export function calcularFechamento(
  receitas: Receita[],
  contasPagar: ContaPagar[],
  { selectedSpaces, dataInicio, dataFim }: FiltroFechamento,
  espacosEmEscopo: { nome: string }[],
): FechamentoResultado {
  const entradas = receitas.filter(r => {
    const matchEspaco = !selectedSpaces?.length || (r.espaco && selectedSpaces.includes(r.espaco))
    const matchInicio = !dataInicio || r.data >= dataInicio
    const matchFim = !dataFim || r.data <= dataFim
    return matchEspaco && matchInicio && matchFim
  })
  const saidas = contasPagar.filter(c => {
    const matchEspaco = !selectedSpaces?.length || selectedSpaces.includes(c.espaco)
    const matchInicio = !dataInicio || c.dataVencimento >= dataInicio
    const matchFim = !dataFim || c.dataVencimento <= dataFim
    return matchEspaco && matchInicio && matchFim
  })

  const entradasOperacionais = entradas.filter(isReceitaOperacional)
  const aportes = entradas.filter(r => r.tipoEntrada === 'aporte_societario')
  const outrasEntradas = entradas.filter(r => r.tipoEntrada === 'outras_entradas')
  const retornosFundo = entradas.filter(r => r.tipoEntrada === 'retorno_fundo_caixa')

  const despesasOperacionais = saidas.filter(isDespesaOperacional)
  const retiradasSocio = saidas.filter(c => c.categoria === 'retirada_socio')
  const transferenciasFundo = saidas.filter(c => c.categoria === 'fundo_caixa')
  const aportesObra = entradas.filter(r => r.tipoEntrada === 'aporte_obra')
  const despesasObra = saidas.filter(isDespesaObra)

  const totalEntradas = entradasOperacionais.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
  const totalAportes = aportes.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
  const totalOutrasEntradas = outrasEntradas.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
  const totalRetornosFundo = retornosFundo.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)

  const totalSaidas = despesasOperacionais.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
  const totalPorCategoriaDespesa = (categoria: string) =>
    despesasOperacionais.filter(c => c.categoria === categoria && c.status === 'pago').reduce((s, c) => s + c.valor, 0)
  const totalRetiradasSocio = retiradasSocio.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
  const totalTransferenciasFundo = transferenciasFundo.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)

  const resultado = totalEntradas - totalSaidas

  // Fundo de Caixa é cumulativo (desde sempre), não travado ao período — senão
  // o saldo "reiniciaria" toda vez que o período do relatório mudasse.
  const entradasAllTime = receitas.filter(r => !selectedSpaces?.length || (r.espaco && selectedSpaces.includes(r.espaco)))
  const saidasAllTime = contasPagar.filter(c => !selectedSpaces?.length || selectedSpaces.includes(c.espaco))

  const fundoTransfersAllTime = somaPaga(saidasAllTime, c => c.categoria === 'fundo_caixa', c => c.valor, c => c.status)
  const fundoReturnsAllTime = somaPaga(entradasAllTime, r => r.tipoEntrada === 'retorno_fundo_caixa', r => r.valor, r => r.status)
  const saldoFundoAtual = fundoTransfersAllTime - fundoReturnsAllTime

  const entradasOperAllTime = somaPaga(entradasAllTime, isReceitaOperacional, r => r.valor, r => r.status)
  const outrasAllTime = somaPaga(entradasAllTime, r => r.tipoEntrada === 'outras_entradas', r => r.valor, r => r.status)
  const aportesAllTime = somaPaga(entradasAllTime, r => r.tipoEntrada === 'aporte_societario', r => r.valor, r => r.status)
  const despesasOperAllTime = somaPaga(saidasAllTime, isDespesaOperacional, c => c.valor, c => c.status)
  const retiradasAllTime = somaPaga(saidasAllTime, c => c.categoria === 'retirada_socio', c => c.valor, c => c.status)

  const saldoDisponivelForaFundo =
    entradasOperAllTime + outrasAllTime + aportesAllTime + fundoReturnsAllTime
    - despesasOperAllTime - retiradasAllTime - fundoTransfersAllTime

  // Disponível para Distribuição: Resultado Operacional do período menos o que
  // entrou em fundo/reserva no período mais o que voltou do fundo no período.
  // Transferir pro Fundo de Caixa não é despesa (por isso não mexe no
  // Resultado), mas reduz o quanto sobra pra repassar aos sócios agora.
  const disponivelParaDistribuicao = resultado - totalTransferenciasFundo + totalRetornosFundo

  const obraPorEspaco = calcularObraPorEspaco(entradasAllTime, saidasAllTime, espacosEmEscopo)

  return {
    entradasOperacionais, totalEntradas, despesasOperacionais, totalSaidas, totalPorCategoriaDespesa, resultado,
    aportes, totalAportes, retiradasSocio, totalRetiradasSocio,
    outrasEntradas, totalOutrasEntradas, transferenciasFundo, totalTransferenciasFundo, retornosFundo, totalRetornosFundo,
    aportesObra, despesasObra,
    saldoFundoAtual, saldoDisponivelForaFundo, disponivelParaDistribuicao,
    obraPorEspaco,
  }
}

function calcularObraPorEspaco(
  entradasAllTime: Receita[],
  saidasAllTime: ContaPagar[],
  espacosEmEscopo: { nome: string }[],
): ObraEspacoResumo[] {
  const nomesComObra = new Set<string>([
    ...Object.keys(SOCIOS_OBRA),
    ...saidasAllTime.filter(isDespesaObra).map(c => c.espaco),
    ...entradasAllTime.filter(r => r.tipoEntrada === 'aporte_obra' && r.espaco).map(r => r.espaco as string),
  ])
  return espacosEmEscopo.filter(e => nomesComObra.has(e.nome)).map(e => {
    const despesasEspaco = saidasAllTime.filter(c => c.espaco === e.nome && isDespesaObra(c))
    const aportesEspaco = entradasAllTime.filter(r => r.espaco === e.nome && r.tipoEntrada === 'aporte_obra')
    const totalDespesas = despesasEspaco.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
    const totalAportes = aportesEspaco.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
    const saldo = totalAportes - totalDespesas
    const porSocioMap = new Map<string, number>()
    for (const nome of SOCIOS_OBRA[e.nome] ?? []) porSocioMap.set(nome, 0)
    for (const r of aportesEspaco) {
      if (r.status !== 'pago' || !r.socioResponsavel) continue
      porSocioMap.set(r.socioResponsavel, (porSocioMap.get(r.socioResponsavel) ?? 0) + r.valor)
    }
    const porSocio = Array.from(porSocioMap.entries()).map(([nome, valor]) => ({ nome, valor }))
    return {
      nome: e.nome, totalDespesas, totalAportes, saldo, porSocio,
      despesasCount: despesasEspaco.length, aportesCount: aportesEspaco.length,
      investimentos: INVESTIMENTOS_SOCIETARIOS[e.nome] ?? [],
    }
  })
}
