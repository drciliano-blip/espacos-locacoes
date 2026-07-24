'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useAtividades } from '@/contexts/AtividadesContext'
import type { Evento, Espaco, EnderecoCompleto } from '@/types'

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
  valor_sinal: number | string | null
  data_vencimento_saldo: string | null
  responsavel: string | null
  telefone_contato: string | null
  decoracao: string | null
  observacoes_tecnicas: string | null
  status_vistoria: string | null
  nome_evento: string | null
  hora_inicio_montagem: string | null
  cpf: string | null
  rg: string | null
  data_nascimento: string | null
  email: string | null
  endereco: EnderecoCompleto | null
  pessoa_juridica: boolean
  razao_social: string | null
  nome_fantasia: string | null
  cnpj: string | null
  endereco_empresa: EnderecoCompleto | null
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
    valorSinal: row.valor_sinal != null ? Number(row.valor_sinal) : undefined,
    dataVencimentoSaldo: row.data_vencimento_saldo ?? undefined,
    responsavel: row.responsavel ?? undefined,
    telefoneContato: row.telefone_contato ?? undefined,
    decoracao: (row.decoracao as Evento['decoracao']) ?? undefined,
    observacoesTecnicas: row.observacoes_tecnicas ?? undefined,
    statusVistoria: (row.status_vistoria as Evento['statusVistoria']) ?? undefined,
    documentos: [],
    nomeEvento: row.nome_evento ?? undefined,
    horaInicioMontagem: row.hora_inicio_montagem?.slice(0, 5) ?? undefined,
    cpf: row.cpf ?? undefined,
    rg: row.rg ?? undefined,
    dataNascimento: row.data_nascimento ?? undefined,
    email: row.email ?? undefined,
    endereco: row.endereco ?? undefined,
    pessoaJuridica: row.pessoa_juridica ?? false,
    razaoSocial: row.razao_social ?? undefined,
    nomeFantasia: row.nome_fantasia ?? undefined,
    cnpj: row.cnpj ?? undefined,
    enderecoEmpresa: row.endereco_empresa ?? undefined,
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
    valor_sinal: e.valorSinal ?? null,
    data_vencimento_saldo: e.dataVencimentoSaldo ?? null,
    responsavel: e.responsavel ?? null,
    telefone_contato: e.telefoneContato ?? null,
    decoracao: e.decoracao ?? null,
    observacoes_tecnicas: e.observacoesTecnicas ?? null,
    status_vistoria: e.statusVistoria ?? null,
    nome_evento: e.nomeEvento ?? null,
    hora_inicio_montagem: e.horaInicioMontagem || null,
    cpf: e.cpf ?? null,
    rg: e.rg ?? null,
    data_nascimento: e.dataNascimento || null,
    email: e.email ?? null,
    endereco: e.endereco ?? null,
    pessoa_juridica: e.pessoaJuridica ?? false,
    razao_social: e.razaoSocial ?? null,
    nome_fantasia: e.nomeFantasia ?? null,
    cnpj: e.cnpj ?? null,
    endereco_empresa: e.enderecoEmpresa ?? null,
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

// Plano padrão ao criar um evento: Sinal hoje + Saldo 8 dias antes do evento (50/50 por padrão).
// Se o evento já veio com valorSinal/dataVencimentoSaldo negociados (forma de pagamento
// "Parcelado"), usa esses valores em vez do split cego. Totalmente editável depois pela
// seção "Plano de Pagamento" em Eventos → Receitas.
function gerarPlanoPadrao(dataEvento: string, valorTotal: number, valorSinal?: number, dataVencimentoSaldo?: string) {
  const hoje = new Date().toISOString().split('T')[0]
  const sinal = valorSinal != null ? Math.round(valorSinal * 100) / 100 : Math.round((valorTotal / 2) * 100) / 100
  const saldo = Math.round((valorTotal - sinal) * 100) / 100

  let dataSaldoStr = dataVencimentoSaldo
  if (!dataSaldoStr) {
    const [y, m, d] = dataEvento.split('-').map(Number)
    const dataSaldo = new Date(y, (m ?? 1) - 1, d ?? 1)
    dataSaldo.setDate(dataSaldo.getDate() - 8)
    dataSaldoStr = `${dataSaldo.getFullYear()}-${String(dataSaldo.getMonth() + 1).padStart(2, '0')}-${String(dataSaldo.getDate()).padStart(2, '0')}`
  }

  return [
    { numero: 1, label: 'Sinal', data: hoje, valor: sinal },
    { numero: 2, label: 'Saldo', data: dataSaldoStr, valor: saldo },
  ]
}

export function EventosProvider({ children }: { children: ReactNode }) {
  const { syncParcelasDoEvento } = useReceitas()
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
      await syncParcelasDoEvento({
        eventoId: novo.id,
        cliente: novo.cliente,
        espaco: novo.espaco,
        parcelas: gerarPlanoPadrao(novo.data, novo.valor, novo.valorSinal, novo.dataVencimentoSaldo),
      })
      await logAtividade({ tipo: 'evento', acao: 'Evento criado', detalhes: `${novo.cliente} — ${novo.data}`, espaco: novo.espaco })
    } catch {
      // efeitos colaterais (gerar plano de pagamento, registrar atividade) não devem derrubar o cadastro do evento
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
    // O plano de pagamento (parcelas) não é regenerado automaticamente aqui — evita apagar
    // parcelas já customizadas ou com baixa dada. Ajustes de plano são feitos na própria
    // seção "Plano de Pagamento" (Eventos → Receitas).
    try {
      await logAtividade({ tipo: 'evento', acao: 'Evento atualizado', detalhes: `${updated.cliente} — ${updated.data}`, espaco: updated.espaco })
    } catch {
      // log é secundário, não deve derrubar a edição do evento
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
