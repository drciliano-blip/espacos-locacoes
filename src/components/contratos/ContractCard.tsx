'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText, MessageSquare, User, Paperclip, FileSignature } from 'lucide-react'
import type { Contrato } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import FileList from '@/components/shared/FileList'
import FileAttachButton from '@/components/shared/FileAttachButton'
import GerarContratoModal from '@/components/contratos/GerarContratoModal'

const statusBadge: Record<string, string> = {
  confirmado:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  em_negociacao: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  cancelado:     'bg-red-500/10 text-red-400 border-red-500/20',
}

const statusLabel: Record<string, string> = {
  confirmado:    'Confirmado',
  em_negociacao: 'Em negociação',
  cancelado:     'Cancelado',
}

const espacoColors: Record<string, string> = {
  'Usine': 'border-t-violet-500',
  'Fabrique': 'border-t-indigo-500',
  'House Pacaembu': 'border-t-sky-500',
  'Complexo Jussara': 'border-t-emerald-500',
  'Espaço Solon': 'border-t-orange-500',
}

interface ContractCardProps {
  contrato: Contrato
}

export default function ContractCard({ contrato: c }: ContractCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [obs, setObs] = useState(c.observacoes)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(c.observacoes)
  const [gerarContratoOpen, setGerarContratoOpen] = useState(false)

  const saldoRestante = c.valorTotal - c.valorEntrada
  const pctPago = c.valorTotal > 0 ? Math.round((c.valorEntrada / c.valorTotal) * 100) : 0

  return (
    <div className={`rounded-xl border border-app-border2 bg-app-surface overflow-hidden border-t-2 ${espacoColors[c.espaco] ?? 'border-t-zinc-600'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-app-subtle">{c.numeroContrato}</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge[c.status]}`}>
                {statusLabel[c.status] ?? c.status}
              </span>
            </div>
            <p className="text-base font-bold text-app-text mt-1">{c.cliente}</p>
            <p className="text-xs text-app-muted">{c.tipo} · {c.espaco}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-app-text">{formatCurrency(c.valorTotal)}</p>
            <p className="text-xs text-app-subtle">Responsável: {c.responsavel}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-app-muted">
          <span>Data: {formatDate(c.dataEvento)}</span>
          <span>Horário: {c.horaInicio}–{c.horaFim}</span>
          <span>Assinado em: {formatDate(c.dataAssinatura)}</span>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-app-subtle">Pagamento recebido</span>
            <span className="font-medium text-app-text2">{pctPago}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-app-surface3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pctPago}%`, backgroundColor: '#25D366' }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1 text-app-subtle">
            <span>Entrada: {formatCurrency(c.valorEntrada)}</span>
            <span>Saldo: {formatCurrency(saldoRestante)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex flex-1 items-center justify-between rounded-lg border border-app-border2/50 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              Detalhes e documentos
            </span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setGerarContratoOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#128C7E] hover:bg-[#25D366]/20 transition-colors"
          >
            <FileSignature className="h-3 w-3" />
            Gerar Contrato
          </button>
        </div>
      </div>

      {gerarContratoOpen && (
        <GerarContratoModal origem={{ tipo: 'contrato', dados: c }} onClose={() => setGerarContratoOpen(false)} />
      )}

      {expanded && (
        <div className="border-t border-app-border bg-app-bg/50 p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              { label: 'CPF/CNPJ', value: c.cpfCnpj },
              { label: 'Valor total', value: formatCurrency(c.valorTotal) },
              { label: 'Entrada', value: formatCurrency(c.valorEntrada) },
              { label: 'Saldo restante', value: formatCurrency(saldoRestante) },
              { label: 'Data do evento', value: formatDate(c.dataEvento) },
              { label: 'Horário', value: `${c.horaInicio} às ${c.horaFim}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-app-subtle">{label}</p>
                <p className="font-medium text-app-text">{value}</p>
              </div>
            ))}
          </div>

          {/* Responsável */}
          <div className="rounded-lg border border-app-border2/50 bg-app-surface2/30 px-4 py-3">
            <p className="text-xs font-medium text-app-muted flex items-center gap-1.5 mb-1.5">
              <User className="h-3 w-3" />
              Funcionário responsável
            </p>
            <p className="text-sm font-semibold text-app-text">{c.responsavel}</p>
            <p className="text-xs text-app-subtle mt-0.5">Espaço: {c.espaco}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-app-muted flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" />
                Observações
              </p>
              {!editing ? (
                <button onClick={() => { setEditing(true); setDraft(obs) }}
                  className="text-xs text-[#25D366] hover:text-[#128C7E] transition-colors">
                  Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setObs(draft); setEditing(false) }}
                    className="text-xs text-emerald-600 hover:text-emerald-700 transition-colors">
                    Salvar
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="text-xs text-app-subtle hover:text-app-text2 transition-colors">
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3}
                className="w-full rounded-lg border bg-app-surface2 px-3 py-2 text-sm text-app-text focus:outline-none resize-none"
                onFocus={e => { e.currentTarget.style.borderColor = '#25D366' }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            ) : (
              <p className="text-sm text-app-muted bg-app-surface2/50 rounded-lg px-3 py-2 border border-app-border2/30 leading-relaxed">
                {obs || <span className="text-app-subtle italic">Sem observações.</span>}
              </p>
            )}
          </div>

          {/* Documentos do contrato */}
          <div>
            <p className="text-xs font-medium text-app-muted flex items-center gap-1.5 mb-3">
              <Paperclip className="h-3 w-3" />
              Documentos anexados
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <FileAttachButton
                module="contratos"
                entityId={c.id}
                entityName={`${c.cliente} — ${c.numeroContrato}`}
                espaco={c.espaco}
                categoria="contrato"
                label="Anexar contrato"
              />
              <FileAttachButton
                module="contratos"
                entityId={c.id}
                entityName={`${c.cliente} — ${c.numeroContrato}`}
                espaco={c.espaco}
                categoria="comprovante_sinal"
                label="Anexar comprovante de sinal"
              />
            </div>
            <FileList
              module="contratos"
              entityId={c.id}
              entityName={`${c.cliente} — ${c.numeroContrato}`}
              espaco={c.espaco}
              showAttach={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}
