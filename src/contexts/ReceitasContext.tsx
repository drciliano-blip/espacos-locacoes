'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface CategoriaReceita {
  id: string
  slug: string
  nome: string
}

export interface Receita {
  id: string
  categoriaId: string
  categoriaSlug: string
  categoriaNome: string
  eventoId?: string
  espaco?: string
  cliente?: string
  descricao: string
  data: string
  dataRecebimento?: string
  valor: number
  status: 'pago' | 'pendente' | 'atrasado'
  metodoPagamento?: string
  observacoes?: string
}

interface ReceitaRow {
  id: string
  categoria_id: string
  categoria: { slug: string; nome: string } | null
  evento_id: string | null
  espaco: { nome: string } | null
  cliente: string | null
  descricao: string
  data: string
  data_recebimento: string | null
  valor: number | string
  status: string
  metodo_pagamento: string | null
  observacoes: string | null
}

function fromRow(row: ReceitaRow): Receita {
  return {
    id: row.id,
    categoriaId: row.categoria_id,
    categoriaSlug: row.categoria?.slug ?? 'outros',
    categoriaNome: row.categoria?.nome ?? 'Outros',
    eventoId: row.evento_id ?? undefined,
    espaco: row.espaco?.nome,
    cliente: row.cliente ?? undefined,
    descricao: row.descricao,
    data: row.data,
    dataRecebimento: row.data_recebimento ?? undefined,
    valor: Number(row.valor),
    status: row.status as Receita['status'],
    metodoPagamento: row.metodo_pagamento ?? undefined,
    observacoes: row.observacoes ?? undefined,
  }
}

export interface NovaReceitaInput {
  categoriaId: string
  eventoId?: string
  espaco?: string
  cliente?: string
  descricao: string
  data: string
  dataRecebimento?: string
  valor: number
  status: Receita['status']
  metodoPagamento?: string
  observacoes?: string
}

interface ReceitaDoEventoInput {
  id: string
  cliente: string
  espaco: string
  data: string
  valor: number
}

interface ReceitasContextValue {
  receitas: Receita[]
  categorias: CategoriaReceita[]
  loading: boolean
  addReceita: (input: NovaReceitaInput) => Promise<void>
  upsertReceitaDoEvento: (evento: ReceitaDoEventoInput) => Promise<void>
}

const ReceitasContext = createContext<ReceitasContextValue | null>(null)

const SELECT = '*, categoria:categorias_receita(slug, nome), espaco:espacos(nome)'

export function ReceitasProvider({ children }: { children: ReactNode }) {
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [categorias, setCategorias] = useState<CategoriaReceita[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: receitasData }, { data: categoriasData }] = await Promise.all([
      supabase.from('receitas').select(SELECT).order('data', { ascending: false }),
      supabase.from('categorias_receita').select('id, slug, nome').eq('ativo', true).order('ordem'),
    ])
    setReceitas(((receitasData as unknown as ReceitaRow[]) ?? []).map(fromRow))
    setCategorias((categoriasData as CategoriaReceita[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addReceita(input: NovaReceitaInput) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let espacoId: string | null = null
    if (input.espaco) {
      const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', input.espaco).single()
      espacoId = espacoRow?.id ?? null
    }

    const { data, error } = await supabase
      .from('receitas')
      .insert({
        categoria_id: input.categoriaId,
        evento_id: input.eventoId ?? null,
        espaco_id: espacoId,
        cliente: input.cliente ?? null,
        descricao: input.descricao,
        data: input.data,
        data_recebimento: input.dataRecebimento ?? null,
        valor: input.valor,
        status: input.status,
        metodo_pagamento: input.metodoPagamento ?? null,
        observacoes: input.observacoes ?? null,
        created_by: user?.id ?? null,
      })
      .select(SELECT)
      .single()

    if (error) throw error
    setReceitas(prev => [fromRow(data as unknown as ReceitaRow), ...prev])
  }

  async function upsertReceitaDoEvento(evento: ReceitaDoEventoInput) {
    const supabase = createClient()

    const { data: categoriaRow } = await supabase.from('categorias_receita').select('id').eq('slug', 'aluguel').single()
    if (!categoriaRow) return

    let espacoId: string | null = null
    if (evento.espaco) {
      const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', evento.espaco).single()
      espacoId = espacoRow?.id ?? null
    }

    const payload = {
      categoria_id: categoriaRow.id,
      evento_id: evento.id,
      espaco_id: espacoId,
      cliente: evento.cliente,
      descricao: `Aluguel — ${evento.cliente}`,
      data: evento.data,
      valor: evento.valor,
    }

    const { data: existing } = await supabase
      .from('receitas')
      .select('id')
      .eq('evento_id', evento.id)
      .eq('categoria_id', categoriaRow.id)
      .maybeSingle()

    if (existing) {
      await supabase.from('receitas').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('receitas').insert({ ...payload, status: 'pendente' })
    }

    await load()
  }

  return (
    <ReceitasContext.Provider value={{ receitas, categorias, loading, addReceita, upsertReceitaDoEvento }}>
      {children}
    </ReceitasContext.Provider>
  )
}

export function useReceitas(): ReceitasContextValue {
  const ctx = useContext(ReceitasContext)
  if (!ctx) throw new Error('useReceitas must be used inside ReceitasProvider')
  return ctx
}
