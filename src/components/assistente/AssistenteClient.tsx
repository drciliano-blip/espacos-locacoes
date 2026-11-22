'use client'

// Aba ASSISTENTE DE IA — copiloto da equipe (Plano 2027).
// Cada cliente/orçamento é um atendimento salvo (um chat): a lista mostra os
// últimos, qualquer operador ou administrador retoma de onde parou.
// Ver AtendimentoView.tsx para a conversa, o orçamento e as ações na Agenda.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bot, Plus, Search, Loader2, ArrowLeft } from 'lucide-react'
import { formatCurrency, mensagemDeErro } from '@/lib/utils'
import { useCurrentUser } from '@/contexts/UserContext'
import { nomeDoUsuarioAtual } from '@/lib/buffet'
import { tabelaPorSlug } from '@/lib/assistente/tabelas-espacos'
import { br, novoNumero } from '@/lib/assistente/orcamento'
import {
  STATUS_ATENDIMENTO, carregarAtendimento, criarAtendimento, excluirAtendimento, listarAtendimentos, novaMensagem, salvarAtendimento, tabelaAusente,
  type Atendimento, type AtendimentoResumo, type StatusAtendimento,
} from '@/lib/assistente/atendimentos'
import { mensagemInicial } from '@/lib/assistente/roteiro'
import AtendimentoView from './AtendimentoView'
import ConsultaChat from './ConsultaChat'

const inputCls = 'w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none'
const FILTROS: (StatusAtendimento | 'todos')[] = ['todos', 'aberto', 'enviado', 'fechado', 'perdido']

function quando(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  return d.toDateString() === hoje.toDateString()
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function AssistenteClient() {
  const { role } = useCurrentUser()
  // Vindo do botão do assistente: ?atendimento=<id>&montar=1 abre o atendimento e já pede o orçamento.
  const searchParams = useSearchParams()
  const idDoLink = searchParams.get('atendimento')
  const [montarAoAbrir, setMontarAoAbrir] = useState(searchParams.get('montar') === '1')
  // Atendimentos (chat por cliente) são de admin e operacional; o financeiro usa só as Consultas.
  const temAtendimentos = role === 'admin' || role === 'operacional'
  const [aba, setAba] = useState<'atendimentos' | 'consultas'>(temAtendimentos ? 'atendimentos' : 'consultas')
  const [lista, setLista] = useState<AtendimentoResumo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semTabela, setSemTabela] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [autor, setAutor] = useState<string | undefined>()
  const [aberto, setAberto] = useState<Atendimento | null>(null)
  const [abrindo, setAbrindo] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<StatusAtendimento | 'todos'>('todos')

  useEffect(() => {
    let vivo = true
    nomeDoUsuarioAtual().then(n => { if (vivo) setAutor(n) }).catch(() => {})
    if (idDoLink) carregarAtendimento(idDoLink).then(a => { if (vivo) setAberto(a) }).catch(e => { if (vivo) setErro(mensagemDeErro(e, 'Não foi possível abrir o atendimento.')) })
    if (!temAtendimentos) { queueMicrotask(() => { if (vivo) setCarregando(false) }); return () => { vivo = false } }
    listarAtendimentos()
      .then(l => { if (vivo) setLista(l) })
      .catch(e => { if (!vivo) return; if (tabelaAusente(e)) setSemTabela(true); else setErro(mensagemDeErro(e, 'Não foi possível carregar os atendimentos.')) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [temAtendimentos, idDoLink])

  async function abrir(id: string) {
    setAbrindo(id); setErro(null)
    try { setAberto(await carregarAtendimento(id)) }
    catch (e) { setErro(mensagemDeErro(e, 'Não foi possível abrir o atendimento.')) }
    finally { setAbrindo(null) }
  }

  async function novo() {
    setAbrindo('novo'); setErro(null)
    try {
      const criado = await criarAtendimento(novoNumero(), autor)
      // Todo atendimento começa com a mensagem padrão (as 5 perguntas), pronta para copiar.
      const mensagens = [
        novaMensagem('assistente', 'Oi! Me diga o que precisa ou cole aqui a mensagem do cliente. Posso montar o orçamento, consultar a agenda, pré-reservar a data e preparar as mensagens para o cliente.\n\nPara começar um atendimento novo, a mensagem padrão já está pronta abaixo.'),
        { ...novaMensagem('assistente', mensagemInicial(autor), autor), tipo: 'rascunho_cliente' as const, enviada: false },
      ]
      await salvarAtendimento(criado.id, { mensagens }, autor)
      const a = { ...criado, mensagens }
      setLista(l => [a, ...l])
      setAberto(a)
    } catch (e) {
      if (tabelaAusente(e)) setSemTabela(true)
      else setErro(mensagemDeErro(e, 'Não foi possível criar o atendimento.'))
    } finally {
      setAbrindo(null)
    }
  }

  const atualizado = useCallback((p: Partial<AtendimentoResumo> & { id: string }) => {
    setLista(l => [...l.map(a => (a.id === p.id ? { ...a, ...p } : a))].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  }, [])

  async function excluir(id: string) {
    try {
      await excluirAtendimento(id)
      setLista(l => l.filter(a => a.id !== id))
      setAberto(null)
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível excluir.'))
    }
  }

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lista.filter(a => (filtro === 'todos' || a.status === filtro) && (!q || a.titulo.toLowerCase().includes(q) || a.numero.toLowerCase().includes(q)))
  }, [lista, busca, filtro])

  return (
    <div className="space-y-4">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-app-text" />
          <div>
            <h1 className="text-xl font-semibold text-app-text">Assistente de IA</h1>
            <p className="text-xs text-app-muted">A IA prepara e consulta; a equipe revisa e confirma.</p>
          </div>
        </div>
        {aba === 'atendimentos' && !semTabela && (
          <button type="button" onClick={novo} disabled={abrindo === 'novo'} className="inline-flex items-center gap-1.5 rounded-lg bg-[#072A43] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {abrindo === 'novo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Novo atendimento
          </button>
        )}
      </div>

      <div className="print:hidden flex gap-1 border-b border-app-border">
        {temAtendimentos && (
          <button type="button" onClick={() => setAba('atendimentos')} className={`px-3 py-2 text-sm ${aba === 'atendimentos' ? 'border-b-2 border-[#072A43] font-semibold text-app-text' : 'text-app-muted'}`}>Atendimentos</button>
        )}
        <button type="button" onClick={() => setAba('consultas')} className={`px-3 py-2 text-sm ${aba === 'consultas' ? 'border-b-2 border-[#072A43] font-semibold text-app-text' : 'text-app-muted'}`}>Consultas</button>
      </div>

      {aba === 'consultas' && <ConsultaChat role={role} autor={autor} />}

      {aba === 'atendimentos' && semTabela && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          O histórico de atendimentos ainda não foi ativado no banco (migration 0052). Peça ao administrador para aplicá-la.
        </div>
      )}
      {aba === 'atendimentos' && erro && <div className="print:hidden rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{erro}</div>}

      <div className={`grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] ${aba === 'atendimentos' ? '' : 'hidden'}`}>
        <aside className={`print:hidden space-y-2 ${aberto ? 'hidden lg:block' : ''}`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-app-muted" />
            <input className={`${inputCls} pl-8`} placeholder="Buscar cliente ou nº" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map(f => (
              <button key={f} type="button" onClick={() => setFiltro(f)}
                className={`rounded-full border px-2.5 py-1 text-xs ${filtro === f ? 'border-[#072A43] bg-[#072A43] text-white' : 'border-app-border2 text-app-text'}`}>
                {f === 'todos' ? 'Todos' : STATUS_ATENDIMENTO[f].label}
              </button>
            ))}
          </div>
          {carregando && <p className="py-4 text-center text-sm text-app-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></p>}
          {!carregando && !semTabela && visiveis.length === 0 && <p className="py-4 text-center text-sm text-app-muted">Nenhum atendimento.</p>}
          <div className="space-y-1.5">
            {visiveis.map(a => {
              const esp = tabelaPorSlug(a.espacoSlug)
              const total = (a.totalLocacao ?? 0) + (a.totalServicos ?? 0)
              return (
                <button key={a.id} type="button" onClick={() => abrir(a.id)}
                  className={`w-full rounded-lg border p-2.5 text-left text-sm ${aberto?.id === a.id ? 'border-[#072A43] ring-2 ring-[#072A43]/20' : 'border-app-border2 bg-app-surface'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-app-text">{a.titulo}</span>
                    <span className="shrink-0 text-[11px] text-app-muted">{abrindo === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : quando(a.updatedAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-app-muted">
                    {[esp?.nome, a.dataEvento ? br(a.dataEvento) : null, total > 0 ? formatCurrency(total) : null].filter(Boolean).join(' · ') || a.numero}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_ATENDIMENTO[a.status].cls}`}>{STATUS_ATENDIMENTO[a.status].label}</span>
                    {a.updatedByNome && <span className="truncate text-[11px] text-app-muted">{a.updatedByNome}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="min-w-0">
          {aberto ? (
            <>
              <div className="print:hidden sticky -top-4 z-20 -mx-1 mb-1 bg-app-bg px-1 pb-2 pt-1 lg:hidden">
              <button type="button" onClick={() => setAberto(null)} className="inline-flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-3 py-2 text-sm font-medium text-app-text lg:hidden">
                <ArrowLeft className="h-4 w-4" /> Voltar para a lista de atendimentos
              </button>
              </div>
              <AtendimentoView
                key={aberto.id}
                atendimento={aberto}
                mensagemInicial={montarAoAbrir && aberto.id === idDoLink ? 'Monte o orçamento com esses dados. Se faltar algo do questionário, prepare a mensagem pedindo ao cliente.' : undefined}
                onMensagemInicialEnviada={() => setMontarAoAbrir(false)}
                autor={autor}
                podeExcluir={role === 'admin'}
                onAtualizado={atualizado}
                onExcluir={() => excluir(aberto.id)}
              />
            </>
          ) : (
            <div className="print:hidden hidden rounded-xl border border-dashed border-app-border2 p-10 text-center text-sm text-app-muted lg:block">
              Escolha um atendimento na lista ou comece um novo.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
