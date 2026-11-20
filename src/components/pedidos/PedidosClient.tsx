'use client'

// Aba Pedidos — o que chega pelos formulários públicos do site (Plano 2027):
// pedidos de orçamento de quem quer alugar e cadastros de donos que querem
// anunciar o espaço. A equipe muda a situação e anota; a primeira mudança
// grava "primeiro contato" (é o tempo de resposta que o plano mede).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Inbox, MessageCircle, Building2, Code2, Copy, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, mensagemDeErro } from '@/lib/utils'
import Toast from '@/components/shared/Toast'

type Aba = 'orcamentos' | 'espacos' | 'embutir'

interface Pedido {
  id: string; numero: number; created_at: string; origem: string; espaco_nome: string | null
  nome: string; telefone: string; email: string | null; data_evento: string | null; data_flexivel: boolean
  numero_pessoas: number | null; tipo_evento: string | null; servicos: string[]; mensagem: string | null
  status: string; primeiro_contato_em: string | null; observacoes: string | null
}

interface Candidato {
  id: string; numero: number; created_at: string; nome_espaco: string; responsavel_nome: string
  telefone: string; email: string; cnpj: string | null; bairro: string; cidade: string; capacidade: number | null
  estilos: string[]; plano_interesse: string | null; documentos: string[]; site_instagram: string | null
  mensagem: string | null; status: string; primeiro_contato_em: string | null; observacoes: string | null
}

const STATUS_PEDIDO: Record<string, string> = {
  novo: 'Novo', em_atendimento: 'Em atendimento', proposta_enviada: 'Proposta enviada', ganho: 'Fechado', perdido: 'Perdido',
}
const STATUS_CANDIDATO: Record<string, string> = {
  novo: 'Novo', em_analise: 'Em análise', documentacao: 'Aguardando documentos', aprovado: 'Aprovado', recusado: 'Recusado',
}
const SERVICOS: Record<string, string> = { buffet_bar: 'Buffet e bar', ingressos: 'Ingressos', producao: 'Produção', staff: 'Segurança e equipe' }
const DOCUMENTOS: Record<string, string> = {
  avcb: 'AVCB', alvara: 'Alvará', seguranca_pf: 'Segurança (PF)', brigada: 'Brigada', planta: 'Planta', fotos: 'Fotos',
}
const PLANOS: Record<string, string> = { vitrine: 'Vitrine', destaque: 'Destaque', exclusivo: 'Exclusivo', nao_sei: 'Não sabe' }
const TODOS_DOCUMENTOS = Object.keys(DOCUMENTOS)

function horasDesde(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 36e5
}

function tempoLabel(horas: number): string {
  if (horas < 1) return 'há menos de 1 h'
  if (horas < 48) return `há ${Math.floor(horas)} h`
  return `há ${Math.floor(horas / 24)} dias`
}

function whatsapp(telefone: string): string {
  const d = telefone.replace(/\D/g, '')
  return `https://wa.me/${d.startsWith('55') ? d : `55${d}`}`
}

async function buscarPedidos() {
  const supabase = createClient()
  const [p, c] = await Promise.all([
    supabase.from('pedidos_orcamento').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('espacos_candidatos').select('*').order('created_at', { ascending: false }).limit(500),
  ])
  return {
    erro: p.error ?? c.error,
    pedidos: (p.data as Pedido[] | null) ?? [],
    candidatos: (c.data as Candidato[] | null) ?? [],
  }
}

const card = 'rounded-xl border border-app-border bg-app-surface p-4 space-y-2'
const select = 'rounded-md border border-app-border2 bg-app-surface px-2 py-1 text-xs text-app-text'

export default function PedidosClient() {
  const [aba, setAba] = useState<Aba>('orcamentos')
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<'abertos' | 'todos'>('abertos')
  const [toast, setToast] = useState<{ msg: string; tipo: 'success' | 'error' } | null>(null)

  const avisar = (msg: string, tipo: 'success' | 'error' = 'error') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  // Mesmo padrão do Buffet: a busca só devolve os dados; o estado muda
  // quando eles chegam (nada síncrono dentro do efeito).
  const aplicarBusca = useCallback((r: Awaited<ReturnType<typeof buscarPedidos>>) => {
    if (r.erro) avisar(mensagemDeErro(r.erro, 'Não foi possível carregar os pedidos.'))
    setPedidos(r.pedidos)
    setCandidatos(r.candidatos)
    setCarregando(false)
  }, [])

  useEffect(() => {
    let vivo = true
    buscarPedidos().then(r => { if (vivo) aplicarBusca(r) })
    return () => { vivo = false }
  }, [aplicarBusca])
  const carregar = () => { setCarregando(true); buscarPedidos().then(aplicarBusca) }

  async function salvar(tabela: 'pedidos_orcamento' | 'espacos_candidatos', id: string, mudanca: Record<string, unknown>, atual: { status: string; primeiro_contato_em: string | null }) {
    const dados: Record<string, unknown> = { ...mudanca, updated_at: new Date().toISOString() }
    if (mudanca.status && mudanca.status !== 'novo' && !atual.primeiro_contato_em) dados.primeiro_contato_em = new Date().toISOString()
    const { error } = await createClient().from(tabela).update(dados).eq('id', id)
    if (error) { avisar(mensagemDeErro(error, 'Não foi possível salvar.')); return }
    const aplicar = <T extends { id: string }>(lista: T[]) => lista.map(x => x.id === id ? { ...x, ...dados } : x)
    if (tabela === 'pedidos_orcamento') setPedidos(aplicar)
    else setCandidatos(aplicar)
  }

  const abertosPedidos = pedidos.filter(p => !['ganho', 'perdido'].includes(p.status))
  const abertosCandidatos = candidatos.filter(c => !['aprovado', 'recusado'].includes(c.status))
  const atrasados = pedidos.filter(p => p.status === 'novo' && horasDesde(p.created_at) > 24).length
  const listaPedidos = filtro === 'abertos' ? abertosPedidos : pedidos
  const listaCandidatos = filtro === 'abertos' ? abertosCandidatos : candidatos

  const tabBtn = (id: Aba, label: string, n?: number) => (
    <button
      onClick={() => setAba(id)}
      className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${aba === id ? 'border-[#25D366] text-app-text font-medium' : 'border-transparent text-app-muted hover:text-app-text'}`}
    >
      {label}{n !== undefined && n > 0 && <span className="ml-1.5 rounded-full bg-[#25D366]/15 px-1.5 text-[11px] text-[#128C7E]">{n}</span>}
    </button>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366]/15"><Inbox className="h-5 w-5 text-[#128C7E]" /></div>
          <div>
            <h1 className="text-lg font-semibold text-app-text leading-tight">Pedidos do site</h1>
            <p className="text-xs text-app-subtle">Orçamentos e donos de espaço que chegaram pelos formulários públicos.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {aba !== 'embutir' && (
            <select value={filtro} onChange={e => setFiltro(e.target.value as 'abertos' | 'todos')} className={select}>
              <option value="abertos">Só em aberto</option>
              <option value="todos">Todos</option>
            </select>
          )}
          <button onClick={carregar} className="flex items-center gap-1 rounded-md border border-app-border2 px-2 py-1 text-xs text-app-muted hover:bg-app-surface2">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {atrasados > 0 && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          {atrasados} {atrasados === 1 ? 'pedido novo está' : 'pedidos novos estão'} sem resposta há mais de 24 horas — o plano promete proposta em até 24 h.
        </p>
      )}

      <div className="flex gap-1 border-b border-app-border">
        {tabBtn('orcamentos', 'Orçamentos', abertosPedidos.length)}
        {tabBtn('espacos', 'Donos de espaço', abertosCandidatos.length)}
        {tabBtn('embutir', 'Como embutir no site')}
      </div>

      {carregando && aba !== 'embutir' && <p className="text-sm text-app-subtle">Carregando…</p>}

      {!carregando && aba === 'orcamentos' && (
        listaPedidos.length === 0 ? <p className="text-sm text-app-subtle">Nenhum pedido {filtro === 'abertos' ? 'em aberto' : 'ainda'}.</p> : (
          <div className="space-y-3">
            {listaPedidos.map(p => (
              <div key={p.id} className={card}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-app-text">#{p.numero} · {p.nome}</p>
                    <p className="text-xs text-app-subtle">
                      Recebido {tempoLabel(horasDesde(p.created_at))} ({new Date(p.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}) · origem: {p.origem}
                      {p.primeiro_contato_em && ` · 1º contato em ${Math.max(0, Math.round((new Date(p.primeiro_contato_em).getTime() - new Date(p.created_at).getTime()) / 36e5))} h`}
                    </p>
                  </div>
                  <select value={p.status} onChange={e => salvar('pedidos_orcamento', p.id, { status: e.target.value }, p)} className={select}>
                    {Object.entries(STATUS_PEDIDO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div><p className="text-app-subtle">Espaço</p><p className="text-app-text">{p.espaco_nome ?? 'Não escolheu'}</p></div>
                  <div><p className="text-app-subtle">Data</p><p className="text-app-text">{p.data_evento ? formatDate(p.data_evento) : '—'}{p.data_flexivel ? ' (flexível)' : ''}</p></div>
                  <div><p className="text-app-subtle">Pessoas</p><p className="text-app-text">{p.numero_pessoas ?? '—'}</p></div>
                  <div><p className="text-app-subtle">Tipo</p><p className="text-app-text">{p.tipo_evento ?? '—'}</p></div>
                </div>
                {p.servicos.length > 0 && <p className="text-xs text-app-muted">Também quer: {p.servicos.map(s => SERVICOS[s] ?? s).join(', ')}</p>}
                {p.mensagem && <p className="text-xs text-app-text2 whitespace-pre-wrap">“{p.mensagem}”</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={whatsapp(p.telefone)} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md bg-[#25D366] px-2.5 py-1 text-xs font-medium text-white">
                    <MessageCircle className="h-3.5 w-3.5" /> {p.telefone}
                  </a>
                  {p.email && <a href={`mailto:${p.email}`} className="text-xs text-app-muted underline">{p.email}</a>}
                </div>
                <Observacoes key={p.observacoes ?? ''} valor={p.observacoes} onSalvar={v => salvar('pedidos_orcamento', p.id, { observacoes: v }, p)} />
              </div>
            ))}
          </div>
        )
      )}

      {!carregando && aba === 'espacos' && (
        listaCandidatos.length === 0 ? <p className="text-sm text-app-subtle">Nenhum cadastro {filtro === 'abertos' ? 'em aberto' : 'ainda'}.</p> : (
          <div className="space-y-3">
            {listaCandidatos.map(c => {
              const faltando = TODOS_DOCUMENTOS.filter(d => !c.documentos.includes(d))
              return (
                <div key={c.id} className={card}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-app-text flex items-center gap-1.5"><Building2 className="h-4 w-4 text-app-subtle" /> #{c.numero} · {c.nome_espaco}</p>
                      <p className="text-xs text-app-subtle">
                        {c.bairro}, {c.cidade} · até {c.capacidade ?? '?'} pessoas · plano: {c.plano_interesse ? PLANOS[c.plano_interesse] : '—'} · recebido {tempoLabel(horasDesde(c.created_at))}
                      </p>
                    </div>
                    <select value={c.status} onChange={e => salvar('espacos_candidatos', c.id, { status: e.target.value }, c)} className={select}>
                      {Object.entries(STATUS_CANDIDATO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-app-muted">
                    Documentos em dia: {c.documentos.length ? c.documentos.map(d => DOCUMENTOS[d] ?? d).join(', ') : 'nenhum informado'}
                    {faltando.length > 0 && <span className="text-amber-600"> · falta: {faltando.map(d => DOCUMENTOS[d]).join(', ')}</span>}
                  </p>
                  {c.mensagem && <p className="text-xs text-app-text2 whitespace-pre-wrap">“{c.mensagem}”</p>}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-app-text">{c.responsavel_nome}</span>
                    <a href={whatsapp(c.telefone)} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md bg-[#25D366] px-2.5 py-1 font-medium text-white">
                      <MessageCircle className="h-3.5 w-3.5" /> {c.telefone}
                    </a>
                    <a href={`mailto:${c.email}`} className="text-app-muted underline">{c.email}</a>
                    {c.cnpj && <span className="text-app-subtle">CNPJ {c.cnpj}</span>}
                    {c.site_instagram && <span className="text-app-subtle">{c.site_instagram}</span>}
                  </div>
                  <Observacoes key={c.observacoes ?? ''} valor={c.observacoes} onSalvar={v => salvar('espacos_candidatos', c.id, { observacoes: v }, c)} />
                </div>
              )
            })}
          </div>
        )
      )}

      {aba === 'embutir' && <ComoEmbutir onCopiado={() => avisar('Código copiado.', 'success')} />}

      <Toast message={toast?.msg ?? null} type={toast?.tipo} />
    </div>
  )
}

// Sem efeito para copiar o valor salvo: quem usa passa key={valor}, e o campo
// recomeça do valor salvo quando ele muda.
function Observacoes({ valor, onSalvar }: { valor: string | null; onSalvar: (v: string | null) => void }) {
  const [texto, setTexto] = useState(valor ?? '')
  return (
    <textarea
      value={texto}
      onChange={e => setTexto(e.target.value)}
      onBlur={() => { if ((texto.trim() || null) !== (valor ?? null)) onSalvar(texto.trim() || null) }}
      rows={2}
      placeholder="Anotações da equipe (salva ao sair do campo)"
      className="w-full rounded-md border border-app-border2 bg-app-bg px-2 py-1.5 text-xs text-app-text placeholder:text-app-subtle"
    />
  )
}

function ComoEmbutir({ onCopiado }: { onCopiado: () => void }) {
  // Esta aba só aparece depois de um clique (nunca no HTML do servidor).
  const [origem] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin))

  const codigo = useMemo(() => (pagina: string, titulo: string, extra = '') => [
    `<iframe data-el src="${origem}/${pagina}?origem=site${extra}" title="${titulo}" loading="lazy" style="width:100%;border:0;min-height:900px"></iframe>`,
    `<script>window.addEventListener('message',function(e){if(e.origin!=='${origem}'||!e.data||e.data.tipo!=='el-altura')return;document.querySelectorAll('iframe[data-el]').forEach(function(f){if(f.src.indexOf(e.data.pagina)>-1)f.style.height=e.data.altura+'px'})});</script>`,
  ].join('\n'), [origem])

  const blocos = [
    { titulo: 'Formulário de orçamento (página de contato ou orçamento)', texto: codigo('orcamento', 'Pedido de orçamento') },
    { titulo: 'Botão de orçamento já com o espaço escolhido (página de cada espaço)', texto: codigo('orcamento', 'Pedido de orçamento', '&espaco=usine'), nota: 'Troque "usine" pelo nome do espaço da página (ex.: fabrique, house-pacaembu, complexo-jussara, espaco-solon).' },
    { titulo: 'Anuncie seu espaço (página para donos de espaço)', texto: codigo('anuncie', 'Anuncie seu espaço') },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-app-text2">
        No WordPress, edite a página, adicione um bloco <strong>HTML personalizado</strong> e cole o código. O formulário aparece dentro do site e cada envio cai nesta aba.
      </p>
      {blocos.map(b => (
        <div key={b.titulo} className={card}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-app-text flex items-center gap-1.5"><Code2 className="h-4 w-4 text-app-subtle" /> {b.titulo}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(b.texto).then(onCopiado).catch(() => {}) }}
              className="flex items-center gap-1 rounded-md border border-app-border2 px-2 py-1 text-xs text-app-muted hover:bg-app-surface2"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </button>
          </div>
          {b.nota && <p className="text-xs text-app-subtle">{b.nota}</p>}
          <pre className="whitespace-pre-wrap break-all rounded-md bg-app-bg border border-app-border2 p-2 text-[11px] text-app-text2">{b.texto}</pre>
        </div>
      ))}
      <p className="text-xs text-app-subtle">
        Links diretos (para WhatsApp, Instagram ou botão no site): {origem}/orcamento · {origem}/anuncie
      </p>
    </div>
  )
}
