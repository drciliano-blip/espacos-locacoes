import { isReceitaOperacional } from '@/contexts/ReceitasContext'
import { isDespesaOperacional, isDespesaObra } from '@/contexts/ContasPagarContext'
import { SOCIOS_OBRA, INVESTIMENTOS_SOCIETARIOS, nomeCanonicoSocio, type InvestimentoSocietario } from '@/lib/socios-config'
import type { Receita } from '@/contexts/ReceitasContext'
import type { Fundo, MovimentacaoFundo } from '@/contexts/FundosContext'
import type { ContaPagar } from '@/types'

// Toda a aritmética financeira do sistema (Resultado Operacional, Obra,
// Fundo de Caixa/Reservas, Disponível para Distribuição) fica aqui, extraída
// do componente Financeiro — nunca duplicar esses cálculos direto numa tela,
// sempre passar por aqui.

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

  // Obra (período filtrado) — o Aporte Societário de um espaço com obra JÁ É
  // a receita da obra (não é um lançamento separado); despesa de obra nunca
  // conta como despesa operacional.
  aportesObra: Receita[]
  despesasObra: ContaPagar[]

  // Fundo de Caixa — acumulado desde o início, só respeita filtro de espaço
  // (não período), porque é saldo de reserva, não resultado de um mês.
  saldoFundoAtual: number
  saldoDisponivelForaFundo: number

  // Saldo atual (acumulado, nunca travado ao período) dos fundos/reservas
  // genéricos — Reserva Impostos, Reserva Obra etc. Nunca inclui o Fundo de
  // Caixa (esse é saldoFundoAtual).
  totalReservasGenericas: number

  // Resultado Operacional acumulado desde sempre (dentro do escopo de espaço
  // filtrado) — usado só pra compor Disponível para Distribuição abaixo,
  // nunca pro card "Resultado Operacional" do topo (esse é o `resultado`
  // travado ao período do FilterBar).
  resultadoAcumulado: number

  // Total retirado pelos sócios desde sempre (dentro do escopo de espaço
  // filtrado) — inclui toda retirada paga, venha de lançamento manual ou de
  // Contas Pagas classificada como Retirada Sócio (sem distinção, sem
  // duplicidade: cada retirada é uma linha só). Usado pra compor Disponível
  // para Distribuição.
  totalRetiradasSocioAcumulado: number

  // Disponível do Espaço — subtotal intermediário: Resultado Operacional
  // acumulado menos tudo que está reservado agora (Fundo de Caixa + reservas
  // genéricas). Não é uma dedução, é o resultado depois de descontar as
  // reservas — a partir daqui é que se desconta o que os sócios já retiraram.
  disponivelDoEspaco: number

  // Disponível para Distribuição — é uma posição atual, não um fluxo de
  // período: Disponível do Espaço menos tudo que os sócios já retiraram.
  // Dinheiro reservado ou já retirado nunca é distribuível de novo. Só esse
  // valor deve alimentar o cálculo de repasse aos sócios, nunca o Resultado
  // bruto.
  disponivelParaDistribuicao: number

  // Mesma conta do disponivelParaDistribuicao, mas por espaço individual —
  // alimenta a divisão societária (% de cada sócio). Só entram fundos
  // vinculados àquele espaço específico (um fundo sem espaço é da empresa
  // toda, não dá pra atribuir a um espaço só).
  disponivelPorEspaco: { nome: string; disponivel: number }[]

  // Fechamento da Obra — acumulado desde o início, só por espaço com obra.
  obraPorEspaco: ObraEspacoResumo[]
}

// Data usada pra encaixar um lançamento num período: se já foi pago/recebido,
// é a data real do pagamento/recebimento — não o vencimento original. Uma
// conta paga antes de vencer precisa contar no período em que o dinheiro
// realmente saiu, senão o Financeiro (que filtra por período) fica menor que
// o total de Contas Pagas (que não filtra por período por padrão) sempre que
// existir pagamento antecipado.
function dataEfetivaReceita(r: Receita): string {
  return r.status === 'pago' && r.dataRecebimento ? r.dataRecebimento : r.data
}
function dataEfetivaConta(c: ContaPagar): string {
  return c.status === 'pago' && c.dataPagamento ? c.dataPagamento : c.dataVencimento
}

// Net (entradas − saídas) das reservas genéricas (Reserva Impostos, Reserva
// Obra etc. — nunca o Fundo de Caixa) dentro de um período, escopado a um
// conjunto de fundos já filtrado por espaço.
export function reservasGenericasNoPeriodo(
  fundosEmEscopo: Fundo[],
  movimentacoes: MovimentacaoFundo[],
  dataInicio?: string,
  dataFim?: string,
): number {
  const idsEmEscopo = new Set(fundosEmEscopo.map(f => f.id))
  const movs = movimentacoes.filter(m =>
    idsEmEscopo.has(m.fundoId) && (!dataInicio || m.data >= dataInicio) && (!dataFim || m.data <= dataFim),
  )
  return movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
    - movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
}

export function calcularFechamento(
  receitas: Receita[],
  contasPagar: ContaPagar[],
  { selectedSpaces, dataInicio, dataFim }: FiltroFechamento,
  espacosEmEscopo: { nome: string }[],
  fundos: Fundo[] = [],
  movimentacoesFundo: MovimentacaoFundo[] = [],
): FechamentoResultado {
  const entradas = receitas.filter(r => {
    const matchEspaco = !selectedSpaces?.length || (r.espaco && selectedSpaces.includes(r.espaco))
    const data = dataEfetivaReceita(r)
    const matchInicio = !dataInicio || data >= dataInicio
    const matchFim = !dataFim || data <= dataFim
    return matchEspaco && matchInicio && matchFim
  })
  const saidas = contasPagar.filter(c => {
    const matchEspaco = !selectedSpaces?.length || selectedSpaces.includes(c.espaco)
    const data = dataEfetivaConta(c)
    const matchInicio = !dataInicio || data >= dataInicio
    const matchFim = !dataFim || data <= dataFim
    return matchEspaco && matchInicio && matchFim
  })

  const entradasOperacionais = entradas.filter(isReceitaOperacional)
  const aportes = entradas.filter(r => r.tipoEntrada === 'aporte_societario')
  const outrasEntradas = entradas.filter(r => r.tipoEntrada === 'outras_entradas')
  const retornosFundo = entradas.filter(r => r.tipoEntrada === 'retorno_fundo_caixa')

  const despesasOperacionais = saidas.filter(isDespesaOperacional)
  const retiradasSocio = saidas.filter(c => c.categoria === 'retirada_socio')
  const transferenciasFundo = saidas.filter(c => c.categoria === 'fundo_caixa')
  const despesasObra = saidas.filter(isDespesaObra)

  // Quais espaços têm obra — usado tanto pro Fechamento da Obra quanto pra
  // escopar "Aportes para Obra": o Aporte Societário JÁ é a receita da obra
  // (não existe um tipo de lançamento manual separado pra isso), então só
  // conta como aporte de obra o aporte de um espaço que efetivamente tem
  // obra (evita que um aporte qualquer de outro espaço apareça aqui).
  // 'aporte_obra' continua reconhecido por compatibilidade com lançamentos
  // antigos feitos antes dessa unificação.
  const nomesComObra = new Set<string>([
    ...Object.keys(SOCIOS_OBRA),
    ...contasPagar.filter(isDespesaObra).map(c => c.espaco),
  ])
  const aportesObra = entradas.filter(r =>
    r.espaco && nomesComObra.has(r.espaco) && (r.tipoEntrada === 'aporte_societario' || r.tipoEntrada === 'aporte_obra'),
  )

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

  // Fundos genéricos (Reserva Impostos, Reserva Obra etc.) no escopo de
  // espaço filtrado — um fundo sem espaço é da empresa toda e sempre entra;
  // um fundo com espaço só entra se aquele espaço estiver no filtro (ou
  // nenhum filtro aplicado), mesma regra usada pros demais totais acima.
  // Saldo sempre acumulado (sem data), nunca travado ao período.
  const fundosEmEscopo = fundos.filter(f => !f.espaco || !selectedSpaces?.length || selectedSpaces.includes(f.espaco))
  const totalReservasGenericas = reservasGenericasNoPeriodo(fundosEmEscopo, movimentacoesFundo)

  const resultadoAcumulado = entradasOperAllTime - despesasOperAllTime

  // Disponível do Espaço é um subtotal intermediário (não uma dedução): o
  // Resultado Operacional acumulado depois de descontar o que está reservado
  // agora (Fundo de Caixa + reservas genéricas). Disponível para Distribuição
  // é uma posição atual (não um fluxo do período): esse subtotal menos tudo
  // que os sócios já retiraram — nenhum desses três é despesa (não mexem no
  // Resultado), mas reduzem o quanto ainda pode sair da empresa pros sócios.
  const disponivelDoEspaco = resultadoAcumulado - saldoFundoAtual - totalReservasGenericas
  const disponivelParaDistribuicao = disponivelDoEspaco - retiradasAllTime

  // Mesma conta, mas por espaço individual — só entram fundos vinculados
  // àquele espaço específico (fundo sem espaço não dá pra atribuir a um só).
  // Retirada de sócio NÃO entra aqui de propósito — isso é "Direito do Sócio"
  // bruto, antes de dividir por participação; descontar retirada coletiva
  // nesse ponto faria a retirada de um sócio reduzir o direito dos outros.
  // O desconto de retirada é individual, por sócio, feito depois de aplicar
  // o percentual de cada um (ver repasseSociosRows em FechamentoClient.tsx).
  const disponivelPorEspaco = espacosEmEscopo.map(e => {
    const entradasEspaco = somaPaga(entradasAllTime, r => isReceitaOperacional(r) && r.espaco === e.nome, r => r.valor, r => r.status)
    const despesasEspaco = somaPaga(saidasAllTime, c => isDespesaOperacional(c) && c.espaco === e.nome, c => c.valor, c => c.status)
    const fundoCaixaEspaco =
      somaPaga(saidasAllTime, c => c.categoria === 'fundo_caixa' && c.espaco === e.nome, c => c.valor, c => c.status)
      - somaPaga(entradasAllTime, r => r.tipoEntrada === 'retorno_fundo_caixa' && r.espaco === e.nome, r => r.valor, r => r.status)
    const reservasGenericasEspaco = reservasGenericasNoPeriodo(fundos.filter(f => f.espaco === e.nome), movimentacoesFundo)
    const disponivel = entradasEspaco - despesasEspaco - fundoCaixaEspaco - reservasGenericasEspaco
    return { nome: e.nome, disponivel }
  })

  const obraPorEspaco = calcularObraPorEspaco(entradasAllTime, saidasAllTime, espacosEmEscopo, nomesComObra)

  return {
    entradasOperacionais, totalEntradas, despesasOperacionais, totalSaidas, totalPorCategoriaDespesa, resultado,
    aportes, totalAportes, retiradasSocio, totalRetiradasSocio,
    outrasEntradas, totalOutrasEntradas, transferenciasFundo, totalTransferenciasFundo, retornosFundo, totalRetornosFundo,
    aportesObra, despesasObra,
    saldoFundoAtual, saldoDisponivelForaFundo, totalReservasGenericas, resultadoAcumulado,
    totalRetiradasSocioAcumulado: retiradasAllTime,
    disponivelDoEspaco, disponivelParaDistribuicao, disponivelPorEspaco,
    obraPorEspaco,
  }
}

function calcularObraPorEspaco(
  entradasAllTime: Receita[],
  saidasAllTime: ContaPagar[],
  espacosEmEscopo: { nome: string }[],
  nomesComObra: Set<string>,
): ObraEspacoResumo[] {
  return espacosEmEscopo.filter(e => nomesComObra.has(e.nome)).map(e => {
    const despesasEspaco = saidasAllTime.filter(c => c.espaco === e.nome && isDespesaObra(c))
    // Aporte Societário é a receita da obra — não existe um lançamento manual
    // separado pra isso. 'aporte_obra' continua reconhecido só por
    // compatibilidade com lançamentos feitos antes dessa unificação.
    const aportesEspaco = entradasAllTime.filter(r => r.espaco === e.nome && (r.tipoEntrada === 'aporte_societario' || r.tipoEntrada === 'aporte_obra'))
    const totalDespesas = despesasEspaco.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
    const totalAportes = aportesEspaco.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
    const saldo = totalAportes - totalDespesas
    const porSocioMap = new Map<string, number>()
    for (const nome of SOCIOS_OBRA[e.nome] ?? []) porSocioMap.set(nome, 0)
    for (const r of aportesEspaco) {
      if (r.status !== 'pago' || !r.socioResponsavel) continue
      const nome = nomeCanonicoSocio(r.socioResponsavel)
      porSocioMap.set(nome, (porSocioMap.get(nome) ?? 0) + r.valor)
    }
    const porSocio = Array.from(porSocioMap.entries()).map(([nome, valor]) => ({ nome, valor }))
    return {
      nome: e.nome, totalDespesas, totalAportes, saldo, porSocio,
      despesasCount: despesasEspaco.length, aportesCount: aportesEspaco.length,
      investimentos: INVESTIMENTOS_SOCIETARIOS[e.nome] ?? [],
    }
  })
}
