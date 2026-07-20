'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export type TipoAtividade = 'evento' | 'contrato' | 'financeiro' | 'funcionario' | 'espaco'

export interface Atividade {
  id: string
  tipo: TipoAtividade
  acao: string
  detalhes?: string
  espaco?: string
  usuarioNome?: string
  createdAt: string
}

interface AtividadeRow {
  id: string
  tipo: TipoAtividade
  acao: string
  detalhes: string | null
  espaco: { nome: string } | null
  usuario_nome: string | null
  created_at: string
}

function fromRow(row: AtividadeRow): Atividade {
  return {
    id: row.id,
    tipo: row.tipo,
    acao: row.acao,
    detalhes: row.detalhes ?? undefined,
    espaco: row.espaco?.nome,
    usuarioNome: row.usuario_nome ?? undefined,
    createdAt: row.created_at,
  }
}

export interface NovaAtividadeInput {
  tipo: TipoAtividade
  acao: string
  detalhes?: string
  espaco?: string
}

interface AtividadesContextValue {
  atividades: Atividade[]
  loading: boolean
  logAtividade: (input: NovaAtividadeInput) => Promise<void>
}

const AtividadesContext = createContext<AtividadesContextValue | null>(null)

const SELECT = '*, espaco:espacos(nome)'

export function AtividadesProvider({ children }: { children: ReactNode }) {
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('atividades').select(SELECT).order('created_at', { ascending: false }).limit(200)
    setAtividades(((data as unknown as AtividadeRow[]) ?? []).map(fromRow))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function logAtividade(input: NovaAtividadeInput) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let usuarioNome: string | null = null
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', user.id).single()
      usuarioNome = profile?.nome ?? null
    }

    let espacoId: string | null = null
    if (input.espaco) {
      const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', input.espaco).single()
      espacoId = espacoRow?.id ?? null
    }

    const { data, error } = await supabase
      .from('atividades')
      .insert({
        tipo: input.tipo,
        acao: input.acao,
        detalhes: input.detalhes ?? null,
        espaco_id: espacoId,
        usuario_id: user?.id ?? null,
        usuario_nome: usuarioNome,
      })
      .select(SELECT)
      .single()

    if (error) throw error
    setAtividades(prev => [fromRow(data as unknown as AtividadeRow), ...prev])
  }

  return (
    <AtividadesContext.Provider value={{ atividades, loading, logAtividade }}>
      {children}
    </AtividadesContext.Provider>
  )
}

export function useAtividades(): AtividadesContextValue {
  const ctx = useContext(AtividadesContext)
  if (!ctx) throw new Error('useAtividades must be used inside AtividadesProvider')
  return ctx
}
