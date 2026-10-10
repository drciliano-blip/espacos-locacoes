'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Trash2, ChevronDown, ChevronUp, CalendarDays, MapPin, Users, Briefcase, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, hojeISO, mensagemDeErro } from '@/lib/utils'
import { useEventos } from '@/contexts/EventosContext'
import { situacaoCredenciamento } from '@/lib/credenciamento-config'
import type { EscalaEvento, Terceirizado } from '@/types'
import { descricaoContratacao, escalaFromRow, GREEN, INPUT_CLASS, SITUACAO_LABEL, VETADO_CLASS, type EscalaRow } from './dados'

const FILTRO_CLASS = 'cursor-pointer rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:outline-none'

type Periodo = 'proximos' | 'passados' | 'todos'

interface Props {
  pessoas: Terceirizado[]
}

export default function EscalaSection({ pessoas }: Props) {
  const { eventos, loading: loadingEventos } = useEventos()
  const [escalas, setEscalas] = useState<EscalaEvento[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('proximos')
  const [soComEscala, setSoComEscala] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pessoaParaAdicionar, setPessoaParaAdicionar] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('evento_escala').select('*').then(({ data, error }) => {
      if (error) setErro(mensagemDeErro(error, 'Não foi possível carregar as escalas.'))
      setEscalas(((data as EscalaRow[]) ?? []).map(escalaFromRow))
      setLoading(false)
    })
  }, [])

  const pessoaPorId = useMemo(() => new Map(pessoas.map(p => [p.id, p])), [pessoas])

  const escalasPorEvento = useMemo(() => {
    const mapa = new Map<string, EscalaEvento[]>()
    for (const e of escalas) mapa.set(e.eventoId, [...(mapa.get(e.eventoId) ?? []), e])
    return mapa
  }, [escalas])

  const hoje = hojeISO()
  const termo = busca.trim().toLowerCase()

  const eventosFiltrados = eventos
    .filter(ev => {
      if (periodo === 'proximos' && ev.data < hoje) return false
      if (periodo === 'passados' && ev.data >= hoje) return false
      const escalados = escalasPorEvento.get(ev.id) ?? []
      if (soComEscala && escalados.length === 0) return false
      if (!termo) return true
      // Busca por cliente, nome do evento, data (dd/mm/aaaa), espaço ou por
      // quem trabalhou — "em quais eventos o fulano esteve".
      const alvo = [
        ev.cliente, ev.nomeEvento ?? '', formatDate(ev.data), ev.espaco,
        ...escalados.map(e => pessoaPorId.get(e.terceirizadoId)?.nomeCompleto ?? ''),
      ].join(' ').toLowerCase()
      return alvo.includes(termo)
    })
    .sort((a, b) => periodo === 'proximos' ? a.data.localeCompare(b.data) : b.data.localeCompare(a.data))

  function abrir(eventoId: string) {
    setExpandedId(id => id === eventoId ? null : eventoId)
    setPessoaParaAdicionar('')
    setErro(null)
  }

  async function handleAdicionar(eventoId: string) {
    const pessoa = pessoaPorId.get(pessoaParaAdicionar)
    if (!pessoa) return
    setErro(null)
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('evento_escala')
      .insert({ evento_id: eventoId, terceirizado_id: pessoa.id, funcao: pessoa.funcao })
      .select()
      .single()
    setBusy(false)
    if (error) return setErro(mensagemDeErro(error, 'Não foi possível escalar a pessoa.'))
    setEscalas(prev => [...prev, escalaFromRow(data as EscalaRow)])
    setPessoaParaAdicionar('')
  }

  async function handleRemover(escala: EscalaEvento) {
    setErro(null)
    const supabase = createClient()
    const { error } = await supabase.from('evento_escala').delete().eq('id', escala.id)
    if (error) return setErro(mensagemDeErro(error, 'Não foi possível remover da escala.'))
    setEscalas(prev => prev.filter(e => e.id !== escala.id))
  }

  if (loading || loadingEventos) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center">
        <p className="text-sm text-app-subtle">Carregando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-subtle" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cliente, evento, data (dd/mm/aaaa) ou nome de quem trabalhou"
            className="w-full rounded-lg border border-app-border2 bg-app-surface pl-8 pr-3 py-1.5 text-xs text-app-text focus:outline-none focus:border-[#25D366]" />
        </div>
        <select value={periodo} onChange={e => setPeriodo(e.target.value as Periodo)} className={FILTRO_CLASS}>
          <option value="proximos">Próximos eventos</option>
          <option value="passados">Eventos passados</option>
          <option value="todos">Todos os eventos</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-app-muted cursor-pointer">
          <input type="checkbox" checked={soComEscala} onChange={e => setSoComEscala(e.target.checked)} className="accent-[#25D366]" />
          Só com equipe escalada
        </label>
      </div>

      {erro && <p className="text-xs text-red-400">{erro}</p>}

      <div className="space-y-2">
        {eventosFiltrados.length === 0 ? (
          <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center">
            <p className="text-sm text-app-subtle">Nenhum evento encontrado.</p>
          </div>
        ) : eventosFiltrados.map(ev => {
          const escalados = (escalasPorEvento.get(ev.id) ?? [])
            .map(escala => ({ escala, pessoa: pessoaPorId.get(escala.terceirizadoId) }))
            .filter((x): x is { escala: EscalaEvento; pessoa: Terceirizado } => !!x.pessoa)
            .sort((a, b) => a.escala.funcao.localeCompare(b.escala.funcao) || a.pessoa.nomeCompleto.localeCompare(b.pessoa.nomeCompleto))
          // A documentação é conferida na data do evento, não na de hoje: um
          // certificado que vence antes do evento já conta como pendência.
          const comPendencia = escalados.filter(x => x.pessoa.status === 'vetado' || situacaoCredenciamento(x.escala.funcao, x.pessoa.tipoContratacao, x.pessoa.documentos, ev.data) === 'pendente').length
          const idsEscalados = new Set(escalados.map(x => x.pessoa.id))
          const disponiveis = pessoas.filter(p => p.status === 'ativo' && !idsEscalados.has(p.id))
          const aberto = expandedId === ev.id

          return (
            <div key={ev.id} className={`rounded-lg border border-app-border2/50 bg-app-surface2/40 overflow-hidden ${ev.status === 'cancelado' ? 'opacity-60' : ''}`}>
              <button onClick={() => abrir(ev.id)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-app-text truncate">{ev.cliente}</p>
                    {ev.nomeEvento && <span className="text-xs text-app-subtle truncate">— {ev.nomeEvento}</span>}
                    {ev.status === 'cancelado' && <span className="rounded-full border border-app-border2 px-2 py-0.5 text-[11px] text-app-subtle">Cancelado</span>}
                    {comPendencia > 0 && (
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${SITUACAO_LABEL.pendente.className}`}>
                        {comPendencia} com pendência
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-app-subtle">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDate(ev.data)}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.espaco}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{escalados.length} escalado{escalados.length === 1 ? '' : 's'}</span>
                  </div>
                </div>
                {aberto ? <ChevronUp className="h-3.5 w-3.5 text-app-subtle shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-app-subtle shrink-0" />}
              </button>

              {aberto && (
                <div className="px-4 pb-4 pt-3 border-t border-app-border/50 space-y-3">
                  {escalados.length === 0 ? (
                    <p className="text-xs text-app-subtle">Ninguém escalado para este evento.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {escalados.map(({ escala, pessoa }) => {
                        const situacao = situacaoCredenciamento(escala.funcao, pessoa.tipoContratacao, pessoa.documentos, ev.data)
                        return (
                          <div key={escala.id} className="flex items-center justify-between gap-3 rounded-lg border border-app-border2/50 bg-app-surface px-3 py-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-medium text-app-text truncate">{pessoa.nomeCompleto}</p>
                                {pessoa.status === 'vetado' ? (
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${VETADO_CLASS}`}>Vetado</span>
                                ) : (
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${SITUACAO_LABEL[situacao].className}`}>
                                    {situacao === 'pendente' ? 'Pendente na data do evento' : situacao === 'atencao' ? 'Vence perto do evento' : 'Apto'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-app-subtle">
                                <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{escala.funcao}</span>
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {descricaoContratacao(pessoa)}
                                </span>
                                {pessoa.cpf && <span>CPF {pessoa.cpf}</span>}
                              </div>
                            </div>
                            <button onClick={() => handleRemover(escala)} title="Remover da escala"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={pessoaParaAdicionar} onChange={e => setPessoaParaAdicionar(e.target.value)} className={`${INPUT_CLASS} flex-1 min-w-[220px] cursor-pointer`}>
                      <option value="">
                        {disponiveis.length === 0 ? 'Nenhuma ficha ativa disponível' : '— Escolha quem vai trabalhar neste evento —'}
                      </option>
                      {disponiveis.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nomeCompleto} — {p.funcao}{p.tipoContratacao === 'empresa' && p.empresaNome ? ` (${p.empresaNome})` : ''}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => handleAdicionar(ev.id)} disabled={!pessoaParaAdicionar || busy}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                      style={{ backgroundColor: GREEN }}>
                      <Plus className="h-4 w-4" />
                      Escalar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
