'use client'

import { useState, useMemo } from 'react'
import FilterBar, { type RelatorioFilters, type Periodo } from './FilterBar'
import { getPeriodRange } from '@/lib/relatorios-utils'
import { formatCurrency } from '@/lib/utils'
import { useEventos } from '@/contexts/EventosContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { useEspacos } from '@/contexts/EspacosContext'
import { useRepasses } from '@/contexts/RepassesContext'
import { useCurrentUser } from '@/contexts/UserContext'
import { DIVISAO_SOCIOS } from '@/lib/socios-config'
import { parseCurrencyBR } from '@/lib/utils'
import { X } from 'lucide-react'
import { downloadWorkbook, type ExportSheet } from '@/lib/xlsx-export'
import { SUBCATEGORIA_LABEL, CATEGORIA_CONTA_LABEL } from './LancamentosTables'
import RelatorioMensalSection from './RelatorioMensalSection'
import ExportarRelatorioButton from './ExportarRelatorioButton'

function getDefaultFilters(): RelatorioFilters {
  const { inicio, fim } = getPeriodRange('anual')
  return {
    periodo: 'anual',
    espacos: [],
    dataInicio: inicio,
    dataFim: fim,
  }
}

const PERIODO_LABELS: Record<string, string> = {
  semanal: 'Semanal',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

export default function RelatoriosClient() {
  const { eventos } = useEventos()
  const { receitas } = useReceitas()
  const { contas: contasPagar } = useContasPagar()
  const { espacosConfig } = useEspacos()
  const { repasses, addRepasse } = useRepasses()
  const { role } = useCurrentUser()
  const podeRegistrarRepasse = role === 'admin' || role === 'financeiro'
  const [filters, setFilters] = useState<RelatorioFilters>(getDefaultFilters)
  const [repasseAlvo, setRepasseAlvo] = useState<{ espaco: string; socio: string } | null>(null)

  function handleFiltersChange(f: RelatorioFilters) {
    if (f.periodo !== filters.periodo) {
      const { inicio, fim } = getPeriodRange(f.periodo)
      setFilters({ ...f, dataInicio: inicio, dataFim: fim })
    } else {
      setFilters(f)
    }
  }

  const espacosLabel = filters.espacos.length === 0
    ? 'Todos os espaços'
    : filters.espacos.join(', ')

  const periodoLabel = PERIODO_LABELS[filters.periodo] ?? filters.periodo

  const selectedSpaces = filters.espacos.length > 0 ? filters.espacos : undefined
  const espacosParaTabela = useMemo(
    () => selectedSpaces ? espacosConfig.filter(e => selectedSpaces.includes(e.nome)) : espacosConfig,
    [espacosConfig, selectedSpaces],
  )

  const eventosPorId = useMemo(() => new Map(eventos.map(e => [e.id, e])), [eventos])

  const entradas = useMemo(() => receitas.filter(r => {
    const matchEspaco = !selectedSpaces || (r.espaco && selectedSpaces.includes(r.espaco))
    const matchInicio = !filters.dataInicio || r.data >= filters.dataInicio
    const matchFim = !filters.dataFim || r.data <= filters.dataFim
    return matchEspaco && matchInicio && matchFim
  }), [receitas, selectedSpaces, filters.dataInicio, filters.dataFim])

  const saidas = useMemo(() => contasPagar.filter(c => {
    const matchEspaco = !selectedSpaces || selectedSpaces.includes(c.espaco)
    const matchInicio = !filters.dataInicio || c.dataVencimento >= filters.dataInicio
    const matchFim = !filters.dataFim || c.dataVencimento <= filters.dataFim
    return matchEspaco && matchInicio && matchFim
  }), [contasPagar, selectedSpaces, filters.dataInicio, filters.dataFim])

  // Repasse para os sócios do período — lucro (receita paga - despesa paga) de cada
  // espaço, dividido pelas regras cadastradas em DIVISAO_SOCIOS. "Já repassado" soma
  // os lançamentos reais de repasse (tela de Fluxo de Caixa) dentro do mesmo período.
  const repasseSociosRows = useMemo(() => {
    const rows: { espaco: string; socio: string; percentual: number; lucro: number; valorDevido: number; jaRepassado: number; valorPendente: number }[] = []
    for (const e of espacosParaTabela) {
      const receitaTotal = entradas.filter(r => r.status === 'pago' && r.espaco === e.nome).reduce((s, r) => s + r.valor, 0)
      const despesaTotal = saidas.filter(c => c.status === 'pago' && c.espaco === e.nome).reduce((s, c) => s + c.valor, 0)
      const lucro = receitaTotal - despesaTotal
      const socios = DIVISAO_SOCIOS[e.nome] ?? []
      for (const s of socios) {
        const valorDevido = lucro * (s.percentual / 100)
        const jaRepassado = repasses
          .filter(r => r.espaco === e.nome && r.socioNome === s.nome && r.data >= filters.dataInicio && r.data <= filters.dataFim)
          .reduce((sum, r) => sum + r.valor, 0)
        rows.push({ espaco: e.nome, socio: s.nome, percentual: s.percentual, lucro, valorDevido, jaRepassado, valorPendente: valorDevido - jaRepassado })
      }
    }
    return rows
  }, [espacosParaTabela, entradas, saidas, repasses, filters.dataInicio, filters.dataFim])

  function handleExportExcel() {
    const totalEntradasPeriodo = entradas.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
    const totalDespesasPeriodo = saidas.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)

    const resumoSheet: ExportSheet = {
      name: 'Relatório Mensal',
      rows: [
        ['Período', `${filters.dataInicio} a ${filters.dataFim}`],
        ['Espaços filtrados', espacosLabel],
        ['Total de Entradas', totalEntradasPeriodo],
        ['Total de Saídas', totalDespesasPeriodo],
        ['Lucro Líquido', totalEntradasPeriodo - totalDespesasPeriodo],
        [],
        ['Espaço', 'Total Entradas', 'Total Saídas', 'Lucro'],
        ...espacosParaTabela.map(e => {
          const receitaTotal = entradas.filter(r => r.status === 'pago' && r.espaco === e.nome).reduce((s, r) => s + r.valor, 0)
          const despesaTotal = saidas.filter(c => c.status === 'pago' && c.espaco === e.nome).reduce((s, c) => s + c.valor, 0)
          return [e.nome, receitaTotal, despesaTotal, receitaTotal - despesaTotal]
        }),
      ],
    }

    const receitasSheet: ExportSheet = {
      name: 'Receitas Discriminadas',
      rows: [
        ['Data', 'Descrição', 'Categoria', 'Espaço', 'Evento Relacionado', 'Cliente/Pagador', 'Forma de Pagamento', 'Valor', 'Status', 'Data Recebimento', 'Parcela', 'Observações'],
        ...entradas.map(r => {
          const evento = r.eventoId ? eventosPorId.get(r.eventoId) : undefined
          return [
            r.data, r.descricao, r.categoriaNome, r.espaco ?? '', evento?.nomeEvento || evento?.tipo || '', r.cliente ?? '',
            r.metodoPagamento ?? '', r.valor, r.status, r.dataRecebimento ?? '', r.parcelaLabel ?? '', r.observacoes ?? '',
          ]
        }),
      ],
    }

    const despesasSheet: ExportSheet = {
      name: 'Despesas Discriminadas',
      rows: [
        ['Data Vencimento', 'Descrição', 'Fornecedor', 'Categoria', 'Tipo de Despesa', 'Espaço', 'Valor', 'Status', 'Data Pagamento', 'Observações'],
        ...saidas.map(c => [
          c.dataVencimento, c.descricao, c.fornecedor ?? '', CATEGORIA_CONTA_LABEL[c.categoria] ?? c.categoria,
          SUBCATEGORIA_LABEL[c.subcategoria] ?? c.subcategoria, c.espaco, c.valor, c.status, c.dataPagamento ?? '', c.observacoes ?? '',
        ]),
      ],
    }

    const repasseSheet: ExportSheet = {
      name: 'Repasse para os Sócios',
      rows: [
        ['Espaço', 'Sócio', 'Percentual (%)', 'Lucro Disponível', 'Valor Devido', 'Já Repassado (Ajuste)', 'Valor Final Pendente'],
        ...repasseSociosRows.map(r => [r.espaco, r.socio, r.percentual, r.lucro, r.valorDevido, r.jaRepassado, r.valorPendente]),
      ],
    }

    downloadWorkbook(
      [resumoSheet, receitasSheet, despesasSheet, repasseSheet],
      `relatorio-${filters.dataInicio}-a-${filters.dataFim}.xlsx`,
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Print header — hidden on screen, visible when printing */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <p className="text-xs text-gray-500 mb-1">Espaços &amp; Locações</p>
        <h1 className="text-xl font-bold text-gray-900">Relatório {periodoLabel}</h1>
        <p className="text-sm text-gray-600 mt-1">{espacosLabel}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Período: {filters.dataInicio} → {filters.dataFim} &nbsp;·&nbsp; Gerado em{' '}
          {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center justify-between print-hidden">
        <div />
        <ExportarRelatorioButton onExcel={handleExportExcel} />
      </div>

      <FilterBar filters={filters} onChange={handleFiltersChange} />

      {/* 1. Relatório Mensal — Entradas, Saídas e Divisão de Lucro */}
      <RelatorioMensalSection
        selectedSpaces={selectedSpaces}
        dataInicio={filters.dataInicio}
        dataFim={filters.dataFim}
      />

      {/* 2. Receitas Discriminadas — sempre aberta, sem botão de expandir/recolher */}
      <FullTable
        titulo="Receitas Discriminadas"
        headers={['Data', 'Descrição', 'Categoria', 'Espaço', 'Evento Relacionado', 'Cliente/Pagador', 'Forma de Pagamento', 'Valor', 'Status', 'Observações']}
        rows={entradas.map(r => {
          const evento = r.eventoId ? eventosPorId.get(r.eventoId) : undefined
          return [
            r.data.split('-').reverse().join('/'), r.descricao, r.categoriaNome, r.espaco ?? '—',
            evento?.nomeEvento || evento?.tipo || '—', r.cliente ?? '—', r.metodoPagamento ?? '—',
            formatCurrency(r.valor), r.status, r.observacoes ?? '—',
          ]
        })}
        totalLabel="Total de Receitas"
        totalValor={formatCurrency(entradas.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0))}
      />

      {/* 3. Despesas Discriminadas — sempre aberta, sem botão de expandir/recolher.
          "Evento relacionado" e "forma de pagamento" não existem no cadastro de contas
          a pagar hoje, por isso não aparecem aqui — os demais campos existentes constam. */}
      <FullTable
        titulo="Despesas Discriminadas"
        headers={['Data Vencimento', 'Descrição', 'Fornecedor', 'Categoria', 'Tipo de Despesa', 'Espaço', 'Valor', 'Status', 'Data Pagamento', 'Observações']}
        rows={saidas.map(c => [
          c.dataVencimento.split('-').reverse().join('/'), c.descricao, c.fornecedor ?? '—',
          CATEGORIA_CONTA_LABEL[c.categoria] ?? c.categoria, SUBCATEGORIA_LABEL[c.subcategoria] ?? c.subcategoria,
          c.espaco, formatCurrency(c.valor), c.status, c.dataPagamento ? c.dataPagamento.split('-').reverse().join('/') : '—', c.observacoes ?? '—',
        ])}
        totalLabel="Total de Despesas"
        totalValor={formatCurrency(saidas.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0))}
      />

      {/* 4. Repasse para os Sócios */}
      <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-app-text">Repasse para os Sócios</h3>
        {repasseSociosRows.length === 0 ? (
          <p className="text-sm text-app-subtle text-center py-4">Nenhum sócio configurado para os espaços filtrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-app-border">
                  {['Espaço', 'Sócio', '%', 'Lucro Disponível', 'Valor Devido', 'Já Repassado (Ajuste)', 'Valor Final Pendente'].map(h => (
                    <th key={h} className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                  {podeRegistrarRepasse && <th className="px-2 py-2 print-hidden" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/50">
                {repasseSociosRows.map((r, i) => (
                  <tr key={`${r.espaco}-${r.socio}-${i}`}>
                    <td className="px-2 py-2 font-medium text-app-text whitespace-nowrap">{r.espaco}</td>
                    <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{r.socio}</td>
                    <td className="px-2 py-2 text-app-text2">{r.percentual}%</td>
                    <td className="px-2 py-2 text-app-text2">{formatCurrency(r.lucro)}</td>
                    <td className="px-2 py-2 text-app-text2">{formatCurrency(r.valorDevido)}</td>
                    <td className="px-2 py-2 text-app-text2">{formatCurrency(r.jaRepassado)}</td>
                    <td className={`px-2 py-2 font-semibold ${r.valorPendente > 0.01 ? 'text-amber-500' : 'text-[#128C7E]'}`}>{formatCurrency(r.valorPendente)}</td>
                    {podeRegistrarRepasse && (
                      <td className="px-2 py-2 print-hidden">
                        <button
                          onClick={() => setRepasseAlvo({ espaco: r.espaco, socio: r.socio })}
                          className="rounded-md border border-app-border2 px-2 py-1 text-[11px] font-medium text-app-muted hover:border-[#25D366] hover:text-[#128C7E] transition-colors whitespace-nowrap"
                        >
                          Registrar repasse
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {repasseAlvo && (
        <RegistrarRepasseModal
          espaco={repasseAlvo.espaco}
          socioNome={repasseAlvo.socio}
          onClose={() => setRepasseAlvo(null)}
          onConfirm={async (valor, data, observacoes) => {
            await addRepasse({ espaco: repasseAlvo.espaco, socioNome: repasseAlvo.socio, valor, data, observacoes })
            setRepasseAlvo(null)
          }}
        />
      )}
    </div>
  )
}

function RegistrarRepasseModal({ espaco, socioNome, onClose, onConfirm }: {
  espaco: string
  socioNome: string
  onClose: () => void
  onConfirm: (valor: number, data: string, observacoes?: string) => Promise<void>
}) {
  const [valor, setValor] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleConfirm() {
    setSubmitted(true)
    if (!valor || parseCurrencyBR(valor) <= 0 || !data) return
    setSaving(true)
    try {
      await onConfirm(parseCurrencyBR(valor), data, observacoes.trim() || undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text">Registrar repasse — {socioNome}</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-app-subtle">{espaco}</p>
          <div>
            <label className="block text-xs text-app-muted mb-1">Valor (R$) *</label>
            <input type="text" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00"
              className={`w-full rounded-lg border ${submitted && (!valor || parseCurrencyBR(valor) <= 0) ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none`} />
          </div>
          <div>
            <label className="block text-xs text-app-muted mb-1">Data do repasse *</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-app-muted mb-1">Observações</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
              className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">Cancelar</button>
          <button onClick={handleConfirm} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: '#25D366' }}>
            {saving ? 'Salvando…' : 'Confirmar repasse'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface FullTableProps {
  titulo: string
  headers: string[]
  rows: (string | number)[][]
  totalLabel: string
  totalValor: string
}

// Bloco sempre aberto — sem <details>/expandir — pra sair completo tanto na tela
// quanto no PDF exportado, conforme exigido: nenhuma informação atrás de clique.
function FullTable({ titulo, headers, rows, totalLabel, totalValor }: FullTableProps) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-app-text">{titulo} ({rows.length})</h3>
        <span className="text-sm font-semibold text-app-text">{totalLabel}: {totalValor}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-app-subtle text-center py-4">Nenhum lançamento no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-app-border">
                {headers.map(h => (
                  <th key={h} className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/50">
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-2 text-app-text2 whitespace-nowrap">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
