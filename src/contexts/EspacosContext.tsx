'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { ESPACOS_CONFIG } from '@/lib/espacos-config'
import type { EspacoConfig } from '@/lib/espacos-config'
import { createClient } from '@/lib/supabase/client'
import { useAtividades } from '@/contexts/AtividadesContext'
import type { EspacoCustomData } from '@/types'

const PALETTE: Pick<EspacoConfig, 'cor' | 'colorClass' | 'bgClass' | 'borderClass' | 'dotClass' | 'gradientFrom'>[] = [
  { cor: 'violet', colorClass: 'text-violet-400', bgClass: 'bg-violet-500/10', borderClass: 'border-violet-500/20', dotClass: 'bg-violet-500', gradientFrom: 'from-violet-500/20' },
  { cor: 'indigo', colorClass: 'text-indigo-400', bgClass: 'bg-indigo-500/10', borderClass: 'border-indigo-500/20', dotClass: 'bg-indigo-500', gradientFrom: 'from-indigo-500/20' },
  { cor: 'sky', colorClass: 'text-sky-400', bgClass: 'bg-sky-500/10', borderClass: 'border-sky-500/20', dotClass: 'bg-sky-500', gradientFrom: 'from-sky-500/20' },
  { cor: 'emerald', colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/20', dotClass: 'bg-emerald-500', gradientFrom: 'from-emerald-500/20' },
  { cor: 'orange', colorClass: 'text-orange-400', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/20', dotClass: 'bg-orange-500', gradientFrom: 'from-orange-500/20' },
]

interface EspacoRow {
  id: string
  slug: string
  nome: string
  endereco: string | null
  capacidade: number
  descricao: string | null
  status: 'ativo' | 'inativo'
  foto_file_id: string | null
  created_at: string
}

function isBuiltin(slug: string): boolean {
  return ESPACOS_CONFIG.some(e => e.slug === slug)
}

function toConfig(row: EspacoRow, paletteIndex: number): EspacoConfig {
  const builtin = ESPACOS_CONFIG.find(e => e.slug === row.slug)
  const base = builtin
    ? { ...builtin, nome: row.nome, descricao: row.descricao || builtin.descricao, capacidade: row.capacidade }
    : { slug: row.slug, nome: row.nome, descricao: row.descricao ?? '', capacidade: row.capacidade, categorias: [], ...PALETTE[paletteIndex % PALETTE.length] }
  return { ...base, id: row.id, fotoFileId: row.foto_file_id ?? undefined }
}

function toCustomData(row: EspacoRow): EspacoCustomData {
  return {
    id: row.id,
    slug: row.slug,
    nome: row.nome,
    endereco: row.endereco ?? '',
    capacidade: row.capacidade,
    descricao: row.descricao ?? '',
    status: row.status,
    fotoFileId: row.foto_file_id ?? undefined,
    criadoEm: row.created_at,
  }
}

function slugify(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

interface NovoEspacoDraft {
  id: string
  nome: string
  endereco: string
  capacidade: number
  descricao: string
  status: 'ativo' | 'inativo'
  fotoFileId?: string
}

interface EspacosContextValue {
  espacosConfig: EspacoConfig[]
  espacosNomes: string[]
  customEspacos: EspacoCustomData[]
  loading: boolean
  addEspaco: (draft: NovoEspacoDraft) => Promise<EspacoCustomData>
  updateEspacoFoto: (id: string, fotoFileId: string) => Promise<void>
}

const EspacosContext = createContext<EspacosContextValue | null>(null)

export function EspacosProvider({ children }: { children: ReactNode }) {
  const { logAtividade } = useAtividades()
  const [rows, setRows] = useState<EspacoRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('espacos').select('*').order('created_at')
    setRows((data as EspacoRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addEspaco(draft: NovoEspacoDraft): Promise<EspacoCustomData> {
    const supabase = createClient()
    const slug = slugify(draft.nome) || `espaco-${Date.now()}`
    const { data, error } = await supabase
      .from('espacos')
      .insert({
        slug,
        nome: draft.nome,
        endereco: draft.endereco,
        capacidade: draft.capacidade,
        descricao: draft.descricao,
        status: draft.status,
        foto_file_id: draft.fotoFileId ?? null,
      })
      .select()
      .single()

    if (error) throw error

    const row = data as EspacoRow
    setRows(prev => [...prev, row])
    try {
      await logAtividade({ tipo: 'espaco', acao: 'Espaço criado', detalhes: row.nome, espaco: row.nome })
    } catch {
      // log é secundário, não deve impedir o cadastro do espaço
    }
    return toCustomData(row)
  }

  async function updateEspacoFoto(id: string, fotoFileId: string): Promise<void> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('espacos')
      .update({ foto_file_id: fotoFileId })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    const row = data as EspacoRow
    setRows(prev => prev.map(r => (r.id === id ? row : r)))
    try {
      await logAtividade({ tipo: 'espaco', acao: 'Foto atualizada', detalhes: row.nome, espaco: row.nome })
    } catch {
      // log é secundário, não deve impedir a troca da foto
    }
  }

  const ativos = rows.filter(r => r.status === 'ativo')
  let paletteIndex = 0
  const espacosConfig: EspacoConfig[] = ativos.map(r => toConfig(r, isBuiltin(r.slug) ? 0 : paletteIndex++))
  const espacosNomes = espacosConfig.map(e => e.nome)
  const customEspacos = rows.filter(r => !isBuiltin(r.slug)).map(toCustomData)

  return (
    <EspacosContext.Provider value={{ espacosConfig, espacosNomes, customEspacos, loading, addEspaco, updateEspacoFoto }}>
      {children}
    </EspacosContext.Provider>
  )
}

export function useEspacos(): EspacosContextValue {
  const ctx = useContext(EspacosContext)
  if (!ctx) throw new Error('useEspacos must be used inside EspacosProvider')
  return ctx
}
