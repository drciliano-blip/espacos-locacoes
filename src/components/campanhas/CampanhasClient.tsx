'use client'

// Aba WHATSAPP CAMPANHAS — integração direta com a Cloud API da Meta.
// Caixa de entrada (admin e operacional), Campanhas e Contatos (admin).
// Leitura pelo Supabase com a sessão (RLS); toda escrita passa pelas rotas
// /api/whatsapp/cloud/*, que falam com a Meta.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Megaphone, Upload, Search, Send, Pause, Play, Plus, UserX, RefreshCw, Inbox, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/contexts/UserContext'
import { mensagemDeErro } from '@/lib/utils'
import { SEGMENTOS, primeiroNome } from '@/lib/whatsapp/segmentos'
import Toast from '@/components/shared/Toast'

type Aba = 'caixa' | 'campanhas' | 'contatos'

interface Contato {
  id: string; telefone: string; nome: string | null; segmento: string | null; opt_out: boolean
  opt_out_at: string | null; origem: string | null; ultima_entrada_at: string | null; ultima_saida_at: string | null
}
interface Campanha {
  id: string; nome: string; template_name: string; template_lang: string; segmento: string | null; status: string
  total: number; enviados: number; entregues: number; lidos: number; falhas: number; respostas: number
  created_by_nome: string | null; created_at: string; parametros: string[] | null; template_texto: string | null
}
interface Mensagem {
  id: string; direction: 'in' | 'out'; tipo: string; conteudo: { texto?: string; template?: string }
  status: string; erro: unknown; enviado_por_nome: string | null; created_at: string; campaign_id: string | null
}
interface Situacao { configurado: boolean; webhookPronto: boolean; limite: number; usada: number; modelos: { name: string; language: string; category: string; status: string; texto: string; variaveis: number; suportado: boolean }[]; erroModelos?: string }

const JANELA = 24 * 60 * 60 * 1000
const STATUS_CAMPANHA: Record<string, [string, string]> = {
  rascunho: ['Rascunho', 'border-zinc-400/40 text-app-muted'],
  enviando: ['Enviando', 'border-sky-500/40 bg-sky-500/10 text-sky-600'],
  pausada: ['Pausada', 'border-amber-500/40 bg-amber-500/10 text-amber-600'],
  concluida: ['Concluída', 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'],
}
const STATUS_MSG: Record<string, string> = {
  pendente: '…', accepted: '✓', sent: '✓', delivered: '✓✓', read: '✓✓ lida', failed: '⚠ falhou', received: '',
}

const fone = (n: string) => {
  const d = n.startsWith('55') ? n.slice(2) : n
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : `+${n}`
}
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, { method: init?.method ?? 'GET', headers: { 'Content-Type': 'application/json' }, body: init?.body ? JSON.stringify(init.body) : undefined })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Erro ${res.status}`)
  return json as T
}

async function todosContatos(): Promise<Contato[]> {
  const sb = createClient()
  const out: Contato[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from('wa_contacts').select('*').order('nome').range(de, de + 999)
    if (error) throw error
    out.push(...(data as Contato[]))
    if (!data || data.length < 1000) return out
  }
}

// CSV "telefone;nome" (ou com vírgula), com aspas e BOM.
function lerCsv(texto: string): { telefone: string; nome: string; segmento?: string }[] {
  const linhas = texto.replace(/^\ufeff/, '').split(/\r?\n/).filter(l => l.trim())
  if (linhas.length === 0) return []
  const sep = linhas[0].includes(';') ? ';' : ','
  const campos = (l: string) => {
    const out: string[] = []; let atual = ''; let aspas = false
    for (let i = 0; i < l.length; i++) {
      const ch = l[i]
      if (ch === '"') { if (aspas && l[i + 1] === '"') { atual += '"'; i++ } else aspas = !aspas }
      else if (ch === sep && !aspas) { out.push(atual); atual = '' }
      else atual += ch
    }
    out.push(atual)
    return out.map(c => c.trim())
  }
  const cab = campos(linhas[0]).map(c => c.toLowerCase())
  const temCab = cab.some(c => c.includes('telefone') || c.includes('nome'))
  const iTel = temCab ? Math.max(0, cab.findIndex(c => c.includes('telefone') || c.includes('phone'))) : 0
  const iNome = temCab ? cab.findIndex(c => c.includes('nome') || c.includes('name')) : 1
  const iSeg = temCab ? cab.findIndex(c => c.includes('segmento')) : -1
  return (temCab ? linhas.slice(1) : linhas).map(l => {
    const c = campos(l)
    return { telefone: c[iTel] ?? '', nome: iNome >= 0 ? c[iNome] ?? '' : '', segmento: iSeg >= 0 ? c[iSeg] : undefined }
  })
}

interface Carga { contatos: Contato[]; campanhas: Campanha[]; situacao: Situacao | null }
async function carregarTudo(): Promise<Carga | string> {
  try {
    const [contatos, { data, error }, situacao] = await Promise.all([
      todosContatos(),
      createClient().from('wa_campaigns').select('*').order('created_at', { ascending: false }),
      api<Situacao>('/api/whatsapp/cloud/status').catch(() => null),
    ])
    if (error) throw error
    return { contatos, campanhas: (data ?? []) as Campanha[], situacao }
  } catch (e) { return mensagemDeErro(e, 'Não foi possível carregar o WhatsApp.') }
}

async function buscarMsgs(id: string): Promise<Mensagem[]> {
  const { data } = await createClient().from('wa_messages').select('*').eq('contact_id', id).order('created_at').limit(500)
  return (data ?? []) as Mensagem[]
}

export default function CampanhasClient() {
  const { role } = useCurrentUser()
  const admin = role === 'admin'
  const [aba, setAba] = useState<Aba>('caixa')
  const [situacao, setSituacao] = useState<Situacao | null>(null)
  const [contatos, setContatos] = useState<Contato[]>([])
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [toast, setToast] = useState<{ m: string; t?: 'error' } | null>(null)
  const avisar = (m: string, t?: 'error') => { setToast({ m, t }); setTimeout(() => setToast(null), 4500) }

  const aplicar = useCallback((r: Carga | string) => {
    if (typeof r === 'string') { setErro(r); return }
    setContatos(r.contatos); setCampanhas(r.campanhas); setSituacao(r.situacao); setErro(null)
  }, [])
  const recarregar = useCallback(async () => { aplicar(await carregarTudo()) }, [aplicar])
  useEffect(() => {
    let vivo = true
    carregarTudo().then(r => { if (vivo) aplicar(r) })
    return () => { vivo = false }
  }, [aplicar])

  const abas: [Aba, string, React.ElementType][] = [['caixa', 'Caixa de entrada', Inbox], ...(admin ? [['campanhas', 'Campanhas', Megaphone], ['contatos', 'Contatos', Users]] as [Aba, string, React.ElementType][] : [])]

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366]/15"><Megaphone className="h-5 w-5 text-[#128C7E]" /></div>
          <div>
            <h1 className="text-lg font-semibold text-app-text leading-tight">WhatsApp Campanhas</h1>
            <p className="text-xs text-app-subtle">Direto pela Meta. Separado do WhatsApp do Assistente (Blip).</p>
          </div>
        </div>
        {situacao && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className={`rounded-full border px-2 py-0.5 ${situacao.configurado ? 'border-emerald-500/40 text-emerald-600' : 'border-red-500/40 text-red-600'}`}>
              {situacao.configurado ? 'Meta conectada' : 'Meta não configurada'}
            </span>
            {!situacao.webhookPronto && <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-600">Webhook sem chave secreta</span>}
            <span className="rounded-full border border-app-border2 px-2 py-0.5 text-app-muted">Cota 24 h: {situacao.usada}/{situacao.limite}</span>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-app-border">
        {abas.map(([k, l, I]) => (
          <button key={k} onClick={() => setAba(k)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${aba === k ? 'border-[#25D366] text-[#128C7E]' : 'border-transparent text-app-muted hover:text-app-text'}`}>
            <I className="h-4 w-4" />{l}
          </button>
        ))}
      </div>

      {erro && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{erro}</p>}

      {aba === 'caixa' && <CaixaEntrada contatos={contatos} recarregar={recarregar} avisar={avisar} />}
      {aba === 'campanhas' && admin && <Campanhas campanhas={campanhas} contatos={contatos} situacao={situacao} recarregar={recarregar} avisar={avisar} />}
      {aba === 'contatos' && admin && <Contatos contatos={contatos} recarregar={recarregar} avisar={avisar} />}
      <Toast message={toast?.m ?? null} type={toast?.t === 'error' ? 'error' : 'success'} />
    </div>
  )
}

type Avisar = (m: string, t?: 'error') => void
const card = 'rounded-xl border border-app-border2/60 bg-app-surface'
const btn = 'flex items-center gap-1 rounded-md border border-app-border2 px-2 py-1 text-[11px] font-medium text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-50'
const input = 'w-full rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none'

// --- Caixa de entrada ---------------------------------------------------------
function CaixaEntrada({ contatos, recarregar, avisar }: { contatos: Contato[]; recarregar: () => Promise<void>; avisar: Avisar }) {
  const [selId, setSelId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState('')
  const fim = useRef<HTMLDivElement>(null)
  const [agora, setAgora] = useState(() => Date.now())

  const conversas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const ult = (c: Contato) => Math.max(c.ultima_entrada_at ? Date.parse(c.ultima_entrada_at) : 0, c.ultima_saida_at ? Date.parse(c.ultima_saida_at) : 0)
    return contatos.filter(c => c.ultima_entrada_at && (!q || c.nome?.toLowerCase().includes(q) || c.telefone.includes(q.replace(/\D/g, '') || '§')))
      .sort((a, b) => ult(b) - ult(a))
  }, [contatos, busca])
  const sel = contatos.find(c => c.id === selId) ?? null
  const dentroJanela = !!sel?.ultima_entrada_at && agora - Date.parse(sel.ultima_entrada_at) < JANELA

  const carregarMsgs = useCallback(async (id: string) => { setMsgs(await buscarMsgs(id)) }, [])

  useEffect(() => {
    if (!selId) return
    let vivo = true
    buscarMsgs(selId).then(m => { if (vivo) setMsgs(m) })
    const t = setInterval(() => { buscarMsgs(selId).then(m => { if (vivo) setMsgs(m) }); recarregar(); setAgora(Date.now()) }, 15000)
    return () => { vivo = false; clearInterval(t) }
  }, [selId, recarregar])
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [msgs.length])

  async function responder() {
    if (!sel || !texto.trim()) return
    setEnviando(true)
    try {
      await api('/api/whatsapp/cloud/responder', { method: 'POST', body: { contactId: sel.id, texto } })
      setTexto(''); await carregarMsgs(sel.id)
    } catch (e) { avisar(mensagemDeErro(e, 'Falha ao enviar.'), 'error') } finally { setEnviando(false) }
  }

  return (
    <div className="grid gap-3 md:grid-cols-[280px_1fr]">
      <div className={`${card} p-2 space-y-2 ${sel ? 'hidden md:block' : ''}`}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar conversa" className={`${input} pl-8`} />
        </div>
        {conversas.length === 0 && <p className="p-4 text-center text-xs text-app-subtle">Nenhuma mensagem recebida ainda.</p>}
        <div className="max-h-[65vh] overflow-y-auto space-y-1">
          {conversas.map(c => {
            const aberta = agora - Date.parse(c.ultima_entrada_at!) < JANELA
            return (
              <button key={c.id} onClick={() => setSelId(c.id)}
                className={`w-full rounded-lg px-2 py-1.5 text-left ${selId === c.id ? 'bg-[#25D366]/15' : 'hover:bg-app-surface2'}`}>
                <p className="truncate text-sm font-medium text-app-text">{c.nome || fone(c.telefone)}</p>
                <p className="text-[11px] text-app-subtle">
                  {quando(c.ultima_entrada_at!)}{c.segmento ? ` · ${c.segmento}` : ''}{aberta ? ' · janela aberta' : ''}{c.opt_out ? ' · saiu' : ''}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <div className={`${card} flex min-h-[60vh] flex-col ${sel ? '' : 'hidden md:flex'}`}>
        {!sel ? <p className="m-auto text-sm text-app-subtle">Escolha uma conversa.</p> : (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-app-border px-3 py-2">
              <div className="min-w-0">
                <button className="md:hidden text-xs text-[#128C7E]" onClick={() => setSelId(null)}>← Conversas</button>
                <p className="truncate text-sm font-semibold text-app-text">{sel.nome || fone(sel.telefone)}</p>
                <p className="text-[11px] text-app-subtle">{fone(sel.telefone)}{sel.segmento ? ` · ${sel.segmento}` : ''}{sel.opt_out ? ' · pediu para sair das campanhas' : ''}</p>
              </div>
              <button className={btn} onClick={() => carregarMsgs(sel.id)}><RefreshCw className="h-3 w-3" /> Atualizar</button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3 max-h-[55vh]">
              {msgs.map(m => (
                <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${m.direction === 'out' ? 'bg-[#25D366]/15 text-app-text' : 'bg-app-surface2 text-app-text'}`}>
                    <p className="whitespace-pre-wrap break-words">{m.tipo === 'template' ? `📣 Modelo: ${m.conteudo.template}` : m.conteudo.texto || `[${m.tipo}]`}</p>
                    <p className="mt-0.5 text-right text-[10px] text-app-subtle">
                      {quando(m.created_at)}{m.enviado_por_nome ? ` · ${m.enviado_por_nome}` : ''} {m.direction === 'out' ? STATUS_MSG[m.status] ?? m.status : ''}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={fim} />
            </div>
            <div className="border-t border-app-border p-2">
              {dentroJanela ? (
                <div className="flex gap-2">
                  <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} placeholder="Responder pelo WhatsApp…"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); responder() } }}
                    className={`${input} resize-none text-base md:text-sm`} />
                  <button onClick={responder} disabled={enviando || !texto.trim()}
                    className="flex items-center gap-1 self-end rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1fb955] disabled:opacity-50">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-app-subtle">Passaram mais de 24 h desde a última mensagem do cliente. Pela regra da Meta, só dá para enviar modelo aprovado (por uma campanha).</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// --- Campanhas ----------------------------------------------------------------
function Campanhas({ campanhas, contatos, situacao, recarregar, avisar }: { campanhas: Campanha[]; contatos: Contato[]; situacao: Situacao | null; recarregar: () => Promise<void>; avisar: Avisar }) {
  const [nova, setNova] = useState(false)
  const [nome, setNome] = useState('')
  const [modelo, setModelo] = useState('')
  const [segmento, setSegmento] = useState('')
  const [rodando, setRodando] = useState<string | null>(null)
  const parar = useRef(false)

  const modeloSel = situacao?.modelos.find(m => `${m.name}|${m.language}` === modelo)
  const alcance = (seg: string | null) => contatos.filter(c => !c.opt_out && (!seg || c.segmento === seg)).length

  async function criar() {
    const [template_name, template_lang] = modelo.split('|')
    try {
      await api('/api/whatsapp/cloud/campanhas', { method: 'POST', body: { nome, template_name, template_lang, segmento: segmento || null } })
      setNova(false); setNome(''); setModelo(''); setSegmento('')
      await recarregar(); avisar('Campanha criada como rascunho.')
    } catch (e) { avisar(mensagemDeErro(e, 'Não foi possível criar.'), 'error') }
  }

  async function disparar(c: Campanha) {
    const n = alcance(c.segmento) - c.enviados - c.falhas
    if (!confirm(`Disparar "${c.nome}" (modelo ${c.template_name}) para até ${n} contato(s)${c.segmento ? ` do segmento ${c.segmento}` : ''}?\n\nCada mensagem de marketing entregue é cobrada pela Meta. O envio respeita a cota de ${situacao?.limite ?? 250} contatos por 24 h; o que passar continua sozinho no dia seguinte.`)) return
    setRodando(c.id); parar.current = false
    let total = 0
    try {
      for (let i = 0; i < 50 && !parar.current; i++) {
        const r = await api<{ enviadas: number; falhas: number; restantes: number; cotaRestante: number; status: string; aviso?: string }>(`/api/whatsapp/cloud/campanhas/${c.id}`, { method: 'POST', body: { acao: 'disparar' } })
        total += r.enviadas
        await recarregar()
        if (r.aviso) { avisar(r.aviso, 'error'); break }
        if (r.status !== 'enviando' || r.enviadas + r.falhas === 0) {
          if (r.status === 'enviando' && r.restantes > 0) avisar(`Cota de 24 h atingida: ${total} enviadas agora, ${r.restantes} ficam para o próximo dia.`)
          else avisar(`${total} mensagem(ns) enviada(s).`)
          break
        }
      }
    } catch (e) { avisar(mensagemDeErro(e, 'Falha no disparo.'), 'error') } finally { setRodando(null); recarregar() }
  }

  async function pausar(c: Campanha) {
    parar.current = true
    try { await api(`/api/whatsapp/cloud/campanhas/${c.id}`, { method: 'POST', body: { acao: 'pausar' } }); await recarregar(); avisar('Campanha pausada.') }
    catch (e) { avisar(mensagemDeErro(e, 'Não foi possível pausar.'), 'error') }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setNova(v => !v)} className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1fb955]">
          <Plus className="h-4 w-4" /> Nova campanha
        </button>
      </div>

      {nova && (
        <div className={`${card} grid gap-2 p-3 md:grid-cols-4`}>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da campanha" className={input} />
          <select value={modelo} onChange={e => setModelo(e.target.value)} className={input}>
            <option value="">Modelo aprovado…</option>
            {situacao?.modelos.map(m => (
              <option key={`${m.name}|${m.language}`} value={`${m.name}|${m.language}`} disabled={m.status !== 'APPROVED' || !m.suportado}>
                {m.name} ({m.language}, {m.category.toLowerCase()}){m.status !== 'APPROVED' ? ' · aguardando aprovação da Meta' : !m.suportado ? ' · formato não suportado' : ''}
              </option>
            ))}
          </select>
          <select value={segmento} onChange={e => setSegmento(e.target.value)} className={input}>
            <option value="">Todos os segmentos ({alcance(null)})</option>
            {SEGMENTOS.map(s => <option key={s} value={s}>{s} ({alcance(s)})</option>)}
          </select>
          <button onClick={criar} disabled={!nome.trim() || !modelo} className="rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Criar rascunho</button>
          {situacao?.erroModelos && <p className="md:col-span-4 text-xs text-red-600">{situacao.erroModelos}</p>}
          {modeloSel && <Previa texto={modeloSel.texto} variaveis={modeloSel.variaveis} contatos={contatos.filter(c => !c.opt_out && (!segmento || c.segmento === segmento))} />}
        </div>
      )}

      {campanhas.length === 0 && <p className="rounded-xl border border-dashed border-app-border2 p-8 text-center text-sm text-app-subtle">Nenhuma campanha ainda.</p>}
      {campanhas.map(c => {
        const [rot, cls] = STATUS_CAMPANHA[c.status] ?? [c.status, '']
        const pct = c.total ? Math.round(((c.enviados + c.falhas) / c.total) * 100) : 0
        return (
          <div key={c.id} className={`${card} p-3 space-y-2`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-app-text">{c.nome}<span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>{rot}</span></p>
                {c.template_texto && <p className="mt-0.5 line-clamp-2 text-xs text-app-subtle">{c.template_texto}</p>}
                <p className="text-xs text-app-muted">Modelo {c.template_name} ({c.template_lang}) · {c.segmento ?? 'todos os segmentos'} · criada {quando(c.created_at)}{c.created_by_nome ? ` por ${c.created_by_nome}` : ''}</p>
              </div>
              <div className="flex gap-1.5">
                {c.status !== 'concluida' && c.status !== 'enviando' && <button className={btn} disabled={!!rodando || !situacao?.configurado} onClick={() => disparar(c)}><Play className="h-3 w-3" /> {c.status === 'pausada' ? 'Retomar' : 'Disparar'}</button>}
                {c.status === 'enviando' && rodando !== c.id && <button className={btn} disabled={!!rodando} onClick={() => disparar(c)}><Play className="h-3 w-3" /> Continuar agora</button>}
                {c.status === 'enviando' && <button className={btn} onClick={() => pausar(c)}><Pause className="h-3 w-3" /> Pausar</button>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              {([['Público', c.total || alcance(c.segmento)], ['Enviados', c.enviados], ['Entregues', c.entregues], ['Lidos', c.lidos], ['Falhas', c.falhas], ['Responderam', c.respostas]] as [string, number][]).map(([l, v]) => (
                <div key={l} className="rounded-lg bg-app-surface2 px-2 py-1"><p className="text-[10px] text-app-subtle">{l}</p><p className="text-sm font-bold text-app-text">{v}</p></div>
              ))}
            </div>
            {c.total > 0 && <div className="h-1.5 rounded-full bg-app-surface2"><div className="h-1.5 rounded-full bg-[#25D366]" style={{ width: `${pct}%` }} /></div>}
            {rodando === c.id && <p className="text-xs text-sky-600">Enviando… pode deixar a tela aberta. Se fechar, o restante sai no agendador diário.</p>}
          </div>
        )
      })}
    </div>
  )
}

// Como a mensagem chega para alguns contatos do público ({{1}} = primeiro nome).
function Previa({ texto, variaveis, contatos }: { texto: string; variaveis: number; contatos: Contato[] }) {
  const amostra = contatos.slice(0, 4)
  const semNome = variaveis ? contatos.filter(c => primeiroNome(c.nome) === 'tudo bem').length : 0
  return (
    <div className="md:col-span-4 space-y-1 rounded-lg bg-app-surface2 p-2 text-xs text-app-muted">
      <p className="font-medium text-app-text">Prévia</p>
      {(variaveis ? amostra : amostra.slice(0, 1)).map(c => (
        <p key={c.id} className="whitespace-pre-wrap"><span className="text-app-subtle">{c.nome || c.telefone}: </span>{texto.replace(/\{\{\s*1\s*\}\}/g, primeiroNome(c.nome))}</p>
      ))}
      {variaveis > 0 && semNome > 0 && <p className="text-app-subtle">{semNome} contato(s) sem nome aproveitável recebem “tudo bem” no lugar do nome.</p>}
    </div>
  )
}

// --- Contatos -----------------------------------------------------------------
function Contatos({ contatos, recarregar, avisar }: { contatos: Contato[]; recarregar: () => Promise<void>; avisar: Avisar }) {
  const [busca, setBusca] = useState('')
  const [seg, setSeg] = useState<string>('todos')
  const [soSairam, setSoSairam] = useState(false)
  const [importando, setImportando] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)

  const contagem = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of contatos) m.set(c.segmento ?? 'Sem segmento', (m.get(c.segmento ?? 'Sem segmento') ?? 0) + 1)
    return m
  }, [contatos])
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase(), qd = busca.replace(/\D/g, '')
    return contatos.filter(c =>
      (seg === 'todos' || (c.segmento ?? 'Sem segmento') === seg) && (!soSairam || c.opt_out) &&
      (!q || c.nome?.toLowerCase().includes(q) || (qd && c.telefone.includes(qd))))
  }, [contatos, busca, seg, soSairam])

  async function importar(f: File) {
    setImportando(true)
    try {
      const linhas = lerCsv(await f.text())
      if (linhas.length === 0) throw new Error('Arquivo vazio.')
      const r = await api<{ lidos: number; novos: number; existentes: number; invalidos: number }>('/api/whatsapp/cloud/contatos', { method: 'POST', body: { contatos: linhas, origem: `csv:${f.name}` } })
      await recarregar()
      avisar(`${r.novos} novo(s), ${r.existentes} já existia(m), ${r.invalidos} telefone(s) inválido(s).`)
    } catch (e) { avisar(mensagemDeErro(e, 'Falha na importação.'), 'error') } finally { setImportando(false); if (arquivo.current) arquivo.current.value = '' }
  }

  async function marcarSaida(c: Contato) {
    if (!confirm(`Marcar ${c.nome || fone(c.telefone)} como fora das campanhas? Ele não recebe mais disparos.`)) return
    try { await api('/api/whatsapp/cloud/contatos', { method: 'PATCH', body: { id: c.id } }); await recarregar() }
    catch (e) { avisar(mensagemDeErro(e, 'Não foi possível marcar.'), 'error') }
  }

  const sairam = contatos.filter(c => c.opt_out).length
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome ou telefone" className={`${input} pl-8`} />
        </div>
        <select value={seg} onChange={e => setSeg(e.target.value)} className={`${input} w-auto`}>
          <option value="todos">Todos ({contatos.length})</option>
          {[...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-app-muted"><input type="checkbox" checked={soSairam} onChange={e => setSoSairam(e.target.checked)} /> Só quem saiu ({sairam})</label>
        <input ref={arquivo} type="file" accept=".csv,text/csv" className="hidden" onChange={e => e.target.files?.[0] && importar(e.target.files[0])} />
        <button onClick={() => arquivo.current?.click()} disabled={importando} className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1fb955] disabled:opacity-50">
          <Upload className="h-4 w-4" /> {importando ? 'Importando…' : 'Importar CSV'}
        </button>
      </div>
      <p className="text-[11px] text-app-subtle">CSV com colunas telefone;nome (opcional: segmento). Se não houver segmento, ele sai do nome (“… Cliente Fabrique”). Contatos já cadastrados não são alterados.</p>

      <div className={`${card} divide-y divide-app-border`}>
        {lista.length === 0 && <p className="p-6 text-center text-sm text-app-subtle">Nenhum contato.</p>}
        {lista.slice(0, 300).map(c => (
          <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-sm text-app-text">{c.nome || '—'}</p>
              <p className="text-[11px] text-app-subtle">{fone(c.telefone)} · {c.segmento ?? 'sem segmento'}{c.opt_out ? ` · saiu ${c.opt_out_at ? quando(c.opt_out_at) : ''}` : ''}</p>
            </div>
            {!c.opt_out && <button className={btn} onClick={() => marcarSaida(c)}><UserX className="h-3 w-3" /> Saiu</button>}
          </div>
        ))}
        {lista.length > 300 && <p className="p-2 text-center text-[11px] text-app-subtle">Mostrando 300 de {lista.length}. Use a busca ou o filtro.</p>}
      </div>
    </div>
  )
}
