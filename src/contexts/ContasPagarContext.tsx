'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAtividades } from '@/contexts/AtividadesContext'
import { useFechamentos } from '@/contexts/FechamentosContext'
import { dataEfetivaConta, periodoFechado, mensagemPeriodoFechado } from '@/lib/fechamento-lock'
import { getFiles, deleteFile } from '@/lib/file-storage'
import { hojeISO } from '@/lib/utils'
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

// "atrasado" não é um valor gravado no banco — é calculado a partir do
// vencimento, pra toda conta pendente vencida virar "Em atraso" automaticamente,
// sem precisar de um job rodando. Só "pago" é um estado confirmado manualmente.
// Único lugar que decide isso — qualquer tela que precise saber se uma conta
// está atrasada (lista de Contas a Pagar, sino de notificações, etc.) usa esta
// função em vez de comparar `c.status` cru.
export function statusEfetivo(conta: ContaPagar): StatusContaPagar {
  if (conta.status === 'pago') return 'pago'
  return conta.dataVencimento < hojeISO() ? 'atrasado' : 'pendente'
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
  origem: string | null
  serie_id: string | null
  serie_numero: number | null
  serie_total: number | null
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
    origem: (row.origem ?? undefined) as ContaPagar['origem'],
    serieId: row.serie_id ?? undefined,
    serieNumero: row.serie_numero ?? undefined,
    serieTotal: row.serie_total ?? undefined,
  }
}

// Mesmo dia do mês, N meses depois — dia 31 em mês de 30 dias cai no último
// dia (nunca "pula" pro mês seguinte).
export function somarMeses(dataISO: string, meses: number): string {
  const [y, m, d] = dataISO.split('-').map(Number)
  const alvo = new Date(y, m - 1 + meses, 1)
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  const dia = Math.min(d, ultimoDia)
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

interface ContasPagarContextValue {
  contas: ContaPagar[]
  loading: boolean
  addConta: (c: ContaPagar) => Promise<void>
  updateConta: (c: ContaPagar) => Promise<void>
  deleteConta: (id: string) => Promise<void>
  // Conta fixa: lança `base` e as dos meses seguintes (total `meses`), todas
  // pendentes exceto a primeira, que mantém o status do formulário.
  addContasSerie: (base: ContaPagar, meses: number) => Promise<number>
  // Aplica descrição/valor/categoria/fornecedor/espaço/observações a esta conta
  // e às próximas da série que ainda não foram pagas. Retorna quantas mudaram.
  updateSerieAPartirDe: (c: ContaPagar) => Promise<number>
  // Exclui esta conta e as próximas da série ainda não pagas.
  deleteSerieAPartirDe: (c: ContaPagar) => Promise<number>
  recarregar: () => Promise<void>
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
  const { fechamentos } = useFechamentos()
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
    const bloqueio = periodoFechado(fechamentos, c.espaco, dataEfetivaConta(c))
    if (bloqueio) throw new Error(mensagemPeriodoFechado(bloqueio))

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
        origem: c.origem ?? 'manual',
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
    const existente = contas.find(x => x.id === c.id)
    if (existente) {
      const bloqueio = periodoFechado(fechamentos, existente.espaco, dataEfetivaConta(existente))
      if (bloqueio) throw new Error(mensagemPeriodoFechado(bloqueio))
    }

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
        origem: c.origem ?? null,
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
    if (alvo) {
      const bloqueio = periodoFechado(fechamentos, alvo.espaco, dataEfetivaConta(alvo))
      if (bloqueio) throw new Error(mensagemPeriodoFechado(bloqueio))
    }
    const supabase = createClient()
    const { data: apagadas, error } = await supabase.from('contas_pagar').delete().eq('id', id).select('id')
    if (error) throw error
    if (!apagadas?.length) throw new Error('Você não tem permissão para excluir esta conta.')
    setContas(prev => prev.filter(c => c.id !== id))
    try {
      const arquivos = await getFiles({ module: 'contas', entityId: id })
      await Promise.all(arquivos.map(f => deleteFile(f.id)))
    } catch {
      // se a limpeza dos arquivos falhar, a conta já foi excluída — não deve
      // travar o fluxo, mas o comprovante pode ficar órfão (bloqueando reenvio
      // futuro do mesmo arquivo na checagem de duplicidade do "Dar baixa")
    }
    if (alvo) {
      try {
        await logAtividade({ tipo: 'financeiro', acao: 'Conta a pagar excluída', detalhes: alvo.descricao, espaco: alvo.espaco !== 'Todos' ? alvo.espaco : undefined })
      } catch {
        // log é secundário, não deve impedir a exclusão já concluída
      }
    }
  }

  async function espacoIdDe(supabase: ReturnType<typeof createClient>, espaco: ContaPagar['espaco']): Promise<string | null> {
    if (!espaco || espaco === 'Todos') return null
    const { data } = await supabase.from('espacos').select('id').eq('nome', espaco).single()
    return data?.id ?? null
  }

  async function addContasSerie(base: ContaPagar, meses: number) {
    const total = Math.max(1, Math.min(60, Math.floor(meses)))
    const serieId = crypto.randomUUID()
    const supabase = createClient()
    const espacoId = await espacoIdDe(supabase, base.espaco)
    const { data: { user } } = await supabase.auth.getUser()
    const linhas = Array.from({ length: total }, (_, i) => {
      const primeira = i === 0
      const c: ContaPagar = primeira ? base : {
        ...base, id: crypto.randomUUID(), status: 'pendente',
        dataPagamento: undefined, horaPagamento: undefined, comprovanteInstituicao: undefined, comprovanteIdentificador: undefined,
        dataVencimento: somarMeses(base.dataVencimento, i),
      }
      const bloqueio = periodoFechado(fechamentos, c.espaco, dataEfetivaConta(c))
      if (bloqueio) throw new Error(mensagemPeriodoFechado(bloqueio))
      return {
        id: c.id, descricao: c.descricao, espaco_id: espacoId, categoria: c.categoria, subcategoria: c.subcategoria,
        valor: c.valor, status: c.status, data_vencimento: c.dataVencimento,
        data_pagamento: c.dataPagamento ?? null, hora_pagamento: c.horaPagamento ?? null,
        comprovante_instituicao: c.comprovanteInstituicao ?? null, comprovante_identificador: c.comprovanteIdentificador ?? null,
        fornecedor: c.fornecedor ?? null, observacoes: c.observacoes ?? null,
        texto_origem_whatsapp: primeira ? (c.textoOrigemWhatsapp ?? null) : null,
        evento_id: c.eventoId ?? null, origem_lancamento: c.origemLancamento ?? null, origem: c.origem ?? 'manual',
        created_by: user?.id ?? null, serie_id: serieId, serie_numero: i + 1, serie_total: total,
      }
    })
    const { data, error } = await supabase.from('contas_pagar').insert(linhas).select(SELECT)
    if (error) throw error
    const novas = ((data as unknown as ContaPagarRow[]) ?? []).map(fromRow)
    setContas(prev => [...novas, ...prev])
    try {
      await logAtividade({ tipo: 'financeiro', acao: 'Conta fixa programada', detalhes: `${base.descricao} — ${total} meses`, espaco: base.espaco !== 'Todos' ? base.espaco : undefined })
    } catch {
      // log é secundário
    }
    return novas.length
  }

  // Esta conta e as próximas da série que ainda dá pra mexer: não pagas e
  // fora de período fechado.
  function proximasDaSerie(c: ContaPagar): ContaPagar[] {
    if (!c.serieId) return [c]
    return contas.filter(x => x.serieId === c.serieId && (x.serieNumero ?? 0) >= (c.serieNumero ?? 0) && x.status !== 'pago'
      && !periodoFechado(fechamentos, x.espaco, dataEfetivaConta(x)))
  }

  async function updateSerieAPartirDe(c: ContaPagar) {
    await updateConta(c)
    const outras = proximasDaSerie(c).filter(x => x.id !== c.id)
    if (outras.length === 0) return 1
    const supabase = createClient()
    const espacoId = await espacoIdDe(supabase, c.espaco)
    const { data, error } = await supabase.from('contas_pagar')
      .update({ descricao: c.descricao, espaco_id: espacoId, categoria: c.categoria, subcategoria: c.subcategoria, valor: c.valor,
                fornecedor: c.fornecedor ?? null, observacoes: c.observacoes ?? null })
      .in('id', outras.map(x => x.id))
      .select(SELECT)
    if (error) throw error
    const mapa = new Map(((data as unknown as ContaPagarRow[]) ?? []).map(r => [r.id, fromRow(r)]))
    setContas(prev => prev.map(x => mapa.get(x.id) ?? x))
    return 1 + mapa.size
  }

  async function deleteSerieAPartirDe(c: ContaPagar) {
    const alvos = proximasDaSerie(c)
    if (!alvos.some(x => x.id === c.id)) throw new Error('Esta conta já está paga ou num período fechado e não pode ser excluída.')
    const supabase = createClient()
    const { error } = await supabase.from('contas_pagar').delete().in('id', alvos.map(x => x.id))
    if (error) throw error
    const ids = new Set(alvos.map(x => x.id))
    setContas(prev => prev.filter(x => !ids.has(x.id)))
    try {
      await logAtividade({ tipo: 'financeiro', acao: 'Conta fixa excluída', detalhes: `${c.descricao} — ${alvos.length} mês(es)`, espaco: c.espaco !== 'Todos' ? c.espaco : undefined })
    } catch {
      // log é secundário
    }
    return alvos.length
  }

  async function darBaixa(id: string, dataPagamento: string, horaPagamento?: string, comprovanteInstituicao?: string, comprovanteIdentificador?: string) {
    const existente = contas.find(c => c.id === id)
    if (existente) {
      const bloqueio = periodoFechado(fechamentos, existente.espaco, dataEfetivaConta(existente))
      if (bloqueio) throw new Error(mensagemPeriodoFechado(bloqueio))
    }

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
    const existente = contas.find(c => c.id === id)
    if (existente) {
      const bloqueio = periodoFechado(fechamentos, existente.espaco, dataEfetivaConta(existente))
      if (bloqueio) throw new Error(mensagemPeriodoFechado(bloqueio))
    }

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
    <ContasPagarContext.Provider value={{ contas, loading, addConta, updateConta, deleteConta, addContasSerie, updateSerieAPartirDe, deleteSerieAPartirDe, darBaixa, corrigirDataPagamento, recarregar: load }}>
      {children}
    </ContasPagarContext.Provider>
  )
}

export function useContasPagar(): ContasPagarContextValue {
  const ctx = useContext(ContasPagarContext)
  if (!ctx) throw new Error('useContasPagar must be used inside ContasPagarProvider')
  return ctx
}
