'use client'

import { useMemo, useState } from 'react'
import { X, Search, Download, Copy, MessageCircle, Banknote, Phone, Mail, CalendarDays, Users } from 'lucide-react'
import { useReceitas, receitaEmAtraso, type Receita, type BaixaReceitaInput } from '@/contexts/ReceitasContext'
import { useEventos } from '@/contexts/EventosContext'
import { useRepasses } from '@/contexts/RepassesContext'
import { aplicarBaixaComRepasseAutomatico } from '@/lib/repasse-socio'
import { downloadWorkbook } from '@/lib/xlsx-export'
import { formatCurrency, formatDate, hojeISO, mensagemDeErro } from '@/lib/utils'
import { EditarParcelaModal } from '@/components/eventos/PlanoPagamentoSection'
import Toast from '@/components/shared/Toast'
import type { Evento } from '@/types'

// Em que pé está o evento da parcela vencida — muda o que o financeiro faz:
// - futuro: a festa ainda vai acontecer e o pagamento não veio → cobrar já;
// - realizado: a festa já aconteceu → muitas vezes foi pago e ninguém deu
//   baixa; conferir no extrato antes de cobrar;
// - sem_evento: o evento foi excluído e a parcela ficou solta no banco
//   (evento_id vira null no delete) → provável sobra, conferir.
export type SituacaoAtraso = 'futuro' | 'realizado' | 'sem_evento'

export const SITUACOES: { valor: SituacaoAtraso; label: string; descricao: string }[] = [
  { valor: 'futuro',     label: 'Evento a acontecer',   descricao: 'O evento ainda vai acontecer e a parcela já venceu — cobrar o cliente.' },
  { valor: 'realizado',  label: 'Evento já realizado',  descricao: 'O evento já aconteceu — confira no extrato se foi pago e dê baixa, ou cobre o cliente.' },
  { valor: 'sem_evento', label: 'Sem evento vinculado', descricao: 'O evento destas parcelas foi excluído do sistema — confira se ainda são devidas.' },
]

// Uma parcela de cliente em atraso, já com os dados do evento que o
// financeiro precisa pra cobrar (contato, documento, data do evento).
export interface ParcelaEmAtraso {
  receita: Receita
  evento?: Evento
  cliente: string
  nomeEvento: string
  dataEvento?: string
  telefone?: string
  email?: string
  documento?: string
  diasAtraso: number
  situacao: SituacaoAtraso
}

interface GrupoCliente {
  chave: string
  cliente: string
  nomeEvento: string
  dataEvento?: string
  telefone?: string
  email?: string
  documento?: string
  espaco?: string
  parcelas: ParcelaEmAtraso[]
  total: number
  maiorAtraso: number
}

function diasEntre(de: string, ate: string): number {
  const [y1, m1, d1] = de.split('-').map(Number)
  const [y2, m2, d2] = ate.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

function nomeParcela(r: Receita): string {
  return r.parcelaLabel ?? r.descricao
}

// Lista única de parcelas de cliente em atraso — usada tanto pelo card do
// topo de Contas a Pagar quanto pela janela, pra os dois totais sempre
// baterem. Só receita de evento (aporte/outras entradas não se cobram de
// cliente), fora de evento cancelado, dentro do espaço ativo.
export function useParcelasEmAtraso(espacosEmEscopo: string[] | undefined): ParcelaEmAtraso[] {
  const { receitas } = useReceitas()
  const { eventos } = useEventos()

  return useMemo(() => {
    const hoje = hojeISO()
    const eventosPorId = new Map(eventos.map(e => [e.id, e]))
    const cancelados = new Set(eventos.filter(e => e.status === 'cancelado').map(e => e.id))
    return receitas
      .filter(r => r.tipoEntrada === 'evento' && receitaEmAtraso(r, cancelados))
      .filter(r => !espacosEmEscopo || (!!r.espaco && espacosEmEscopo.includes(r.espaco)))
      .map(r => {
        const ev = r.eventoId ? eventosPorId.get(r.eventoId) : undefined
        return {
          receita: r,
          evento: ev,
          cliente: ev?.cliente ?? r.cliente ?? r.descricao,
          nomeEvento: ev?.nomeEvento || ev?.tipo || '',
          dataEvento: ev?.data,
          telefone: ev?.telefoneContato,
          email: ev?.email,
          documento: ev?.pessoaJuridica ? ev?.cnpj : ev?.cpf,
          // Marcada como "atrasado" à mão antes de vencer: conta 0 dia, nunca negativo.
          diasAtraso: Math.max(0, diasEntre(r.data, hoje)),
          // Evento do próprio dia ainda conta como "a acontecer".
          situacao: (!ev ? 'sem_evento' : ev.data >= hoje ? 'futuro' : 'realizado') as SituacaoAtraso,
        }
      })
  }, [receitas, eventos, espacosEmEscopo])
}

function agruparPorCliente(itens: ParcelaEmAtraso[]): GrupoCliente[] {
  const grupos = new Map<string, GrupoCliente>()
  for (const it of itens) {
    const chave = it.receita.eventoId ?? `cliente:${it.cliente}`
    let g = grupos.get(chave)
    if (!g) {
      g = {
        chave, cliente: it.cliente, nomeEvento: it.nomeEvento, dataEvento: it.dataEvento,
        telefone: it.telefone, email: it.email, documento: it.documento, espaco: it.receita.espaco,
        parcelas: [], total: 0, maiorAtraso: 0,
      }
      grupos.set(chave, g)
    }
    g.parcelas.push(it)
    g.total += it.receita.valor
    g.maiorAtraso = Math.max(g.maiorAtraso, it.diasAtraso)
  }
  for (const g of grupos.values()) g.parcelas.sort((a, b) => a.receita.data.localeCompare(b.receita.data))
  return [...grupos.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'))
}

function mensagemCobranca(g: GrupoCliente): string {
  const evento = [g.nomeEvento, g.dataEvento ? `de ${formatDate(g.dataEvento)}` : '', g.espaco ? `no ${g.espaco}` : '']
    .filter(Boolean).join(' ')
  const linhas = g.parcelas.map(p => `• ${nomeParcela(p.receita)} — venc. ${formatDate(p.receita.data)} — ${formatCurrency(p.receita.valor)}`)
  return [
    `Olá, ${g.cliente}! Tudo bem?`,
    '',
    `Identificamos ${g.parcelas.length > 1 ? 'parcelas em aberto' : 'uma parcela em aberto'} referente${g.parcelas.length > 1 ? 's' : ''} ao seu evento${evento ? ` ${evento}` : ''}:`,
    ...linhas,
    '',
    `Total em aberto: ${formatCurrency(g.total)}`,
    '',
    'Poderia nos informar a previsão de pagamento? Caso já tenha pago, por favor nos envie o comprovante. Obrigado!',
  ].join('\n')
}

function linkWhatsApp(telefone: string, texto: string): string | null {
  let digitos = telefone.replace(/\D/g, '')
  if (digitos.length < 10) return null
  if (!digitos.startsWith('55') || digitos.length <= 11) digitos = `55${digitos}`
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`
}

const ORDEM_SITUACAO: Record<SituacaoAtraso, number> = { futuro: 0, realizado: 1, sem_evento: 2 }
const LABEL_SITUACAO = Object.fromEntries(SITUACOES.map(s => [s.valor, s.label])) as Record<SituacaoAtraso, string>

// Exporta as três seções (com a coluna Situação), não só a aberta na tela —
// a planilha é a lista de trabalho completa do financeiro.
function exportarExcel(itens: ParcelaEmAtraso[]) {
  const ordenados = [...itens].sort((a, b) =>
    ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] || a.receita.data.localeCompare(b.receita.data))
  const grupos = agruparPorCliente(ordenados).sort((a, b) =>
    ORDEM_SITUACAO[a.parcelas[0].situacao] - ORDEM_SITUACAO[b.parcelas[0].situacao] || a.cliente.localeCompare(b.cliente, 'pt-BR'))
  const parcelas: (string | number)[][] = [
    ['Situação', 'Cliente', 'Evento', 'Data do evento', 'Espaço', 'Telefone', 'E-mail', 'CPF/CNPJ', 'Parcela', 'Vencimento', 'Dias em atraso', 'Valor (R$)'],
    ...ordenados.map(p => [
      LABEL_SITUACAO[p.situacao], p.cliente, p.nomeEvento, p.dataEvento ? formatDate(p.dataEvento) : '', p.receita.espaco ?? '',
      p.telefone ?? '', p.email ?? '', p.documento ?? '', nomeParcela(p.receita),
      formatDate(p.receita.data), p.diasAtraso, p.receita.valor,
    ]),
    [],
    ['', '', '', '', '', '', '', '', '', '', 'Total', ordenados.reduce((s, p) => s + p.receita.valor, 0)],
  ]
  const resumo: (string | number)[][] = [
    ['Situação', 'Cliente', 'Evento', 'Data do evento', 'Espaço', 'Telefone', 'E-mail', 'CPF/CNPJ', 'Parcelas em atraso', 'Vencimento mais antigo', 'Maior atraso (dias)', 'Total em atraso (R$)'],
    ...grupos.map(g => [
      LABEL_SITUACAO[g.parcelas[0].situacao], g.cliente, g.nomeEvento, g.dataEvento ? formatDate(g.dataEvento) : '', g.espaco ?? '',
      g.telefone ?? '', g.email ?? '', g.documento ?? '', g.parcelas.length,
      formatDate(g.parcelas[0].receita.data), g.maiorAtraso, g.total,
    ]),
  ]
  downloadWorkbook(
    [{ name: 'Parcelas em atraso', rows: parcelas }, { name: 'Resumo por cliente', rows: resumo }],
    `cobranca-clientes-em-atraso-${hojeISO()}.xlsx`,
  )
}

export default function CobrancaClientesModal({ itens, onClose }: { itens: ParcelaEmAtraso[]; onClose: () => void }) {
  const { updateReceita } = useReceitas()
  const { repasses, addRepasse } = useRepasses()
  const [visao, setVisao] = useState<'cliente' | 'data'>('cliente')
  // Abre na seção mais urgente que tiver algo.
  const [secao, setSecao] = useState<SituacaoAtraso>(() =>
    SITUACOES.find(s => itens.some(p => p.situacao === s.valor))?.valor ?? 'futuro')
  const [busca, setBusca] = useState('')
  const [baixando, setBaixando] = useState<Receita | null>(null)
  const [toast, setToast] = useState<{ msg: string; tipo: 'success' | 'error' } | null>(null)

  function showToast(msg: string, tipo: 'success' | 'error' = 'success') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return itens.filter(p => p.situacao === secao
      && (!q || `${p.cliente} ${p.nomeEvento} ${p.telefone ?? ''}`.toLowerCase().includes(q)))
  }, [itens, busca, secao])
  const resumoSecoes = useMemo(() => SITUACOES.map(s => {
    const daSecao = itens.filter(p => p.situacao === s.valor)
    return { ...s, qtd: daSecao.length, total: daSecao.reduce((t, p) => t + p.receita.valor, 0) }
  }), [itens])
  const secaoAtual = SITUACOES.find(s => s.valor === secao) ?? SITUACOES[0]

  const grupos = useMemo(() => agruparPorCliente(filtrados), [filtrados])
  const porData = useMemo(() => {
    const mapa = new Map<string, ParcelaEmAtraso[]>()
    for (const p of [...filtrados].sort((a, b) => a.receita.data.localeCompare(b.receita.data) || a.cliente.localeCompare(b.cliente, 'pt-BR'))) {
      mapa.set(p.receita.data, [...(mapa.get(p.receita.data) ?? []), p])
    }
    return [...mapa.entries()]
  }, [filtrados])
  const grupoPorChave = useMemo(() => new Map(agruparPorCliente(itens).map(g => [g.chave, g])), [itens])

  const total = filtrados.reduce((s, p) => s + p.receita.valor, 0)
  const qtdClientes = grupos.length
  const maiorAtraso = filtrados.reduce((m, p) => Math.max(m, p.diasAtraso), 0)

  async function copiar(g: GrupoCliente) {
    try {
      await navigator.clipboard.writeText(mensagemCobranca(g))
      showToast('Mensagem de cobrança copiada.')
    } catch {
      showToast('Não foi possível copiar a mensagem.', 'error')
    }
  }

  async function salvarBaixa(parcela: Receita, patch: BaixaReceitaInput) {
    try {
      await aplicarBaixaComRepasseAutomatico(parcela, patch, updateReceita, addRepasse, repasses)
      showToast(patch.status === 'pago' ? 'Baixa registrada.' : 'Parcela atualizada.')
    } catch (err) {
      showToast(mensagemDeErro(err, 'Falha ao registrar a baixa.'), 'error')
      throw err
    }
  }

  function acoesCliente(g: GrupoCliente) {
    const wa = g.telefone ? linkWhatsApp(g.telefone, mensagemCobranca(g)) : null
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => copiar(g)} title="Copiar mensagem de cobrança"
          className="flex items-center gap-1 rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1 text-xs text-app-text hover:bg-app-surface2 transition-colors">
          <Copy className="h-3.5 w-3.5" /> Copiar cobrança
        </button>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" title="Abrir conversa no WhatsApp com a mensagem pronta"
            className="flex items-center gap-1 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-2.5 py-1 text-xs font-medium text-[#128C7E] hover:bg-[#25D366]/20 transition-colors">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        )}
      </div>
    )
  }

  function botaoBaixa(r: Receita) {
    return (
      <button onClick={() => setBaixando(r)}
        className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 transition-colors">
        <Banknote className="h-3.5 w-3.5" /> Dar baixa
      </button>
    )
  }

  function atraso(dias: number) {
    return <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 whitespace-nowrap">{dias} {dias === 1 ? 'dia' : 'dias'}</span>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-2xl border border-app-border bg-app-surface shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-app-border">
          <div>
            <p className="text-base font-semibold text-app-text">Clientes em atraso</p>
            <p className="text-xs text-app-muted mt-0.5">Parcelas de eventos vencidas e não pagas.</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Seções */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 pt-4">
          {resumoSecoes.map(s => (
            <button key={s.valor} type="button" onClick={() => setSecao(s.valor)}
              className={`rounded-xl border p-3 text-left transition-colors ${secao === s.valor
                ? (s.valor === 'futuro' ? 'border-red-500/60 bg-red-500/10' : 'border-amber-500/60 bg-amber-500/10')
                : 'border-app-border hover:bg-app-surface2/60'}`}>
              <p className={`text-xs font-medium ${s.valor === 'futuro' ? 'text-red-600' : 'text-amber-600'}`}>{s.label}</p>
              <p className="text-sm font-bold text-app-text">{formatCurrency(s.total)}</p>
              <p className="text-xs text-app-muted">{s.qtd} {s.qtd === 1 ? 'parcela' : 'parcelas'}</p>
            </button>
          ))}
        </div>
        <p className="px-5 pt-2 text-xs text-app-muted">{secaoAtual.descricao}</p>

        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-5 pt-3">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-xs text-red-600">Total da seção</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(total)}</p>
          </div>
          <div className="rounded-xl border border-app-border bg-app-surface2/40 p-3">
            <p className="text-xs text-app-muted">Clientes / parcelas</p>
            <p className="text-lg font-bold text-app-text">{qtdClientes} / {filtrados.length}</p>
          </div>
          <div className="rounded-xl border border-app-border bg-app-surface2/40 p-3">
            <p className="text-xs text-app-muted">Maior atraso</p>
            <p className="text-lg font-bold text-app-text">{maiorAtraso} {maiorAtraso === 1 ? 'dia' : 'dias'}</p>
          </div>
        </div>

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <div className="flex rounded-lg border border-app-border2 p-0.5">
            {([['cliente', 'Por cliente', Users], ['data', 'Por vencimento', CalendarDays]] as const).map(([v, label, Icon]) => (
              <button key={v} onClick={() => setVisao(v)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${visao === v ? 'bg-[#25D366]/15 text-[#128C7E]' : 'text-app-muted hover:text-app-text'}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-subtle" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente, evento ou telefone"
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 pl-8 pr-2.5 py-1.5 text-sm text-app-text focus:outline-none" />
          </div>
          <button onClick={() => exportarExcel(itens)} disabled={itens.length === 0} title="Exporta as três seções, com a coluna Situação"
            className="flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-3 py-1.5 text-sm font-medium text-app-text hover:bg-app-surface2 transition-colors disabled:opacity-50">
            <Download className="h-4 w-4 text-[#25D366]" /> Exportar Excel
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
          {filtrados.length === 0 ? (
            <p className="py-10 text-center text-sm text-app-subtle">
              {itens.length === 0 ? 'Nenhum cliente em atraso 🎉' : busca.trim() ? 'Nenhum resultado para a busca.' : 'Nada nesta seção.'}
            </p>
          ) : visao === 'cliente' ? (
            grupos.map(g => (
              <div key={g.chave} className="rounded-xl border border-app-border">
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 bg-app-surface2/40 rounded-t-xl">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-app-text">{g.cliente}</p>
                    <p className="text-xs text-app-muted mt-0.5">
                      {[g.nomeEvento, g.dataEvento ? `Evento em ${formatDate(g.dataEvento)}` : '', g.espaco].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-app-subtle">
                      {g.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{g.telefone}</span>}
                      {g.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{g.email}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <p className="text-sm font-bold text-red-600">{formatCurrency(g.total)}</p>
                    {acoesCliente(g)}
                  </div>
                </div>
                <div className="divide-y divide-app-border/50">
                  {g.parcelas.map(p => (
                    <div key={p.receita.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-[140px]">
                        <p className="text-sm text-app-text">{nomeParcela(p.receita)}</p>
                        <p className="text-xs text-app-subtle">Venceu {formatDate(p.receita.data)}</p>
                      </div>
                      {atraso(p.diasAtraso)}
                      <p className="w-28 text-right text-sm font-semibold text-app-text">{formatCurrency(p.receita.valor)}</p>
                      {botaoBaixa(p.receita)}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            porData.map(([data, parcelas]) => (
              <div key={data} className="rounded-xl border border-app-border">
                <div className="flex items-center justify-between px-4 py-2.5 bg-app-surface2/40 rounded-t-xl">
                  <p className="text-sm font-semibold text-app-text">Vencimento {formatDate(data)} <span className="ml-1 font-normal text-xs text-app-muted">· {parcelas[0].diasAtraso} {parcelas[0].diasAtraso === 1 ? 'dia' : 'dias'} de atraso</span></p>
                  <p className="text-sm font-bold text-red-600">{formatCurrency(parcelas.reduce((s, p) => s + p.receita.valor, 0))}</p>
                </div>
                <div className="divide-y divide-app-border/50">
                  {parcelas.map(p => {
                    const g = grupoPorChave.get(p.receita.eventoId ?? `cliente:${p.cliente}`)
                    return (
                      <div key={p.receita.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-[180px]">
                          <p className="text-sm font-medium text-app-text">{p.cliente}</p>
                          <p className="text-xs text-app-subtle">
                            {[p.nomeEvento, p.dataEvento ? `Evento em ${formatDate(p.dataEvento)}` : '', nomeParcela(p.receita), p.telefone].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <p className="w-28 text-right text-sm font-semibold text-app-text">{formatCurrency(p.receita.valor)}</p>
                        {g && acoesCliente(g)}
                        {botaoBaixa(p.receita)}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-app-border">
          <p className="text-xs text-app-muted">{filtrados.length} {filtrados.length === 1 ? 'parcela' : 'parcelas'} em atraso</p>
          <p className="text-sm font-semibold text-app-text">Total: <span className="text-red-600">{formatCurrency(total)}</span></p>
        </div>
      </div>

      {baixando && (
        <div onClick={e => e.stopPropagation()}>
          <EditarParcelaModal parcela={baixando} onClose={() => setBaixando(null)} onSalvar={patch => salvarBaixa(baixando, patch)} />
        </div>
      )}
      <Toast message={toast?.msg ?? null} type={toast?.tipo} />
    </div>
  )
}
