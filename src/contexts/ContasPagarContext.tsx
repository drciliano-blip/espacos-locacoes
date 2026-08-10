'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAtividades } from '@/contexts/AtividadesContext'
import type { ContaPagar, CategoriaContaPagar, StatusContaPagar } from '@/types'

// Fundo de Caixa (transferência de saldo), Retirada Sócio (distribuição a
// sócio) e Obra (custo de um projeto à parte, bancado por aporte específico)
// não são despesa operacional — nunca entram no Resultado Operacional. Obra
// tem fechamento próprio, com seu próprio saldo (aportes − despesas de obra).
export function isDespesaOperacional(c: ContaPagar): boolean {
  return c.categoria !== 'fundo_caixa' && c.categoria !== 'retirada_socio' && c.categoria !== 'obra'
}

export function isDespesaObra(c: ContaPagar): boolean {
  return c.categoria === 'obra'
}

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
  hora_pagamento: string | null
  data_baixa: string | null
  comprovante_instituicao: string | null
  comprovante_identificador: string | null
  fornecedor: string | null
  observacoes: string | null
  texto_origem_whatsapp: string | null
  evento_id: string | null
  origem_lancamento: string | null
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
    horaPagamento: row.hora_pagamento ?? undefined,
    dataBaixa: row.data_baixa ?? undefined,
    comprovanteInstituicao: row.comprovante_instituicao ?? undefined,
    comprovanteIdentificador: row.comprovante_identificador ?? undefined,
    fornecedor: row.fornecedor ?? undefined,
    observacoes: row.observacoes ?? undefined,
    textoOrigemWhatsapp: row.texto_origem_whatsapp ?? undefined,
    eventoId: row.evento_id ?? undefined,
    origemLancamento: (row.origem_lancamento ?? undefined) as ContaPagar['origemLancamento'],
  }
}

interface ContasPagarContextValue {
  contas: ContaPagar[]
  loading: boolean
  addConta: (c: ContaPagar) => Promise<void>
  updateConta: (c: ContaPagar) => Promise<void>
  deleteConta: (id: string) => Promise<void>
  darBaixa: (id: string, dataPagamento: string, horaPagamento?: string, comprovanteInstituicao?: string, comprovanteIdentificador?: string) => Promise<void>
  // Corrige a data/hora do pagamento de uma conta JÁ paga (relendo o comprovante),
  // sem alterar o status nem a data em que a baixa foi originalmente registrada.
  // Só atualiza os campos que vieram com valor de verdade — nunca sobrescreve com
  // um chute (ex: vencimento) quando a IA não conseguiu identificar algo.
  corrigirDataPagamento: (id: string, dataPagamento?: string, horaPagamento?: string, comprovanteInstituicao?: string, comprovanteIdentificador?: string) => Promise<void>
}

const ContasPagarContext = createContext<ContasPagarContextValue | null>(null)
const SELECT = '*, espaco:espacos(nome)'

export function ContasPagarProvider({ children }: { children: ReactNode }) {
  const { logAtividade } = useAtividades()
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
        hora_pagamento: c.horaPagamento ?? null,
        comprovante_instituicao: c.comprovanteInstituicao ?? null,
        comprovante_identificador: c.comprovanteIdentificador ?? null,
        fornecedor: c.fornecedor ?? null,
        observacoes: c.observacoes ?? null,
        texto_origem_whatsapp: c.textoOrigemWhatsapp ?? null,
        evento_id: c.eventoId ?? null,
        origem_lancamento: c.origemLancamento ?? null,
        created_by: user?.id ?? null,
      })
      .select(SELECT)
      .single()

    if (error) throw error
    const nova = fromRow(data as unknown as ContaPagarRow)
    setContas(prev => [nova, ...prev])
    try {
      await logAtividade({ tipo: 'financeiro', acao: 'Conta a pagar lançada', detalhes: nova.descricao, espaco: nova.espaco !== 'Todos' ? nova.espaco : undefined })
    } catch {
      // log é secundário, não deve impedir o lançamento da conta
    }
  }

  async function updateConta(c: ContaPagar) {
    const supabase = createClient()
    let espacoId: string | null = null
    if (c.espaco && c.espaco !== 'Todos') {
      const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', c.espaco).single()
      espacoId = espacoRow?.id ?? null
    }

    const { data, error } = await supabase
      .from('contas_pagar')
      .update({
        descricao: c.descricao,
        espaco_id: espacoId,
        categoria: c.categoria,
        subcategoria: c.subcategoria,
        valor: c.valor,
        status: c.status,
        data_vencimento: c.dataVencimento,
        data_pagamento: c.dataPagamento ?? null,
        hora_pagamento: c.horaPagamento ?? null,
        comprovante_instituicao: c.comprovanteInstituicao ?? null,
        comprovante_identificador: c.comprovanteIdentificador ?? null,
        fornecedor: c.fornecedor ?? null,
        observacoes: c.observacoes ?? null,
        texto_origem_whatsapp: c.textoOrigemWhatsapp ?? null,
        evento_id: c.eventoId ?? null,
        origem_lancamento: c.origemLancamento ?? null,
      })
      .eq('id', c.id)
      .select(SELECT)
      .single()

    if (error) throw error
    const atualizada = fromRow(data as unknown as ContaPagarRow)
    setContas(prev => prev.map(x => x.id === c.id ? atualizada : x))
    try {
      await logAtividade({ tipo: 'financeiro', acao: 'Conta a pagar editada', detalhes: atualizada.descricao, espaco: atualizada.espaco !== 'Todos' ? atualizada.espaco : undefined })
    } catch {
      // log é secundário, não deve impedir a edição da conta
    }
  }

  async function deleteConta(id: string) {
    const alvo = contas.find(c => c.id === id)
    const supabase = createClient()
    const { error } = await supabase.from('contas_pagar').delete().eq('id', id)
    if (error) throw error
    setContas(prev => prev.filter(c => c.id !== id))
    if (alvo) {
      try {
        await logAtividade({ tipo: 'financeiro', acao: 'Conta a pagar excluída', detalhes: alvo.descricao, espaco: alvo.espaco !== 'Todos' ? alvo.espaco : undefined })
      } catch {
        // log é secundário, não deve impedir a exclusão já concluída
      }
    }
  }

  async function darBaixa(id: string, dataPagamento: string, horaPagamento?: string, comprovanteInstituicao?: string, comprovanteIdentificador?: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('contas_pagar')
      .update({
        status: 'pago',
        data_pagamento: dataPagamento,
        hora_pagamento: horaPagamento ?? null,
        data_baixa: new Date().toISOString(),
        comprovante_instituicao: comprovanteInstituicao ?? null,
        comprovante_identificador: comprovanteIdentificador ?? null,
      })
      .eq('id', id)
      .select(SELECT)
      .single()

    if (error) throw error
    const atualizada = fromRow(data as unknown as ContaPagarRow)
    setContas(prev => prev.map(c => c.id === id ? atualizada : c))
    try {
      await logAtividade({ tipo: 'financeiro', acao: 'Conta a pagar paga', detalhes: atualizada.descricao, espaco: atualizada.espaco !== 'Todos' ? atualizada.espaco : undefined })
    } catch {
      // log é secundário, não deve impedir a baixa da conta
    }
  }

  async function corrigirDataPagamento(id: string, dataPagamento?: string, horaPagamento?: string, comprovanteInstituicao?: string, comprovanteIdentificador?: string) {
    const patch: Record<string, string> = {}
    if (dataPagamento !== undefined) patch.data_pagamento = dataPagamento
    if (horaPagamento !== undefined) patch.hora_pagamento = horaPagamento
    if (comprovanteInstituicao !== undefined) patch.comprovante_instituicao = comprovanteInstituicao
    if (comprovanteIdentificador !== undefined) patch.comprovante_identificador = comprovanteIdentificador
    if (Object.keys(patch).length === 0) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from('contas_pagar')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()

    if (error) throw error
    const atualizada = fromRow(data as unknown as ContaPagarRow)
    setContas(prev => prev.map(c => c.id === id ? atualizada : c))
  }

  return (
    <ContasPagarContext.Provider value={{ contas, loading, addConta, updateConta, deleteConta, darBaixa, corrigirDataPagamento }}>
      {children}
    </ContasPagarContext.Provider>
  )
}

export function useContasPagar(): ContasPagarContextValue {
  const ctx = useContext(ContasPagarContext)
  if (!ctx) throw new Error('useContasPagar must be used inside ContasPagarProvider')
  return ctx
}
