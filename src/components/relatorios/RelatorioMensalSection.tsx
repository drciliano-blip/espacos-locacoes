'use client'

import { useMemo } from 'react'
import { ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { formatCurrency } from '@/lib/utils'
import { ESPACOS_CONFIG } from '@/lib/espacos-config'
import { DIVISAO_SOCIOS } from '@/lib/socios-config'

interface Props {
  selectedSpaces?: string[]
  dataInicio?: string
  dataFim?: string
}

export default function RelatorioMensalSection({ selectedSpaces, dataInicio, dataFim }: Props) {
  const { receitas } = useReceitas()
  const { contas: contasPagar } = useContasPagar()

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
    ? ESPACOS_CONFIG.filter(e => selectedSpaces.includes(e.nome))
    : ESPACOS_CONFIG

  const porEspaco = useMemo(() => espacos.map(e => {
    const entradaEspaco = entradas.filter(r => r.status === 'pago' && r.espaco === e.nome).reduce((s, r) => s + r.valor, 0)
    // Contas com espaço "Todos" são despesas gerais, não entram na divisão por espaço.
    const saidaEspaco = saidas.filter(c => c.status === 'pago' && c.espaco === e.nome).reduce((s, c) => s + c.valor, 0)
    const lucroEspaco = entradaEspaco - saidaEspaco
    const socios = (DIVISAO_SOCIOS[e.nome] ?? []).map(s => ({ ...s, valor: lucroEspaco * (s.percentual / 100) }))
    return { nome: e.nome, entrada: entradaEspaco, saida: saidaEspaco, lucro: lucroEspaco, socios }
  }), [espacos, entradas, saidas])

  const saidasGerais = saidas.filter(c => c.status === 'pago' && c.espaco === 'Todos').reduce((s, c) => s + c.valor, 0)

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-5">
      <h3 className="text-sm font-semibold text-app-text">Relatório Mensal — Entradas, Saídas e Divisão de Lucro</h3>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-1"><ArrowUpCircle className="h-4 w-4 text-emerald-500" /><span className="text-xs text-emerald-600 font-medium">Total de Entradas</span></div>
          <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalEntradas)}</p>
          <p className="text-xs text-app-subtle mt-1">{entradas.length} lançamentos</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-1"><ArrowDownCircle className="h-4 w-4 text-red-500" /><span className="text-xs text-red-600 font-medium">Total de Saídas</span></div>
          <p className="text-lg font-bold text-red-600">{formatCurrency(totalSaidas)}</p>
          <p className="text-xs text-app-subtle mt-1">{saidas.length} lançamentos</p>
        </div>
        <div className={`rounded-xl border p-4 ${lucroLiquido >= 0 ? 'border-[#25D366]/25 bg-[#25D366]/5' : 'border-red-500/20 bg-red-500/5'}`}>
          <div className="flex items-center gap-2 mb-1"><Wallet className={`h-4 w-4 ${lucroLiquido >= 0 ? 'text-[#128C7E]' : 'text-red-500'}`} /><span className={`text-xs font-medium ${lucroLiquido >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>Lucro Líquido</span></div>
          <p className={`text-lg font-bold ${lucroLiquido >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(lucroLiquido)}</p>
        </div>
      </div>

      {/* Divisão de lucro por espaço/sócio */}
      <div>
        <p className="text-xs font-medium text-app-muted mb-3">Divisão de lucro por espaço</p>
        <div className="space-y-3">
          {porEspaco.map(e => (
            <div key={e.nome} className="rounded-lg border border-app-border2/60 bg-app-bg p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <p className="text-sm font-semibold text-app-text">{e.nome}</p>
                <div className="flex items-center gap-3 text-xs text-app-subtle">
                  <span>Entradas: <span className="text-emerald-600 font-medium">{formatCurrency(e.entrada)}</span></span>
                  <span>Saídas: <span className="text-red-500 font-medium">{formatCurrency(e.saida)}</span></span>
                  <span>Lucro: <span className={`font-semibold ${e.lucro >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(e.lucro)}</span></span>
                </div>
              </div>
              {e.socios.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {e.socios.map(s => (
                    <span key={s.nome} className="flex items-center gap-1.5 rounded-full bg-app-surface2 border border-app-border2/60 px-2.5 py-1 text-xs">
                      <span className="text-app-text font-medium">{s.nome}</span>
                      <span className="text-app-subtle">{s.percentual}%</span>
                      <span className={`font-semibold ${s.valor >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(s.valor)}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-app-subtle italic">Divisão de sócios não configurada para este espaço.</p>
              )}
            </div>
          ))}
          {saidasGerais > 0 && (
            <p className="text-xs text-app-subtle italic">
              Despesas gerais (não vinculadas a um espaço específico): {formatCurrency(saidasGerais)} — não entram na divisão por espaço acima.
            </p>
          )}
        </div>
      </div>

      {/* Lançamentos de entrada */}
      {entradas.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-[#128C7E] hover:text-[#25D366] transition-colors list-none flex items-center gap-1">
            <span className="group-open:hidden">▶</span>
            <span className="hidden group-open:inline">▼</span>
            Ver lançamentos de entrada ({entradas.length})
          </summary>
          <div className="mt-3 overflow-x-auto rounded-lg border border-app-border2">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-app-border bg-app-surface2">
                  {['Descrição', 'Cliente', 'Espaço', 'Categoria', 'Data', 'Valor', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-app-subtle font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/40">
                {entradas.map(r => (
                  <tr key={r.id} className="hover:bg-app-surface2/30 transition-colors">
                    <td className="px-3 py-2 text-app-text max-w-[200px] truncate">{r.descricao}</td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap">{r.cliente ?? '—'}</td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap">{r.espaco ?? '—'}</td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap">{r.categoriaNome}</td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap">{r.data.split('-').reverse().join('/')}</td>
                    <td className="px-3 py-2 font-semibold text-app-text whitespace-nowrap">{formatCurrency(r.valor)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                        r.status === 'pago'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : r.status === 'atrasado'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Lançamentos de saída */}
      {saidas.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-[#128C7E] hover:text-[#25D366] transition-colors list-none flex items-center gap-1">
            <span className="group-open:hidden">▶</span>
            <span className="hidden group-open:inline">▼</span>
            Ver lançamentos de saída ({saidas.length})
          </summary>
          <div className="mt-3 overflow-x-auto rounded-lg border border-app-border2">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-app-border bg-app-surface2">
                  {['Descrição', 'Beneficiário', 'Espaço', 'Categoria', 'Vencimento', 'Valor', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-app-subtle font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/40">
                {saidas.map(c => (
                  <tr key={c.id} className="hover:bg-app-surface2/30 transition-colors">
                    <td className="px-3 py-2 text-app-text max-w-[200px] truncate">{c.descricao}</td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap">{c.fornecedor ?? '—'}</td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap">{c.espaco}</td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap">{c.categoria === 'fixa' ? 'Fixa' : 'Variável'}</td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap">{c.dataVencimento.split('-').reverse().join('/')}</td>
                    <td className="px-3 py-2 font-semibold text-app-text whitespace-nowrap">{formatCurrency(c.valor)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                        c.status === 'pago'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : c.status === 'atrasado'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
