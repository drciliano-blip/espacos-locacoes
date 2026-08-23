'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { extrairPalavrasChave, type PadraoClassificacao, type ClassificacaoPadrao } from '@/lib/padroes-classificacao'

interface PadraoRow {
  id: string
  padrao_texto: string
  tipo: string
  classificacao: string
  espaco: { nome: string } | null
  categoria_receita_id: string | null
  tipo_entrada: string | null
  categoria_conta: string | null
  subcategoria_conta: string | null
  vezes_usado: number
}

function fromRow(row: PadraoRow): PadraoClassificacao {
  return {
    id: row.id,
    padraoTexto: row.padrao_texto,
    tipo: row.tipo as PadraoClassificacao['tipo'],
    classificacao: row.classificacao as ClassificacaoPadrao,
    espaco: row.espaco?.nome,
    categoriaReceitaId: row.categoria_receita_id ?? undefined,
    tipoEntrada: row.tipo_entrada ?? undefined,
    categoriaConta: row.categoria_conta ?? undefined,
    subcategoriaConta: row.subcategoria_conta ?? undefined,
    vezesUsado: row.vezes_usado,
  }
}

export type ResultadoClassificacao =
  | { classificacao: 'transferencia' }
  | { classificacao: 'ignorar' }
  | { classificacao: 'lancamento'; espaco?: string; categoriaReceitaId?: string; tipoEntrada?: string; categoriaConta?: string; subcategoriaConta?: string }

interface PadroesClassificacaoContextValue {
  padroes: PadraoClassificacao[]
  loading: boolean
  registrarPadrao: (descricao: string, tipo: 'entrada' | 'saida', resultado: ResultadoClassificacao) => Promise<void>
}

const PadroesClassificacaoContext = createContext<PadroesClassificacaoContextValue | null>(null)
const SELECT = '*, espaco:espacos(nome)'

export function PadroesClassificacaoProvider({ children }: { children: ReactNode }) {
  const [padroes, setPadroes] = useState<PadraoClassificacao[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('padroes_classificacao').select(SELECT).order('vezes_usado', { ascending: false })
    setPadroes(((data as unknown as PadraoRow[]) ?? []).map(fromRow))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Chamado toda vez que o usuário confirma uma classificação (lote ou
  // individual) — nunca aplica nada sozinho, só aprende com o que o usuário
  // já decidiu, pra sugerir mais rápido da próxima vez.
  async function registrarPadrao(descricao: string, tipo: 'entrada' | 'saida', resultado: ResultadoClassificacao) {
    const palavras = extrairPalavrasChave(descricao)
    if (palavras.length === 0) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let espacoId: string | null = null
    if (resultado.classificacao === 'lancamento' && resultado.espaco) {
      const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', resultado.espaco).single()
      espacoId = espacoRow?.id ?? null
    }

    const camposClassificacao = resultado.classificacao === 'lancamento'
      ? {
          classificacao: 'lancamento',
          espaco_id: espacoId,
          categoria_receita_id: resultado.categoriaReceitaId ?? null,
          tipo_entrada: resultado.tipoEntrada ?? null,
          categoria_conta: resultado.categoriaConta ?? null,
          subcategoria_conta: resultado.subcategoriaConta ?? null,
        }
      : {
          classificacao: resultado.classificacao,
          espaco_id: null, categoria_receita_id: null, tipo_entrada: null, categoria_conta: null, subcategoria_conta: null,
        }

    const { data: existentes } = await supabase
      .from('padroes_classificacao')
      .select('id, padrao_texto, vezes_usado')
      .eq('tipo', tipo)
      .in('padrao_texto', palavras)
    const existentesPorTexto = new Map((existentes ?? []).map(r => [r.padrao_texto as string, r as { id: string; vezes_usado: number }]))

    for (const palavra of palavras) {
      const existente = existentesPorTexto.get(palavra)
      if (existente) {
        await supabase.from('padroes_classificacao')
          .update({ ...camposClassificacao, vezes_usado: existente.vezes_usado + 1, updated_at: new Date().toISOString() })
          .eq('id', existente.id)
      } else {
        await supabase.from('padroes_classificacao')
          .insert({ padrao_texto: palavra, tipo, ...camposClassificacao, vezes_usado: 1, created_by: user?.id ?? null })
      }
    }
    await load()
  }

  return (
    <PadroesClassificacaoContext.Provider value={{ padroes, loading, registrarPadrao }}>
      {children}
    </PadroesClassificacaoContext.Provider>
  )
}

export function usePadroesClassificacao(): PadroesClassificacaoContextValue {
  const ctx = useContext(PadroesClassificacaoContext)
  if (!ctx) throw new Error('usePadroesClassificacao must be used inside PadroesClassificacaoProvider')
  return ctx
}
