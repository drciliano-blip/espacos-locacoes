'use client'

// Cartão de ação que o assistente propõe no chat. Não grava nada sozinho:
// abre a MESMA janela que o sistema já usa para a tarefa (painel do evento,
// "Editar parcela", "Nova Conta a Pagar"), já no ponto certo, com as
// validações, travas e registros de sempre e as permissões de quem clicou.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, FileSignature, Ban, Banknote, Receipt, ExternalLink, CheckCircle2 } from 'lucide-react'
import { useEventos } from '@/contexts/EventosContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useRepasses } from '@/contexts/RepassesContext'
import { aplicarBaixaComRepasseAutomatico } from '@/lib/repasse-socio'
import EventoDrawer from '@/components/eventos/EventoDrawer'
import { EditarParcelaModal } from '@/components/eventos/PlanoPagamentoSection'
import type { AcaoProposta } from '@/lib/assistente/ferramentas'

export type AcaoSistema = Exclude<AcaoProposta, { tipo: 'pre_evento' }>

const btn = 'inline-flex items-center gap-1.5 rounded-lg bg-[#072A43] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50'

export default function CartaoAcaoSistema({ acao, feita, onFeita }: { acao: AcaoSistema; feita?: boolean; onFeita?: () => void }) {
  const router = useRouter()
  const { eventos, updateEvento, deleteEvento } = useEventos()
  const { receitas, updateReceita } = useReceitas()
  const { repasses, addRepasse } = useRepasses()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const icone = acao.tipo === 'baixa' ? Banknote : acao.tipo === 'conta' ? Receipt
    : acao.acao === 'gerar_contrato' ? FileSignature : acao.acao === 'cancelar' ? Ban : CalendarClock
  const Icone = icone
  const rotulo = acao.tipo === 'baixa' ? 'Abrir e dar baixa' : acao.tipo === 'conta' ? 'Abrir em Contas a Pagar'
    : { gerar_contrato: 'Abrir e gerar contrato', cancelar: 'Abrir cancelamento', reagendar: 'Abrir e alterar data', converter: 'Abrir e confirmar', ver: 'Abrir evento' }[acao.acao]

  function abrir() {
    setErro(null)
    if (acao.tipo === 'conta') {
      const c = acao.campos
      const q = new URLSearchParams({ nova: '1', descricao: c.descricao, valor: String(c.valor), vencimento: c.vencimento, categoria: c.categoria, subcategoria: c.subcategoria, espaco: c.espaco, ...(c.fornecedor ? { fornecedor: c.fornecedor } : {}), ...(c.observacoes ? { observacoes: c.observacoes } : {}) })
      onFeita?.()
      router.push(`/contas-a-pagar?${q.toString()}`)
      return
    }
    if (acao.tipo === 'evento' && !eventos.some(e => e.id === acao.eventoId)) { setErro('Evento ainda carregando ou sem acesso. Tente de novo em instantes.'); return }
    if (acao.tipo === 'baixa' && !receitas.some(r => r.id === acao.receitaId)) { setErro('Parcela ainda carregando ou sem acesso. Tente de novo em instantes.'); return }
    setAberto(true)
  }

  const evento = acao.tipo === 'evento' ? eventos.find(e => e.id === acao.eventoId) : undefined
  const parcela = acao.tipo === 'baixa' ? receitas.find(r => r.id === acao.receitaId) : undefined

  return (
    <div className="mt-2 rounded-lg border border-[#072A43]/20 bg-app-surface p-2.5 text-app-text">
      <p className="flex items-center gap-1.5 text-sm"><Icone className="h-4 w-4 text-[#9A7937]" /> {acao.resumo}</p>
      {feita
        ? <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Feito.</p>
        : <button type="button" onClick={abrir} className={`${btn} mt-1.5`}><ExternalLink className="h-3.5 w-3.5" /> {rotulo}</button>}
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}

      {aberto && evento && acao.tipo === 'evento' && (
        <EventoDrawer
          evento={evento}
          acaoInicial={acao.acao === 'ver' ? undefined : acao.acao}
          novaData={acao.novaData}
          onClose={() => setAberto(false)}
          onUpdate={async ev => { await updateEvento(ev) }}
          onDelete={async (id, motivo) => { await deleteEvento(id, motivo); setAberto(false); onFeita?.() }}
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
