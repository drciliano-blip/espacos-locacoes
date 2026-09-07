'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAtividades } from '@/contexts/AtividadesContext'
import { formatCurrency, formatDate } from '@/lib/utils'

export interface RepasseSocioSnapshot {
  socio: string
  percentual: number
  valorDevido: number
  retirado: number
  jaRepassado: number
  valorPendente: number
}

export interface FechamentoLancamento {
  data: string
  pessoa: string
  descricao: string
  valor: number
}

export interface FechamentoSecaoDetalhe {
  total: number
  lista: FechamentoLancamento[]
}

// Detalhe linha-a-linha de cada seção do período fechado — junto com
// repasseSocios, é o que permite "Visualizar" reconstruir o relatório
// completo daquele fechamento sem precisar recalcular nada ao vivo.
// Fechamentos feitos antes desta coluna existir vêm como '{}' do banco —
// EMPTY_DETALHES cobre esse caso.
export interface FechamentoDetalhes {
  receitaOperacional: FechamentoSecaoDetalhe
  despesaOperacional: FechamentoSecaoDetalhe
  aportes: FechamentoSecaoDetalhe
  despesasObra: FechamentoSecaoDetalhe
  retiradas: FechamentoSecaoDetalhe
}

const SECAO_VAZIA: FechamentoSecaoDetalhe = { total: 0, lista: [] }
export const EMPTY_DETALHES: FechamentoDetalhes = {
  receitaOperacional: SECAO_VAZIA,
  despesaOperacional: SECAO_VAZIA,
  aportes: SECAO_VAZIA,
  despesasObra: SECAO_VAZIA,
  retiradas: SECAO_VAZIA,
}

export interface Fechamento {
  id: string
  espaco: string
  dataInicio: string
  dataFim: string
  resultadoOperacional: number
  resultadoAcumulado: number
  fundoReservaDeduzido: number
  retiradaDeduzida: number
  disponivelDoEspaco: number
  disponivelParaDistribuicao: number
  repasseSocios: RepasseSocioSnapshot[]
  detalhes: FechamentoDetalhes
  fechadoPorNome?: string
  fechadoEm: string
}

interface FechamentoRow {
  id: string
  espaco: { nome: string } | null
  data_inicio: string
  data_fim: string
  resultado_operacional: number | string
  resultado_acumulado: number | string
  fundo_reserva_deduzido: number | string
  retirada_deduzida: number | string
  disponivel_do_espaco: number | string
  disponivel_para_distribuicao: number | string
  repasse_socios: RepasseSocioSnapshot[] | null
  detalhes: Partial<FechamentoDetalhes> | null
  fechado_por_nome: string | null
  created_at: string
}

function fromRow(row: FechamentoRow): Fechamento {
  return {
    id: row.id,
    espaco: row.espaco?.nome ?? '',
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    resultadoOperacional: Number(row.resultado_operacional),
    resultadoAcumulado: Number(row.resultado_acumulado),
    fundoReservaDeduzido: Number(row.fundo_reserva_deduzido),
    retiradaDeduzida: Number(row.retirada_deduzida),
    disponivelDoEspaco: Number(row.disponivel_do_espaco),
    disponivelParaDistribuicao: Number(row.disponivel_para_distribuicao),
    repasseSocios: row.repasse_socios ?? [],
    detalhes: { ...EMPTY_DETALHES, ...row.detalhes },
    fechadoPorNome: row.fechado_por_nome ?? undefined,
    fechadoEm: row.created_at,
  }
}

export interface NovoFechamentoInput {
  espaco: string
  dataInicio: string
  dataFim: string
  resultadoOperacional: number
  resultadoAcumulado: number
  fundoReservaDeduzido: number
  retiradaDeduzida: number
  disponivelDoEspaco: number
  disponivelParaDistribuicao: number
  repasseSocios: RepasseSocioSnapshot[]
  detalhes: FechamentoDetalhes
}

interface FechamentosContextValue {
  fechamentos: Fechamento[]
  loading: boolean
  fecharPeriodo: (input: NovoFechamentoInput) => Promise<void>
  reabrirPeriodo: (id: string) => Promise<void>
}

const FechamentosContext = createContext<FechamentosContextValue | null>(null)
const SELECT = '*, espaco:espacos(nome)'

export function FechamentosProvider({ children }: { children: ReactNode }) {
  const { logAtividade } = useAtividades()
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('fechamentos_mensais').select(SELECT).order('data_inicio', { ascending: false })
    setFechamentos(((data as unknown as FechamentoRow[]) ?? []).map(fromRow))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function fecharPeriodo(input: NovoFechamentoInput) {
    const supabase = createClient()
    const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', input.espaco).single()
    if (!espacoRow) throw new Error(`Espaço "${input.espaco}" não encontrado.`)
    const { data: { user } } = await supabase.auth.getUser()

    let fechadoPorNome: string | null = null
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', user.id).single()
      fechadoPorNome = profile?.nome ?? null
    }

    const { data, error } = await supabase
      .from('fechamentos_mensais')
      .insert({
        espaco_id: espacoRow.id,
        data_inicio: input.dataInicio,
        data_fim: input.dataFim,
        resultado_operacional: input.resultadoOperacional,
        resultado_acumulado: input.resultadoAcumulado,
        fundo_reserva_deduzido: input.fundoReservaDeduzido,
        retirada_deduzida: input.retiradaDeduzida,
        disponivel_do_espaco: input.disponivelDoEspaco,
        disponivel_para_distribuicao: input.disponivelParaDistribuicao,
        repasse_socios: input.repasseSocios,
        detalhes: input.detalhes,
        fechado_por: user?.id ?? null,
        fechado_por_nome: fechadoPorNome,
      })
      .select(SELECT)
      .single()

    if (error) throw error
    const novo = fromRow(data as unknown as FechamentoRow)
    setFechamentos(prev => [novo, ...prev])
    try {
      await logAtividade({
        tipo: 'financeiro',
        acao: 'Fechamento de período realizado',
        detalhes: `${formatDate(novo.dataInicio)} a ${formatDate(novo.dataFim)} — Disponível para Distribuição: ${formatCurrency(novo.disponivelParaDistribuicao)}`,
        espaco: novo.espaco,
      })
    } catch {
      // log é secundário, não deve impedir o fechamento
    }
  }

  async function reabrirPeriodo(id: string) {
    const alvo = fechamentos.find(f => f.id === id)
    const supabase = createClient()
    const { error } = await supabase.from('fechamentos_mensais').delete().eq('id', id)
    if (error) throw error
    setFechamentos(prev => prev.filter(f => f.id !== id))
    if (alvo) {
      try {
        await logAtividade({
          tipo: 'financeiro',
          acao: 'Fechamento de período reaberto',
          detalhes: `${formatDate(alvo.dataInicio)} a ${formatDate(alvo.dataFim)} — Disponível para Distribuição: ${formatCurrency(alvo.disponivelParaDistribuicao)}`,
          espaco: alvo.espaco,
        })
      } catch {
        // log é secundário, não deve impedir a reabertura já concluída
      }
    }
  }

  return (
    <FechamentosContext.Provider value={{ fechamentos, loading, fecharPeriodo, reabrirPeriodo }}>
      {children}
    </FechamentosContext.Provider>
  )
}

export function useFechamentos(): FechamentosContextValue {
  const ctx = useContext(FechamentosContext)
  if (!ctx) throw new Error('useFechamentos must be used inside FechamentosProvider')
  return ctx
}
