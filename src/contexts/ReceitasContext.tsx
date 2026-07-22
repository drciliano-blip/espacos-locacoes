'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAtividades } from '@/contexts/AtividadesContext'

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
  parcelaNumero?: number
  parcelaLabel?: string
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
  parcela_numero: number | null
  parcela_label: string | null
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
    parcelaNumero: row.parcela_numero ?? undefined,
    parcelaLabel: row.parcela_label ?? undefined,
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

export interface ParcelaPlano {
  numero: number
  label: string
  data: string
  valor: number
}

interface SyncParcelasInput {
  eventoId: string
  espaco: string
  cliente: string
  parcelas: ParcelaPlano[]
}

interface BaixaReceitaInput {
  status: Receita['status']
  dataRecebimento?: string
  metodoPagamento?: string
  observacoes?: string
}

interface ReceitasContextValue {
  receitas: Receita[]
  categorias: CategoriaReceita[]
  loading: boolean
  addReceita: (input: NovaReceitaInput) => Promise<void>
  syncParcelasDoEvento: (input: SyncParcelasInput) => Promise<void>
  updateReceita: (id: string, patch: BaixaReceitaInput) => Promise<void>
}

const ReceitasContext = createContext<ReceitasContextValue | null>(null)

const SELECT = '*, categoria:categorias_receita(slug, nome), espaco:espacos(nome)'

export function ReceitasProvider({ children }: { children: ReactNode }) {
  const { logAtividade } = useAtividades()
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
    const nova = fromRow(data as unknown as ReceitaRow)
    setReceitas(prev => [nova, ...prev])
    try {
      await logAtividade({ tipo: 'financeiro', acao: 'Receita lançada', detalhes: `${nova.categoriaNome} — ${nova.descricao}`, espaco: nova.espaco })
    } catch {
      // log é secundário, não deve impedir o lançamento da receita
    }
  }

  async function syncParcelasDoEvento(input: SyncParcelasInput) {
    const supabase = createClient()

    const { data: categoriaRow } = await supabase.from('categorias_receita').select('id').eq('slug', 'aluguel').single()
    if (!categoriaRow) return

    let espacoId: string | null = null
    if (input.espaco) {
      const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', input.espaco).single()
      espacoId = espacoRow?.id ?? null
    }

    const { data: existingRows } = await supabase
      .from('receitas')
      .select('id, parcela_numero, status')
      .eq('evento_id', input.eventoId)
      .eq('categoria_id', categoriaRow.id)

    const existing = (existingRows ?? []) as { id: string; parcela_numero: number | null; status: string }[]
    const numerosNoPlano = new Set(input.parcelas.map(p => p.numero))

    for (const parcela of input.parcelas) {
      const match = existing.find(e => e.parcela_numero === parcela.numero)
      const payload = {
        categoria_id: categoriaRow.id,
        evento_id: input.eventoId,
        espaco_id: espacoId,
        cliente: input.cliente,
        descricao: `${parcela.label} — ${input.cliente}`,
        data: parcela.data,
        valor: parcela.valor,
        parcela_numero: parcela.numero,
        parcela_label: parcela.label,
      }
      if (match) {
        await supabase.from('receitas').update(payload).eq('id', match.id)
      } else {
        await supabase.from('receitas').insert({ ...payload, status: 'pendente' })
      }
    }

    // remove parcelas que saíram do plano — nunca uma que já foi paga (protege o histórico de baixa)
    for (const row of existing) {
      if (row.parcela_numero !== null && !numerosNoPlano.has(row.parcela_numero) && row.status !== 'pago') {
        await supabase.from('receitas').delete().eq('id', row.id)
      }
    }

    await load()
  }

  async function updateReceita(id: string, patch: BaixaReceitaInput) {
    const supabase = createClient()
    const payload = {
      status: patch.status,
      data_recebimento: patch.dataRecebimento ?? null,
      metodo_pagamento: patch.metodoPagamento ?? null,
      observacoes: patch.observacoes ?? null,
    }
    const { data, error } = await supabase.from('receitas').update(payload).eq('id', id).select(SELECT).single()
    if (error) throw error
    const atualizada = fromRow(data as unknown as ReceitaRow)
    setReceitas(prev => prev.map(r => (r.id === id ? atualizada : r)))
    try {
      await logAtividade({ tipo: 'financeiro', acao: 'Baixa registrada', detalhes: `${atualizada.descricao} — ${atualizada.status}`, espaco: atualizada.espaco })
    } catch {
      // log é secundário, não deve impedir a baixa
    }
  }

  return (
    <ReceitasContext.Provider value={{ receitas, categorias, loading, addReceita, syncParcelasDoEvento, updateReceita }}>
      {children}
    </ReceitasContext.Provider>
  )
}

export function useReceitas(): ReceitasContextValue {
  const ctx = useContext(ReceitasContext)
  if (!ctx) throw new Error('useReceitas must be used inside ReceitasProvider')
  return ctx
}
