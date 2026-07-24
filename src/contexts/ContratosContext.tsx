'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAtividades } from '@/contexts/AtividadesContext'
import type { Contrato, Espaco, StatusEvento } from '@/types'

interface ContratoRow {
  id: string
  numero_contrato: string
  cliente: string
  cpf_cnpj: string
  espaco: { nome: string } | null
  data_evento: string
  hora_inicio: string
  hora_fim: string
  valor_total: number | string
  valor_entrada: number | string
  data_assinatura: string
  status: string
  observacoes: string | null
  responsavel: string | null
  tipo: string
  tipo_minuta: string | null
  valor_negociado: number | string | null
  observacao_negociacao: string | null
  observacao_parceria: string | null
  evento_id: string | null
}

function fromRow(row: ContratoRow): Contrato {
  return {
    id: row.id,
    numeroContrato: row.numero_contrato,
    cliente: row.cliente,
    cpfCnpj: row.cpf_cnpj,
    espaco: (row.espaco?.nome ?? '') as Espaco,
    dataEvento: row.data_evento,
    horaInicio: (row.hora_inicio ?? '').slice(0, 5),
    horaFim: (row.hora_fim ?? '').slice(0, 5),
    valorTotal: Number(row.valor_total),
    valorEntrada: Number(row.valor_entrada),
    dataAssinatura: row.data_assinatura,
    status: row.status as StatusEvento,
    observacoes: row.observacoes ?? '',
    responsavel: row.responsavel ?? '',
    tipo: row.tipo,
    tipoMinuta: (row.tipo_minuta as Contrato['tipoMinuta']) ?? undefined,
    valorNegociado: row.valor_negociado != null ? Number(row.valor_negociado) : undefined,
    observacaoNegociacao: row.observacao_negociacao ?? undefined,
    observacaoParceria: row.observacao_parceria ?? undefined,
    eventoId: row.evento_id ?? undefined,
  }
}

interface ContratosContextValue {
  contratos: Contrato[]
  loading: boolean
  addContrato: (c: Contrato) => Promise<void>
}

const ContratosContext = createContext<ContratosContextValue | null>(null)
const SELECT = '*, espaco:espacos(nome)'

export function ContratosProvider({ children }: { children: ReactNode }) {
  const { logAtividade } = useAtividades()
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('contratos').select(SELECT).order('data_assinatura', { ascending: false })
    setContratos(((data as unknown as ContratoRow[]) ?? []).map(fromRow))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addContrato(c: Contrato) {
    const supabase = createClient()
    const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', c.espaco).single()
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('contratos')
      .insert({
        id: c.id,
        numero_contrato: c.numeroContrato,
        cliente: c.cliente,
        cpf_cnpj: c.cpfCnpj,
        espaco_id: espacoRow?.id,
        data_evento: c.dataEvento,
        hora_inicio: c.horaInicio,
        hora_fim: c.horaFim,
        valor_total: c.valorTotal,
        valor_entrada: c.valorEntrada,
        data_assinatura: c.dataAssinatura,
        status: c.status,
        observacoes: c.observacoes,
        responsavel: c.responsavel,
        tipo: c.tipo,
        tipo_minuta: c.tipoMinuta ?? null,
        valor_negociado: c.valorNegociado ?? null,
        observacao_negociacao: c.observacaoNegociacao ?? null,
        observacao_parceria: c.observacaoParceria ?? null,
        evento_id: c.eventoId ?? null,
        created_by: user?.id ?? null,
      })
      .select(SELECT)
      .single()

    if (error) throw error
    const novo = fromRow(data as unknown as ContratoRow)
    setContratos(prev => [novo, ...prev])
    try {
      await logAtividade({ tipo: 'contrato', acao: 'Contrato criado', detalhes: `${novo.numeroContrato} — ${novo.cliente}`, espaco: novo.espaco })
    } catch {
      // log é secundário, não deve impedir o cadastro do contrato
    }
  }

  return (
    <ContratosContext.Provider value={{ contratos, loading, addContrato }}>
      {children}
    </ContratosContext.Provider>
  )
}

export function useContratos(): ContratosContextValue {
  const ctx = useContext(ContratosContext)
  if (!ctx) throw new Error('useContratos must be used inside ContratosProvider')
  return ctx
}
