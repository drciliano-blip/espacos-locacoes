'use client'

import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import CalendarView from '@/components/agenda/CalendarView'
import ConsultarDisponibilidadeSection from '@/components/agenda/ConsultarDisponibilidadeSection'
import EventList, { type AbaAgenda } from '@/components/agenda/EventList'
import ExportarPdfAgendaModal, { type CamposPdfAgenda, CAMPOS_PDF_PADRAO } from '@/components/agenda/ExportarPdfAgendaModal'
import EspacoGoogleCalendar from '@/components/espacos/EspacoGoogleCalendar'
import EventoDrawer from '@/components/eventos/EventoDrawer'
import NovoEventoModal from '@/components/eventos/NovoEventoModal'
import ExportarRelatorioButton from '@/components/relatorios/ExportarRelatorioButton'
import FullTable from '@/components/shared/FullTable'
import Toast from '@/components/shared/Toast'
import { useEventos } from '@/contexts/EventosContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useCurrentUser } from '@/contexts/UserContext'
import { useEspacoAtivo, MSG_ESPACO_ESPECIFICO_NECESSARIO } from '@/contexts/EspacoAtivoContext'
import { useEspacos } from '@/contexts/EspacosContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { downloadWorkbook, type ExportSheet } from '@/lib/xlsx-export'
import type { Evento, Espaco } from '@/types'

const statusLabelEvento: Record<string, string> = { confirmado: 'Confirmado', cancelado: 'Cancelado' }

function contatoLabel(evento: Evento): string {
  if (!evento.responsavel) return '—'
  return evento.telefoneContato ? `${evento.responsavel} · ${evento.telefoneContato}` : evento.responsavel
}

// Um evento do próprio dia só vira "passado" depois que o horário de término dele já
// passou — antes disso, mesmo sendo hoje, ainda conta como "próximo".
function isEventoPassado(evento: Evento, agora: Date): boolean {
  const [y, m, d] = evento.data.split('-').map(Number)
  const dataEvento = new Date(y, m - 1, d)
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  if (dataEvento.getTime() !== hoje.getTime()) return dataEvento.getTime() < hoje.getTime()
  if (!evento.horaFim) return false
  const [hh, mm] = evento.horaFim.split(':').map(Number)
  const fimEvento = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), hh || 0, mm || 0)
  return agora.getTime() > fimEvento.getTime()
}

export default function AgendaPage() {
  const { eventos, addEvento, updateEvento, deleteEvento } = useEventos()
  const { receitas } = useReceitas()
  const { role } = useCurrentUser()
  const { espacosEmEscopo, espacoUnico, precisaEspacoEspecifico } = useEspacoAtivo()
  const { espacosConfig } = useEspacos()
  const espacoAtivoConfig = espacosConfig.find(e => e.nome === espacoUnico)

  const [abaPrincipal, setAbaPrincipal] = useState<'agenda' | 'disponibilidade'>('agenda')
  const [selectedDate, setSelectedDate]     = useState<Date | null>(null)
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null)
  const [novoEventoOpen, setNovoEventoOpen] = useState(false)
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [camposPdf, setCamposPdf] = useState<CamposPdfAgenda>(CAMPOS_PDF_PADRAO)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const eventosFiltrados = useMemo(() => {
    if (!espacosEmEscopo) return eventos
    return eventos.filter(e => espacosEmEscopo.includes(e.espaco))
  }, [eventos, espacosEmEscopo])

  // Mês navegado no CalendarView — só usado quando a aba "mes" está ativa
  // (as outras duas abas, Próximos/Passados, não dependem de mês nenhum).
  const [mesExibido, setMesExibido] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  })
  const [aba, setAba] = useState<AbaAgenda>('proximos')

  const espacosLabel = espacoUnico ?? (espacosEmEscopo?.length ? espacosEmEscopo.join(', ') : 'Todos os espaços')
  const mesAnoLabel = format(mesExibido, 'MMMM yyyy', { locale: ptBR })

  // Lista efetivamente exibida na tela — dia selecionado no calendário tem
  // prioridade; senão segue a aba ativa (próximos/passados/mês). Esse é o
  // ÚNICO lugar que decide "o que está na tela": tanto o EventList quanto a
  // exportação usam exatamente esta lista, nunca um cálculo à parte — é
  // assim que a exportação nunca mais diverge do filtro aplicado.
  const eventosExibidos = useMemo(() => {
    if (selectedDate) {
      return eventosFiltrados.filter(e => {
        const [y, m, d] = e.data.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        return date.getFullYear() === selectedDate.getFullYear() && date.getMonth() === selectedDate.getMonth() && date.getDate() === selectedDate.getDate()
      })
    }
    if (aba === 'mes') {
      return eventosFiltrados
        .filter(e => {
          const [y, m] = e.data.split('-').map(Number)
          return y === mesExibido.getFullYear() && m === mesExibido.getMonth() + 1
        })
        .slice()
        .sort((a, b) => a.data.localeCompare(b.data))
    }
    const agora = new Date()
    const proximos = eventosFiltrados.filter(e => !isEventoPassado(e, agora)).sort((a, b) => a.data.localeCompare(b.data))
    const passados = eventosFiltrados.filter(e => isEventoPassado(e, agora)).sort((a, b) => b.data.localeCompare(a.data))
    return aba === 'proximos' ? proximos : passados
  }, [eventosFiltrados, selectedDate, aba, mesExibido])

  // Título do filtro atual — usado tanto no cabeçalho impresso quanto na
  // planilha Excel, pra deixar explícito exatamente o que foi exportado.
  const tituloFiltro = selectedDate
    ? `Eventos em ${formatDate(selectedDate.toISOString().split('T')[0])}`
    : aba === 'mes' ? `Eventos de ${mesAnoLabel}`
    : aba === 'proximos' ? 'Próximos Eventos'
    : 'Eventos Passados'

  // Relação exibida — valor recebido/a receber derivados ao vivo do
  // ReceitasContext, igual ao resto do app (nunca armazenados no Evento,
  // sempre a soma das receitas pagas dele).
  const relacaoExibida = useMemo(() => eventosExibidos.map(e => {
    const valorRecebido = receitas.filter(r => r.eventoId === e.id && r.status === 'pago').reduce((s, r) => s + r.valor, 0)
    return { evento: e, valorRecebido, valorAReceber: e.valor - valorRecebido }
  }), [eventosExibidos, receitas])

  const totaisExibidos = useMemo(() => ({
    quantidade: relacaoExibida.length,
    valorTotalContratado: relacaoExibida.reduce((s, r) => s + r.evento.valor, 0),
    totalRecebido: relacaoExibida.reduce((s, r) => s + r.valorRecebido, 0),
    totalAReceber: relacaoExibida.reduce((s, r) => s + r.valorAReceber, 0),
  }), [relacaoExibida])

  function handleExportExcelRelacao() {
    const sheet: ExportSheet = {
      name: 'Relação Agenda',
      rows: [
        ['Filtro aplicado', tituloFiltro],
        ['Espaço', espacosLabel],
        [],
        ['Data', 'Nome do Evento', 'Valor Total', 'Status', 'Valor Recebido', 'Valor a Receber', 'Contato Responsável'],
        ...relacaoExibida.map(r => [
          formatDate(r.evento.data), r.evento.cliente, r.evento.valor,
          statusLabelEvento[r.evento.status] ?? r.evento.status, r.valorRecebido, r.valorAReceber, contatoLabel(r.evento),
        ]),
        [],
        ['Quantidade total de eventos', totaisExibidos.quantidade],
        ['Valor total contratado', totaisExibidos.valorTotalContratado],
        ['Total recebido', totaisExibidos.totalRecebido],
        ['Total a receber', totaisExibidos.totalAReceber],
      ],
    }
    const sufixo = selectedDate
      ? selectedDate.toISOString().split('T')[0]
      : aba === 'mes' ? format(mesExibido, 'yyyy-MM') : aba
    downloadWorkbook([sheet], `relacao-agenda-${sufixo}.xlsx`)
  }

  // Colunas do PDF — só as marcadas no modal "Exportar PDF" entram no
  // relatório impresso, nessa ordem fixa. Excel não passa por aqui: continua
  // trazendo tudo, é o export "completo" pra uso interno.
  const pdfColunas = useMemo(() => {
    const todas: { key: keyof CamposPdfAgenda; header: string; cell: (r: (typeof relacaoExibida)[number]) => string }[] = [
      { key: 'data', header: 'Data', cell: r => formatDate(r.evento.data) },
      { key: 'nome', header: 'Nome do Evento', cell: r => r.evento.cliente },
      { key: 'status', header: 'Status', cell: r => statusLabelEvento[r.evento.status] ?? r.evento.status },
      { key: 'valor', header: 'Valor Negociado', cell: r => formatCurrency(r.evento.valor) },
      { key: 'contato', header: 'Contato Responsável', cell: r => contatoLabel(r.evento) },
    ]
    return todas.filter(c => camposPdf[c.key])
  }, [camposPdf, relacaoExibida])

  function handleConfirmarPdf(campos: CamposPdfAgenda) {
    setCamposPdf(campos)
    setPdfModalOpen(false)
    setTimeout(() => window.print(), 60)
  }

  async function handleUpdate(updated: Evento) {
    await updateEvento(updated)
    setSelectedEvento(updated)
  }

  async function handleDelete(id: string) {
    await deleteEvento(id)
    setSelectedEvento(null)
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Alterna entre a Agenda normal e a consulta de disponibilidade —
          áreas propositalmente separadas, cada uma com seu próprio bloco de
          impressão, nunca misturadas no mesmo PDF. */}
      <div className="print:hidden flex items-center gap-1.5 bg-app-surface border border-app-border rounded-xl p-1 shadow-sm w-fit mb-4">
        <button
          onClick={() => setAbaPrincipal('agenda')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${abaPrincipal === 'agenda' ? 'text-white font-bold shadow-md' : 'bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF]'}`}
          style={abaPrincipal === 'agenda' ? { backgroundColor: '#25D366' } : undefined}
        >
          Agenda
        </button>
        <button
          onClick={() => setAbaPrincipal('disponibilidade')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${abaPrincipal === 'disponibilidade' ? 'text-white font-bold shadow-md' : 'bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF]'}`}
          style={abaPrincipal === 'disponibilidade' ? { backgroundColor: '#25D366' } : undefined}
        >
          Consultar Disponibilidade
        </button>
      </div>

      {abaPrincipal === 'disponibilidade' && <ConsultarDisponibilidadeSection />}

      {abaPrincipal === 'agenda' && (
        <>
      {/* Cabeçalho impresso — escondido na tela, só aparece no PDF exportado
          pela "Exportar Relação" (window.print, restrito ao bloco abaixo
          porque o resto da página fica print:hidden). */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <p className="text-xs text-gray-500 mb-1">Espaços &amp; Locações</p>
        <h1 className="text-xl font-bold text-gray-900 capitalize">Relação Agenda — {tituloFiltro}</h1>
        <p className="text-sm text-gray-600 mt-1">{espacosLabel}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="print:hidden space-y-4">
        {/* Espaço já é definido globalmente pelo Dashboard — aqui só mostra
            quantos eventos estão em escopo e o botão de criar. */}
        <div className="flex items-center gap-2 flex-wrap">
          {espacosEmEscopo && (
            <span className="text-xs text-app-subtle">
              {eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? 's' : ''}
            </span>
          )}

          <ExportarRelatorioButton onExcel={handleExportExcelRelacao} onPdf={() => setPdfModalOpen(true)} label="Exportar Relação" />

          {/* Botão Novo Evento */}
          {role !== 'socio' && (
            <button
              onClick={() => {
                if (precisaEspacoEspecifico()) { showToast(MSG_ESPACO_ESPECIFICO_NECESSARIO); return }
                setNovoEventoOpen(true)
              }}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white shrink-0 transition-opacity"
              style={{ backgroundColor: '#25D366' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#128C7E' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#25D366' }}
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Evento
            </button>
          )}
        </div>

        <div className="space-y-4">
          <CalendarView
            eventos={eventosFiltrados}
            selectedDate={selectedDate}
            onDaySelect={setSelectedDate}
            onMonthChange={setMesExibido}
            mostrarEventos
            onEventoClick={setSelectedEvento}
          />
          <EventList
            eventos={eventosExibidos}
            selectedDate={selectedDate}
            aba={aba}
            onAbaChange={setAba}
            mesAnoLabel={mesAnoLabel}
            onEventoClick={setSelectedEvento}
            mostrarAbaMes={false}
          />
        </div>

        {/* Google Calendar — sempre o do espaço ativo no momento, mesma
            conexão persistente por espaço usada em Espaços → [espaço]. Sem
            espaço específico selecionado, não há conexão única possível. */}
        {espacoUnico && espacoAtivoConfig?.id ? (
          <EspacoGoogleCalendar key={espacoAtivoConfig.id} espacoId={espacoAtivoConfig.id} espacoNome={espacoAtivoConfig.nome} />
        ) : (
          <div className="rounded-xl border border-app-border bg-app-surface p-5 text-center">
            <p className="text-sm text-app-subtle">{MSG_ESPACO_ESPECIFICO_NECESSARIO}</p>
          </div>
        )}
      </div>

      {/* Relação Agenda — escondida na tela, só aparece no PDF exportado.
          Reflete exatamente o que está em `eventosExibidos` (dia/aba/mês
          ativo) e o espaço ativo, e só traz as colunas marcadas no modal
          "Exportar PDF" — nenhuma informação fora da seleção do usuário
          pode aparecer aqui (ex: compartilhar sem revelar valores). */}
      <div className="hidden print:block space-y-3">
        <FullTable
          titulo={tituloFiltro}
          headers={pdfColunas.map(c => c.header)}
          rows={relacaoExibida.map(r => pdfColunas.map(c => c.cell(r)))}
          totalLabel="Quantidade de eventos" totalValor={String(totaisExibidos.quantidade)}
        />
      </div>
        </>
      )}

      {selectedEvento && (
        <EventoDrawer
          evento={eventos.find(e => e.id === selectedEvento.id) ?? selectedEvento}
          onClose={() => setSelectedEvento(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {novoEventoOpen && (
        <NovoEventoModal
          espacoPadrao={(espacoUnico ?? undefined) as Espaco | undefined}
          onClose={() => setNovoEventoOpen(false)}
          onSave={addEvento}
        />
      )}

      {pdfModalOpen && (
        <ExportarPdfAgendaModal
          camposIniciais={camposPdf}
          onClose={() => setPdfModalOpen(false)}
          onConfirm={handleConfirmarPdf}
        />
      )}

      <Toast message={toastMsg} />
    </div>
  )
}
