'use client'

import { useState, useMemo } from 'react'
import { Receipt, TrendingDown, CheckCircle2, AlertCircle, Clock, Filter, X } from 'lucide-react'
import { contasPagar, ESPACOS } from '@/lib/mock-data'
import { formatCurrency } from '@/lib/utils'
import type { ContaPagar, CategoriaContaPagar, StatusContaPagar } from '@/types'

const statusBadge: Record<StatusContaPagar, string> = {
  pago: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pendente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  atrasado: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const statusLabel: Record<StatusContaPagar, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  atrasado: 'Atrasado',
}

const subcategoriaLabel: Record<string, string> = {
  aluguel: 'Aluguel',
  energia: 'Energia',
  internet: 'Internet',
  funcionários: 'Funcionários',
  manutenção: 'Manutenção',
  fornecedores: 'Fornecedores',
  extras: 'Extras',
}

const subcategoriaBadge: Record<string, string> = {
  aluguel: 'bg-violet-500/10 text-violet-400',
  energia: 'bg-yellow-500/10 text-yellow-400',
  internet: 'bg-sky-500/10 text-sky-400',
  funcionários: 'bg-blue-500/10 text-blue-400',
  manutenção: 'bg-orange-500/10 text-orange-400',
  fornecedores: 'bg-teal-500/10 text-teal-400',
  extras: 'bg-zinc-500/10 text-zinc-400',
}

export default function ContasPagarPage() {
  const [tab, setTab] = useState<'apagar' | 'pagas'>('apagar')
  const [filterEspaco, setFilterEspaco] = useState('')
  const [filterCategoria, setFilterCategoria] = useState<CategoriaContaPagar | ''>('')
  const [filterSubcategoria, setFilterSubcategoria] = useState('')
  const [filterMes, setFilterMes] = useState('')

  const meses = [
    { value: '2026-05', label: 'Maio 2026' },
    { value: '2026-06', label: 'Junho 2026' },
  ]

  const filtered = useMemo(() => {
    return contasPagar.filter((c) => {
      if (tab === 'apagar' && c.status === 'pago') return false
      if (tab === 'pagas' && c.status !== 'pago') return false
      if (filterEspaco && c.espaco !== filterEspaco) return false
      if (filterCategoria && c.categoria !== filterCategoria) return false
      if (filterSubcategoria && c.subcategoria !== filterSubcategoria) return false
      if (filterMes && !c.dataVencimento.startsWith(filterMes)) return false
      return true
    })
  }, [tab, filterEspaco, filterCategoria, filterSubcategoria, filterMes])

  const fixas = filtered.filter((c) => c.categoria === 'fixa')
  const variaveis = filtered.filter((c) => c.categoria === 'variavel')

  const totalPago = contasPagar.filter((c) => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
  const totalPendente = contasPagar.filter((c) => c.status === 'pendente').reduce((s, c) => s + c.valor, 0)
  const totalAtrasado = contasPagar.filter((c) => c.status === 'atrasado').reduce((s, c) => s + c.valor, 0)
  const totalGeral = contasPagar.reduce((s, c) => s + c.valor, 0)

  const subcategoriasFixas = ['aluguel', 'energia', 'internet', 'funcionários']
  const subcategoriasVariaveis = ['manutenção', 'fornecedores', 'extras']
  const subcategorias = filterCategoria === 'fixa'
    ? subcategoriasFixas
    : filterCategoria === 'variavel'
    ? subcategoriasVariaveis
    : [...subcategoriasFixas, ...subcategoriasVariaveis]

  const hasFilters = filterEspaco || filterCategoria || filterSubcategoria || filterMes

  function clearFilters() {
    setFilterEspaco('')
    setFilterCategoria('')
    setFilterSubcategoria('')
    setFilterMes('')
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-app-border bg-app-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-app-muted" />
            <span className="text-xs text-app-muted">Total Geral</span>
          </div>
          <p className="text-xl font-bold text-app-text">{formatCurrency(totalGeral)}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-emerald-400">Pagas</span>
          </div>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalPago)}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-amber-400">Pendentes</span>
          </div>
          <p className="text-xl font-bold text-amber-400">{formatCurrency(totalPendente)}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span className="text-xs text-red-400">Atrasadas</span>
          </div>
          <p className="text-xl font-bold text-red-400">{formatCurrency(totalAtrasado)}</p>
        </div>
      </div>

      {/* Tabs + Filtros */}
      <div className="rounded-xl border border-app-border bg-app-surface">
        <div className="flex items-center justify-between px-5 pt-4 pb-0 border-b border-app-border">
          <div className="flex gap-1">
            <button
              onClick={() => setTab('apagar')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === 'apagar'
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-app-muted hover:text-app-text'
              }`}
            >
              <span className="flex items-center gap-2">
                <Receipt className="h-3.5 w-3.5" />
                Contas a Pagar
                <span className="rounded-full bg-amber-500/15 text-amber-400 text-xs px-1.5 py-0.5">
                  {contasPagar.filter(c => c.status !== 'pago').length}
                </span>
              </span>
            </button>
            <button
              onClick={() => setTab('pagas')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === 'pagas'
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-app-muted hover:text-app-text'
              }`}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Contas Pagas
                <span className="rounded-full bg-emerald-500/15 text-emerald-400 text-xs px-1.5 py-0.5">
                  {contasPagar.filter(c => c.status === 'pago').length}
                </span>
              </span>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-app-border bg-app-surface2/30">
          <Filter className="h-3.5 w-3.5 text-app-subtle shrink-0" />

          <select
            value={filterEspaco}
            onChange={(e) => setFilterEspaco(e.target.value)}
            className="rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:border-violet-500 focus:outline-none cursor-pointer"
          >
            <option value="">Todos os espaços</option>
            <option value="Todos">Geral (Todos)</option>
            {ESPACOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>

          <select
            value={filterCategoria}
            onChange={(e) => {
              setFilterCategoria(e.target.value as CategoriaContaPagar | '')
              setFilterSubcategoria('')
            }}
            className="rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:border-violet-500 focus:outline-none cursor-pointer"
          >
            <option value="">Todas as categorias</option>
            <option value="fixa">Despesas Fixas</option>
            <option value="variavel">Despesas Variáveis</option>
          </select>

          <select
            value={filterSubcategoria}
            onChange={(e) => setFilterSubcategoria(e.target.value)}
            className="rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:border-violet-500 focus:outline-none cursor-pointer"
          >
            <option value="">Todas as subcategorias</option>
            {subcategorias.map((s) => <option key={s} value={s}>{subcategoriaLabel[s]}</option>)}
          </select>

          <select
            value={filterMes}
            onChange={(e) => setFilterMes(e.target.value)}
            className="rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:border-violet-500 focus:outline-none cursor-pointer"
          >
            <option value="">Todos os meses</option>
            {meses.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-app-muted hover:text-red-400 transition-colors ml-auto"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="p-5 space-y-6">
          {/* Despesas Fixas */}
          {fixas.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-app-subtle">
                  Despesas Fixas
                </h3>
                <span className="text-xs text-app-subtle">
                  — {formatCurrency(fixas.reduce((s, c) => s + c.valor, 0))}
                </span>
              </div>
              <div className="space-y-2">
                {fixas.map((conta) => (
                  <ContaRow key={conta.id} conta={conta} />
                ))}
              </div>
            </section>
          )}

          {/* Despesas Variáveis */}
          {variaveis.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-app-subtle">
                  Despesas Variáveis
                </h3>
                <span className="text-xs text-app-subtle">
                  — {formatCurrency(variaveis.reduce((s, c) => s + c.valor, 0))}
                </span>
              </div>
              <div className="space-y-2">
                {variaveis.map((conta) => (
                  <ContaRow key={conta.id} conta={conta} />
                ))}
              </div>
            </section>
          )}

          {fixas.length === 0 && variaveis.length === 0 && (
            <p className="text-sm text-app-subtle text-center py-8">
              Nenhuma conta encontrada com os filtros selecionados.
            </p>
          )}

          {filtered.length > 0 && (
            <div className="flex justify-between items-center pt-3 border-t border-app-border">
              <span className="text-xs text-app-muted">{filtered.length} contas</span>
              <span className="text-sm font-bold text-app-text">
                Total: {formatCurrency(filtered.reduce((s, c) => s + c.valor, 0))}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ContaRow({ conta }: { conta: ContaPagar }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-app-border2/50 bg-app-surface2/40 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-app-text truncate">{conta.descricao}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${subcategoriaBadge[conta.subcategoria]}`}>
            {subcategoriaLabel[conta.subcategoria]}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-app-subtle">{conta.espaco}</span>
          {conta.fornecedor && (
            <span className="text-xs text-app-subtle">· {conta.fornecedor}</span>
          )}
          <span className="text-xs text-app-subtle">
            · Venc. {conta.dataVencimento.split('-').reverse().join('/')}
          </span>
          {conta.dataPagamento && (
            <span className="text-xs text-emerald-400">
              · Pago em {conta.dataPagamento.split('-').reverse().join('/')}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge[conta.status]}`}>
          {statusLabel[conta.status]}
        </span>
        <span className="text-sm font-bold text-app-text w-24 text-right">
          {formatCurrency(conta.valor)}
        </span>
      </div>
    </div>
  )
}
