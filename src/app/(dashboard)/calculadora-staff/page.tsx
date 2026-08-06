'use client'

import { useState } from 'react'
import { Calculator, Plus, Trash2, RotateCcw } from 'lucide-react'
import { formatCurrency, parseCurrencyBR } from '@/lib/utils'

// Funções fixas — sempre visíveis, a operadora só preenche a quantidade de cada
// uma pra agilizar o preenchimento (não precisa selecionar função por função).
const FUNCOES_FIXAS = [
  'Barman', 'Chefe de Bar', 'Atendente de Bar', 'Segurança', 'Bombeiro', 'Policial',
  'Técnico de Som', 'Técnico de Luz', 'Hostess', 'Recepção', 'Caixa', 'Limpeza', 'Chapelaria',
] as const

// Valores de referência — só preenchem o campo automaticamente, continuam 100%
// editáveis (o valor pode mudar de evento pra evento).
const VALOR_PADRAO: Record<string, number> = {
  'Técnico de Som': 400, 'Técnico de Luz': 400, 'Segurança': 200, 'Bombeiro': 210,
  'Policial': 500, 'Limpeza': 230, 'Recepção': 150, 'Caixa': 150, 'Chapelaria': 150,
  'Chefe de Bar': 160, 'Atendente de Bar': 140,
}

interface LinhaFixa {
  quantidade: string
  valorUnitario: string
  horasExtras: string
}

interface LinhaExtra {
  id: string
  funcao: string
  quantidade: string
  valorUnitario: string
  horasExtras: string
}

function linhasFixasIniciais(): Record<string, LinhaFixa> {
  const out: Record<string, LinhaFixa> = {}
  for (const funcao of FUNCOES_FIXAS) {
    out[funcao] = { quantidade: '', valorUnitario: VALOR_PADRAO[funcao] !== undefined ? String(VALOR_PADRAO[funcao]) : '', horasExtras: '' }
  }
  return out
}

function novaLinhaExtra(): LinhaExtra {
  return { id: crypto.randomUUID(), funcao: '', quantidade: '', valorUnitario: '', horasExtras: '' }
}

// Valor Unitário remunera até 8h de evento — a hora extra é 1/8 desse valor,
// recalculada sempre que o Valor Unitário muda.
function valorHoraExtraDe(valorUnitario: string): number {
  const valor = valorUnitario ? parseCurrencyBR(valorUnitario) : 0
  return valor / 8
}

// Valor Total por profissional = Valor Unitário + (Valor Hora Extra × Qtd. Horas Extras).
// Sem horas extras, o valor total fica igual ao Valor Unitário.
function valorTotalDe(valorUnitario: string, horasExtras: string): number {
  const valor = valorUnitario ? parseCurrencyBR(valorUnitario) : 0
  const qtdHoras = Number(horasExtras) || 0
  return valor + valorHoraExtraDe(valorUnitario) * qtdHoras
}

function subtotalDe(quantidade: string, valorUnitario: string, horasExtras: string): number {
  const qtd = Number(quantidade) || 0
  return qtd * valorTotalDe(valorUnitario, horasExtras)
}

export default function CalculadoraStaffPage() {
  const [contexto, setContexto] = useState({ pessoas: '', duracao: '' })
  const [fixas, setFixas] = useState<Record<string, LinhaFixa>>(linhasFixasIniciais)
  const [extras, setExtras] = useState<LinhaExtra[]>([])

  function atualizarFixa(funcao: string, patch: Partial<LinhaFixa>) {
    setFixas(prev => ({ ...prev, [funcao]: { ...prev[funcao], ...patch } }))
  }

  function atualizarExtra(id: string, patch: Partial<LinhaExtra>) {
    setExtras(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)))
  }

  function adicionarExtra() {
    setExtras(prev => [...prev, novaLinhaExtra()])
  }

  function removerExtra(id: string) {
    setExtras(prev => prev.filter(l => l.id !== id))
  }

  function limparTudo() {
    setContexto({ pessoas: '', duracao: '' })
    setFixas(linhasFixasIniciais())
    setExtras([])
  }

  const totalFixas = FUNCOES_FIXAS.reduce((s, f) => s + subtotalDe(fixas[f].quantidade, fixas[f].valorUnitario, fixas[f].horasExtras), 0)
  const totalExtras = extras.reduce((s, l) => s + subtotalDe(l.quantidade, l.valorUnitario, l.horasExtras), 0)
  const total = totalFixas + totalExtras

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-bold text-app-text flex items-center gap-2">
          <Calculator className="h-5 w-5 text-[#25D366]" />
          Calculadora de Staff
        </h1>
        <p className="text-sm text-app-muted mt-0.5">Preencha a quantidade de cada função e veja o custo total na hora — nada aqui é salvo.</p>
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
                <th className="px-3 py-2.5 text-left text-xs font-medium text-app-subtle uppercase tracking-wide w-24">Quantidade</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-app-subtle uppercase tracking-wide w-32">Valor Unitário (R$)</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-app-subtle uppercase tracking-wide w-32">Valor Hora Extra (R$)</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-app-subtle uppercase tracking-wide w-28">Qtd. Horas Extras</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-app-subtle uppercase tracking-wide w-32">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/50">
              {FUNCOES_FIXAS.map(funcao => {
                const linha = fixas[funcao]
                const horaExtra = valorHoraExtraDe(linha.valorUnitario)
                const subtotal = subtotalDe(linha.quantidade, linha.valorUnitario, linha.horasExtras)
                return (
                  <tr key={funcao}>
                    <td className="px-3 py-2 font-medium text-app-text whitespace-nowrap">{funcao}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number" min="0" inputMode="numeric"
                        value={linha.quantidade}
                        onChange={e => atualizarFixa(funcao, { quantidade: e.target.value })}
                        placeholder="0"
                        className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-sm text-app-text focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text" inputMode="decimal"
                        value={linha.valorUnitario}
                        onChange={e => atualizarFixa(funcao, { valorUnitario: e.target.value })}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-sm text-app-text focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap">{formatCurrency(horaExtra)}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number" min="0" inputMode="numeric"
                        value={linha.horasExtras}
                        onChange={e => atualizarFixa(funcao, { horasExtras: e.target.value })}
                        placeholder="0"
                        className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-sm text-app-text focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-app-text whitespace-nowrap">{formatCurrency(subtotal)}</td>
                  </tr>
                )
              })}

              {extras.map(l => {
                const horaExtra = valorHoraExtraDe(l.valorUnitario)
                return (
                  <tr key={l.id} className="bg-app-surface2/20">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          value={l.funcao}
                          onChange={e => atualizarExtra(l.id, { funcao: e.target.value })}
                          placeholder="Nome da função"
                          className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-sm text-app-text focus:outline-none"
                        />
                        <button
                          onClick={() => removerExtra(l.id)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number" min="0" inputMode="numeric"
                        value={l.quantidade}
                        onChange={e => atualizarExtra(l.id, { quantidade: e.target.value })}
                        placeholder="0"
                        className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-sm text-app-text focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text" inputMode="decimal"
                        value={l.valorUnitario}
                        onChange={e => atualizarExtra(l.id, { valorUnitario: e.target.value })}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-sm text-app-text focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap">{formatCurrency(horaExtra)}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number" min="0" inputMode="numeric"
                        value={l.horasExtras}
                        onChange={e => atualizarExtra(l.id, { horasExtras: e.target.value })}
                        placeholder="0"
                        className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-sm text-app-text focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-app-text whitespace-nowrap">{formatCurrency(subtotalDe(l.quantidade, l.valorUnitario, l.horasExtras))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-3 py-3 border-t border-app-border">
          <button
            onClick={adicionarExtra}
            className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar outra função
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
