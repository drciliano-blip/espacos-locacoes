'use client'

import { useState } from 'react'
import { Calculator, Plus, Trash2, RotateCcw } from 'lucide-react'
import { formatCurrency, parseCurrencyBR } from '@/lib/utils'

const FUNCOES = [
  'Barman', 'Chefe de Bar', 'Atendente de Bar', 'Segurança', 'Bombeiro', 'Policial',
  'Técnico de Som', 'Técnico de Luz', 'Hostess', 'Recepção', 'Caixa', 'Limpeza', 'Chapelaria',
] as const

// Valores de referência — só preenchem o campo automaticamente ao escolher a função,
// continuam 100% editáveis linha a linha depois.
const VALOR_PADRAO: Record<string, number> = {
  'Técnico de Som': 400, 'Técnico de Luz': 400, 'Segurança': 200, 'Bombeiro': 210,
  'Policial': 500, 'Limpeza': 230, 'Recepção': 150, 'Caixa': 150, 'Chapelaria': 150,
  'Chefe de Bar': 160, 'Atendente de Bar': 140,
}

const OUTRA = 'Outra categoria'

interface Linha {
  id: string
  funcao: string
  funcaoCustom: string
  quantidade: string
  valorUnitario: string
}

function novaLinha(): Linha {
  const funcao = FUNCOES[0]
  return {
    id: crypto.randomUUID(),
    funcao,
    funcaoCustom: '',
    quantidade: '1',
    valorUnitario: VALOR_PADRAO[funcao] !== undefined ? String(VALOR_PADRAO[funcao]) : '',
  }
}

export default function CalculadoraStaffPage() {
  const [contexto, setContexto] = useState({ pessoas: '', duracao: '' })
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()])

  function atualizarLinha(id: string, patch: Partial<Linha>) {
    setLinhas(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)))
  }

  function trocarFuncao(id: string, funcao: string) {
    setLinhas(prev => prev.map(l => {
      if (l.id !== id) return l
      const valorPadrao = VALOR_PADRAO[funcao]
      return { ...l, funcao, valorUnitario: valorPadrao !== undefined ? String(valorPadrao) : l.valorUnitario }
    }))
  }

  function adicionarLinha() {
    setLinhas(prev => [...prev, novaLinha()])
  }

  function removerLinha(id: string) {
    setLinhas(prev => (prev.length > 1 ? prev.filter(l => l.id !== id) : prev))
  }

  function limparTudo() {
    setContexto({ pessoas: '', duracao: '' })
    setLinhas([novaLinha()])
  }

  const linhasComSubtotal = linhas.map(l => {
    const quantidadeNum = Number(l.quantidade) || 0
    const valorNum = l.valorUnitario ? parseCurrencyBR(l.valorUnitario) : 0
    return { ...l, subtotal: quantidadeNum * valorNum }
  })

  const total = linhasComSubtotal.reduce((s, l) => s + l.subtotal, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-bold text-app-text flex items-center gap-2">
          <Calculator className="h-5 w-5 text-[#25D366]" />
          Calculadora de Staff
        </h1>
        <p className="text-sm text-app-muted mt-0.5">Monte a equipe do evento e veja o custo total na hora — nada aqui é salvo.</p>
      </div>

      <div className="rounded-xl border border-app-border bg-app-surface p-4 flex flex-wrap gap-4">
        <div>
          <label className="text-xs text-app-subtle mb-1 block">Número de pessoas (opcional)</label>
          <input
            value={contexto.pessoas}
            onChange={e => setContexto(c => ({ ...c, pessoas: e.target.value }))}
            placeholder="Ex: 800"
            inputMode="numeric"
            className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none w-40"
          />
        </div>
        <div>
          <label className="text-xs text-app-subtle mb-1 block">Duração do evento (opcional)</label>
          <input
            value={contexto.duracao}
            onChange={e => setContexto(c => ({ ...c, duracao: e.target.value }))}
            placeholder="Ex: até 8h"
            className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none w-40"
          />
        </div>
      </div>

      <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-app-border bg-app-surface2/40">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-app-subtle uppercase tracking-wide">Função</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-app-subtle uppercase tracking-wide w-28">Quantidade</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-app-subtle uppercase tracking-wide w-36">Valor Unitário (R$)</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-app-subtle uppercase tracking-wide w-32">Subtotal</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/50">
              {linhasComSubtotal.map(l => (
                <tr key={l.id}>
                  <td className="px-3 py-2 align-top">
                    <select
                      value={l.funcao}
                      onChange={e => trocarFuncao(l.id, e.target.value)}
                      className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-sm text-app-text focus:outline-none"
                    >
                      {FUNCOES.map(f => <option key={f} value={f}>{f}</option>)}
                      <option value={OUTRA}>{OUTRA}</option>
                    </select>
                    {l.funcao === OUTRA && (
                      <input
                        value={l.funcaoCustom}
                        onChange={e => atualizarLinha(l.id, { funcaoCustom: e.target.value })}
                        placeholder="Nome da função"
                        className="mt-1.5 w-full rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-sm text-app-text focus:outline-none"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="number" min="0" inputMode="numeric"
                      value={l.quantidade}
                      onChange={e => atualizarLinha(l.id, { quantidade: e.target.value })}
                      className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-sm text-app-text focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text" inputMode="decimal"
                      value={l.valorUnitario}
                      onChange={e => atualizarLinha(l.id, { valorUnitario: e.target.value })}
                      placeholder="0,00"
                      className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-sm text-app-text focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 align-top text-right font-semibold text-app-text whitespace-nowrap">{formatCurrency(l.subtotal)}</td>
                  <td className="px-3 py-2 align-top text-center">
                    <button
                      onClick={() => removerLinha(l.id)}
                      disabled={linhas.length === 1}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-3 py-3 border-t border-app-border">
          <button
            onClick={adicionarLinha}
            className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar função
          </button>
          <button
            onClick={limparTudo}
            className="flex items-center gap-1.5 text-xs text-app-subtle hover:text-red-500 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Limpar tudo
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[#25D366]/25 bg-[#25D366]/5 p-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-medium text-[#128C7E] uppercase tracking-wide">Total Geral</p>
          {(contexto.pessoas || contexto.duracao) && (
            <p className="text-xs text-app-subtle mt-0.5">
              Staff para {contexto.pessoas ? `${contexto.pessoas} pessoas` : 'o evento'}{contexto.duracao ? ` (${contexto.duracao})` : ''}
            </p>
          )}
        </div>
        <p className="text-2xl font-bold text-[#128C7E]">{formatCurrency(total)}</p>
      </div>
    </div>
  )
}
