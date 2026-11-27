'use client'

// Cartão de ação que o assistente propõe no chat. Nada grava sem o toque de
// quem confere. Baixa de parcela, conta a pagar, alteração de evento e conta
// paga pelo extrato gravam direto do cartão (com Desfazer e registro no
// histórico); o resto abre a MESMA janela que o sistema já usa para a tarefa
// (painel do evento, "Editar parcela", "Nova Conta a Pagar", "Dar baixa",
// "Fechar Período", "+ Aporte"/"+ Retirada"), já no ponto certo, com as
// validações, travas e registros de sempre e as permissões de quem clicou.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarClock, FileSignature, Ban, Banknote, Receipt, ExternalLink, CheckCircle2, FileText, CalendarPlus, Loader2, Undo2, AlertTriangle,
  PencilLine, MessageSquareText, Copy, Download, Eye, ListOrdered, Lock, Users, type LucideIcon,
} from 'lucide-react'
import { useEventos } from '@/contexts/EventosContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useRepasses } from '@/contexts/RepassesContext'
import { aplicarBaixaComRepasseAutomatico } from '@/lib/repasse-socio'
import EventoDrawer from '@/components/eventos/EventoDrawer'
import NovoEventoModal from '@/components/eventos/NovoEventoModal'
import { EditarParcelaModal } from '@/components/eventos/PlanoPagamentoSection'
import type { AcaoProposta } from '@/lib/assistente/ferramentas'
import { mensagemDeErro, formatCurrency } from '@/lib/utils'
import { downloadFile, viewFile } from '@/lib/file-storage'
import type { Evento } from '@/types'
import { FORMAS_DIRETAS, hojeISO, useExecutorAcoes } from './executor'
import { createClient } from '@/lib/supabase/client'
import { novoNumero } from '@/lib/assistente/orcamento'

export type AcaoSistema = Exclude<AcaoProposta, { tipo: 'pre_evento' }>

const btn = 'inline-flex items-center gap-1.5 rounded-lg bg-[#072A43] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50'
const btnSec = 'inline-flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-3 py-1.5 text-xs font-semibold text-app-text disabled:opacity-50'
const campo = 'rounded-lg border border-app-border2 bg-app-surface px-2 py-1 text-xs text-app-text'
const brData = (d?: string) => (d ? d.split('-').reverse().join('/') : '')

// Telefone para o link do WhatsApp (Brasil por padrão).
function linkWhatsapp(telefone: string, texto: string) {
  const d = telefone.replace(/\D/g, '')
  const num = d.length === 10 || d.length === 11 ? `55${d}` : d
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}

function IconeAcao({ acao }: { acao: AcaoSistema }) {
  const Icone = iconeDe(acao)
  return <Icone className="h-4 w-4 shrink-0 text-[#9A7937]" />
}

function iconeDe(acao: AcaoSistema): LucideIcon {
  switch (acao.tipo) {
    case 'cadastro_evento': return CalendarPlus
    case 'baixa': return Banknote
    case 'conta': case 'baixa_conta': return Receipt
    case 'atendimento': return FileText
    case 'editar_evento': return PencilLine
    case 'mensagem': return MessageSquareText
    case 'arquivo': return FileText
    case 'plano': return ListOrdered
    case 'fechamento': return Lock
    case 'socio': return Users
    case 'evento': return acao.acao === 'gerar_contrato' ? FileSignature : acao.acao === 'cancelar' ? Ban : CalendarClock
  }
}

function rotuloDe(acao: AcaoSistema): string {
  switch (acao.tipo) {
    case 'cadastro_evento': return 'Abrir cadastro do evento'
    case 'baixa': return 'Abrir e dar baixa'
    case 'conta': return 'Abrir em Contas a Pagar'
    case 'baixa_conta': return 'Abrir e dar baixa (com comprovante)'
    case 'atendimento': return 'Abrir e montar o orçamento'
    case 'editar_evento': return 'Abrir para ajustar'
    case 'plano': return 'Abrir e conferir o plano'
    case 'fechamento': return 'Abrir "Fechar Período"'
    case 'socio': return acao.lancamento === 'aporte' ? 'Abrir "+ Aporte" preenchido' : 'Abrir "+ Retirada" preenchida'
    case 'mensagem': case 'arquivo': return ''
    case 'evento': return { gerar_contrato: 'Abrir e gerar contrato', cancelar: 'Abrir cancelamento', reagendar: 'Abrir e alterar data', converter: 'Abrir e confirmar', ver: 'Abrir evento' }[acao.acao]
  }
}

// onFeita recebe a função de desfazer quando a ação gravou direto do cartão;
// quem guarda o cartão devolve em `desfazer` (some ao recarregar a página).
// onValores: avisa a data e a forma que a pessoa deixou no cartão de baixa
// (o "Confirmar as N baixas" usa esses valores); bloqueado: trava os botões
// enquanto a confirmação em lote está gravando.
export default function CartaoAcaoSistema({ acao, feita, onFeita, desfazer, onDesfeita, onValores, bloqueado }: {
  acao: AcaoSistema; feita?: boolean; onFeita?: (desfazer?: () => Promise<void>) => void
  desfazer?: () => Promise<void>; onDesfeita?: () => void
  onValores?: (v: { dataPagamento: string; forma: string }) => void; bloqueado?: boolean
}) {
  const router = useRouter()
  const { eventos, updateEvento, deleteEvento, addEvento } = useEventos()
  const { receitas, updateReceita } = useReceitas()
  const { repasses, addRepasse } = useRepasses()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const exec = useExecutorAcoes()
  const [gravando, setGravando] = useState(false)
  const [dataPag, setDataPag] = useState(acao.tipo === 'baixa' ? (acao.dataPagamento ?? hojeISO()) : '')
  const [forma, setForma] = useState(acao.tipo === 'baixa' ? (acao.forma ?? '') : '')
  useEffect(() => { if (acao.tipo === 'baixa') onValores?.({ dataPagamento: dataPag, forma }) }, [dataPag, forma]) // eslint-disable-line react-hooks/exhaustive-deps
  const duplicada = acao.tipo === 'conta' ? exec.possivelDuplicada(acao) : undefined
  const direto = acao.tipo === 'baixa' || acao.tipo === 'editar_evento'
    || (acao.tipo === 'conta' && exec.podeLancarDireto(acao) && !duplicada)
    || (acao.tipo === 'baixa_conta' && !!acao.viaExtrato)

  async function gravarDireto() {
    setErro(null); setGravando(true)
    try {
      const volta = acao.tipo === 'baixa' ? await exec.darBaixa(acao, dataPag, forma)
        : acao.tipo === 'conta' ? await exec.lancarConta(acao)
        : acao.tipo === 'editar_evento' ? await exec.editarEvento(acao)
        : acao.tipo === 'baixa_conta' ? await exec.pagarContaPeloExtrato(acao)
        : undefined
      onFeita?.(volta)
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível gravar.'))
    } finally {
      setGravando(false)
    }
  }

  async function desfazerAgora() {
    if (!desfazer || !window.confirm('Desfazer esta ação?')) return
    setErro(null); setGravando(true)
    try { await desfazer(); onDesfeita?.() } catch (e) { setErro(mensagemDeErro(e, 'Não foi possível desfazer.')) } finally { setGravando(false) }
  }

  async function copiar(textoCopiar: string) {
    try { await navigator.clipboard.writeText(textoCopiar); setAviso('Copiado. Cole na conversa com o cliente.'); setTimeout(() => setAviso(null), 3000) } catch { setErro('Não foi possível copiar: selecione o texto e copie.') }
  }

  async function arquivo(como: 'ver' | 'baixar') {
    if (acao.tipo !== 'arquivo') return
    setErro(null)
    try { if (como === 'ver') await viewFile(acao.fileId); else await downloadFile(acao.fileId) } catch (e) { setErro(mensagemDeErro(e, 'Não foi possível abrir o arquivo.')) }
  }

  async function abrir() {
    setErro(null)
    if (acao.tipo === 'conta') {
      const c = acao.campos
      const q = new URLSearchParams({ nova: '1', descricao: c.descricao, valor: String(c.valor), vencimento: c.vencimento, categoria: c.categoria, subcategoria: c.subcategoria, espaco: c.espaco, ...(c.fornecedor ? { fornecedor: c.fornecedor } : {}), ...(c.observacoes ? { observacoes: c.observacoes } : {}) })
      // Não marca como feito: a conta só existe quando a pessoa salvar na tela.
      router.push(`/contas-a-pagar?${q.toString()}`)
      return
    }
    if (acao.tipo === 'baixa_conta') { router.push(`/contas-a-pagar?baixa=${encodeURIComponent(acao.contaId)}`); return }
    if (acao.tipo === 'fechamento') {
      router.push(`/fechamento?${new URLSearchParams({ espaco: acao.espaco, de: acao.de, ate: acao.ate, fechar: '1' }).toString()}`)
      return
    }
    if (acao.tipo === 'socio') {
      const q = new URLSearchParams({ espaco: acao.espaco, lancar: acao.lancamento, socio: acao.socio })
      if (acao.valor) q.set('valor', acao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
      if (acao.data) q.set('data', acao.data)
      if (acao.descricao) q.set('descricao', acao.descricao)
      router.push(`/fechamento?${q.toString()}`)
      return
    }
    if (acao.tipo === 'atendimento') {
      let id = acao.atendimentoId
      if (!id && acao.novo) {
        // O atendimento é criado agora, pelo toque de quem confere (com a sessão dela).
        setGravando(true)
        try {
          const sb = createClient()
          const { data: { session } } = await sb.auth.getSession()
          const { data, error } = await sb.from('assistente_atendimentos').insert({
            ...acao.novo, numero: `${novoNumero()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`, created_by: session?.user.id ?? null,
          }).select('id').single()
          if (error) throw error
          id = data.id as string
        } catch (e) {
          setErro(mensagemDeErro(e, 'Não foi possível abrir o atendimento.'))
          setGravando(false)
          return
        }
      }
      if (!id) return
      onFeita?.()
      router.push(`/assistente?atendimento=${id}&montar=1`)
      return
    }
    const idEvento = acao.tipo === 'evento' || acao.tipo === 'editar_evento' || acao.tipo === 'plano' ? acao.eventoId : undefined
    if (idEvento && !eventos.some(e => e.id === idEvento)) { setErro('Evento ainda carregando ou sem acesso. Tente de novo em instantes.'); return }
    if (acao.tipo === 'baixa' && !receitas.some(r => r.id === acao.receitaId)) { setErro('Parcela ainda carregando ou sem acesso. Tente de novo em instantes.'); return }
    setAberto(true)
  }

  const rotulo = rotuloDe(acao)
  const idEvento = acao.tipo === 'evento' || acao.tipo === 'editar_evento' || acao.tipo === 'plano' ? acao.eventoId : undefined
  const evento = idEvento ? eventos.find(e => e.id === idEvento) : undefined
  const parcela = acao.tipo === 'baixa' ? receitas.find(r => r.id === acao.receitaId) : undefined
  const rotuloDireto = acao.tipo === 'baixa' ? 'Confirmar baixa' : acao.tipo === 'editar_evento' ? 'Confirmar alteração' : acao.tipo === 'baixa_conta' ? 'Confirmar pagamento' : 'Lançar agora'

  return (
    <div className="mt-2 rounded-lg border border-[#072A43]/20 bg-app-surface p-2.5 text-app-text">
      <p className="flex items-center gap-1.5 text-sm"><IconeAcao acao={acao} /> {acao.resumo}</p>

      {/* Detalhes de cada tipo, antes dos botões. */}
      {acao.tipo === 'editar_evento' && (
        <ul className="mt-1 space-y-0.5 text-xs text-app-muted">{acao.mudancas.map(m => <li key={m}>• {m}</li>)}</ul>
      )}
      {acao.tipo === 'plano' && (
        <ul className="mt-1 space-y-0.5 text-xs text-app-muted">{acao.linhas.map(l => <li key={l}>• {l}</li>)}</ul>
      )}
      {acao.tipo === 'baixa_conta' && acao.viaExtrato && (
        <p className="mt-1 text-[11px] text-app-muted">Pago em {brData(acao.dataPagamento)} pelo extrato{acao.identificador ? ` · ${acao.identificador}` : ''}. Confira no banco antes de confirmar.</p>
      )}
      {acao.tipo === 'mensagem' && (
        <p className="mt-1.5 whitespace-pre-wrap rounded-md bg-app-surface2 px-2.5 py-2 text-xs [overflow-wrap:anywhere]">{acao.texto}</p>
      )}

      {acao.tipo === 'mensagem' ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => copiar(acao.texto)} className={btn}><Copy className="h-3.5 w-3.5" /> Copiar</button>
          {acao.telefone && <a href={linkWhatsapp(acao.telefone, acao.texto)} target="_blank" rel="noopener noreferrer" className={btnSec}><ExternalLink className="h-3.5 w-3.5" /> Abrir no WhatsApp</a>}
        </div>
      ) : acao.tipo === 'arquivo' ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => arquivo('ver')} className={btn}><Eye className="h-3.5 w-3.5" /> Abrir</button>
          <button type="button" onClick={() => arquivo('baixar')} className={btnSec}><Download className="h-3.5 w-3.5" /> Baixar</button>
        </div>
      ) : feita ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Feito{desfazer ? ' e registrado no histórico.' : '.'}</span>
          {desfazer && <button type="button" onClick={desfazerAgora} disabled={gravando || bloqueado} className={btnSec}><Undo2 className="h-3.5 w-3.5" /> Desfazer</button>}
        </div>
      ) : direto ? (
        <div className="mt-1.5 space-y-1.5">
          {acao.tipo === 'baixa' && <p className="text-[11px] text-app-muted">Confira o valor no extrato do banco antes de confirmar.</p>}
          {acao.tipo === 'baixa' && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-app-muted">
              <label className="inline-flex items-center gap-1">Pago em <input type="date" className={campo} value={dataPag} max={hojeISO()} onChange={e => setDataPag(e.target.value)} /></label>
              <select className={campo} value={forma} onChange={e => setForma(e.target.value)} aria-label="Forma de pagamento">
                <option value="">Forma de pagamento...</option>
                {FORMAS_DIRETAS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={gravarDireto} disabled={gravando || bloqueado || (acao.tipo === 'baixa' && (!forma || !dataPag))} className={btn}>
              {gravando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {rotuloDireto}
            </button>
            <button type="button" onClick={abrir} disabled={bloqueado} className={btnSec}><ExternalLink className="h-3.5 w-3.5" /> Abrir para ajustar</button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 space-y-1.5">
          {duplicada && (
            <p className="flex items-start gap-1 text-xs text-amber-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Parece já lançada: {duplicada.descricao} · {formatCurrency(duplicada.valor)} · venc. {duplicada.dataVencimento?.split('-').reverse().join('/')}. Confira na tela antes de lançar.</p>
          )}
          <button type="button" onClick={abrir} disabled={gravando} className={btn}>{gravando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />} {rotulo}</button>
        </div>
      )}
      {aviso && <p className="mt-1 text-xs text-emerald-700">{aviso}</p>}
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}

      {aberto && evento && (acao.tipo === 'evento' || acao.tipo === 'editar_evento' || acao.tipo === 'plano') && (
        <EventoDrawer
          evento={evento}
          acaoInicial={acao.tipo === 'editar_evento' ? 'editar' : acao.tipo === 'evento' && acao.acao !== 'ver' ? acao.acao : undefined}
          novaData={acao.tipo === 'evento' ? acao.novaData : undefined}
          alteracoes={acao.tipo === 'editar_evento' ? (acao.alteracoes as Partial<Evento>) : undefined}
          planoSugerido={acao.tipo === 'plano' ? acao.parcelas : undefined}
          onClose={() => setAberto(false)}
          onUpdate={async ev => { await updateEvento(ev) }}
          onDelete={async (id, motivo) => { await deleteEvento(id, motivo); setAberto(false); onFeita?.() }}
        />
      )}

      {aberto && acao.tipo === 'cadastro_evento' && (
        <NovoEventoModal
          fichaOrigem={acao.ficha}
          onClose={() => setAberto(false)}
          onSave={async ev => { await addEvento(ev); onFeita?.() }}
        />
      )}

      {aberto && parcela && (
        <div onClick={e => e.stopPropagation()}>
          <EditarParcelaModal
            parcela={parcela}
            dataEvento={eventos.find(e => e.id === parcela.eventoId)?.data}
            onClose={() => setAberto(false)}
            onSalvar={async patch => {
              await aplicarBaixaComRepasseAutomatico(parcela, patch, updateReceita, addRepasse, repasses)
              setAberto(false)
              if (patch.status === 'pago') onFeita?.()
            }}
          />
        </div>
      )}
    </div>
  )
}
