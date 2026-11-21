'use client'

// Um atendimento do Assistente de IA (um chat por cliente/orçamento).
// A conversa (cliente, IA, equipe) e o orçamento ficam salvos no banco
// (assistente_atendimentos). A IA lê a conversa inteira; o sistema confere a
// agenda e calcula a locação pela tabela do espaço; os orçamentos de Locação e
// de Serviços saem separados. Ações na Agenda (pré-reserva, confirmar evento)
// só acontecem com o clique de quem está atendendo e usam as permissões dele.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Loader2, FileDown, Copy, Plus, Trash2, CalendarCheck, CalendarX, AlertTriangle, CalendarClock, CheckCircle2, Send, StickyNote, MessageSquareText } from 'lucide-react'
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
interface Extraido {
  cliente: string | null; empresa: string | null; telefone: string | null; email: string | null
  tipoEvento: string | null; dataEvento: string | null; convidados: number | null; duracaoHoras: number | null
  vesperaOuFeriado: TipoDia; espacoDesejado: string | null; servicosPedidos: string[]
  observacoes: string | null; faltaPerguntar: string[]
}
interface Resposta { mensagem: string; upsell: { servico: string; motivo: string }[]; alertas: string[] }

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

async function chamar<T>(corpo: unknown): Promise<T> {
  const res = await fetch('/api/assistente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
  const json = await res.json().catch(() => ({ error: 'Resposta inválida do servidor.' }))
  if (!res.ok) throw new Error(json.error ?? 'Erro ao consultar a IA.')
  return json as T
}


const ROTULO_AUTOR: Record<Mensagem['autor'], string> = { cliente: 'Cliente', assistente: 'Resposta da IA', equipe: 'Nota da equipe', sistema: 'Sistema' }

// Texto da conversa para a IA ler, em ordem, com quem disse o quê.
function conversaParaIA(msgs: Mensagem[]): string {
  return msgs
    .filter(m => m.autor !== 'sistema')
    .map(m => `[${new Date(m.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] ${m.autor === 'cliente' ? 'CLIENTE' : m.autor === 'assistente' ? 'E&L (resposta enviada ou rascunho)' : 'NOTA INTERNA DA EQUIPE'}: ${m.texto}`)
    .join('\n\n')
}

interface Props {
  atendimento: Atendimento
  autor?: string
  podeExcluir: boolean
  onAtualizado: (patch: Partial<AtendimentoResumo> & { id: string }) => void
  onExcluir: () => void
}

export default function AtendimentoView({ atendimento, autor, podeExcluir, onAtualizado, onExcluir }: Props) {
  const ini = atendimento.estado
  const numero = atendimento.numero
  const { eventos, addEvento, confirmarPreEvento } = useEventos()
  const { espacosConfig } = useEspacos()

  const [analisando, setAnalisando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [salvoEm, setSalvoEm] = useState<string | null>(null)

  const [mensagens, setMensagens] = useState<Mensagem[]>(atendimento.mensagens)
  const [status, setStatus] = useState<StatusAtendimento>(atendimento.status)
  const [novoTexto, setNovoTexto] = useState('')

  const [versao, setVersao] = useState(ini.versao ?? 1)
  const [dados, setDados] = useState<DadosEvento>({ ...DADOS_VAZIOS, ...(ini.dados ?? {}) })
  const [pedidos, setPedidos] = useState<string[]>(ini.pedidos ?? [])
  const [falta, setFalta] = useState<string[]>(ini.falta ?? [])
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
  const [upsell, setUpsell] = useState<{ servico: string; motivo: string }[]>(ini.upsell ?? [])
  const [alertas, setAlertas] = useState<string[]>(ini.alertas ?? [])
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

  // ---------- IA: ler a conversa
  async function adicionarDoCliente() {
    const texto = novoTexto.trim()
    if (!texto) return
    const novas = [...mensagens, novaMensagem('cliente', texto, autor)]
    setNovoTexto('')
    await gravarMensagens(novas)
    await analisar(novas)
  }

  async function adicionarNota() {
    const texto = novoTexto.trim()
    if (!texto) return
    setNovoTexto('')
    await gravarMensagens([...mensagens, novaMensagem('equipe', texto, autor)])
  }

  async function analisar(msgs = mensagens) {
    if (!msgs.some(m => m.autor === 'cliente')) { setErro('Adicione pelo menos uma mensagem do cliente.'); return }
    setErro(null); setAnalisando(true)
    try {
      const r = await chamar<Extraido>({ acao: 'extrair', texto: conversaParaIA(msgs), dadosAtuais: { ...dados, espaco: slug || null } })
      // A IA devolve null no que não sabe: nesses campos fica o que já estava.
      setDados(d => ({
        cliente: r.cliente ?? d.cliente, empresa: r.empresa ?? d.empresa, telefone: r.telefone ?? d.telefone, email: r.email ?? d.email,
        tipoEvento: r.tipoEvento ?? d.tipoEvento, data: r.dataEvento ?? d.data, convidados: r.convidados ?? d.convidados,
        duracaoHoras: r.duracaoHoras ?? d.duracaoHoras, tipoDia: r.vesperaOuFeriado ?? d.tipoDia, observacoes: r.observacoes ?? d.observacoes,
      }))
      setPedidos(r.servicosPedidos ?? [])
      setFalta(r.faltaPerguntar ?? [])
      if (r.espacoDesejado && tabelaPorSlug(r.espacoDesejado)) setSlug(r.espacoDesejado)
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível analisar a conversa.'))
    } finally {
      setAnalisando(false)
    }
  }

  async function gerarResposta() {
    setErro(null); setGerando(true)
    try {
      const escolhido = opcoesEspacos.find(o => o.t.slug === slug)
      // Etapa 1 (coleta): falta alguma das 5 respostas → a IA pede só o que falta.
      const contexto = emColeta || !espaco ? {
        etapa: 'coleta',
        conversaAteAgora: conversaParaIA(mensagens.slice(-30)),
        jaRespondido: perguntas.filter(p => p.resposta).map(p => `${p.pergunta}: ${p.resposta}`),
        faltaResponder: perguntas.filter(p => !p.resposta).map(p => p.pergunta),
        espacosLivresQueComportam: dados.data && dados.convidados && agendaDoDia
          ? opcoesEspacos.filter(o => o.livre === true && o.cabe && !o.t.semTabela).map(o => `${o.t.nome} (até ${o.t.capacidade.toLocaleString('pt-BR')} pessoas)`)
          : 'ainda não dá para conferir (falta data ou número de pessoas)',
        observacao: 'O Complexo Jussara é atendido pessoalmente pela direção: se o cliente escolher o Jussara, diga que a equipe vai retornar com os detalhes.',
      } : {
        etapa: 'orcamento',
        conversaAteAgora: conversaParaIA(mensagens.slice(-30)),
        cliente: { nome: dados.cliente, empresa: dados.empresa },
        evento: { tipo: dados.tipoEvento, data: dados.data ? `${diaDaSemana(dados.data)}, ${br(dados.data)}` : 'não informada', convidados: dados.convidados, duracaoHoras: dados.duracaoHoras, observacoes: dados.observacoes },
        espacoEscolhido: {
          nome: espaco.nome,
          disponivelNaData: escolhido?.livre ?? 'verificar manualmente',
          jaPreReservadoParaEsteCliente: !!preEvento,
          comportaOPublico: escolhido?.cabe ?? true,
          capacidade: espaco.capacidade,
          totalLocacao: formatCurrency(totalLoc),
          itensLocacao: linhasLoc.map(l => `${l.descricao}: ${formatCurrency(l.valor)}`),
          inclusoNaLocacao: [...espaco.staffDaCasa, ...espaco.rider.map(r => r.titulo)],
          obrigatorios: espaco.obrigatorios,
          contratacao: contratacao === 'parceria' ? 'parceria (venda de ingressos obrigatória pela FASTIX)' : fastix ? 'locação com condição FASTIX (cliente vende ingressos pela FASTIX)' : 'locação',
          pagamento: parcelas(totalLoc, regraLoc, dados.data).map(p => `${p.descricao}: ${formatCurrency(p.valor)}${p.vencimento ? ` até ${br(p.vencimento)}` : ''}`),
        },
        alternativasLivres: opcoesEspacos
          .filter(o => o.t.slug !== slug && o.livre === true && o.cabe && !o.t.semTabela)
          .map(o => `${o.t.nome}: ${formatCurrency(o.total)} (até ${o.t.capacidade} pessoas)`),
        orcamentoServicos: { itens: linhasServ.map(l => `${l.descricao} (${l.prestador || 'E&L'}): ${formatCurrency(l.valor)}`), total: formatCurrency(totalServ) },
        opcionaisJaOferecidos: opcionais.map(o => o.descricao),
        servicosQueOClientePediu: pedidos,
        faltaPerguntar: falta,
        catalogo: {
          buffetEL: tabelasBuffet.map(t => t.nome),
          parceiros: ['decoração', 'foto e vídeo', 'som e iluminação extra', 'painel de LED', 'mobiliário e lounge', 'bar de drinks', 'cabine de fotos', 'produção do evento', 'segurança e brigada'],
        },
      }
      const r = await chamar<Resposta>({ acao: 'resposta', contexto })
      setUpsell(r.upsell); setAlertas(r.alertas)
      await gravarMensagens([...mensagens, novaMensagem('assistente', r.mensagem, autor)])
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível gerar a resposta.'))
    } finally {
      setGerando(false)
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
  async function preReservar() {
    if (!espaco || !nomeNoSistema || !dados.data) return
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
      await gravarMensagens([...mensagens, novaMensagem('sistema', `Pré-evento criado na Agenda: ${nomeNoSistema}, ${br(dados.data)}.`, autor)])
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
  const emColeta = perguntas.some(p => !p.resposta)
  const ultimaResposta = [...mensagens].reverse().find(m => m.autor === 'assistente')

  return (
    <div className="space-y-4">
      <div className="print:hidden space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-app-text">{titulo}</h2>
            <p className="text-xs text-app-muted">
              Nº {numero} · aberto por {atendimento.createdByNome ?? '—'}
              {salvoEm && <> · salvo às {new Date(salvoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select className={`${inputCls} w-auto`} value={status} onChange={e => mudarStatus(e.target.value as StatusAtendimento)} aria-label="Situação do atendimento">
              {(Object.keys(STATUS_ATENDIMENTO) as StatusAtendimento[]).map(s => <option key={s} value={s}>{STATUS_ATENDIMENTO[s].label}</option>)}
            </select>
            {podeExcluir && (
              <button type="button" className={btnSec} aria-label="Excluir atendimento" onClick={() => { if (window.confirm('Excluir este atendimento e toda a conversa? Não dá para desfazer.')) onExcluir() }}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {erro && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{erro}</div>}

        <section className={cardCls}>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-app-text"><MessageSquareText className="h-4 w-4" /> 1. Conversa</h2>
          {mensagens.length === 0 && <p className="mb-3 text-xs text-app-muted">Cole a primeira mensagem do cliente (WhatsApp, e-mail ou pedido do site).</p>}
          <div className="mb-3 rounded-lg border border-app-border2 p-3">
            <p className="mb-2 text-xs font-semibold text-app-muted">Questionário inicial {emColeta ? `· faltam ${perguntas.filter(p => !p.resposta).length}` : '· completo: siga para o orçamento e os extras'}</p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
              {perguntas.map(p => (
                <div key={p.chave} className={`rounded-md px-2 py-1.5 text-xs ${p.resposta ? 'bg-emerald-500/10 text-emerald-800' : 'bg-amber-500/10 text-amber-800'}`}>
                  <p className="font-semibold">{p.resposta ? '✓' : '•'} {p.pergunta}</p>
                  <p className="truncate">{p.resposta ?? 'pendente'}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {mensagens.map(m => (
              <div key={m.id} className={`flex ${m.autor === 'cliente' ? 'justify-start' : m.autor === 'sistema' ? 'justify-center' : 'justify-end'}`}>
                {m.autor === 'sistema'
                  ? <p className="rounded-full bg-app-surface2 px-3 py-1 text-xs text-app-muted">{m.texto} · {m.por ?? ''}</p>
                  : (
                    <div className={`w-full max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.autor === 'cliente' ? 'bg-app-surface2 text-app-text' : m.autor === 'equipe' ? 'border border-amber-500/30 bg-amber-500/10 text-app-text' : 'border border-[#072A43]/20 bg-[#072A43]/5 text-app-text'}`}>
                      <p className="mb-1 text-[11px] text-app-muted">
                        {ROTULO_AUTOR[m.autor]} · {new Date(m.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{m.por ? ` · ${m.por}` : ''}
                        {m.autor === 'assistente' && (m.enviada ? ' · enviada' : ' · rascunho')}
                        {m.canal === 'whatsapp' && ' · WhatsApp'}
                      </p>
                      {m.autor === 'assistente' && !m.enviada
                        ? <textarea className={`${inputCls} min-h-[160px]`} value={m.texto} onChange={e => editarMensagem(m.id, e.target.value)} onBlur={() => gravarMensagens(mensagens)} />
                        : <p className="whitespace-pre-wrap">{m.texto}</p>}
                      {m.autor === 'assistente' && (
                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                          <button type="button" className={btnSec} onClick={() => navigator.clipboard.writeText(m.texto).then(() => avisar('Resposta copiada.'))}><Copy className="h-4 w-4" /> Copiar</button>
                          {!m.enviada && podeWhatsapp && (
                            <button type="button" className={btnPrim} disabled={enviandoWa === m.id} onClick={() => enviarWhatsapp(m)}>
                              {enviandoWa === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar pelo WhatsApp
                            </button>
                          )}
                          {!m.enviada && <button type="button" className={btnSec} onClick={() => marcarEnviada(m)}>{podeWhatsapp ? 'Já enviei por fora' : <><Send className="h-4 w-4" /> Marcar como enviada</>}</button>}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            ))}
          </div>
          <textarea className={`${inputCls} mt-3 min-h-[90px]`} placeholder="Cole a nova mensagem do cliente ou escreva uma nota interna." value={novoTexto} onChange={e => setNovoTexto(e.target.value)} />
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button type="button" className={btnSec} disabled={!novoTexto.trim()} onClick={adicionarNota}><StickyNote className="h-4 w-4" /> Nota interna</button>
            {mensagens.some(m => m.autor === 'cliente') && (
              <button type="button" className={btnSec} disabled={analisando} onClick={() => analisar()}>Reler conversa</button>
            )}
            <button type="button" className={btnPrim} disabled={analisando || !novoTexto.trim()} onClick={adicionarDoCliente}>
              {analisando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Mensagem do cliente
            </button>
          </div>
        </section>

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
                        ? <button type="button" className={btnSec} disabled={agendando || !dados.data || !(dados.empresa || dados.cliente)} onClick={preReservar}>
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

            <section className={cardCls}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-app-text">5. Resposta e PDFs</h2>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnSec} disabled={!pronto} onClick={() => setImprimindo('locacao')}><FileDown className="h-4 w-4" /> PDF Locação</button>
                  <button type="button" className={btnSec} disabled={!pronto || linhasServ.length === 0} onClick={() => setImprimindo('servicos')}><FileDown className="h-4 w-4" /> PDF Serviços</button>
                  <button type="button" className={btnSec} disabled={!pronto} onClick={() => setVersao(v => v + 1)}>Nova versão</button>
                  <button type="button" className={btnPrim} disabled={gerando || !mensagens.some(m => m.autor === 'cliente')} onClick={gerarResposta}>
                    {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {emColeta ? 'Gerar resposta (pedir o que falta)' : 'Gerar resposta com orçamento'}
                  </button>
                </div>
              </div>
              {emColeta && <p className="text-xs text-app-muted">Etapa de coleta: a resposta agradece e pede só o que falta do questionário (e sugere os espaços livres, se já tiver data e pessoas). Os PDFs saem quando o espaço estiver escolhido.</p>}
              {ultimaResposta && !ultimaResposta.enviada && <p className="text-xs text-app-muted">A resposta gerada fica na conversa (passo 1) como rascunho: revise, copie e marque como enviada.</p>}
              {alertas.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
                  <p className="mb-1 font-semibold">Atenção da equipe</p>
                  {alertas.map(a => <p key={a}>• {a}</p>)}
                </div>
              )}
              {upsell.length > 0 && (
                <div className="mt-2 rounded-lg border border-app-border2 p-3 text-sm">
                  <p className="mb-2 text-xs font-semibold text-app-muted">Serviços extras sugeridos pela IA</p>
                  {upsell.map(u => (
                    <div key={u.servico} className="flex items-start justify-between gap-3 py-1">
                      <div><p className="text-app-text">{u.servico}</p><p className="text-xs text-app-muted">{u.motivo}</p></div>
                      <button type="button" className={btnSec} onClick={() => { setOpcionais(o => [...o, { descricao: u.servico, prestador: '[Parceiro credenciado]', valor: 0 }]); setUpsell(us => us.filter(x => x.servico !== u.servico)); avisar('Adicionado aos opcionais: preencha o valor.') }}>
                        <Plus className="h-4 w-4" /> Opcional
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
      </div>

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
