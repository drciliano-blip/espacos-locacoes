'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAtividades } from '@/contexts/AtividadesContext'
import { saveFile, hashFile } from '@/lib/file-storage'
import { computeDedupeHash, type MovimentacaoBancaria, type TipoMovimentacaoBancaria } from '@/lib/conciliacao-bancaria'
import type { TipoTransacao } from '@/lib/ofx-parser'

export type FormatoExtrato = 'ofx' | 'csv' | 'xlsx' | 'xls' | 'pdf'

export interface ExtratoBancario {
  id: string
  espaco?: string
  banco?: string
  conta?: string
  nomeArquivo: string
  formato: FormatoExtrato
  periodoInicio?: string
  periodoFim?: string
  saldoInicial?: number
  saldoFinal?: number
  totalMovimentacoes: number
  createdAt: string
}

interface ExtratoRow {
  id: string
  espaco: { nome: string } | null
  banco: string | null
  conta: string | null
  nome_arquivo: string
  formato: string
  periodo_inicio: string | null
  periodo_fim: string | null
  saldo_inicial: number | string | null
  saldo_final: number | string | null
  total_movimentacoes: number
  created_at: string
}

interface MovimentacaoRow {
  id: string
  extrato_id: string
  espaco: { nome: string } | null
  data: string
  hora: string | null
  descricao: string
  valor: number | string
  tipo: string
  tipo_transacao: string | null
  identificador_transacao: string | null
  favorecido_pagador: string | null
  lancamento_tipo: string | null
  lancamento_id: string | null
  classificacao_especial: string | null
}

function extratoFromRow(row: ExtratoRow): ExtratoBancario {
  return {
    id: row.id,
    espaco: row.espaco?.nome,
    banco: row.banco ?? undefined,
    conta: row.conta ?? undefined,
    nomeArquivo: row.nome_arquivo,
    formato: row.formato as FormatoExtrato,
    periodoInicio: row.periodo_inicio ?? undefined,
    periodoFim: row.periodo_fim ?? undefined,
    saldoInicial: row.saldo_inicial != null ? Number(row.saldo_inicial) : undefined,
    saldoFinal: row.saldo_final != null ? Number(row.saldo_final) : undefined,
    totalMovimentacoes: row.total_movimentacoes,
    createdAt: row.created_at,
  }
}

function movimentacaoFromRow(row: MovimentacaoRow): MovimentacaoBancaria {
  return {
    id: row.id,
    extratoId: row.extrato_id,
    espaco: row.espaco?.nome,
    data: row.data,
    hora: row.hora ?? undefined,
    descricao: row.descricao,
    valor: Number(row.valor),
    tipo: row.tipo as TipoMovimentacaoBancaria,
    tipoTransacao: (row.tipo_transacao ?? undefined) as TipoTransacao | undefined,
    identificadorTransacao: row.identificador_transacao ?? undefined,
    favorecidoPagador: row.favorecido_pagador ?? undefined,
    lancamentoTipo: (row.lancamento_tipo ?? undefined) as MovimentacaoBancaria['lancamentoTipo'],
    lancamentoId: row.lancamento_id ?? undefined,
    classificacaoEspecial: (row.classificacao_especial ?? undefined) as MovimentacaoBancaria['classificacaoEspecial'],
  }
}

export interface MovimentacaoParaImportar {
  data: string
  hora?: string
  descricao: string
  valor: number
  tipo: TipoMovimentacaoBancaria
  tipoTransacao?: TipoTransacao
  identificadorTransacao?: string
  favorecidoPagador?: string
}

export interface ImportarExtratoInput {
  arquivo: File
  formato: FormatoExtrato
  espaco?: string
  banco?: string
  conta?: string
  periodoInicio?: string
  periodoFim?: string
  saldoInicial?: number
  saldoFinal?: number
  movimentacoes: MovimentacaoParaImportar[]
}

export interface ImportarExtratoResultado {
  extrato: ExtratoBancario
  totalNovas: number
  totalDuplicadas: number
}

interface ConciliacaoContextValue {
  extratos: ExtratoBancario[]
  movimentacoes: MovimentacaoBancaria[]
  loading: boolean
  importarExtrato: (input: ImportarExtratoInput) => Promise<ImportarExtratoResultado>
  vincularMovimentacao: (movimentacaoId: string, lancamentoTipo: 'receita' | 'conta_pagar', lancamentoId: string) => Promise<void>
  desvincularMovimentacao: (movimentacaoId: string) => Promise<void>
  marcarClassificacaoEspecial: (movimentacaoIds: string[], classificacao: 'transferencia' | 'ignorado') => Promise<void>
  desmarcarClassificacaoEspecial: (movimentacaoId: string) => Promise<void>
  excluirExtrato: (id: string) => Promise<void>
}

const ConciliacaoContext = createContext<ConciliacaoContextValue | null>(null)
const SELECT_EXTRATO = '*, espaco:espacos(nome)'
const SELECT_MOVIMENTACAO = '*, espaco:espacos(nome)'

export function ConciliacaoProvider({ children }: { children: ReactNode }) {
  const { logAtividade } = useAtividades()
  const [extratos, setExtratos] = useState<ExtratoBancario[]>([])
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoBancaria[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: extratosData }, { data: movsData }] = await Promise.all([
      supabase.from('extratos_bancarios').select(SELECT_EXTRATO).order('created_at', { ascending: false }),
      supabase.from('movimentacoes_bancarias').select(SELECT_MOVIMENTACAO).order('data', { ascending: false }),
    ])
    setExtratos(((extratosData as unknown as ExtratoRow[]) ?? []).map(extratoFromRow))
    setMovimentacoes(((movsData as unknown as MovimentacaoRow[]) ?? []).map(movimentacaoFromRow))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function importarExtrato(input: ImportarExtratoInput): Promise<ImportarExtratoResultado> {
    const supabase = createClient()
    const hash = await hashFile(input.arquivo)

    // Mesmo padrão já usado pro comprovante de Contas a Pagar: confere antes
    // de inserir (não depende de capturar violação de constraint) — a
    // constraint única em file_hash fica só como rede de segurança.
    const { data: existente } = await supabase.from('extratos_bancarios').select('id').eq('file_hash', hash).maybeSingle()
    if (existente) throw new Error('Este arquivo já foi importado.')

    let espacoId: string | null = null
    if (input.espaco) {
      const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', input.espaco).single()
      espacoId = espacoRow?.id ?? null
    }
    const { data: { user } } = await supabase.auth.getUser()

    const { data: extratoData, error: extratoError } = await supabase
      .from('extratos_bancarios')
      .insert({
        espaco_id: espacoId,
        banco: input.banco ?? null,
        conta: input.conta ?? null,
        nome_arquivo: input.arquivo.name,
        formato: input.formato,
        periodo_inicio: input.periodoInicio ?? null,
        periodo_fim: input.periodoFim ?? null,
        saldo_inicial: input.saldoInicial ?? null,
        saldo_final: input.saldoFinal ?? null,
        file_hash: hash,
        total_movimentacoes: input.movimentacoes.length,
        created_by: user?.id ?? null,
      })
      .select(SELECT_EXTRATO)
      .single()

    if (extratoError) throw extratoError
    const extrato = extratoFromRow(extratoData as unknown as ExtratoRow)

    // Dedupe de movimentação é global (não só dentro deste extrato) — evita
    // duplicar quando dois arquivos importados têm período sobreposto.
    const comHash = input.movimentacoes.map(m => ({ ...m, dedupeHash: computeDedupeHash(m) }))
    const hashesUnicos = Array.from(new Set(comHash.map(m => m.dedupeHash)))
    const { data: existentes } = await supabase.from('movimentacoes_bancarias').select('dedupe_hash').in('dedupe_hash', hashesUnicos)
    const hashesExistentes = new Set((existentes ?? []).map(r => r.dedupe_hash as string))

    const vistosNesteLote = new Set<string>()
    const novas = comHash.filter(m => {
      if (hashesExistentes.has(m.dedupeHash) || vistosNesteLote.has(m.dedupeHash)) return false
      vistosNesteLote.add(m.dedupeHash)
      return true
    })

    let inseridas: MovimentacaoBancaria[] = []
    if (novas.length > 0) {
      const { data: movsData, error: movsError } = await supabase
        .from('movimentacoes_bancarias')
        .insert(novas.map(m => ({
          extrato_id: extrato.id,
          espaco_id: espacoId,
          data: m.data,
          hora: m.hora ?? null,
          descricao: m.descricao,
          valor: m.valor,
          tipo: m.tipo,
          tipo_transacao: m.tipoTransacao ?? null,
          identificador_transacao: m.identificadorTransacao ?? null,
          favorecido_pagador: m.favorecidoPagador ?? null,
          dedupe_hash: m.dedupeHash,
          created_by: user?.id ?? null,
        })))
        .select(SELECT_MOVIMENTACAO)

      if (movsError) throw movsError
      inseridas = ((movsData as unknown as MovimentacaoRow[]) ?? []).map(movimentacaoFromRow)
    }

    try {
      await saveFile(input.arquivo, {
        module: 'extratos',
        entityId: extrato.id,
        entityName: extrato.nomeArquivo,
        espaco: input.espaco,
        fileHash: hash,
      })
    } catch {
      // extrato já foi importado com sucesso — falha ao guardar uma cópia do
      // arquivo original não deve desfazer a importação
    }

    setExtratos(prev => [extrato, ...prev])
    setMovimentacoes(prev => [...inseridas, ...prev])

    try {
      await logAtividade({
        tipo: 'financeiro',
        acao: 'Extrato bancário importado',
        detalhes: `${extrato.nomeArquivo} — ${inseridas.length} movimentação(ões) nova(s)`,
        espaco: extrato.espaco,
      })
    } catch {
      // log é secundário, não deve impedir a importação
    }

    return { extrato, totalNovas: inseridas.length, totalDuplicadas: input.movimentacoes.length - inseridas.length }
  }

  async function vincularMovimentacao(movimentacaoId: string, lancamentoTipo: 'receita' | 'conta_pagar', lancamentoId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('movimentacoes_bancarias')
      .update({ lancamento_tipo: lancamentoTipo, lancamento_id: lancamentoId })
      .eq('id', movimentacaoId)
    if (error) throw error
    setMovimentacoes(prev => prev.map(m => m.id === movimentacaoId ? { ...m, lancamentoTipo, lancamentoId } : m))
  }

  async function desvincularMovimentacao(movimentacaoId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('movimentacoes_bancarias')
      .update({ lancamento_tipo: null, lancamento_id: null })
      .eq('id', movimentacaoId)
    if (error) throw error
    setMovimentacoes(prev => prev.map(m => m.id === movimentacaoId ? { ...m, lancamentoTipo: undefined, lancamentoId: undefined } : m))
  }

  // Em lote — usado pela Classificação em Lote pra marcar várias
  // movimentações de uma vez como Transferência ou Ignorado.
  async function marcarClassificacaoEspecial(movimentacaoIds: string[], classificacao: 'transferencia' | 'ignorado') {
    if (movimentacaoIds.length === 0) return
    const supabase = createClient()
    const { error } = await supabase
      .from('movimentacoes_bancarias')
      .update({ classificacao_especial: classificacao })
      .in('id', movimentacaoIds)
    if (error) throw error
    const idsSet = new Set(movimentacaoIds)
    setMovimentacoes(prev => prev.map(m => idsSet.has(m.id) ? { ...m, classificacaoEspecial: classificacao } : m))
  }

  // Desfaz uma classificação especial (Transferência/Ignorado) — sem isso a
  // movimentação ficava travada nesse status pra sempre, sem nenhuma forma de
  // voltar pra conferência normal.
  async function desmarcarClassificacaoEspecial(movimentacaoId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('movimentacoes_bancarias')
      .update({ classificacao_especial: null })
      .eq('id', movimentacaoId)
    if (error) throw error
    setMovimentacoes(prev => prev.map(m => m.id === movimentacaoId ? { ...m, classificacaoEspecial: undefined } : m))
  }

  async function excluirExtrato(id: string) {
    const alvo = extratos.find(e => e.id === id)
    const supabase = createClient()
    const { error } = await supabase.from('extratos_bancarios').delete().eq('id', id)
    if (error) throw error
    setExtratos(prev => prev.filter(e => e.id !== id))
    setMovimentacoes(prev => prev.filter(m => m.extratoId !== id))
    if (alvo) {
      try {
        await logAtividade({ tipo: 'financeiro', acao: 'Extrato bancário excluído', detalhes: alvo.nomeArquivo, espaco: alvo.espaco })
      } catch {
        // log é secundário, não deve impedir a exclusão já concluída
      }
    }
  }

  return (
    <ConciliacaoContext.Provider value={{ extratos, movimentacoes, loading, importarExtrato, vincularMovimentacao, desvincularMovimentacao, marcarClassificacaoEspecial, desmarcarClassificacaoEspecial, excluirExtrato }}>
      {children}
    </ConciliacaoContext.Provider>
  )
}

export function useConciliacao(): ConciliacaoContextValue {
  const ctx = useContext(ConciliacaoContext)
  if (!ctx) throw new Error('useConciliacao must be used inside ConciliacaoProvider')
  return ctx
}
