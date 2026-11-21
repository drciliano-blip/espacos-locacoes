'use client'

// Aba ASSISTENTE DE IA — etapa 1 do Plano 2027 (copiloto da equipe).
// A equipe cola a mensagem do cliente; a IA lê os dados do evento; o sistema
// confere a agenda, calcula a locação pela tabela do espaço e monta os dois
// orçamentos (Locação e Serviços, separados); a IA escreve a resposta de
// WhatsApp e sugere serviços extras. Nada é enviado sozinho: a equipe revisa,
// gera os PDFs e envia. Esta etapa não grava nada no banco.

import { useEffect, useMemo, useState } from 'react'
import { Bot, Sparkles, Loader2, FileDown, Copy, Plus, Trash2, RotateCcw, CalendarCheck, CalendarX, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, mensagemDeErro } from '@/lib/utils'
import { carregarTabelas, opcoesDaTabela, sugerirFaixa, type BuffetTabela } from '@/lib/buffet'
import { PAGAMENTO_FASTIX, TABELAS_ESPACOS, tabelaPorSlug } from '@/lib/assistente/tabelas-espacos'
import {
  DADOS_VAZIOS, br, diaDaSemana, linhasLocacao, novoNumero, parcelas, soma,
  type DadosEvento, type LinhaOrcamento, type TipoDia,
} from '@/lib/assistente/orcamento'
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

export default function AssistenteClient() {
  const [texto, setTexto] = useState('')
  const [analisando, setAnalisando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [numero, setNumero] = useState<string | null>(null)
  const [versao, setVersao] = useState(1)
  const [dados, setDados] = useState<DadosEvento>(DADOS_VAZIOS)
  const [pedidos, setPedidos] = useState<string[]>([])
  const [falta, setFalta] = useState<string[]>([])
  const [slug, setSlug] = useState<string>('')
  const [ocupacao, setOcupacao] = useState<{ data: string; porSlug: Record<string, Ocupacao[]>; falhou: boolean } | null>(null)

  const [montagem, setMontagem] = useState(false)
  // Parceria: FASTIX obrigatória (contrato). Locação: FASTIX opcional.
  const [contratacao, setContratacao] = useState<'locacao' | 'parceria'>('locacao')
  const [fastixOpcional, setFastixOpcional] = useState(false)
  const [staffComplementar, setStaffComplementar] = useState(0)
  const [valorManual, setValorManual] = useState<number | null>(null)

  const [tabelasBuffet, setTabelasBuffet] = useState<BuffetTabela[]>([])
  const [buffetId, setBuffetId] = useState('')
  const [buffetOpcao, setBuffetOpcao] = useState('')
  const [buffetValor, setBuffetValor] = useState<number | null>(null)
  const [extras, setExtras] = useState<LinhaOrcamento[]>([])
  const [opcionais, setOpcionais] = useState<LinhaOrcamento[]>([])
  const [condicoesServicos, setCondicoesServicos] = useState('')

  const [resposta, setResposta] = useState<Resposta | null>(null)
  const [imprimindo, setImprimindo] = useState<'locacao' | 'servicos' | null>(null)

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
      sb.from('eventos').select('espaco_id, cliente, status').eq('data', dados.data).neq('status', 'cancelado'),
    ]).then(([esp, ev]) => {
      if (!vivo) return
      // Sem a agenda não dá para dizer que está livre: mostra "conferir".
      if (esp.error || ev.error) { setOcupacao({ data: dados.data, porSlug: {}, falhou: true }); return }
      const slugDe = new Map((esp.data ?? []).map(e => [e.id as string, e.slug as string]))
      const porSlug: Record<string, Ocupacao[]> = {}
      for (const e of ev.data ?? []) {
        const s = slugDe.get(e.espaco_id as string)
        if (s) (porSlug[s] ??= []).push({ cliente: e.cliente as string, status: e.status as string })
      }
      setOcupacao({ data: dados.data, porSlug, falhou: false })
    })
    return () => { vivo = false }
  }, [dados.data])

  const agendaDoDia = ocupacao && ocupacao.data === dados.data && !ocupacao.falhou ? ocupacao.porSlug : null
  const agendaFalhou = !!ocupacao && ocupacao.data === dados.data && ocupacao.falhou
  const espaco = tabelaPorSlug(slug)

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

  async function analisar() {
    setErro(null); setAnalisando(true); setResposta(null)
    try {
      const r = await chamar<Extraido>({ acao: 'extrair', texto })
      setDados({
        cliente: r.cliente ?? '', empresa: r.empresa ?? '', telefone: r.telefone ?? '', email: r.email ?? '',
        tipoEvento: r.tipoEvento ?? '', data: r.dataEvento ?? '', convidados: r.convidados, duracaoHoras: r.duracaoHoras,
        tipoDia: r.vesperaOuFeriado ?? 'normal', observacoes: r.observacoes ?? '',
      })
      setPedidos(r.servicosPedidos ?? [])
      setFalta(r.faltaPerguntar ?? [])
      setSlug(r.espacoDesejado && tabelaPorSlug(r.espacoDesejado) ? r.espacoDesejado : '')
      setNumero(novoNumero()); setVersao(1)
      setMontagem(false); setStaffComplementar(0); setValorManual(null); setContratacao('locacao'); setFastixOpcional(false)
      setBuffetId(''); setBuffetOpcao(''); setBuffetValor(null); setExtras([]); setOpcionais([])
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível analisar a mensagem.'))
    } finally {
      setAnalisando(false)
    }
  }

  async function gerarResposta() {
    if (!espaco) { setErro('Escolha o espaço antes de gerar a resposta.'); return }
    setErro(null); setGerando(true)
    try {
      const escolhido = opcoesEspacos.find(o => o.t.slug === slug)
      const contexto = {
        cliente: { nome: dados.cliente, empresa: dados.empresa },
        evento: { tipo: dados.tipoEvento, data: dados.data ? `${diaDaSemana(dados.data)}, ${br(dados.data)}` : 'não informada', convidados: dados.convidados, duracaoHoras: dados.duracaoHoras, observacoes: dados.observacoes },
        espacoEscolhido: {
          nome: espaco.nome,
          disponivelNaData: escolhido?.livre ?? 'verificar manualmente',
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
      setResposta(await chamar<Resposta>({ acao: 'resposta', contexto }))
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível gerar a resposta.'))
    } finally {
      setGerando(false)
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

  function novoAtendimento() {
    setTexto(''); setDados(DADOS_VAZIOS); setPedidos([]); setFalta([]); setSlug(''); setNumero(null)
    setResposta(null); setErro(null); setExtras([]); setOpcionais([]); setBuffetId(''); setBuffetOpcao(''); setBuffetValor(null)
  }

  const pronto = !!numero && !!espaco

  return (
    <div className="space-y-4">
      <div className="print:hidden space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-app-text" />
            <div>
              <h1 className="text-xl font-semibold text-app-text">Assistente de IA</h1>
              <p className="text-xs text-app-muted">Etapa 1 · copiloto da equipe: a IA prepara, você revisa e envia.</p>
            </div>
          </div>
          {numero && <button type="button" className={btnSec} onClick={novoAtendimento}><RotateCcw className="h-4 w-4" /> Novo atendimento</button>}
        </div>

        {erro && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{erro}</div>}

        <section className={cardCls}>
          <h2 className="mb-2 text-sm font-semibold text-app-text">1. Mensagem do cliente</h2>
          <textarea className={`${inputCls} min-h-[120px]`} placeholder="Cole aqui a conversa do WhatsApp, o e-mail ou o pedido do site." value={texto} onChange={e => setTexto(e.target.value)} />
          <div className="mt-2 flex justify-end">
            <button type="button" className={btnPrim} disabled={analisando || !texto.trim()} onClick={analisar}>
              {analisando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Analisar com IA
            </button>
          </div>
        </section>

        {numero && (
          <>
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
                  <button type="button" className={btnPrim} disabled={!pronto || gerando} onClick={gerarResposta}>
                    {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar resposta com IA
                  </button>
                </div>
              </div>
              {!espaco && <p className="text-xs text-app-muted">Escolha o espaço no passo 3.</p>}
              {resposta && (
                <div className="space-y-3">
                  <textarea className={`${inputCls} min-h-[200px]`} value={resposta.mensagem} onChange={e => setResposta({ ...resposta, mensagem: e.target.value })} />
                  <div className="flex justify-end">
                    <button type="button" className={btnSec} onClick={() => navigator.clipboard.writeText(resposta.mensagem).then(() => avisar('Resposta copiada.'))}><Copy className="h-4 w-4" /> Copiar resposta</button>
                  </div>
                  {resposta.alertas.length > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
                      <p className="mb-1 font-semibold">Atenção da equipe</p>
                      {resposta.alertas.map(a => <p key={a}>• {a}</p>)}
                    </div>
                  )}
                  {resposta.upsell.length > 0 && (
                    <div className="rounded-lg border border-app-border2 p-3 text-sm">
                      <p className="mb-2 text-xs font-semibold text-app-muted">Serviços extras sugeridos pela IA</p>
                      {resposta.upsell.map(u => (
                        <div key={u.servico} className="flex items-start justify-between gap-3 py-1">
                          <div><p className="text-app-text">{u.servico}</p><p className="text-xs text-app-muted">{u.motivo}</p></div>
                          <button type="button" className={btnSec} onClick={() => { setOpcionais(o => [...o, { descricao: u.servico, prestador: '[Parceiro credenciado]', valor: 0 }]); avisar('Adicionado aos opcionais: preencha o valor.') }}>
                            <Plus className="h-4 w-4" /> Opcional
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {imprimindo && espaco && numero && (
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

      <Toast message={toast} />
    </div>
  )
}
