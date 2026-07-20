'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useAtividades } from '@/contexts/AtividadesContext'
import type { Evento, Espaco } from '@/types'

interface EventoRow {
  id: string
  cliente: string
  espaco: { nome: string } | null
  data: string
  hora_inicio: string
  hora_fim: string
  tipo: string
  tipo_evento: string | null
  status: string
  valor: number | string
  observacoes: string | null
  numero_pessoas: number | null
  capacidade_utilizada: number | null
  faturamento_bruto: number | string | null
  faturamento_liquido: number | string | null
  forma_pagamento: string | null
  data_vencimento_saldo: string | null
  responsavel: string | null
  telefone_contato: string | null
  decoracao: string | null
  observacoes_tecnicas: string | null
  status_vistoria: string | null
}

function fromRow(row: EventoRow): Evento {
  return {
    id: row.id,
    cliente: row.cliente,
    espaco: (row.espaco?.nome ?? '') as Espaco,
    data: row.data,
    horaInicio: (row.hora_inicio ?? '').slice(0, 5),
    horaFim: (row.hora_fim ?? '').slice(0, 5),
    tipo: row.tipo,
    tipoEvento: (row.tipo_evento as Evento['tipoEvento']) ?? undefined,
    status: row.status as Evento['status'],
    valor: Number(row.valor),
    observacoes: row.observacoes ?? undefined,
    numeroPessoas: row.numero_pessoas ?? undefined,
    capacidadeUtilizada: row.capacidade_utilizada ?? undefined,
    faturamentoBruto: row.faturamento_bruto != null ? Number(row.faturamento_bruto) : undefined,
    faturamentoLiquido: row.faturamento_liquido != null ? Number(row.faturamento_liquido) : undefined,
    formaPagamento: (row.forma_pagamento as Evento['formaPagamento']) ?? undefined,
    dataVencimentoSaldo: row.data_vencimento_saldo ?? undefined,
    responsavel: row.responsavel ?? undefined,
    telefoneContato: row.telefone_contato ?? undefined,
    decoracao: (row.decoracao as Evento['decoracao']) ?? undefined,
    observacoesTecnicas: row.observacoes_tecnicas ?? undefined,
    statusVistoria: (row.status_vistoria as Evento['statusVistoria']) ?? undefined,
    documentos: [],
  }
}

function toPayload(e: Evento) {
  return {
    cliente: e.cliente,
    data: e.data,
    hora_inicio: e.horaInicio,
    hora_fim: e.horaFim,
    tipo: e.tipo,
    tipo_evento: e.tipoEvento ?? null,
    status: e.status,
    valor: e.valor,
    observacoes: e.observacoes ?? null,
    numero_pessoas: e.numeroPessoas ?? null,
    capacidade_utilizada: e.capacidadeUtilizada ?? null,
    faturamento_bruto: e.faturamentoBruto ?? null,
    faturamento_liquido: e.faturamentoLiquido ?? null,
    forma_pagamento: e.formaPagamento ?? null,
    data_vencimento_saldo: e.dataVencimentoSaldo ?? null,
    responsavel: e.responsavel ?? null,
    telefone_contato: e.telefoneContato ?? null,
    decoracao: e.decoracao ?? null,
    observacoes_tecnicas: e.observacoesTecnicas ?? null,
    status_vistoria: e.statusVistoria ?? null,
  }
}

interface EventosContextValue {
  eventos: Evento[]
  loading: boolean
  addEvento: (e: Evento) => Promise<void>
  updateEvento: (e: Evento) => Promise<void>
  deleteEvento: (id: string) => Promise<void>
}

const EventosContext = createContext<EventosContextValue | null>(null)

const SELECT = '*, espaco:espacos(nome)'

export function EventosProvider({ children }: { children: ReactNode }) {
  const { upsertReceitaDoEvento } = useReceitas()
  const { logAtividade } = useAtividades()
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('eventos').select(SELECT).order('data')
    setEventos(((data as unknown as EventoRow[]) ?? []).map(fromRow))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addEvento(e: Evento) {
    const supabase = createClient()
    const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', e.espaco).single()
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('eventos')
      // preserva o id pré-gerado no client — arquivos já podem ter sido anexados a ele antes de salvar
      .insert({ id: e.id, espaco_id: espacoRow?.id, created_by: user?.id ?? null, ...toPayload(e) })
      .select(SELECT)
      .single()

    if (error) throw error
    const novo = fromRow(data as unknown as EventoRow)
    setEventos(prev => [novo, ...prev])
    try {
      await upsertReceitaDoEvento({ id: novo.id, cliente: novo.cliente, espaco: novo.espaco, data: novo.data, valor: novo.valor })
      await logAtividade({ tipo: 'evento', acao: 'Evento criado', detalhes: `${novo.cliente} — ${novo.data}`, espaco: novo.espaco })
    } catch {
      // efeitos colaterais (sincronizar receita, registrar atividade) não devem derrubar o cadastro do evento
    }
  }

  async function updateEvento(e: Evento) {
    const supabase = createClient()
    const { data: espacoRow } = await supabase.from('espacos').select('id').eq('nome', e.espaco).single()

    const { data, error } = await supabase
      .from('eventos')
      .update({ espaco_id: espacoRow?.id, ...toPayload(e) })
      .eq('id', e.id)
      .select(SELECT)
      .single()

    if (error) throw error
    const updated = fromRow(data as unknown as EventoRow)
    setEventos(prev => prev.map(x => (x.id === updated.id ? updated : x)))
    try {
      await upsertReceitaDoEvento({ id: updated.id, cliente: updated.cliente, espaco: updated.espaco, data: updated.data, valor: updated.valor })
      await logAtividade({ tipo: 'evento', acao: 'Evento atualizado', detalhes: `${updated.cliente} — ${updated.data}`, espaco: updated.espaco })
    } catch {
      // efeitos colaterais não devem derrubar a edição do evento
    }
  }

  async function deleteEvento(id: string) {
    const alvo = eventos.find(e => e.id === id)
    const supabase = createClient()
    const { error } = await supabase.from('eventos').delete().eq('id', id)
    if (error) throw error
    setEventos(prev => prev.filter(x => x.id !== id))
    if (alvo) {
      try {
        await logAtividade({ tipo: 'evento', acao: 'Evento excluído', detalhes: `${alvo.cliente} — ${alvo.data}`, espaco: alvo.espaco })
      } catch {
        // log é secundário, não deve impedir a exclusão já concluída
      }
    }
  }

  return (
    <EventosContext.Provider value={{ eventos, loading, addEvento, updateEvento, deleteEvento }}>
      {children}
    </EventosContext.Provider>
  )
}

export function useEventos(): EventosContextValue {
  const ctx = useContext(EventosContext)
  if (!ctx) throw new Error('useEventos must be used inside EventosProvider')
  return ctx
}
