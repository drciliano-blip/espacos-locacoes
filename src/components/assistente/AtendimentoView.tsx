'use client'

// Um atendimento do Assistente de IA (um chat por cliente/orçamento).
// A conversa (cliente, IA, equipe) e o orçamento ficam salvos no banco
// (assistente_atendimentos). A IA lê a conversa inteira; o sistema confere a
// agenda e calcula a locação pela tabela do espaço; os orçamentos de Locação e
// de Serviços saem separados. Ações na Agenda (pré-reserva, confirmar evento)
// só acontecem com o clique de quem está atendendo e usam as permissões dele.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Loader2, FileDown, Copy, Plus, Trash2, CalendarCheck, CalendarX, AlertTriangle, CalendarClock, CheckCircle2, Send, MessageSquareText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, mensagemDeErro } from '@/lib/utils'
import { carregarTabelas, opcoesDaTabela, sugerirFaixa, type BuffetTabela } from '@/lib/buffet'
import { PAGAMENTO_FASTIX, TABELAS_ESPACOS, tabelaPorSlug } from '@/lib/assistente/tabelas-espacos'
import {
  DADOS_VAZIOS, br, diaDaSemana, linhasLocacao, parcelas, soma,
  type DadosEvento, type LinhaOrcamento, type TipoDia,
} from '@/lib/assistente/orcamento'
import {
  STATUS_ATENDIMENTO, carregarAtendimento, juntarMensagens, novaMensagem, salvarAtendimento,
  type Atendimento, type AtendimentoResumo, type EstadoAtendimento, type Mensagem, type StatusAtendimento,
} from '@/lib/assistente/atendimentos'
import { useEventos } from '@/contexts/EventosContext'
import { useEspacos } from '@/contexts/EspacosContext'
import NovoEventoModal from '@/components/eventos/NovoEventoModal'
import type { Espaco, Evento } from '@/types'
import { questionario } from '@/lib/assistente/roteiro'
import PropostaAssistente from './PropostaAssistente'
import { pedirAoVivo, type AoVivo } from '@/lib/assistente/pedir-ao-vivo'
import CartaoAcaoSistema, { type AcaoSistema } from './CartaoAcaoSistema'
import BotaoVoz from './BotaoVoz'
import BotaoAnexo, { textoDaFicha } from './BotaoAnexo'
import Toast from '@/components/shared/Toast'

const inputCls = 'w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none'
const cardCls = 'rounded-xl border border-app-border bg-app-surface p-4'
const btnPrim = 'inline-flex items-center gap-1.5 rounded-lg bg-[#072A43] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'
const btnSec = 'inline-flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-2 text-sm text-app-text disabled:opacity-50'

const PAGAMENTO_SERVICOS = [
  { descricao: 'Na contratação', pct: 50 },
  { descricao: 'Até 8 dias antes do evento', pct: 50, diasAntes: 8 },
]

interface Ocupacao { cliente: string; status: string }


function Campo({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-xs text-app-muted ${className ?? ''}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  )
}

const editarLinha = (lista: LinhaOrcamento[], setLista: (l: LinhaOrcamento[]) => void, i: number, patch: Partial<LinhaOrcamento>) =>
  setLista(lista.map((l, j) => (j === i ? { ...l, ...patch } : l)))

function EditorLinhas({ lista, setLista, rotulo }: { lista: LinhaOrcamento[]; setLista: (l: LinhaOrcamento[]) => void; rotulo: string }) {
  return (
    <div className="space-y-2">
      {lista.map((l, i) => (
        <div key={i} className="grid grid-cols-12 gap-2">
          <input className={`${inputCls} col-span-12 sm:col-span-5`} placeholder="Serviço" value={l.descricao} onChange={e => editarLinha(lista, setLista, i, { descricao: e.target.value })} />
          <input className={`${inputCls} col-span-6 sm:col-span-3`} placeholder="Prestado por" value={l.prestador ?? ''} onChange={e => editarLinha(lista, setLista, i, { prestador: e.target.value })} />
          <input className={`${inputCls} col-span-4 sm:col-span-3`} type="number" min={0} placeholder="Valor" value={l.valor || ''} onChange={e => editarLinha(lista, setLista, i, { valor: Number(e.target.value) || 0 })} />
          <button type="button" aria-label="Remover" className="col-span-2 sm:col-span-1 text-app-muted" onClick={() => setLista(lista.filter((_, j) => j !== i))}><Trash2 className="mx-auto h-4 w-4" /></button>
          <input className={`${inputCls} col-span-12`} placeholder="Detalhe (opcional)" value={l.detalhe ?? ''} onChange={e => editarLinha(lista, setLista, i, { detalhe: e.target.value })} />
        </div>
      ))}
      <button type="button" className={btnSec} onClick={() => setLista([...lista, { descricao: '', prestador: '[Parceiro credenciado]', valor: 0 }])}>
        <Plus className="h-4 w-4" /> {rotulo}
      </button>
    </div>
  )
}

interface Props {
  atendimento: Atendimento
  autor?: string
  podeExcluir: boolean
  onAtualizado: (patch: Partial<AtendimentoResumo> & { id: string }) => void
  onExcluir: () => void
  mensagemInicial?: string // enviada sozinha ao abrir (vindo do botão do assistente)
  onMensagemInicialEnviada?: () => void
}

export default function AtendimentoView({ atendimento, autor, podeExcluir, onAtualizado, onExcluir, mensagemInicial, onMensagemInicialEnviada }: Props) {
  const ini = atendimento.estado
  const numero = atendimento.numero
  const { eventos, addEvento, confirmarPreEvento } = useEventos()
  const { espacosConfig } = useEspacos()

  const [pensando, setPensando] = useState(false)
  const [vivo, setVivo] = useState<AoVivo>({ texto: '', etapa: '' })
  // Como desfazer o que foi gravado direto de um cartão (vale enquanto a tela está aberta).
  const [desfazeres, setDesfazeres] = useState<Record<string, () => Promise<void>>>({})
  const [verOrcamento, setVerOrcamento] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [, setSalvoEm] = useState<string | null>(null)

  const [mensagens, setMensagens] = useState<Mensagem[]>(atendimento.mensagens)
  const [status, setStatus] = useState<StatusAtendimento>(atendimento.status)
  const [novoTexto, setNovoTexto] = useState('')
  const [iaHist, setIaHist] = useState<unknown[]>(ini.ia ?? [])
  const [iaAte, setIaAte] = useState<string | undefined>(ini.iaAte)
  const fimChat = useRef<HTMLDivElement>(null)

  const [versao, setVersao] = useState(ini.versao ?? 1)
  const [dados, setDados] = useState<DadosEvento>({ ...DADOS_VAZIOS, ...(ini.dados ?? {}) })
  const [pedidos] = useState<string[]>(ini.pedidos ?? [])
  const [falta] = useState<string[]>(ini.falta ?? [])
  const [slug, setSlug] = useState<string>(ini.slug ?? '')
  const [ocupacao, setOcupacao] = useState<{ data: string; porSlug: Record<string, Ocupacao[]>; falhou: boolean } | null>(null)

  const [montagem, setMontagem] = useState(ini.montagem ?? false)
  // Parceria: FASTIX obrigatória (contrato). Locação: FASTIX opcional.
  const [contratacao, setContratacao] = useState<'locacao' | 'parceria'>(ini.contratacao ?? 'locacao')
  const [fastixOpcional, setFastixOpcional] = useState(ini.fastixOpcional ?? false)
  const [staffComplementar, setStaffComplementar] = useState(ini.staffComplementar ?? 0)
  const [valorManual, setValorManual] = useState<number | null>(ini.valorManual ?? null)

  const [tabelasBuffet, setTabelasBuffet] = useState<BuffetTabela[]>([])
  const [buffetId, setBuffetId] = useState(ini.buffetId ?? '')
  const [buffetOpcao, setBuffetOpcao] = useState(ini.buffetOpcao ?? '')
  const [buffetValor, setBuffetValor] = useState<number | null>(ini.buffetValor ?? null)
  const [extras, setExtras] = useState<LinhaOrcamento[]>(ini.extras ?? [])
  const [opcionais, setOpcionais] = useState<LinhaOrcamento[]>(ini.opcionais ?? [])
  const [condicoesServicos, setCondicoesServicos] = useState(ini.condicoesServicos ?? '')
  const [upsell] = useState<{ servico: string; motivo: string }[]>(ini.upsell ?? [])
  const [alertas] = useState<string[]>(ini.alertas ?? [])
  const [preEventoId, setPreEventoId] = useState<string | undefined>(ini.preEventoId)
  const [whatsapp] = useState<string | undefined>(ini.whatsapp)
  const [waConfigurado, setWaConfigurado] = useState(false)
  const [enviandoWa, setEnviandoWa] = useState<string | null>(null)

  const [imprimindo, setImprimindo] = useState<'locacao' | 'servicos' | null>(null)
  const [confirmando, setConfirmando] = useState<Evento | null>(null)
  const [agendando, setAgendando] = useState(false)

  const avisar = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500) }
  const set = <K extends keyof DadosEvento>(k: K, v: DadosEvento[K]) => setDados(d => ({ ...d, [k]: v }))

  useEffect(() => {
    let vivo = true
    carregarTabelas().then(t => { if (vivo) setTabelasBuffet(t.filter(x => x.ativo)) }).catch(() => {})
    return () => { vivo = false }
  }, [])

  // Agenda do dia: eventos não cancelados de cada espaço na data pedida.
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) return
    let vivo = true
    const sb = createClient()
    Promise.all([
      sb.from('espacos').select('id, slug'),
      sb.from('eventos').select('id, espaco_id, cliente, status').eq('data', dados.data).neq('status', 'cancelado'),
    ]).then(([esp, ev]) => {
      if (!vivo) return
      // Sem a agenda não dá para dizer que está livre: mostra "conferir".
      if (esp.error || ev.error) { setOcupacao({ data: dados.data, porSlug: {}, falhou: true }); return }
      const slugDe = new Map((esp.data ?? []).map(e => [e.id as string, e.slug as string]))
      const porSlug: Record<string, Ocupacao[]> = {}
      for (const e of ev.data ?? []) {
        if (e.id === preEventoId) continue // a própria pré-reserva não conta como ocupação
        const s = slugDe.get(e.espaco_id as string)
        if (s) (porSlug[s] ??= []).push({ cliente: e.cliente as string, status: e.status as string })
      }
      setOcupacao({ data: dados.data, porSlug, falhou: false })
    })
    return () => { vivo = false }
  }, [dados.data, preEventoId])

  const agendaDoDia = ocupacao && ocupacao.data === dados.data && !ocupacao.falhou ? ocupacao.porSlug : null
  const agendaFalhou = !!ocupacao && ocupacao.data === dados.data && ocupacao.falhou
  const espaco = tabelaPorSlug(slug)
  const nomeNoSistema = espacosConfig.find(c => c.slug === slug)?.nome
  const preEvento = preEventoId ? eventos.find(e => e.id === preEventoId) : undefined

  const opcoesEspacos = useMemo(() => TABELAS_ESPACOS.map(t => {
    const ocup = agendaDoDia?.[t.slug] ?? []
    const total = soma(linhasLocacao(t, dados, { montagem: false, staffComplementar: 0, valorManual: null }))
    return {
      t, ocup, total,
      cabe: !dados.convidados || dados.convidados <= t.capacidade,
      livre: t.semAgendaNoSistema ? null : agendaDoDia ? ocup.length === 0 : null,
    }
  }), [agendaDoDia, dados])

  const linhasLoc = useMemo(
    () => (espaco ? linhasLocacao(espaco, dados, { montagem, staffComplementar, valorManual }) : []),
    [espaco, dados, montagem, staffComplementar, valorManual],
  )
  const totalLoc = soma(linhasLoc)
  const fastix: 'parceria' | 'opcional' | null = contratacao === 'parceria' ? 'parceria' : fastixOpcional ? 'opcional' : null
  const regraLoc = espaco ? (fastix ? PAGAMENTO_FASTIX : espaco.pagamento) : []

  const tabelaBuffet = tabelasBuffet.find(t => t.id === buffetId)
  const faixa = sugerirFaixa(tabelaBuffet, buffetOpcao, dados.convidados ?? undefined)
  const linhaBuffet: LinhaOrcamento | null = tabelaBuffet ? {
    descricao: [tabelaBuffet.nome, buffetOpcao].filter(Boolean).join(' · '),
    detalhe: [faixa ? `até ${faixa.ateConvidados.toLocaleString('pt-BR')} convidados` : dados.convidados ? `${dados.convidados} convidados` : '', tabelaBuffet.inclusos].filter(Boolean).join(' · '),
    prestador: 'E&L',
    valor: buffetValor ?? faixa?.valor ?? 0,
  } : null
  const linhasServ = [...(linhaBuffet ? [linhaBuffet] : []), ...extras.filter(e => e.descricao.trim())]
  const totalServ = soma(linhasServ)
  const titulo = (dados.empresa || dados.cliente || 'Novo atendimento').trim()

  // ---------- salvamento automático do orçamento (1 s depois da última mudança)
  const estado: EstadoAtendimento = {
    versao, dados, pedidos, falta, slug, montagem, contratacao, fastixOpcional, staffComplementar, valorManual,
    buffetId, buffetOpcao, buffetValor, extras, opcionais, condicoesServicos, upsell, alertas, preEventoId, whatsapp,
    ia: iaHist, iaAte,
  }
  const estadoJson = JSON.stringify(estado)
  const ultimoSalvo = useRef(JSON.stringify({ ...estado }))
  useEffect(() => {
    if (estadoJson === ultimoSalvo.current) return
    const t = setTimeout(() => {
      const e = JSON.parse(estadoJson) as EstadoAtendimento
      salvarAtendimento(atendimento.id, {
        estado: e, titulo, espacoSlug: e.slug || null, dataEvento: e.dados.data || null,
        totalLocacao: e.slug ? totalLoc : null, totalServicos: totalServ || null,
      }, autor).then(em => {
        ultimoSalvo.current = estadoJson
        setSalvoEm(em)
        onAtualizado({ id: atendimento.id, titulo, espacoSlug: e.slug || undefined, dataEvento: e.dados.data || undefined, totalLocacao: totalLoc, totalServicos: totalServ, updatedAt: em, updatedByNome: autor })
      }).catch(err => setErro(mensagemDeErro(err, 'Não foi possível salvar o atendimento.')))
    }, 1000)
    return () => clearTimeout(t)
  }, [estadoJson, atendimento.id, titulo, totalLoc, totalServ, autor, onAtualizado])

  // Mensagens e status gravam na hora (não esperam o salvamento automático).
  async function gravarMensagens(novas: Mensagem[], novoStatus?: StatusAtendimento) {
    setMensagens(novas)
    if (novoStatus) setStatus(novoStatus)
    try {
      const em = await salvarAtendimento(atendimento.id, { mensagens: novas, titulo, ...(novoStatus ? { status: novoStatus } : {}) }, autor)
      setSalvoEm(em)
      onAtualizado({ id: atendimento.id, titulo, updatedAt: em, updatedByNome: autor, ...(novoStatus ? { status: novoStatus } : {}) })
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível salvar a conversa.'))
    }
  }

  async function mudarStatus(s: StatusAtendimento) {
    setStatus(s)
    try {
      const em = await salvarAtendimento(atendimento.id, { status: s }, autor)
      setSalvoEm(em)
      onAtualizado({ id: atendimento.id, status: s, updatedAt: em, updatedByNome: autor })
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível mudar a situação.'))
    }
  }

  function editarMensagem(id: string, texto: string) {
    setMensagens(ms => ms.map(m => (m.id === id ? { ...m, texto } : m)))
  }

  // WhatsApp: o sistema tem a chave do Blip? E mensagens novas que chegaram
  // pelo WhatsApp enquanto a tela está aberta (confere a cada 15 s).
  useEffect(() => {
    let vivo = true
    fetch('/api/whatsapp/enviar').then(r => r.json()).then(j => { if (vivo) setWaConfigurado(!!j.configurado) }).catch(() => {})
    return () => { vivo = false }
  }, [])
  const idsConhecidos = useRef(new Set(atendimento.mensagens.map(m => m.id)))
  useEffect(() => { for (const m of mensagens) idsConhecidos.current.add(m.id) }, [mensagens])
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return
      carregarAtendimento(atendimento.id).then(a => {
        const novas = a.mensagens.filter(m => !idsConhecidos.current.has(m.id))
        if (novas.length === 0) return
        setMensagens(ms => juntarMensagens(ms, novas))
        if (novas.some(m => m.autor === 'cliente')) {
          setToast('Nova mensagem do cliente. Use "Reler conversa" para atualizar os dados.')
          setTimeout(() => setToast(null), 5000)
        }
      }).catch(() => {})
    }, 15000)
    return () => clearInterval(t)
  }, [atendimento.id])

  const podeWhatsapp = waConfigurado && !!(whatsapp || dados.telefone.replace(/\D/g, '').length >= 10)

  async function enviarWhatsapp(m: Mensagem) {
    if (!window.confirm('Enviar esta mensagem ao cliente pelo WhatsApp?')) return
    setEnviandoWa(m.id); setErro(null)
    try {
      await gravarMensagens(mensagens) // garante a última edição salva antes de enviar
      const res = await fetch('/api/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ atendimentoId: atendimento.id, mensagemId: m.id, texto: m.texto }) })
      const j = await res.json().catch(() => ({ error: 'Resposta inválida do servidor.' }))
      if (!res.ok) throw new Error(j.error ?? 'Falha ao enviar.')
      setMensagens(j.mensagens)
      if (j.status) setStatus(j.status)
      onAtualizado({ id: atendimento.id, status: j.status, updatedAt: new Date().toISOString(), updatedByNome: autor })
      avisar('Enviado pelo WhatsApp.')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível enviar pelo WhatsApp.'))
    } finally {
      setEnviandoWa(null)
    }
  }

  async function marcarEnviada(m: Mensagem) {
    const novas = mensagens.map(x => (x.id === m.id ? { ...x, enviada: true, por: autor ?? x.por } : x))
    await gravarMensagens(novas, status === 'aberto' ? 'enviado' : undefined)
    avisar('Resposta marcada como enviada ao cliente.')
  }

  // ---------- Agenda (com as permissões de quem está usando)
  async function preReservar(cartaoId?: string) {
    if (!espaco || !nomeNoSistema || !dados.data) { setErro('Para pré-reservar, o orçamento precisa ter cliente, data e um espaço da agenda.'); return }
    const ocupado = opcoesEspacos.find(o => o.t.slug === slug)?.livre === false
    const aviso = ocupado ? '\n\nATENÇÃO: já existe evento nesse espaço nessa data.' : ''
    if (!window.confirm(`Criar pré-evento na Agenda?\n\n${dados.empresa || dados.cliente} · ${nomeNoSistema} · ${br(dados.data)}${aviso}`)) return
    setAgendando(true); setErro(null)
    try {
      const evento: Evento = {
        id: crypto.randomUUID(),
        cliente: (dados.empresa || dados.cliente).trim(),
        nomeEvento: dados.tipoEvento.trim() || undefined,
        telefoneContato: dados.telefone.trim() || undefined,
        email: dados.email.trim() || undefined,
        espaco: nomeNoSistema as Espaco,
        data: dados.data,
        horaInicio: '00:00',
        horaFim: '00:00',
        tipo: 'Evento',
        status: 'em_negociacao',
        valor: totalLoc,
        numeroPessoas: dados.convidados ?? undefined,
        tipoContrato: contratacao,
        responsavel: dados.empresa ? dados.cliente || undefined : undefined,
        observacoes: [`Pré-reserva pelo Assistente de IA · orçamento ${numero}-E v${versao}`, dados.observacoes].filter(Boolean).join('\n'),
      }
      await addEvento(evento)
      setPreEventoId(evento.id)
      const base = cartaoId ? mensagens.map(m => (m.id === cartaoId ? { ...m, feita: true } : m)) : mensagens
      await gravarMensagens([...base, novaMensagem('sistema', `Pré-evento criado na Agenda: ${nomeNoSistema}, ${br(dados.data)}.`, autor)])
      avisar('Pré-evento criado na Agenda.')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível criar o pré-evento (confira se você tem acesso à Agenda).'))
    } finally {
      setAgendando(false)
    }
  }

  // PDF: renderiza o orçamento escondido e chama a impressão do navegador.
  useEffect(() => {
    if (!imprimindo) return
    const t = setTimeout(() => window.print(), 80)
    const fim = () => setImprimindo(null)
    window.addEventListener('afterprint', fim)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fim) }
  }, [imprimindo])

  const pronto = !!espaco
  const perguntas = questionario(dados, espaco?.nome)
  const faltam = perguntas.filter(p => !p.resposta)

  useEffect(() => { fimChat.current?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' }) }, [mensagens.length, pensando])
  useEffect(() => { if (vivo.texto) fimChat.current?.scrollIntoView({ block: 'end', inline: 'nearest' }) }, [vivo.texto])

  // Aplica na tela o orçamento que o assistente montou (o salvamento automático grava).
  function aplicarEstado(e: EstadoAtendimento) {
    setDados({ ...DADOS_VAZIOS, ...e.dados }); setSlug(e.slug); setMontagem(e.montagem); setContratacao(e.contratacao)
    setFastixOpcional(e.fastixOpcional); setStaffComplementar(e.staffComplementar); setValorManual(e.valorManual)
    setBuffetId(e.buffetId); setBuffetOpcao(e.buffetOpcao); setBuffetValor(e.buffetValor); setExtras(e.extras); setOpcionais(e.opcionais)
  }

  // ---------- Chat com o assistente
  async function enviarChat(textoFixo?: string, paraIA?: string) {
    const texto = (textoFixo ?? novoTexto).trim()
    const clienteNovas = mensagens.filter(m => m.autor === 'cliente' && (!iaAte || m.em > iaAte)).map(m => m.texto)
    if ((!texto && clienteNovas.length === 0) || pensando) return
    setErro(null); setNovoTexto(''); setPensando(true)
    const comPergunta = texto ? [...mensagens, novaMensagem('equipe', texto, autor)] : mensagens
    setMensagens(comPergunta)
    const agora = new Date().toISOString()
    try {
      setVivo({ texto: '', etapa: '' })
      const j = await pedirAoVivo('/api/assistente/chat', { mensagem: paraIA ?? texto, historico: iaHist, estado, preEvento: preEvento ? { status: preEvento.status } : null, clienteNovas }, setVivo)
      if (j.error) throw new Error(j.error)
      if (j.estado) aplicarEstado(j.estado as EstadoAtendimento)
      setIaHist(j.historico ?? iaHist); setIaAte(agora)
      const novas: Mensagem[] = []
      if (j.resposta) novas.push(novaMensagem('assistente', j.resposta))
      for (const a of (j.acoes ?? []) as { tipo: string; texto?: string; dados?: Record<string, unknown> }[]) {
        if (a.tipo === 'rascunho' && a.texto) novas.push({ ...novaMensagem('assistente', a.texto), tipo: 'rascunho_cliente', enviada: false })
        if (a.tipo === 'pdfs') novas.push({ ...novaMensagem('sistema', 'Orçamentos prontos para gerar.'), tipo: 'pdfs' })
        if (a.tipo === 'pre_evento') novas.push({ ...novaMensagem('sistema', 'Pré-reservar a data na Agenda'), tipo: 'pre_evento', acao: a.dados })
        if (a.tipo === 'confirmar_evento') novas.push({ ...novaMensagem('sistema', 'Converter o pré-evento em evento'), tipo: 'confirmar_evento' })
        if (a.tipo === 'sistema' && a.dados) novas.push({ ...novaMensagem('sistema', String(a.dados.resumo ?? 'Ação no sistema')), tipo: 'acao_sistema', acao: a.dados })
      }
      await gravarMensagens([...comPergunta, ...novas])
    } catch (e) {
      // Não chegou ao assistente: tira da conversa e devolve para a caixa.
      setMensagens(mensagens)
      if (!paraIA) setNovoTexto(texto)
      setErro(e instanceof TypeError
        ? 'A mensagem não chegou ao assistente (a resposta demorou ou a internet oscilou). Ela voltou para a caixa: toque em enviar de novo.'
        : `${mensagemDeErro(e, 'Não foi possível falar com o assistente.')} A mensagem voltou para a caixa.`)
    } finally {
      setPensando(false)
    }
  }

  // Pedido que veio do botão do assistente: envia uma vez, logo ao abrir.
  const inicialEnviada = useRef(false)
  useEffect(() => {
    if (!mensagemInicial || inicialEnviada.current) return
    inicialEnviada.current = true
    onMensagemInicialEnviada?.()
    queueMicrotask(() => { void enviarChat(mensagemInicial) })
  })

  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); avisar('Copiado.') } catch { setErro('Não consegui copiar: selecione o texto e copie.') }
  }

  const ehRascunho = (m: Mensagem) => m.tipo === 'rascunho_cliente' || (m.autor === 'assistente' && !m.tipo && m.enviada !== undefined)

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-2 border-b border-app-border pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-app-text">{titulo}</h2>
          <p className="truncate text-xs text-app-muted">
            {espaco ? `${espaco.nome} · ` : ''}{dados.data ? `${br(dados.data)} · ` : ''}{dados.convidados ? `${dados.convidados} pessoas · ` : ''}
            {espaco ? `Locação ${formatCurrency(totalLoc)}` : 'sem espaço'}{totalServ ? ` · Serviços ${formatCurrency(totalServ)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={btnSec} onClick={() => setVerOrcamento(true)}><FileDown className="h-4 w-4" /> Orçamento</button>
          <select className={`${inputCls} w-auto`} value={status} onChange={e => mudarStatus(e.target.value as StatusAtendimento)} aria-label="Situação do atendimento">
            {(Object.keys(STATUS_ATENDIMENTO) as StatusAtendimento[]).map(s => <option key={s} value={s}>{STATUS_ATENDIMENTO[s].label}</option>)}
          </select>
          {podeExcluir && (
            <button type="button" className={btnSec} aria-label="Excluir atendimento" onClick={() => { if (window.confirm('Excluir este atendimento e toda a conversa? Não dá para desfazer.')) onExcluir() }}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        {faltam.length > 0 && faltam.length < 5 && (
          <p className="w-full text-xs text-amber-700">Falta do cliente: {faltam.map(p => p.pergunta.toLowerCase()).join(', ')}</p>
        )}
      </div>

      <div className="print:hidden flex-1 space-y-4 py-4">
        {mensagens.map(m => {
          if (m.autor === 'equipe') return (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl bg-[#072A43] px-3.5 py-2 text-sm text-white">{m.texto}</div>
            </div>
          )
          if (m.autor === 'cliente') return (
            <div key={m.id} className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl bg-app-surface2 px-3.5 py-2 text-sm text-app-text">
                <p className="mb-0.5 text-[11px] font-semibold text-app-muted">Cliente{m.canal === 'whatsapp' ? ' · WhatsApp' : ''} · {new Date(m.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.texto}</p>
              </div>
            </div>
          )
          if (ehRascunho(m)) return (
            <div key={m.id} className="max-w-[92%] rounded-2xl border border-[#072A43]/20 bg-app-surface p-3 text-sm">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-app-muted"><MessageSquareText className="h-3.5 w-3.5" /> Mensagem para o cliente · {m.enviada ? `enviada${m.canal === 'whatsapp' ? ' pelo WhatsApp' : ''}` : 'rascunho'}</p>
              {m.enviada
                ? <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-app-text">{m.texto}</p>
                : <textarea className={`${inputCls} min-h-[140px]`} value={m.texto} onChange={e => editarMensagem(m.id, e.target.value)} onBlur={() => gravarMensagens(mensagens)} />}
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button type="button" className={btnSec} onClick={() => copiar(m.texto)}><Copy className="h-4 w-4" /> Copiar</button>
                {!m.enviada && podeWhatsapp && (
                  <button type="button" className={btnPrim} disabled={enviandoWa === m.id} onClick={() => enviarWhatsapp(m)}>
                    {enviandoWa === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar pelo WhatsApp
                  </button>
                )}
                {!m.enviada && <button type="button" className={btnSec} onClick={() => marcarEnviada(m)}><CheckCircle2 className="h-4 w-4" /> Já enviei</button>}
              </div>
            </div>
          )
          if (m.tipo === 'pdfs') return (
            <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-app-border2 p-3 text-sm">
              <span className="text-app-muted">Orçamentos:</span>
              <button type="button" className={btnSec} disabled={!pronto} onClick={() => setImprimindo('locacao')}><FileDown className="h-4 w-4" /> PDF Locação</button>
              <button type="button" className={btnSec} disabled={!pronto || linhasServ.length === 0} onClick={() => setImprimindo('servicos')}><FileDown className="h-4 w-4" /> PDF Serviços</button>
              <button type="button" className={btnSec} onClick={() => setVerOrcamento(true)}>Conferir ou ajustar</button>
            </div>
          )
          if (m.tipo === 'pre_evento') return (
            <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <CalendarClock className="h-4 w-4 text-amber-600" />
              <span className="text-app-text">Pré-reservar: {dados.empresa || dados.cliente} · {nomeNoSistema ?? espaco?.nome} · {br(dados.data)}{dados.convidados ? ` · ${dados.convidados} pessoas` : ''}</span>
              {m.feita || preEventoId
                ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Na Agenda</span>
                : <button type="button" className={btnPrim} disabled={agendando} onClick={() => preReservar(m.id)}>{agendando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Confirmar</button>}
            </div>
          )
          if (m.tipo === 'confirmar_evento') return (
            <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              {preEvento?.status === 'confirmado'
                ? <span className="text-emerald-800">Evento confirmado na Agenda.</span>
                : <><span className="text-app-text">Converter o pré-evento em evento confirmado</span>
                  <button type="button" className={btnPrim} disabled={!preEvento} onClick={() => preEvento && setConfirmando(preEvento)}>Abrir formulário</button></>}
            </div>
          )
          if (m.tipo === 'acao_sistema' && m.acao) return (
            <div key={m.id} className="max-w-[92%]">
              <CartaoAcaoSistema acao={m.acao as unknown as AcaoSistema} feita={m.feita} desfazer={desfazeres[m.id]}
                onFeita={d => { if (d) setDesfazeres(x => ({ ...x, [m.id]: d })); gravarMensagens(mensagens.map(x => (x.id === m.id ? { ...x, feita: true } : x))) }}
                onDesfeita={() => { setDesfazeres(x => { const n = { ...x }; delete n[m.id]; return n }); gravarMensagens(mensagens.map(x => (x.id === m.id ? { ...x, feita: false } : x))) }} />
            </div>
          )
          if (m.autor === 'sistema') return <p key={m.id} className="text-center text-xs text-app-muted">{m.texto}</p>
          return (
            <div key={m.id} className="flex gap-2">
              <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#9A7937]" />
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-app-text">{m.texto}</p>
            </div>
          )
        })}
        {pensando && vivo.texto && (
          <div className="flex gap-2">
            <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#9A7937]" />
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-app-text">{vivo.texto}<span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-app-muted align-middle" /></p>
          </div>
        )}
        {pensando && !vivo.texto && <p className="inline-flex items-center gap-2 text-sm text-app-muted"><Loader2 className="h-4 w-4 animate-spin" /> {vivo.etapa || 'Pensando...'}</p>}
        {erro && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{erro}</p>}
        <div ref={fimChat} />
      </div>

      <form className="print:hidden sticky bottom-0 z-10 flex items-end gap-2 rounded-2xl border border-app-border2 bg-app-surface p-2 shadow-lg" onSubmit={e => { e.preventDefault(); enviarChat() }}>
        <textarea
          className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-app-text focus:outline-none"
          rows={1}
          placeholder="Escreva, fale no microfone ou cole a mensagem do cliente..."
          value={novoTexto}
          onChange={e => setNovoTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width: 768px)').matches) { e.preventDefault(); enviarChat() } }}
        />
        <BotaoAnexo disabled={pensando} pergunta={novoTexto.trim()} onErro={setErro} onLido={f => enviarChat(`📎 ${f.arquivo}${novoTexto.trim() ? ` — ${novoTexto.trim()}` : ''}`, textoDaFicha(f, novoTexto.trim()))} />
        <BotaoVoz disabled={pensando} onParcial={setNovoTexto} onFinal={t => enviarChat(t)} onErro={setErro} />
        <button type="submit" aria-label="Enviar" disabled={pensando || (!novoTexto.trim() && !mensagens.some(m => m.autor === 'cliente' && (!iaAte || m.em > iaAte)))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#072A43] text-white disabled:opacity-40">
          {pensando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>

      {verOrcamento && (
        <div className="print:hidden fixed inset-0 z-40 flex justify-end bg-black/40" onClick={e => { if (e.target === e.currentTarget) setVerOrcamento(false) }}>
          <div className="h-full w-full max-w-3xl space-y-4 overflow-y-auto bg-app-bg p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-app-text">Orçamento nº {numero} · versão {versao}</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnSec} disabled={!pronto} onClick={() => setImprimindo('locacao')}><FileDown className="h-4 w-4" /> PDF Locação</button>
                <button type="button" className={btnSec} disabled={!pronto || linhasServ.length === 0} onClick={() => setImprimindo('servicos')}><FileDown className="h-4 w-4" /> PDF Serviços</button>
                <button type="button" className={btnSec} disabled={!pronto} onClick={() => setVersao(v => v + 1)}>Nova versão</button>
                <button type="button" className={btnPrim} onClick={() => setVerOrcamento(false)}>Voltar ao chat</button>
              </div>
            </div>
            <section className={cardCls}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-app-text">2. Dados do evento</h2>
                <span className="text-xs text-app-muted">Orçamento nº {numero} · versão {versao}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Campo label="Cliente"><input className={inputCls} value={dados.cliente} onChange={e => set('cliente', e.target.value)} /></Campo>
                <Campo label="Empresa"><input className={inputCls} value={dados.empresa} onChange={e => set('empresa', e.target.value)} /></Campo>
                <Campo label="Telefone"><input className={inputCls} value={dados.telefone} onChange={e => set('telefone', e.target.value)} /></Campo>
                <Campo label="E-mail"><input className={inputCls} value={dados.email} onChange={e => set('email', e.target.value)} /></Campo>
                <Campo label="Tipo de evento"><input className={inputCls} value={dados.tipoEvento} onChange={e => set('tipoEvento', e.target.value)} /></Campo>
                <Campo label={dados.data ? `Data (${diaDaSemana(dados.data)})` : 'Data'}><input className={inputCls} type="date" value={dados.data} onChange={e => set('data', e.target.value)} /></Campo>
                <Campo label="Convidados"><input className={inputCls} type="number" min={1} value={dados.convidados ?? ''} onChange={e => set('convidados', e.target.value ? Number(e.target.value) : null)} /></Campo>
                <Campo label="Tipo de dia">
                  <select className={inputCls} value={dados.tipoDia} onChange={e => set('tipoDia', e.target.value as TipoDia)}>
                    <option value="normal">Dia normal</option><option value="vespera">Véspera de feriado</option><option value="feriado">Feriado</option>
                  </select>
                </Campo>
                <Campo label="Observações" className="col-span-2 md:col-span-4"><input className={inputCls} value={dados.observacoes} onChange={e => set('observacoes', e.target.value)} /></Campo>
              </div>
              {(pedidos.length > 0 || falta.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {pedidos.map(p => <span key={p} className="rounded-full bg-sky-500/10 px-2.5 py-1 text-sky-700">Pediu: {p}</span>)}
                  {falta.map(p => <span key={p} className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700">Falta: {p}</span>)}
                </div>
              )}
            </section>
            <section className={cardCls}>
              <h2 className="mb-2 text-sm font-semibold text-app-text">3. Espaço e Orçamento de Locação</h2>
              {!dados.data && <p className="mb-2 text-xs text-amber-700">Informe a data para conferir a agenda e o preço do dia.</p>}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {opcoesEspacos.map(o => (
                  <button type="button" key={o.t.slug} onClick={() => { setSlug(o.t.slug); setValorManual(null); setMontagem(false) }}
                    className={`rounded-lg border p-3 text-left text-sm ${slug === o.t.slug ? 'border-[#072A43] ring-2 ring-[#072A43]/20' : 'border-app-border2'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-app-text">{o.t.nome}</span>
                      <span className="text-xs text-app-muted">até {o.t.capacidade.toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="mt-1 text-app-text">{o.t.semTabela ? 'Sem tabela' : dados.data ? `${o.t.aPartirDe ? 'a partir de ' : ''}${formatCurrency(o.total)}` : '—'}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      {o.livre === true && <span className="inline-flex items-center gap-1 text-emerald-600"><CalendarCheck className="h-3.5 w-3.5" /> Livre</span>}
                      {o.livre === false && <span className="inline-flex items-center gap-1 text-red-600"><CalendarX className="h-3.5 w-3.5" /> Ocupado ({o.ocup.map(x => x.status === 'confirmado' ? 'confirmado' : 'em negociação').join(', ')})</span>}
                      {o.livre === null && dados.data && <span className="text-app-muted">{o.t.semAgendaNoSistema ? 'Agenda fora do sistema: confirmar' : agendaFalhou ? 'Não consegui ler a agenda: confirmar' : 'Conferindo agenda...'}</span>}
                      {!o.cabe && <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Não comporta o público</span>}
                    </div>
                  </button>
                ))}
              </div>

              {espaco && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Campo label={espaco.semTabela ? 'Valor da locação (sem tabela)' : 'Ajustar valor da locação (opcional)'}>
                    <input className={inputCls} type="number" min={0} placeholder={espaco.semTabela ? 'Informe o valor' : 'Usar tabela'} value={valorManual ?? ''} onChange={e => setValorManual(e.target.value ? Number(e.target.value) : null)} />
                  </Campo>
                  <Campo label="Contratação">
                    <select className={inputCls} value={contratacao} onChange={e => setContratacao(e.target.value as 'locacao' | 'parceria')}>
                      <option value="locacao">Locação</option>
                      <option value="parceria">Parceria (FASTIX obrigatória)</option>
                    </select>
                  </Campo>
                  <label className="flex items-center gap-2 self-end text-sm text-app-text">
                    <input type="checkbox" disabled={contratacao === 'parceria'} checked={contratacao === 'parceria' || fastixOpcional} onChange={e => setFastixOpcional(e.target.checked)} />
                    Condição FASTIX: 25% na reserva e 75% até 8 dias antes
                  </label>
                  <Campo label="Staff complementar obrigatório (R$)">
                    <input className={inputCls} type="number" min={0} value={staffComplementar || ''} onChange={e => setStaffComplementar(Number(e.target.value) || 0)} />
                  </Campo>
                  {espaco.montagemDiaAnterior && (
                    <label className="flex items-center gap-2 self-end text-sm text-app-text">
                      <input type="checkbox" checked={montagem} onChange={e => setMontagem(e.target.checked)} /> Montagem 1 dia antes (+{formatCurrency(espaco.montagemDiaAnterior)})
                    </label>
                  )}
                  <div className="md:col-span-3 rounded-lg bg-app-surface2 p-3 text-sm">
                    {linhasLoc.map((l, i) => <div key={i} className="flex justify-between gap-2"><span>{l.descricao}</span><span>{formatCurrency(l.valor)}</span></div>)}
                    <div className="mt-1 flex justify-between border-t border-app-border2 pt-1 font-semibold"><span>Total da locação</span><span>{formatCurrency(totalLoc)}</span></div>
                    {espaco.obrigatorios.map(o => <p key={o} className="mt-1 text-xs text-amber-700">• {o}</p>)}
                  </div>
                </div>
              )}
              {espaco && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-app-border2 p-3 text-sm">
                  <CalendarClock className="h-4 w-4 text-amber-600" />
                  {!preEventoId && (
                    <>
                      <span className="text-app-muted">Agenda:</span>
                      {nomeNoSistema
                        ? <button type="button" className={btnSec} disabled={agendando || !dados.data || !(dados.empresa || dados.cliente)} onClick={() => preReservar()}>
                            {agendando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Pré-reservar a data
                          </button>
                        : <span className="text-app-muted">{espaco.nome} não está na agenda do sistema: reserve por fora.</span>}
                      {nomeNoSistema && (!dados.data || !(dados.empresa || dados.cliente)) && <span className="text-xs text-app-muted">Preencha cliente e data.</span>}
                    </>
                  )}
                  {preEventoId && !preEvento && <span className="text-app-muted">Pré-evento criado. Carregando da Agenda...</span>}
                  {preEvento?.status === 'em_negociacao' && (
                    <>
                      <span className="text-app-text">Pré-reservado na Agenda ({br(preEvento.data)}).</span>
                      <button type="button" className={btnPrim} onClick={() => setConfirmando(preEvento)}>
                        <CheckCircle2 className="h-4 w-4" /> Confirmar e converter em evento
                      </button>
                    </>
                  )}
                  {preEvento?.status === 'confirmado' && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Evento confirmado na Agenda.</span>}
                  {preEvento?.status === 'cancelado' && <span className="text-red-600">O pré-evento foi cancelado na Agenda.</span>}
                </div>
              )}
            </section>
            <section className={cardCls}>
              <h2 className="mb-2 text-sm font-semibold text-app-text">4. Orçamento de Serviços</h2>
              <p className="mb-3 text-xs text-app-muted">Não inclua aqui o que já vem com o espaço (staff da casa e rider técnico): isso fica no Orçamento de Locação.</p>
              <div className="grid gap-3 md:grid-cols-3">
                <Campo label="Buffet EL">
                  <select className={inputCls} value={buffetId} onChange={e => { setBuffetId(e.target.value); setBuffetOpcao(opcoesDaTabela(tabelasBuffet.find(t => t.id === e.target.value))[0] ?? ''); setBuffetValor(null) }}>
                    <option value="">Sem buffet</option>
                    {tabelasBuffet.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </Campo>
                {tabelaBuffet && (
                  <>
                    <Campo label="Opção">
                      <select className={inputCls} value={buffetOpcao} onChange={e => { setBuffetOpcao(e.target.value); setBuffetValor(null) }}>
                        {opcoesDaTabela(tabelaBuffet).map(o => <option key={o}>{o}</option>)}
                      </select>
                    </Campo>
                    <Campo label={faixa ? `Valor (tabela: até ${faixa.ateConvidados} convidados)` : 'Valor (sem faixa para esse público)'}>
                      <input className={inputCls} type="number" min={0} value={buffetValor ?? faixa?.valor ?? ''} onChange={e => setBuffetValor(e.target.value ? Number(e.target.value) : null)} />
                    </Campo>
                  </>
                )}
              </div>
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold text-app-muted">Serviços de parceiros e outros</p>
                <EditorLinhas lista={extras} setLista={setExtras} rotulo="Adicionar serviço" />
              </div>
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold text-app-muted">Opcionais sugeridos (aparecem no PDF, fora do total)</p>
                <EditorLinhas lista={opcionais} setLista={setOpcionais} rotulo="Adicionar opcional" />
              </div>
              <Campo label="Observação de pagamento dos serviços (opcional)" className="mt-3">
                <input className={inputCls} value={condicoesServicos} onChange={e => setCondicoesServicos(e.target.value)} />
              </Campo>
              <p className="mt-2 text-right text-sm font-semibold text-app-text">Total dos serviços: {formatCurrency(totalServ)}</p>
            </section>
          </div>
        </div>
      )}

      {imprimindo && espaco && (
        <div className="hidden print:block">
          <PropostaAssistente
            tipo={imprimindo}
            numero={numero}
            versao={versao}
            dados={dados}
            espaco={espaco}
            linhas={imprimindo === 'locacao' ? linhasLoc : linhasServ}
            opcionais={opcionais.filter(o => o.descricao.trim())}
            parcelas={imprimindo === 'locacao' ? parcelas(totalLoc, regraLoc, dados.data) : parcelas(totalServ, PAGAMENTO_SERVICOS, dados.data)}
            condicoesServicos={condicoesServicos}
            fastix={imprimindo === 'locacao' ? fastix : null}
          />
        </div>
      )}

      {confirmando && (
        <NovoEventoModal
          preEvento={confirmando}
          onClose={() => setConfirmando(null)}
          onSave={async ev => {
            await confirmarPreEvento(ev)
            setConfirmando(null)
            await gravarMensagens([...mensagens, novaMensagem('sistema', `Evento confirmado na Agenda: ${ev.espaco}, ${br(ev.data)}.`, autor)], 'fechado')
            avisar('Evento confirmado na Agenda.')
          }}
        />
      )}

      <Toast message={toast} />
    </div>
  )
}
