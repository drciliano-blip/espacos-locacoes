'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAtividades } from '@/contexts/AtividadesContext'

export interface RepasseSocio {
  id: string
  espaco: string
  socioNome: string
  valor: number
  data: string
  observacoes?: string
}

interface RepasseRow {
  id: string
  espaco: { nome: string } | null
  socio_nome: string
  valor: number | string
  data: string
  observacoes: string | null
}

function fromRow(row: RepasseRow): RepasseSocio {
  return {
    id: row.id,
    espaco: row.espaco?.nome ?? '',
    socioNome: row.socio_nome,
    valor: Number(row.valor),
    data: row.data,
    observacoes: row.observacoes ?? undefined,
  }
}

interface NovoRepasseInput {
  espaco: string
  socioNome: string
  valor: number
  data: string
  observacoes?: string
}

interface RepassesContextValue {
  repasses: RepasseSocio[]
  loading: boolean
  addRepasse: (input: NovoRepasseInput) => Promise<void>
}

const RepassesContext = createContext<RepassesContextValue | null>(null)
const SELECT = '*, espaco:espacos(nome)'

export function RepassesProvider({ children }: { children: ReactNode }) {
  const { logAtividade } = useAtividades()
  const [repasses, setRepasses] = useState<RepasseSocio[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('repasses_socios').select(SELECT).order('data', { ascending: false })
    setRepasses(((data as unknown as RepasseRow[]) ?? []).map(fromRow))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addRepasse(input: NovoRepasseInput) {
    const supabase = createClient()
    const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', input.espaco).single()
    if (!espacoRow) throw new Error(`Espaço "${input.espaco}" não encontrado.`)
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('repasses_socios')
      .insert({
        espaco_id: espacoRow.id,
        socio_nome: input.socioNome,
        valor: input.valor,
        data: input.data,
        observacoes: input.observacoes ?? null,
        created_by: user?.id ?? null,
      })
      .select(SELECT)
      .single()

    if (error) throw error
    const novo = fromRow(data as unknown as RepasseRow)
    setRepasses(prev => [novo, ...prev])
    try {
      await logAtividade({ tipo: 'financeiro', acao: 'Repasse registrado', detalhes: `${novo.socioNome} — R$ ${novo.valor.toFixed(2)}`, espaco: novo.espaco })
    } catch {
      // log é secundário, não deve impedir o registro do repasse
    }
  }

  return (
    <RepassesContext.Provider value={{ repasses, loading, addRepasse }}>
      {children}
    </RepassesContext.Provider>
  )
}

export function useRepasses(): RepassesContextValue {
  const ctx = useContext(RepassesContext)
  if (!ctx) throw new Error('useRepasses must be used inside RepassesProvider')
  return ctx
}
