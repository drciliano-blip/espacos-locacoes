'use client'

import { useEffect, useState } from 'react'
import { Inbox, ChevronDown, ChevronUp, Mail, Phone, Calendar, FileSignature } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import FileList from '@/components/shared/FileList'
import GerarContratoModal from '@/components/contratos/GerarContratoModal'
import type { FichaCliente } from '@/types'

interface FichaRow {
  id: string
  criado_em: string
  nome_completo: string
  cpf: string
  rg: string | null
  data_nascimento: string | null
  email: string
  telefone_celular: string
  endereco: FichaCliente['endereco'] | null
  pessoa_juridica: boolean
  razao_social: string | null
  nome_fantasia: string | null
  cnpj: string | null
  endereco_empresa: FichaCliente['enderecoEmpresa'] | null
  nome_evento: string
  espaco_desejado: string
  tipo_evento: string
  data_evento: string
  hora_inicio_montagem: string | null
  hora_inicio_evento: string | null
  hora_termino_evento: string | null
  valor_locacao: string | null
  forma_pagamento: string | null
  valor_sinal: string | null
  data_vencimento_saldo: string | null
  documento_file_id: string | null
}

function fromRow(row: FichaRow): FichaCliente {
  return {
    id: row.id,
    criadoEm: row.criado_em,
    nomeCompleto: row.nome_completo,
    cpf: row.cpf,
    rg: row.rg ?? undefined,
    dataNascimento: row.data_nascimento ?? undefined,
    email: row.email,
    telefoneCelular: row.telefone_celular,
    endereco: row.endereco ?? { rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '' },
    pessoaJuridica: row.pessoa_juridica,
    razaoSocial: row.razao_social ?? undefined,
    nomeFantasia: row.nome_fantasia ?? undefined,
    cnpj: row.cnpj ?? undefined,
    enderecoEmpresa: row.endereco_empresa ?? undefined,
    nomeEvento: row.nome_evento,
    espacoDesejado: row.espaco_desejado,
    tipoEvento: row.tipo_evento,
    dataEvento: row.data_evento,
    horaInicioMontagem: row.hora_inicio_montagem?.slice(0, 5) ?? undefined,
    horaInicioEvento: row.hora_inicio_evento?.slice(0, 5) ?? undefined,
    horaTerminoEvento: row.hora_termino_evento?.slice(0, 5) ?? undefined,
    valorLocacao: row.valor_locacao ?? undefined,
    formaPagamento: row.forma_pagamento ?? undefined,
    valorSinal: row.valor_sinal ?? undefined,
    dataVencimentoSaldo: row.data_vencimento_saldo ?? undefined,
    documentoFileId: row.documento_file_id ?? undefined,
  }
}

export default function FichasRecebidasSection() {
  const [fichas, setFichas] = useState<FichaCliente[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [gerarContratoFicha, setGerarContratoFicha] = useState<FichaCliente | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('fichas_clientes')
      .select('*')
      .order('criado_em', { ascending: false })
      .then(({ data }) => setFichas(((data as unknown as FichaRow[]) ?? []).map(fromRow)))
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <p className="text-app-subtle flex items-center gap-1.5"><Mail className="h-3 w-3" />{f.email}</p>
                  <p className="text-app-subtle flex items-center gap-1.5"><Phone className="h-3 w-3" />{f.telefoneCelular}</p>
                  <p className="text-app-subtle">CPF: {f.cpf}</p>
                  {f.pessoaJuridica && <p className="text-app-subtle">CNPJ: {f.cnpj}</p>}
                  <p className="text-app-subtle">Tipo de evento: {f.tipoEvento}</p>
                  <p className="text-app-subtle">Forma de pagamento: {f.formaPagamento || '—'}</p>
                  <p className="text-app-subtle">Valor: {f.valorLocacao ? formatCurrency(Number(f.valorLocacao)) : '—'}</p>
                  {f.formaPagamento === 'Parcelado' && (
                    <>
                      <p className="text-app-subtle">Sinal proposto: {f.valorSinal ? formatCurrency(Number(f.valorSinal)) : '—'}</p>
                      <p className="text-app-subtle">Vencimento do saldo: {f.dataVencimentoSaldo ? f.dataVencimentoSaldo.split('-').reverse().join('/') : '—'}</p>
                    </>
                  )}
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
