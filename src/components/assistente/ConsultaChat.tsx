'use client'

// Aba CONSULTAS do Assistente de IA: a pessoa pergunta em linguagem natural e
// a IA busca no sistema com as permissões dela (agenda, recebimentos em
// atraso, lançamentos duplicados, conferência do mês). Ações que mudam dados
// voltam como cartão e só acontecem com o clique em Confirmar.

import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, CalendarClock, CheckCircle2, RotateCcw } from 'lucide-react'
import type Anthropic from '@anthropic-ai/sdk'
import { formatCurrency, mensagemDeErro } from '@/lib/utils'
import { useEventos } from '@/contexts/EventosContext'
import { br } from '@/lib/assistente/orcamento'
import type { AcaoProposta } from '@/lib/assistente/ferramentas'
import type { Espaco, Evento, NivelAcesso } from '@/types'
import CartaoAcaoSistema from './CartaoAcaoSistema'
import BotaoVoz from './BotaoVoz'
import BotaoAnexo, { textoDaFicha } from './BotaoAnexo'

interface Bolha {
  id: string
  autor: 'pessoa' | 'ia'
  texto: string
  acoes?: (AcaoProposta & { feita?: boolean })[]
}

const SUGESTOES: Record<string, string[]> = {
  admin: [
    'O que tem na agenda nos próximos 7 dias?',
    'Quais clientes estão com pagamento atrasado?',
    'Tem lançamento duplicado no mês passado?',
    'Confere o mês passado do Espaço Solon para o fechamento.',
    'Como faço o fechamento do mês?',
  ],
  financeiro: [
    'Quais clientes estão com pagamento atrasado?',
    'Tem lançamento duplicado no mês passado?',
    'Confere o mês passado de todos os espaços.',
    'Quanto entra de parcelas nos próximos 15 dias?',
    'Como dou baixa numa conta paga?',
  ],
  operacional: [
    'O que tem na agenda nos próximos 7 dias?',
    'O Fabrique está livre nos sábados de dezembro?',
    'Quais pré-eventos estão em aberto?',
    'Como gero o contrato de um evento?',
  ],
}

const CHAVE = 'assistente-consulta-v1'

export default function ConsultaChat({ role, autor, tela, compacto }: { role: NivelAcesso; autor?: string; tela?: string; compacto?: boolean }) {
  const { addEvento } = useEventos()
  const [bolhas, setBolhas] = useState<Bolha[]>([])
  const [historico, setHistorico] = useState<Anthropic.Beta.BetaMessageParam[]>([])
  const [pergunta, setPergunta] = useState('')
  const [pensando, setPensando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fim = useRef<HTMLDivElement>(null)

  // Mantém a conversa desta aba do navegador (some ao fechar a aba).
  useEffect(() => {
    try {
      const salvo = sessionStorage.getItem(CHAVE)
      if (!salvo) return
      const { b, h } = JSON.parse(salvo) as { b: Bolha[]; h: Anthropic.Beta.BetaMessageParam[] }
      queueMicrotask(() => { setBolhas(b); setHistorico(h) })
    } catch { /* sem armazenamento: começa vazio */ }
  }, [])
  useEffect(() => {
    try { sessionStorage.setItem(CHAVE, JSON.stringify({ b: bolhas, h: historico })) } catch { /* ignora */ }
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [bolhas, historico])

  // paraIA: texto completo para o assistente (ex.: dados da ficha anexada); o chat mostra só `texto`.
  async function perguntar(texto = pergunta, paraIA?: string) {
    const q = texto.trim()
    if (!q || pensando) return
    setErro(null); setPergunta(''); setPensando(true)
    const idBolha = crypto.randomUUID()
    setBolhas(b => [...b, { id: idBolha, autor: 'pessoa', texto: q }])
    try {
      const res = await fetch('/api/assistente/consulta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pergunta: paraIA ?? q, historico, tela }) })
      const json = await res.json().catch(() => ({ error: 'Resposta inválida do servidor.' }))
      if (!res.ok) throw new Error(json.error ?? 'Erro ao consultar.')
      setHistorico(json.historico ?? [])
      setBolhas(b => [...b, { id: crypto.randomUUID(), autor: 'ia', texto: json.resposta, acoes: json.acoes?.length ? json.acoes : undefined }])
    } catch (e) {
      // Não chegou ao assistente: tira a mensagem da conversa e devolve para a caixa,
      // para não parecer que foi respondida (senão a próxima pergunta vai sem ela).
      setBolhas(b => b.filter(x => x.id !== idBolha))
      if (!paraIA) setPergunta(q)
      setErro(e instanceof TypeError
        ? 'A mensagem não chegou ao assistente (a resposta demorou ou a internet oscilou). Ela voltou para a caixa: toque em enviar de novo.'
        : `${mensagemDeErro(e, 'Não foi possível consultar.')} A mensagem voltou para a caixa.`)
    } finally {
      setPensando(false)
    }
  }

  // Diagnóstico: mostra no chat o que funciona e o que falha na ligação com a IA.
  const [testando, setTestando] = useState(false)
  async function testar() {
    setTestando(true)
    try {
      const res = await fetch('/api/assistente/diagnostico', { cache: 'no-store' })
      const j = await res.json().catch(() => ({ error: `O servidor respondeu ${res.status} sem dados.` }))
      const texto = j.passos
        ? 'Teste da IA:\n' + (j.passos as { passo: string; ok: boolean; detalhe: string }[]).map(p => `${p.ok ? '✅' : '❌'} ${p.passo}: ${p.detalhe}`).join('\n')
        : `Teste da IA falhou: ${j.error ?? res.status}`
      setBolhas(b => [...b, { id: crypto.randomUUID(), autor: 'ia', texto }])
      setErro(null)
    } catch (e) {
      setBolhas(b => [...b, { id: crypto.randomUUID(), autor: 'ia', texto: `Teste da IA: a conexão com o servidor falhou (${e instanceof Error ? e.message : 'erro'}).` }])
    } finally {
      setTestando(false)
    }
  }

  function marcarFeita(bolhaId: string, i: number) {
    setBolhas(bs => bs.map(b => (b.id === bolhaId ? { ...b, acoes: b.acoes?.map((x, j) => (j === i ? { ...x, feita: true } : x)) } : b)))
  }

  async function executar(bolhaId: string, i: number, a: AcaoProposta) {
    if (a.tipo !== 'pre_evento') return
    try {
      const evento: Evento = {
        id: crypto.randomUUID(), cliente: a.cliente, nomeEvento: a.nomeEvento, telefoneContato: a.telefone,
        espaco: a.espaco as Espaco, data: a.data, horaInicio: '00:00', horaFim: '00:00', tipo: 'Evento',
        status: 'em_negociacao', valor: a.valor ?? 0, numeroPessoas: a.pessoas,
        observacoes: [`Pré-reserva pelo Assistente de IA${autor ? ` (${autor})` : ''}`, a.observacoes].filter(Boolean).join('\n'),
      }
      await addEvento(evento)
      marcarFeita(bolhaId, i)
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível criar o pré-evento.'))
    }
  }

  function limpar() {
    setBolhas([]); setHistorico([]); setErro(null)
    try { sessionStorage.removeItem(CHAVE) } catch { /* ignora */ }
  }

  return (
    <div className={`flex flex-col bg-app-surface ${compacto ? 'h-full' : 'min-h-[60vh] rounded-xl border border-app-border'}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-app-border px-4 py-2.5">
        <p className="min-w-0 basis-full text-xs text-app-muted sm:basis-0 sm:flex-1 sm:text-sm">Tire dúvidas, consulte agenda e financeiro ou peça tarefas. A IA usa o seu nível de acesso e não altera nada sozinha.</p>
        <button type="button" onClick={testar} disabled={testando} className="shrink-0 text-xs text-app-muted underline disabled:opacity-50">{testando ? 'Testando…' : 'Testar a IA'}</button>
        {bolhas.length > 0 && <button type="button" onClick={limpar} className="inline-flex shrink-0 items-center gap-1 text-xs text-app-muted"><RotateCcw className="h-3.5 w-3.5" /> Nova conversa</button>}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {bolhas.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-app-muted">Exemplos:</p>
            <div className="flex flex-wrap gap-2">
              {(SUGESTOES[role] ?? SUGESTOES.operacional).map(s => (
                <button key={s} type="button" onClick={() => perguntar(s)} className="rounded-full border border-app-border2 px-3 py-1.5 text-left text-sm text-app-text">{s}</button>
              ))}
            </div>
          </div>
        )}
        {bolhas.map(b => (
          <div key={b.id} className={`flex ${b.autor === 'pessoa' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${b.autor === 'pessoa' ? 'bg-[#072A43] text-white' : 'bg-app-surface2 text-app-text'}`}>
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{b.texto}</p>
              {b.acoes?.map((a, i) => a.tipo !== 'pre_evento' ? (
                <CartaoAcaoSistema key={i} acao={a} feita={a.feita} onFeita={() => marcarFeita(b.id, i)} />
              ) : (
                <div key={i} className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-app-text">
                  <p className="flex items-center gap-1.5 text-xs font-semibold"><CalendarClock className="h-4 w-4 text-amber-600" /> Criar pré-evento na Agenda</p>
                  <p className="mt-1 text-sm">{a.cliente} · {a.espaco} · {br(a.data)}{a.pessoas ? ` · ${a.pessoas} pessoas` : ''}{a.valor ? ` · ${formatCurrency(a.valor)}` : ''}</p>
                  {a.feita
                    ? <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Pré-evento criado.</p>
                    : <button type="button" onClick={() => executar(b.id, i, a)} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[#072A43] px-3 py-1.5 text-xs font-semibold text-white">Confirmar</button>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {pensando && <p className="inline-flex items-center gap-2 text-sm text-app-muted"><Loader2 className="h-4 w-4 animate-spin" /> Consultando o sistema...</p>}
        {erro && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            <p>{erro}</p>
            <button type="button" onClick={testar} disabled={testando} className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 disabled:opacity-50">
              {testando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Testar a IA
            </button>
          </div>
        )}
        <div ref={fim} />
      </div>

      <form className="flex gap-2 border-t border-app-border p-3" onSubmit={e => { e.preventDefault(); perguntar() }}>
        <input className="min-w-0 flex-1 rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm text-app-text focus:outline-none" placeholder="Escreva ou toque no microfone e fale" value={pergunta} onChange={e => setPergunta(e.target.value)} />
        <BotaoAnexo disabled={pensando} pergunta={pergunta.trim()} onErro={setErro} onLido={f => perguntar(`📎 ${f.arquivo}${pergunta.trim() ? ` — ${pergunta.trim()}` : ''}`, textoDaFicha(f, pergunta.trim()))} />
        <BotaoVoz disabled={pensando} onParcial={setPergunta} onFinal={t => perguntar(t)} onErro={setErro} />
        <button type="submit" disabled={pensando || !pergunta.trim()} aria-label="Enviar" className="inline-flex items-center rounded-lg bg-[#072A43] px-3 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  )
}
