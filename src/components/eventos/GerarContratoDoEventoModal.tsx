'use client'

import { useState } from 'react'
import { X, FileSignature, Handshake } from 'lucide-react'
import { parseCurrencyBR, formatCurrency } from '@/lib/utils'
import type { Evento, Contrato, TipoMinuta } from '@/types'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

interface Props {
  evento: Evento
  onClose: () => void
  onSave: (c: Contrato) => Promise<void>
  onCreated: (contrato: Contrato) => void
}

export default function GerarContratoDoEventoModal({ evento, onClose, onSave, onCreated }: Props) {
  const [tipoMinuta, setTipoMinuta] = useState<TipoMinuta>('locacao')
  const [valorNegociado, setValorNegociado] = useState(String(evento.valor))
  const [observacaoNegociacao, setObservacaoNegociacao] = useState('')
  const [observacaoParceria, setObservacaoParceria] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleCriar() {
    setSaving(true)
    setErro(null)
    try {
      const now = new Date()
      const seq = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0')
      const contrato: Contrato = {
        id: crypto.randomUUID(),
        numeroContrato: `EL-${seq}-${String(Date.now()).slice(-4)}`,
        cliente: evento.cliente,
        cpfCnpj: evento.pessoaJuridica ? (evento.cnpj || '—') : (evento.cpf || '—'),
        espaco: evento.espaco,
        dataEvento: evento.data,
        horaInicio: evento.horaInicio,
        horaFim: evento.horaFim,
        valorTotal: evento.valor,
        valorEntrada: evento.valorSinal ?? 0,
        dataAssinatura: now.toISOString().split('T')[0],
        status: evento.status,
        responsavel: evento.responsavel || '—',
        observacoes: evento.observacoes || '',
        tipo: evento.tipo,
        tipoMinuta,
        valorNegociado: valorNegociado ? parseCurrencyBR(valorNegociado) : undefined,
        observacaoNegociacao: observacaoNegociacao.trim() || undefined,
        observacaoParceria: tipoMinuta === 'parceria' ? (observacaoParceria.trim() || undefined) : undefined,
        eventoId: evento.id,
      }
      await onSave(contrato)
      onCreated(contrato)
    } catch (err) {
      setErro(err instanceof Error ? `Não foi possível criar o contrato: ${err.message}` : 'Não foi possível criar o contrato.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-[#25D366]" />
            Gerar Contrato deste evento
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg border border-app-border2/50 bg-app-surface2/40 px-3 py-2.5">
            <p className="text-sm font-medium text-app-text">{evento.cliente}</p>
            <p className="text-xs text-app-subtle mt-0.5">{evento.espaco} · {evento.data.split('-').reverse().join('/')} · {formatCurrency(evento.valor)}</p>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Tipo de minuta</label>
            <select
              value={tipoMinuta}
              onChange={e => setTipoMinuta(e.target.value as TipoMinuta)}
              className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
              onBlur={e => { e.currentTarget.style.borderColor = '' }}
            >
              <option value="locacao">Locação (valor fixo)</option>
              <option value="parceria">Parceria (% sobre faturamento)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Valor negociado (R$)</label>
            <input
              type="text" inputMode="decimal"
              value={valorNegociado}
              onChange={e => setValorNegociado(e.target.value)}
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
              onBlur={e => { e.currentTarget.style.borderColor = '' }}
            />
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Observação sobre a negociação</label>
            <textarea
              value={observacaoNegociacao}
              onChange={e => setObservacaoNegociacao(e.target.value)}
              rows={2}
              placeholder="Ex: desconto combinado, condições específicas do acordo…"
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none resize-none"
              onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
              onBlur={e => { e.currentTarget.style.borderColor = '' }}
            />
          </div>

          {tipoMinuta === 'parceria' && (
            <div>
              <label className="text-xs text-app-subtle mb-0.5 flex items-center gap-1.5">
                <Handshake className="h-3.5 w-3.5" />
                Observação sobre a parceria
              </label>
              <textarea
                value={observacaoParceria}
                onChange={e => setObservacaoParceria(e.target.value)}
                rows={2}
                placeholder="Descreva a parceria: com quem, o que cada lado cede…"
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none resize-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
          )}

          {erro && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60">
            Cancelar
          </button>
          <button
            onClick={handleCriar}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 transition-colors"
            style={{ backgroundColor: GREEN }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = DARK_GREEN }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
          >
            <FileSignature className="h-3.5 w-3.5" />
            {saving ? 'Criando…' : 'Criar contrato'}
          </button>
        </div>
      </div>
    </div>
  )
}
