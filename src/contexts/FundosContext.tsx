'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAtividades } from '@/contexts/AtividadesContext'

export interface Fundo {
  id: string
  espaco?: string // undefined = fundo da empresa toda
  nome: string
  descricao?: string
}

export type TipoMovimentacaoFundo = 'entrada' | 'saida'

export interface MovimentacaoFundo {
  id: string
  fundoId: string
  tipo: TipoMovimentacaoFundo
  valor: number
  data: string
  descricao?: string
  responsavel?: string
}

interface FundoRow {
  id: string
  espaco: { nome: string } | null
  nome: string
  descricao: string | null
  meta: number | string | null
}

interface MovimentacaoRow {
  id: string
  fundo_id: string
  tipo: string
  valor: number | string
  data: string
  descricao: string | null
  responsavel: string | null
}

function fundoFromRow(row: FundoRow): Fundo {
  return {
    id: row.id,
    espaco: row.espaco?.nome,
    nome: row.nome,
    descricao: row.descricao ?? undefined,
  }
}

function movimentacaoFromRow(row: MovimentacaoRow): MovimentacaoFundo {
  return {
    id: row.id,
    fundoId: row.fundo_id,
    tipo: row.tipo as TipoMovimentacaoFundo,
    valor: Number(row.valor),
    data: row.data,
    descricao: row.descricao ?? undefined,
    responsavel: row.responsavel ?? undefined,
  }
}

export interface NovoFundoInput {
  nome: string
  descricao?: string
  espaco?: string
  valorInicial?: number
  responsavelInicial?: string
}

export interface NovaMovimentacaoInput {
  fundoId: string
  tipo: TipoMovimentacaoFundo
  valor: number
  data: string
  descricao?: string
  responsavel?: string
}

interface FundosContextValue {
  fundos: Fundo[]
  movimentacoes: MovimentacaoFundo[]
  loading: boolean
  addFundo: (input: NovoFundoInput) => Promise<Fundo>
  addMovimentacao: (input: NovaMovimentacaoInput) => Promise<void>
  deleteFundo: (id: string) => Promise<void>
}

const FundosContext = createContext<FundosContextValue | null>(null)
const SELECT_FUNDO = '*, espaco:espacos(nome)'

export function FundosProvider({ children }: { children: ReactNode }) {
  const { logAtividade } = useAtividades()
  const [fundos, setFundos] = useState<Fundo[]>([])
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoFundo[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: fundosData }, { data: movsData }] = await Promise.all([
      supabase.from('fundos').select(SELECT_FUNDO).order('created_at', { ascending: false }),
      supabase.from('movimentacoes_fundo').select('*').order('data', { ascending: false }),
    ])
    setFundos(((fundosData as unknown as FundoRow[]) ?? []).map(fundoFromRow))
    setMovimentacoes(((movsData as unknown as MovimentacaoRow[]) ?? []).map(movimentacaoFromRow))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addFundo(input: NovoFundoInput): Promise<Fundo> {
    const supabase = createClient()
    let espacoId: string | null = null
    if (input.espaco) {
      const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', input.espaco).single()
      espacoId = espacoRow?.id ?? null
    }
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('fundos')
      .insert({
        espaco_id: espacoId,
        nome: input.nome,
        descricao: input.descricao ?? null,
        created_by: user?.id ?? null,
      })
      .select(SELECT_FUNDO)
      .single()

    if (error) throw error
    const novo = fundoFromRow(data as unknown as FundoRow)
    setFundos(prev => [novo, ...prev])

    if (input.valorInicial && input.valorInicial > 0) {
      await addMovimentacao({
        fundoId: novo.id,
        tipo: 'entrada',
        valor: input.valorInicial,
        data: new Date().toISOString().split('T')[0],
        descricao: 'Saldo inicial',
        responsavel: input.responsavelInicial,
      })
    }

    try {
      await logAtividade({ tipo: 'financeiro', acao: 'Fundo criado', detalhes: novo.nome, espaco: novo.espaco })
    } catch {
      // log é secundário, não deve impedir a criação do fundo
    }
    return novo
  }

  async function addMovimentacao(input: NovaMovimentacaoInput) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('movimentacoes_fundo')
      .insert({
        fundo_id: input.fundoId,
        tipo: input.tipo,
        valor: input.valor,
        data: input.data,
        descricao: input.descricao ?? null,
        responsavel: input.responsavel ?? null,
        created_by: user?.id ?? null,
      })
      .select()
      .single()

    if (error) throw error
    const nova = movimentacaoFromRow(data as unknown as MovimentacaoRow)
    setMovimentacoes(prev => [nova, ...prev])
    try {
      const fundo = fundos.find(f => f.id === input.fundoId)
      await logAtividade({
        tipo: 'financeiro',
        acao: input.tipo === 'entrada' ? 'Entrada em fundo registrada' : 'Retirada de fundo registrada',
        detalhes: `${fundo?.nome ?? 'Fundo'} — ${input.descricao ?? ''}`,
        espaco: fundo?.espaco,
      })
    } catch {
      // log é secundário, não deve impedir a movimentação
    }
  }

  // Só permite excluir com saldo zerado — evita apagar reserva que ainda tem
  // dinheiro nela. Confere de novo aqui (não só na UI) contra a movimentacoes
  // atual, é a garantia real antes de mandar pro banco.
  async function deleteFundo(id: string) {
    const saldo = movimentacoes
      .filter(m => m.fundoId === id)
      .reduce((s, m) => s + (m.tipo === 'entrada' ? m.valor : -m.valor), 0)
    if (saldo !== 0) throw new Error('Só é possível excluir um fundo com saldo zerado.')

    const alvo = fundos.find(f => f.id === id)
    const supabase = createClient()
    const { error } = await supabase.from('fundos').delete().eq('id', id)
    if (error) throw error
    setFundos(prev => prev.filter(f => f.id !== id))
    setMovimentacoes(prev => prev.filter(m => m.fundoId !== id))
    try {
      await logAtividade({ tipo: 'financeiro', acao: 'Fundo excluído', detalhes: alvo?.nome ?? '', espaco: alvo?.espaco })
    } catch {
      // log é secundário, não deve impedir a exclusão já concluída
    }
  }

  return (
    <FundosContext.Provider value={{ fundos, movimentacoes, loading, addFundo, addMovimentacao, deleteFundo }}>
      {children}
    </FundosContext.Provider>
  )
}

export function useFundos(): FundosContextValue {
  const ctx = useContext(FundosContext)
  if (!ctx) throw new Error('useFundos must be used inside FundosProvider')
  return ctx
}
