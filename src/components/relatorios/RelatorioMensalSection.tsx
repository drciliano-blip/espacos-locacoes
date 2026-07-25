'use client'

import { useMemo } from 'react'
import { ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { useEspacos } from '@/contexts/EspacosContext'
import { useEventos } from '@/contexts/EventosContext'
import { formatCurrency } from '@/lib/utils'
import { DIVISAO_SOCIOS } from '@/lib/socios-config'
import { ReceitasTable, DespesasTable } from './LancamentosTables'
import type { Receita } from '@/contexts/ReceitasContext'
import type { ContaPagar, Evento } from '@/types'

interface Props {
  selectedSpaces?: string[]
  dataInicio?: string
  dataFim?: string
}

export default function RelatorioMensalSection({ selectedSpaces, dataInicio, dataFim }: Props) {
  const { receitas } = useReceitas()
  const { contas: contasPagar } = useContasPagar()
  const { espacosConfig } = useEspacos()
  const { eventos } = useEventos()
  const eventosPorId = useMemo(() => new Map(eventos.map(e => [e.id, e])), [eventos])

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

  // Total e divisão de lucro consideram só o que foi de fato recebido/pago —
  // mesmo critério já usado no Dashboard e nos Relatórios (receita = status "pago").
  const totalEntradas = entradas.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
  const totalSaidas   = saidas.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
  const lucroLiquido  = totalEntradas - totalSaidas

  const espacos = selectedSpaces?.length
    ? espacosConfig.filter(e => selectedSpaces.includes(e.nome))
    : espacosConfig

  const porEspaco = useMemo(() => espacos.map(e => {
    const entradasEspaco = entradas.filter(r => r.espaco === e.nome)
    // Contas com espaço "Todos" são despesas gerais, não entram na divisão por espaço.
    const saidasEspaco = saidas.filter(c => c.espaco === e.nome)
    const receitaTotal = entradasEspaco.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
    const despesaTotal = saidasEspaco.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
    const lucro = receitaTotal - despesaTotal
    // Se o espaço não estiver configurado em DIVISAO_SOCIOS, presume-se que não tem sócio.
    const socios = (DIVISAO_SOCIOS[e.nome] ?? []).map(s => ({ ...s, valor: lucro * (s.percentual / 100) }))
    return { nome: e.nome, entradasEspaco, saidasEspaco, receitaTotal, despesaTotal, lucro, socios }
  }), [espacos, entradas, saidas])

  const saidasGerais = saidas.filter(c => c.espaco === 'Todos')
  const totalSaidasGerais = saidasGerais.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-5">
      <h3 className="text-sm font-semibold text-app-text">Relatório Mensal — Entradas, Saídas e Divisão de Lucro</h3>

      {/* KPIs gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="min-w-0 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-1"><ArrowUpCircle className="h-4 w-4 shrink-0 text-emerald-500" /><span className="text-xs text-emerald-600 font-medium">Total de Entradas</span></div>
          <p className="text-lg font-bold text-emerald-600 break-words">{formatCurrency(totalEntradas)}</p>
          <p className="text-xs text-app-subtle mt-1">{entradas.length} lançamentos</p>
        </div>
        <div className="min-w-0 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-1"><ArrowDownCircle className="h-4 w-4 shrink-0 text-red-500" /><span className="text-xs text-red-600 font-medium">Total de Saídas</span></div>
          <p className="text-lg font-bold text-red-600 break-words">{formatCurrency(totalSaidas)}</p>
          <p className="text-xs text-app-subtle mt-1">{saidas.length} lançamentos</p>
        </div>
        <div className={`min-w-0 rounded-xl border p-4 ${lucroLiquido >= 0 ? 'border-[#25D366]/25 bg-[#25D366]/5' : 'border-red-500/20 bg-red-500/5'}`}>
          <div className="flex items-center gap-2 mb-1"><Wallet className={`h-4 w-4 shrink-0 ${lucroLiquido >= 0 ? 'text-[#128C7E]' : 'text-red-500'}`} /><span className={`text-xs font-medium ${lucroLiquido >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>Lucro Líquido</span></div>
          <p className={`text-lg font-bold break-words ${lucroLiquido >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(lucroLiquido)}</p>
        </div>
      </div>

      {/* Relatório por espaço */}
      <div className="space-y-4">
        {porEspaco.map(e => (
          <EspacoReportCard key={e.nome} {...e} eventosPorId={eventosPorId} />
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
  eventosPorId: Map<string, Evento>
}

function EspacoReportCard({ nome, entradasEspaco, saidasEspaco, receitaTotal, despesaTotal, lucro, socios, eventosPorId }: EspacoReportCardProps) {
  return (
    <div className="rounded-lg border border-app-border2/60 bg-app-bg p-4 space-y-3">
      <p className="text-sm font-semibold text-app-text">{nome}</p>

      {/* Receita discriminada */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-app-muted hover:text-app-text transition-colors list-none flex items-center justify-between gap-1">
          <span className="flex items-center gap-1">
            <span className="group-open:hidden">▶</span>
            <span className="hidden group-open:inline">▼</span>
            Receita discriminada ({entradasEspaco.length})
          </span>
          <span className="font-semibold text-emerald-600">Total: {formatCurrency(receitaTotal)}</span>
        </summary>
        {entradasEspaco.length === 0 ? (
          <p className="text-xs italic text-app-subtle mt-2">Nenhum lançamento no período.</p>
        ) : (
          <ReceitasTable receitas={entradasEspaco} eventosPorId={eventosPorId} />
        )}
      </details>

      {/* Despesa discriminada */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-app-muted hover:text-app-text transition-colors list-none flex items-center justify-between gap-1">
          <span className="flex items-center gap-1">
            <span className="group-open:hidden">▶</span>
            <span className="hidden group-open:inline">▼</span>
            Despesa discriminada ({saidasEspaco.length})
          </span>
          <span className="font-semibold text-red-500">Total: {formatCurrency(despesaTotal)}</span>
        </summary>
        {saidasEspaco.length === 0 ? (
          <p className="text-xs italic text-app-subtle mt-2">Nenhum lançamento no período.</p>
        ) : (
          <DespesasTable despesas={saidasEspaco} />
        )}
      </details>

      <div className="flex items-center justify-between pt-1 border-t border-app-border/50">
        <span className="text-xs font-medium text-app-muted">Lucro</span>
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
