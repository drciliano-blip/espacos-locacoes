'use client'

import { useMemo } from 'react'
import { ArrowUpCircle, ArrowDownCircle, Wallet, Handshake, PlusCircle, Landmark, Vault, ArrowLeftRight, HardHat, Info } from 'lucide-react'
import { useReceitas, isReceitaOperacional } from '@/contexts/ReceitasContext'
import { useContasPagar, isDespesaOperacional, isDespesaObra } from '@/contexts/ContasPagarContext'
import { useEspacos } from '@/contexts/EspacosContext'
import { formatCurrency } from '@/lib/utils'
import { DIVISAO_SOCIOS, SOCIOS_OBRA, INVESTIMENTOS_SOCIETARIOS } from '@/lib/socios-config'
import { DespesasTable } from './LancamentosTables'
import type { Receita } from '@/contexts/ReceitasContext'
import type { ContaPagar } from '@/types'

interface Props {
  selectedSpaces?: string[]
  dataInicio?: string
  dataFim?: string
}

export default function RelatorioMensalSection({ selectedSpaces, dataInicio, dataFim }: Props) {
  const { receitas } = useReceitas()
  const { contas: contasPagar } = useContasPagar()
  const { espacosConfig } = useEspacos()

  const entradas = useMemo(() => receitas.filter(r => {
    const matchEspaco = !selectedSpaces?.length || (r.espaco && selectedSpaces.includes(r.espaco))
    const matchInicio = !dataInicio || r.data >= dataInicio
    const matchFim    = !dataFim    || r.data <= dataFim
    return matchEspaco && matchInicio && matchFim
  }), [receitas, selectedSpaces, dataInicio, dataFim])

  const saidas = useMemo(() => contasPagar.filter(c => {
    const matchEspaco = !selectedSpaces?.length || selectedSpaces.includes(c.espaco)
    const matchInicio = !dataInicio || c.dataVencimento >= dataInicio
    const matchFim    = !dataFim    || c.dataVencimento <= dataFim
    return matchEspaco && matchInicio && matchFim
  }), [contasPagar, selectedSpaces, dataInicio, dataFim])

  // Aporte societário, outras entradas manuais e retorno do Fundo de Caixa NÃO contam
  // como faturamento/receita operacional. Retirada de sócio e transferência pro Fundo
  // de Caixa NÃO contam como despesa — são movimentações societárias/de caixa, não
  // custo do negócio. Isso é o que separa "Resultado Operacional" de "Movimentações
  // Societárias" e "Controle de Caixa" nos relatórios.
  const entradasOperacionais = useMemo(() => entradas.filter(isReceitaOperacional), [entradas])
  const aportes = useMemo(() => entradas.filter(r => r.tipoEntrada === 'aporte_societario'), [entradas])
  const outrasEntradas = useMemo(() => entradas.filter(r => r.tipoEntrada === 'outras_entradas'), [entradas])
  const retornosFundo = useMemo(() => entradas.filter(r => r.tipoEntrada === 'retorno_fundo_caixa'), [entradas])

  const despesasOperacionais = useMemo(() => saidas.filter(isDespesaOperacional), [saidas])
  const retiradasSocio = useMemo(() => saidas.filter(c => c.categoria === 'retirada_socio'), [saidas])
  const transferenciasFundo = useMemo(() => saidas.filter(c => c.categoria === 'fundo_caixa'), [saidas])

  const totalEntradas = entradasOperacionais.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
  const totalAportes = aportes.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
  const totalOutrasEntradas = outrasEntradas.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
  const totalRetornosFundo = retornosFundo.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
  const totalCaixa = totalEntradas + totalAportes + totalOutrasEntradas

  const totalSaidas = despesasOperacionais.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
  const totalPorCategoria = (categoria: string) =>
    despesasOperacionais.filter(c => c.categoria === categoria && c.status === 'pago').reduce((s, c) => s + c.valor, 0)
  const totalRetiradasSocio = retiradasSocio.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
  const totalTransferenciasFundo = transferenciasFundo.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)

  const resultado = totalEntradas - totalSaidas

  // Saldo do Fundo de Caixa e saldo disponível fora dele são cumulativos (desde
  // sempre), não travados ao período filtrado — senão o saldo "reiniciaria" toda
  // vez que o usuário trocasse o período do relatório. Só respeitam o filtro de
  // espaço, igual ao resto da tela.
  const entradasAllTime = useMemo(() => receitas.filter(r =>
    !selectedSpaces?.length || (r.espaco && selectedSpaces.includes(r.espaco))
  ), [receitas, selectedSpaces])
  const saidasAllTime = useMemo(() => contasPagar.filter(c =>
    !selectedSpaces?.length || selectedSpaces.includes(c.espaco)
  ), [contasPagar, selectedSpaces])

  const somaPaga = (valor: number, cond: boolean) => cond ? valor : 0
  const sumPago = <T,>(arr: T[], pred: (x: T) => boolean, valor: (x: T) => number, status: (x: T) => string) =>
    arr.reduce((s, x) => s + somaPaga(valor(x), pred(x) && status(x) === 'pago'), 0)

  const fundoTransfersAllTime = sumPago(saidasAllTime, c => c.categoria === 'fundo_caixa', c => c.valor, c => c.status)
  const fundoReturnsAllTime = sumPago(entradasAllTime, r => r.tipoEntrada === 'retorno_fundo_caixa', r => r.valor, r => r.status)
  const saldoFundoAtual = fundoTransfersAllTime - fundoReturnsAllTime

  const entradasOperAllTime = sumPago(entradasAllTime, isReceitaOperacional, r => r.valor, r => r.status)
  const outrasAllTime = sumPago(entradasAllTime, r => r.tipoEntrada === 'outras_entradas', r => r.valor, r => r.status)
  const aportesAllTime = sumPago(entradasAllTime, r => r.tipoEntrada === 'aporte_societario', r => r.valor, r => r.status)
  const despesasOperAllTime = sumPago(saidasAllTime, isDespesaOperacional, c => c.valor, c => c.status)
  const retiradasAllTime = sumPago(saidasAllTime, c => c.categoria === 'retirada_socio', c => c.valor, c => c.status)

  const saldoDisponivelForaFundo =
    entradasOperAllTime + outrasAllTime + aportesAllTime + fundoReturnsAllTime
    - despesasOperAllTime - retiradasAllTime - fundoTransfersAllTime

  const espacos = selectedSpaces?.length
    ? espacosConfig.filter(e => selectedSpaces.includes(e.nome))
    : espacosConfig

  // Fechamento da Obra é um controle à parte, nunca misturado com a operação:
  // só entra aporte para obra (entrada) e despesa categoria "obra" (saída). É
  // acumulado desde o início (não trava no período do relatório), porque é o
  // fechamento de um projeto, não um resultado mensal. Só aparece pra espaço
  // que tenha sócios de obra configurados ou algum lançamento de obra — nunca
  // pra espaço sem nenhuma obra em andamento.
  const obraPorEspaco = useMemo(() => {
    const nomesComObra = new Set<string>([
      ...Object.keys(SOCIOS_OBRA),
      ...saidasAllTime.filter(isDespesaObra).map(c => c.espaco),
      ...entradasAllTime.filter(r => r.tipoEntrada === 'aporte_obra' && r.espaco).map(r => r.espaco as string),
    ])
    return espacos.filter(e => nomesComObra.has(e.nome)).map(e => {
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
  }, [espacos, saidasAllTime, entradasAllTime])

  const porEspaco = useMemo(() => espacos.map(e => {
    // Divisão de lucro entre sócios usa só receita operacional (de evento) e
    // despesa operacional — aporte/outras entradas, retirada de sócio e Fundo de
    // Caixa não entram no lucro, só aparecem separados.
    const entradasEspaco = entradasOperacionais.filter(r => r.espaco === e.nome)
    // Contas com espaço "Todos" são despesas gerais, não entram na divisão por espaço.
    const saidasEspaco = despesasOperacionais.filter(c => c.espaco === e.nome)
    const receitaTotal = entradasEspaco.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
    const despesaTotal = saidasEspaco.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
    const lucro = receitaTotal - despesaTotal
    // Se o espaço não estiver configurado em DIVISAO_SOCIOS, presume-se que não tem sócio.
    const socios = (DIVISAO_SOCIOS[e.nome] ?? []).map(s => ({ ...s, valor: lucro * (s.percentual / 100) }))
    const aportesEspaco = aportes.filter(r => r.espaco === e.nome && r.status === 'pago').reduce((s, r) => s + r.valor, 0)
    const retiradasEspaco = retiradasSocio.filter(c => c.espaco === e.nome && c.status === 'pago').reduce((s, c) => s + c.valor, 0)
    const transferenciasEspaco = transferenciasFundo.filter(c => c.espaco === e.nome && c.status === 'pago').reduce((s, c) => s + c.valor, 0)
    return { nome: e.nome, entradasEspaco, saidasEspaco, receitaTotal, despesaTotal, lucro, socios, aportesEspaco, retiradasEspaco, transferenciasEspaco }
  }), [espacos, entradasOperacionais, despesasOperacionais, aportes, retiradasSocio, transferenciasFundo])

  const saidasGerais = despesasOperacionais.filter(c => c.espaco === 'Todos')
  const totalSaidasGerais = saidasGerais.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-6">
      <h3 className="text-sm font-semibold text-app-text">Relatório Mensal — Entradas, Saídas e Divisão de Lucro</h3>

      {/* Resultado Operacional */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Resultado Operacional</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="min-w-0 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-1"><ArrowUpCircle className="h-4 w-4 shrink-0 text-emerald-500" /><span className="text-xs text-emerald-600 font-medium">Receitas Operacionais</span></div>
            <p className="text-lg font-bold text-emerald-600 break-words">{formatCurrency(totalEntradas)}</p>
            <p className="text-xs text-app-subtle mt-1">{entradasOperacionais.length} lançamentos — de eventos/Agenda</p>
          </div>
          <div className="min-w-0 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-1"><ArrowDownCircle className="h-4 w-4 shrink-0 text-red-500" /><span className="text-xs text-red-600 font-medium">Despesas Operacionais</span></div>
            <p className="text-lg font-bold text-red-600 break-words">{formatCurrency(totalSaidas)}</p>
            <p className="text-xs text-app-subtle mt-1">
              Operacional {formatCurrency(totalPorCategoria('operacional'))} · Financeiro {formatCurrency(totalPorCategoria('financeiro'))}
            </p>
          </div>
          <div className={`min-w-0 rounded-xl border p-4 ${resultado >= 0 ? 'border-[#25D366]/25 bg-[#25D366]/5' : 'border-red-500/20 bg-red-500/5'}`}>
            <div className="flex items-center gap-2 mb-1"><Wallet className={`h-4 w-4 shrink-0 ${resultado >= 0 ? 'text-[#128C7E]' : 'text-red-500'}`} /><span className={`text-xs font-medium ${resultado >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>Resultado</span></div>
            <p className={`text-lg font-bold break-words ${resultado >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(resultado)}</p>
            <p className="text-xs text-app-subtle mt-1">Receitas operacionais − despesas operacionais</p>
          </div>
        </div>
      </section>

      {/* Movimentações Societárias */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Movimentações Societárias</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="flex items-center gap-2 mb-1"><Handshake className="h-4 w-4 shrink-0 text-violet-500" /><span className="text-xs text-violet-600 font-medium">Aportes Societários</span></div>
            <p className="text-lg font-bold text-violet-600 break-words">{formatCurrency(totalAportes)}</p>
            <p className="text-xs text-app-subtle mt-1">{aportes.length} lançamentos — não conta como faturamento nem despesa</p>
          </div>
          <div className="min-w-0 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
            <div className="flex items-center gap-2 mb-1"><Landmark className="h-4 w-4 shrink-0 text-fuchsia-500" /><span className="text-xs text-fuchsia-600 font-medium">Retiradas de Sócios</span></div>
            <p className="text-lg font-bold text-fuchsia-600 break-words">{formatCurrency(totalRetiradasSocio)}</p>
            <p className="text-xs text-app-subtle mt-1">{retiradasSocio.length} lançamentos — não conta como despesa</p>
          </div>
        </div>
      </section>

      {/* Controle de Caixa */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Controle de Caixa</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="min-w-0 rounded-xl border border-app-border2 bg-app-surface2/40 p-4">
            <div className="flex items-center gap-2 mb-1"><PlusCircle className="h-4 w-4 shrink-0 text-app-muted" /><span className="text-xs text-app-muted font-medium">Outras Entradas</span></div>
            <p className="text-lg font-bold text-app-text break-words">{formatCurrency(totalOutrasEntradas)}</p>
            <p className="text-xs text-app-subtle mt-1">{outrasEntradas.length} lançamentos — não conta como faturamento</p>
          </div>
          <div className="min-w-0 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-1"><Vault className="h-4 w-4 shrink-0 text-amber-500" /><span className="text-xs text-amber-600 font-medium">Transferências p/ Fundo de Caixa</span></div>
            <p className="text-lg font-bold text-amber-600 break-words">{formatCurrency(totalTransferenciasFundo)}</p>
            <p className="text-xs text-app-subtle mt-1">{transferenciasFundo.length} lançamentos no período — não é despesa</p>
          </div>
          <div className="min-w-0 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <div className="flex items-center gap-2 mb-1"><ArrowLeftRight className="h-4 w-4 shrink-0 text-sky-500" /><span className="text-xs text-sky-600 font-medium">Retornos do Fundo de Caixa</span></div>
            <p className="text-lg font-bold text-sky-600 break-words">{formatCurrency(totalRetornosFundo)}</p>
            <p className="text-xs text-app-subtle mt-1">{retornosFundo.length} lançamentos no período — não é receita</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 mb-1"><Vault className="h-4 w-4 shrink-0 text-amber-600" /><span className="text-xs text-amber-700 font-medium">Saldo Atual do Fundo de Caixa</span></div>
            <p className="text-lg font-bold text-amber-700 break-words">{formatCurrency(saldoFundoAtual)}</p>
            <p className="text-xs text-app-subtle mt-1">Acumulado — transferências menos retornos, desde o início</p>
          </div>
          <div className="min-w-0 rounded-xl border border-app-border2 bg-app-surface2/40 p-4">
            <div className="flex items-center gap-2 mb-1"><Wallet className="h-4 w-4 shrink-0 text-app-muted" /><span className="text-xs text-app-muted font-medium">Saldo Disponível fora do Fundo</span></div>
            <p className="text-lg font-bold text-app-text break-words">{formatCurrency(saldoDisponivelForaFundo)}</p>
            <p className="text-xs text-app-subtle mt-1">Acumulado — caixa operacional, sem contar o Fundo de Caixa</p>
          </div>
        </div>
      </section>

      {/* Fechamento da Obra — controle à parte, nunca misturado com a operação */}
      {obraPorEspaco.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Fechamento da Obra</h4>
          <div className="space-y-3">
            {obraPorEspaco.map(o => (
              <div key={o.nome} className="rounded-lg border border-orange-500/25 bg-orange-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-app-text flex items-center gap-1.5">
                    <HardHat className="h-4 w-4 text-orange-500" />
                    {o.nome}
                  </p>
                  <p className="text-xs text-app-subtle">{o.aportesCount} aporte(s) · {o.despesasCount} despesa(s) de obra — acumulado</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-app-subtle">Aportes para Obra</p>
                    <p className="font-semibold text-violet-600">{formatCurrency(o.totalAportes)}</p>
                  </div>
                  <div>
                    <p className="text-app-subtle">Despesas de Obra</p>
                    <p className="font-semibold text-red-500">{formatCurrency(o.totalDespesas)}</p>
                  </div>
                  <div>
                    <p className="text-app-subtle">Saldo da Obra</p>
                    <p className={`font-semibold ${o.saldo >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(o.saldo)}</p>
                  </div>
                </div>

                {o.porSocio.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-app-muted mb-1.5">Aporte realizado por cada sócio</p>
                    <div className="flex flex-wrap gap-2">
                      {o.porSocio.map(s => (
                        <span key={s.nome} className="flex items-center gap-1.5 rounded-full bg-app-surface2 border border-app-border2/60 px-2.5 py-1 text-xs">
                          <span className="text-app-text font-medium">{s.nome}</span>
                          <span className="font-semibold text-violet-600">{formatCurrency(s.valor)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {o.investimentos.length > 0 && (
                  <div className="rounded-lg bg-app-surface2/60 border border-app-border2/60 px-3 py-2 space-y-1">
                    <p className="text-xs font-medium text-app-muted flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Quadro Societário</p>
                    {o.investimentos.map((inv, i) => (
                      <p key={i} className="text-xs text-app-subtle">
                        <span className="text-app-text font-medium">{inv.socio}</span> — {inv.descricao}: {formatCurrency(inv.valor)} (informativo, não é receita nem entra no fechamento da obra)
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Relatório por espaço */}
      <div className="space-y-4">
        {porEspaco.map(e => (
          <EspacoReportCard key={e.nome} {...e} />
        ))}
        {espacos.length === 0 && (
          <p className="text-sm text-app-subtle text-center py-4">Nenhum espaço cadastrado.</p>
        )}
      </div>

      {/* Despesas gerais, não vinculadas a um espaço específico */}
      {saidasGerais.length > 0 && (
        <details className="group rounded-lg border border-app-border2/60 bg-app-bg p-4">
          <summary className="cursor-pointer text-xs font-medium text-app-muted hover:text-app-text transition-colors list-none flex items-center justify-between gap-1">
            <span className="flex items-center gap-1">
              <span className="group-open:hidden">▶</span>
              <span className="hidden group-open:inline">▼</span>
              Despesas gerais (não vinculadas a um espaço) — {saidasGerais.length} lançamentos
            </span>
            <span className="font-semibold text-red-500">{formatCurrency(totalSaidasGerais)}</span>
          </summary>
          <div className="mt-3">
            <DespesasTable despesas={saidasGerais} />
          </div>
        </details>
      )}
    </div>
  )
}

interface EspacoReportCardProps {
  nome: string
  entradasEspaco: Receita[]
  saidasEspaco: ContaPagar[]
  receitaTotal: number
  despesaTotal: number
  lucro: number
  socios: { nome: string; percentual: number; valor: number }[]
  aportesEspaco: number
  retiradasEspaco: number
  transferenciasEspaco: number
}

function EspacoReportCard({ nome, entradasEspaco, saidasEspaco, receitaTotal, despesaTotal, lucro, socios, aportesEspaco, retiradasEspaco, transferenciasEspaco }: EspacoReportCardProps) {
  return (
    <div className="rounded-lg border border-app-border2/60 bg-app-bg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-app-text">{nome}</p>
        <p className="text-xs text-app-subtle">{entradasEspaco.length} receita(s) operacional(is) · {saidasEspaco.length} despesa(s)</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-app-subtle">Receitas Operacionais</p>
          <p className="font-semibold text-emerald-600">{formatCurrency(receitaTotal)}</p>
        </div>
        <div>
          <p className="text-app-subtle">Despesas Operacionais</p>
          <p className="font-semibold text-red-500">{formatCurrency(despesaTotal)}</p>
        </div>
      </div>

      {aportesEspaco > 0 && (
        <p className="text-xs text-violet-500 flex items-center gap-1.5">
          <Handshake className="h-3 w-3" />
          + {formatCurrency(aportesEspaco)} em aportes societários neste espaço (fora do resultado)
        </p>
      )}
      {retiradasEspaco > 0 && (
        <p className="text-xs text-fuchsia-500 flex items-center gap-1.5">
          <Landmark className="h-3 w-3" />
          − {formatCurrency(retiradasEspaco)} em retiradas de sócios neste espaço (fora do resultado)
        </p>
      )}
      {transferenciasEspaco > 0 && (
        <p className="text-xs text-amber-600 flex items-center gap-1.5">
          <Vault className="h-3 w-3" />
          − {formatCurrency(transferenciasEspaco)} transferidos pro Fundo de Caixa neste espaço (fora do resultado)
        </p>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-app-border/50">
        <span className="text-xs font-medium text-app-muted">Resultado</span>
        <span className={`text-sm font-bold ${lucro >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(lucro)}</span>
      </div>

      {/* Repasse para os sócios */}
      <div>
        <p className="text-xs font-medium text-app-muted mb-1.5">Repasse para os sócios</p>
        {socios.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {socios.map(s => (
              <span key={s.nome} className="flex items-center gap-1.5 rounded-full bg-app-surface2 border border-app-border2/60 px-2.5 py-1 text-xs">
                <span className="text-app-text font-medium">{s.nome}</span>
                <span className="text-app-subtle">{s.percentual}%</span>
                <span className={`font-semibold ${s.valor >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(s.valor)}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-app-subtle italic">Sem sócio configurado para este espaço — o lucro fica integral.</p>
        )}
      </div>
    </div>
  )
}
