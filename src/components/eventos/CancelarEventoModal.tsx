'use client'

import { useState } from 'react'
import { X, Ban, Trash2, ArrowLeft } from 'lucide-react'
import type { Evento } from '@/types'
import { formatCurrency, parseCurrencyBR } from '@/lib/utils'

type Passo = 'escolha' | 'reembolso-tipo' | 'reembolso-valor' | 'excluir-confirma'

interface Props {
  evento: Evento
  totalRecebido: number
  onClose: () => void
  onManterReceita: () => Promise<void>
  onReembolso: (valor: number) => Promise<void>
  onExcluir: () => Promise<void>
}

// Diferencia claramente os 3 caminhos de "cancelar um evento": cancelamento
// comercial puro (evento não acontece, mas o dinheiro fica), reembolso
// financeiro (dinheiro recebido é devolvido — vira uma saída vinculada ao
// evento, nunca apaga a receita original) e exclusão por erro de cadastro
// (evento nunca deveria ter existido — some tudo).
export default function CancelarEventoModal({ evento, totalRecebido, onClose, onManterReceita, onReembolso, onExcluir }: Props) {
  const [passo, setPasso] = useState<Passo>('escolha')
  const [tipoReembolso, setTipoReembolso] = useState<'integral' | 'parcial' | null>(null)
  const [valorParcial, setValorParcial] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleManterReceita() {
    setProcessando(true)
    setErro(null)
    try {
      await onManterReceita()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível cancelar o evento.')
    } finally {
      setProcessando(false)
    }
  }

  async function handleConfirmarReembolso() {
    const valor = tipoReembolso === 'integral' ? totalRecebido : parseCurrencyBR(valorParcial)
    setSubmitted(true)
    if (tipoReembolso === 'parcial' && (!valorParcial || valor <= 0 || valor > totalRecebido)) return
    setProcessando(true)
    setErro(null)
    try {
      await onReembolso(valor)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível registrar o reembolso.')
    } finally {
      setProcessando(false)
    }
  }

  async function handleExcluir() {
    setProcessando(true)
    setErro(null)
    try {
      await onExcluir()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível excluir o evento.')
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-app-text flex items-center gap-2">
            <Ban className="h-4 w-4 text-red-400" />
            Cancelar evento
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {passo === 'escolha' && (
          <div className="space-y-3">
            <p className="text-sm text-app-muted">{evento.cliente} — {evento.espaco}</p>
            {totalRecebido > 0 && (
              <p className="text-xs text-app-subtle">Recebido até agora: <span className="font-semibold text-app-text">{formatCurrency(totalRecebido)}</span></p>
            )}

            <button
              onClick={handleManterReceita}
              disabled={processando}
              className="w-full text-left rounded-lg border border-app-border2 p-3 hover:bg-app-surface2 transition-colors disabled:opacity-50"
            >
              <p className="text-sm font-medium text-app-text">Cancelar e manter a receita</p>
              <p className="text-xs text-app-subtle mt-0.5">O evento fica marcado como Cancelado. O valor já recebido continua com a empresa — nenhum estorno é feito.</p>
            </button>

            <button
              onClick={() => setPasso('reembolso-tipo')}
              disabled={processando || totalRecebido <= 0}
              className="w-full text-left rounded-lg border border-app-border2 p-3 hover:bg-app-surface2 transition-colors disabled:opacity-50"
            >
              <p className="text-sm font-medium text-app-text">Cancelar e gerar reembolso</p>
              <p className="text-xs text-app-subtle mt-0.5">
                {totalRecebido > 0
                  ? 'O dinheiro recebido será devolvido — gera uma saída financeira vinculada a este evento.'
                  : 'Não há valor recebido para reembolsar neste evento.'}
              </p>
            </button>

            <button
              onClick={() => setPasso('excluir-confirma')}
              disabled={processando}
              className="w-full text-left rounded-lg border border-red-500/30 bg-red-500/5 p-3 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <p className="text-sm font-medium text-red-400 flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" />Excluir definitivamente</p>
              <p className="text-xs text-app-subtle mt-0.5">Use só se o evento foi criado por engano e nunca deveria ter existido.</p>
            </button>

            {erro && <p className="text-xs text-red-400">{erro}</p>}
          </div>
        )}

        {passo === 'reembolso-tipo' && (
          <div className="space-y-3">
            <button onClick={() => setPasso('escolha')} className="flex items-center gap-1 text-xs text-app-subtle hover:text-app-text transition-colors mb-1">
              <ArrowLeft className="h-3 w-3" />Voltar
            </button>
            <p className="text-sm text-app-muted">O reembolso será integral ou parcial?</p>
            <button
              onClick={() => { setTipoReembolso('integral'); setPasso('reembolso-valor') }}
              className="w-full text-left rounded-lg border border-app-border2 p-3 hover:bg-app-surface2 transition-colors"
            >
              <p className="text-sm font-medium text-app-text">Integral</p>
              <p className="text-xs text-app-subtle mt-0.5">Devolve o valor recebido inteiro: {formatCurrency(totalRecebido)}</p>
            </button>
            <button
              onClick={() => { setTipoReembolso('parcial'); setPasso('reembolso-valor') }}
              className="w-full text-left rounded-lg border border-app-border2 p-3 hover:bg-app-surface2 transition-colors"
            >
              <p className="text-sm font-medium text-app-text">Parcial</p>
              <p className="text-xs text-app-subtle mt-0.5">Devolve só uma parte — a diferença fica como receita efetiva.</p>
            </button>
          </div>
        )}

        {passo === 'reembolso-valor' && (
          <div className="space-y-3">
            <button onClick={() => setPasso('reembolso-tipo')} className="flex items-center gap-1 text-xs text-app-subtle hover:text-app-text transition-colors mb-1">
              <ArrowLeft className="h-3 w-3" />Voltar
            </button>
            {tipoReembolso === 'integral' ? (
              <p className="text-sm text-app-muted">
                Confirma o reembolso integral de <span className="font-semibold text-app-text">{formatCurrency(totalRecebido)}</span>?
                Isso gera uma saída financeira (Reembolso de Evento) vinculada a este evento.
              </p>
            ) : (
              <>
                <label className="text-xs text-app-subtle mb-0.5 block">Valor do reembolso (R$)<span className="text-red-400 ml-0.5">*</span></label>
                <input
                  type="text" inputMode="decimal"
                  value={valorParcial}
                  onChange={e => setValorParcial(e.target.value)}
                  placeholder="0,00"
                  className={`w-full rounded-lg border ${submitted && (!valorParcial || parseCurrencyBR(valorParcial) <= 0 || parseCurrencyBR(valorParcial) > totalRecebido) ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                />
                <p className="text-xs text-app-subtle">Máximo: {formatCurrency(totalRecebido)}</p>
              </>
            )}
            {erro && <p className="text-xs text-red-400">{erro}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} disabled={processando} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleConfirmarReembolso} disabled={processando} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                {processando ? 'Processando…' : 'Confirmar reembolso'}
              </button>
            </div>
          </div>
        )}

        {passo === 'excluir-confirma' && (
          <div className="space-y-3">
            <button onClick={() => setPasso('escolha')} className="flex items-center gap-1 text-xs text-app-subtle hover:text-app-text transition-colors mb-1">
              <ArrowLeft className="h-3 w-3" />Voltar
            </button>
            <p className="text-sm text-red-400 font-medium">
              Este evento e todos os registros financeiros gerados por ele serão excluídos definitivamente. Deseja continuar?
            </p>
            <p className="text-xs text-app-subtle">Isso remove o evento, as receitas e reembolsos vinculados a ele — não fica só como "Cancelado". Esta ação não pode ser desfeita.</p>
            {erro && <p className="text-xs text-red-400">{erro}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} disabled={processando} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-50">
                Voltar
              </button>
              <button onClick={handleExcluir} disabled={processando} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                {processando ? 'Excluindo…' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
