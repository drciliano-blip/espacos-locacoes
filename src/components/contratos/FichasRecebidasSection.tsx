'use client'

import { useEffect, useState } from 'react'
import { Inbox, ChevronDown, ChevronUp, Mail, Phone, Calendar, FileSignature } from 'lucide-react'
import { getFichas } from '@/lib/fichas-store'
import { formatCurrency } from '@/lib/utils'
import FileList from '@/components/shared/FileList'
import GerarContratoModal from '@/components/contratos/GerarContratoModal'
import type { FichaCliente } from '@/types'

export default function FichasRecebidasSection() {
  const [fichas, setFichas] = useState<FichaCliente[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [gerarContratoFicha, setGerarContratoFicha] = useState<FichaCliente | null>(null)

  useEffect(() => {
    setFichas(getFichas())
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366]/15">
          <Inbox className="h-4 w-4 text-[#25D366]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-app-text">{fichas.length} fichas recebidas</p>
          <p className="text-xs text-app-muted">Enviadas pelo formulário público /ficha-cliente</p>
        </div>
      </div>

      <div className="space-y-2">
        {fichas.length === 0 ? (
          <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center">
            <p className="text-sm text-app-subtle">Nenhuma ficha recebida ainda.</p>
          </div>
        ) : fichas.map(f => (
          <div key={f.id} className="rounded-lg border border-app-border2/50 bg-app-surface2/40 overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-app-text truncate">{f.nomeCompleto}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-xs text-app-subtle">{f.nomeEvento} · {f.espacoDesejado}</span>
                  <span className="flex items-center gap-1 text-xs text-app-subtle">
                    <Calendar className="h-3 w-3" />
                    {f.dataEvento ? f.dataEvento.split('-').reverse().join('/') : '—'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setGerarContratoFicha(f)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#128C7E] hover:bg-[#25D366]/20 transition-colors"
                >
                  <FileSignature className="h-3.5 w-3.5" />
                  Gerar contrato desta ficha
                </button>
                <button onClick={() => setExpandedId(id => id === f.id ? null : f.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 transition-colors">
                  {expandedId === f.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {expandedId === f.id && (
              <div className="px-4 pb-4 pt-1 border-t border-app-border/50 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <p className="text-app-subtle flex items-center gap-1.5"><Mail className="h-3 w-3" />{f.email}</p>
                  <p className="text-app-subtle flex items-center gap-1.5"><Phone className="h-3 w-3" />{f.telefoneCelular}</p>
                  <p className="text-app-subtle">CPF: {f.cpf}</p>
                  {f.pessoaJuridica && <p className="text-app-subtle">CNPJ: {f.cnpj}</p>}
                  <p className="text-app-subtle">Tipo de evento: {f.tipoEvento}</p>
                  <p className="text-app-subtle">Forma de pagamento: {f.formaPagamento || '—'}</p>
                  <p className="text-app-subtle">Valor: {f.valorLocacao ? formatCurrency(Number(f.valorLocacao)) : '—'}</p>
                  <p className="text-app-subtle">
                    Montagem {f.horaInicioMontagem || '—'} · Início {f.horaInicioEvento || '—'} · Término {f.horaTerminoEvento || '—'}
                  </p>
                </div>
                {f.pessoaJuridica && (f.razaoSocial || f.nomeFantasia) && (
                  <p className="text-xs text-app-subtle">
                    Empresa: {f.razaoSocial} {f.nomeFantasia ? `(${f.nomeFantasia})` : ''}
                  </p>
                )}
                <div>
                  <p className="text-xs font-medium text-app-muted mb-1.5">Documento anexado</p>
                  <FileList module="fichas" entityId={f.id} entityName={f.nomeCompleto} showAttach={false} compact />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {gerarContratoFicha && (
        <GerarContratoModal
          origem={{ tipo: 'ficha', dados: gerarContratoFicha }}
          onClose={() => setGerarContratoFicha(null)}
        />
      )}
    </div>
  )
}
