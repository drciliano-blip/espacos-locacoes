'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ContaPagar, CategoriaContaPagar, StatusContaPagar } from '@/types'

interface ContaPagarRow {
  id: string
  descricao: string
  espaco: { nome: string } | null
  categoria: string
  subcategoria: string
  valor: number | string
  status: string
  data_vencimento: string
  data_pagamento: string | null
  fornecedor: string | null
  observacoes: string | null
}

function fromRow(row: ContaPagarRow): ContaPagar {
  return {
    id: row.id,
    descricao: row.descricao,
    espaco: (row.espaco?.nome ?? 'Todos') as ContaPagar['espaco'],
    categoria: row.categoria as CategoriaContaPagar,
    subcategoria: row.subcategoria as ContaPagar['subcategoria'],
    valor: Number(row.valor),
    status: row.status as StatusContaPagar,
    dataVencimento: row.data_vencimento,
    dataPagamento: row.data_pagamento ?? undefined,
    fornecedor: row.fornecedor ?? undefined,
    observacoes: row.observacoes ?? undefined,
  }
}

interface ContasPagarContextValue {
  contas: ContaPagar[]
  loading: boolean
  addConta: (c: ContaPagar) => Promise<void>
}

const ContasPagarContext = createContext<ContasPagarContextValue | null>(null)
const SELECT = '*, espaco:espacos(nome)'

export function ContasPagarProvider({ children }: { children: ReactNode }) {
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('contas_pagar').select(SELECT).order('data_vencimento', { ascending: false })
    setContas(((data as unknown as ContaPagarRow[]) ?? []).map(fromRow))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addConta(c: ContaPagar) {
    const supabase = createClient()
    let espacoId: string | null = null
    if (c.espaco && c.espaco !== 'Todos') {
      const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', c.espaco).single()
      espacoId = espacoRow?.id ?? null
    }
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('contas_pagar')
      .insert({
        id: c.id,
        descricao: c.descricao,
        espaco_id: espacoId,
        categoria: c.categoria,
        subcategoria: c.subcategoria,
        valor: c.valor,
        status: c.status,
        data_vencimento: c.dataVencimento,
        data_pagamento: c.dataPagamento ?? null,
        fornecedor: c.fornecedor ?? null,
        observacoes: c.observacoes ?? null,
        created_by: user?.id ?? null,
      })
      .select(SELECT)
      .single()

    if (error) throw error
    setContas(prev => [fromRow(data as unknown as ContaPagarRow), ...prev])
  }

  return (
    <ContasPagarContext.Provider value={{ contas, loading, addConta }}>
      {children}
    </ContasPagarContext.Provider>
  )
}

export function useContasPagar(): ContasPagarContextValue {
  const ctx = useContext(ContasPagarContext)
  if (!ctx) throw new Error('useContasPagar must be used inside ContasPagarProvider')
  return ctx
}
