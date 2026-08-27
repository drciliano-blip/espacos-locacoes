'use client'

import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import CalendarView from '@/components/agenda/CalendarView'
import EventList, { type AbaAgenda } from '@/components/agenda/EventList'
import GoogleCalendarView from '@/components/agenda/GoogleCalendarView'
import EventoDrawer from '@/components/eventos/EventoDrawer'
import NovoEventoModal from '@/components/eventos/NovoEventoModal'
import ExportarRelatorioButton from '@/components/relatorios/ExportarRelatorioButton'
import FullTable from '@/components/shared/FullTable'
import Toast from '@/components/shared/Toast'
import { useEventos } from '@/contexts/EventosContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useCurrentUser } from '@/contexts/UserContext'
import { useEspacoAtivo, MSG_ESPACO_ESPECIFICO_NECESSARIO } from '@/contexts/EspacoAtivoContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { downloadWorkbook, type ExportSheet } from '@/lib/xlsx-export'
import type { Evento, Espaco } from '@/types'

const statusLabelEvento: Record<string, string> = { confirmado: 'Confirmado', cancelado: 'Cancelado' }

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

  const [selectedDate, setSelectedDate]     = useState<Date | null>(null)
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null)
  const [novoEventoOpen, setNovoEventoOpen] = useState(false)
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
        ['Data', 'Nome do Evento', 'Valor Total', 'Status', 'Valor Recebido', 'Valor a Receber'],
        ...relacaoExibida.map(r => [
          formatDate(r.evento.data), r.evento.cliente, r.evento.valor,
          statusLabelEvento[r.evento.status] ?? r.evento.status, r.valorRecebido, r.valorAReceber,
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

          <ExportarRelatorioButton onExcel={handleExportExcelRelacao} onPdf={() => window.print()} label="Exportar Relação" />

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

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
          <CalendarView
            eventos={eventosFiltrados}
            selectedDate={selectedDate}
            onDaySelect={setSelectedDate}
            onMonthChange={setMesExibido}
          />
          <EventList
            eventos={eventosExibidos}
            selectedDate={selectedDate}
            aba={aba}
            onAbaChange={setAba}
            mesAnoLabel={mesAnoLabel}
            onEventoClick={setSelectedEvento}
          />
        </div>

        {/* Google Calendar */}
        <GoogleCalendarView />
      </div>

      {/* Relação Agenda — escondida na tela, só aparece no PDF exportado.
          Reflete exatamente o que está em `eventosExibidos` (dia/aba/mês
          ativo) e o espaço ativo, nunca uma lista à parte recalculada com
          outro filtro. */}
      <div className="hidden print:block space-y-3">
        <FullTable
          titulo={tituloFiltro}
          headers={['Data', 'Nome do Evento', 'Valor Total', 'Status', 'Valor Recebido', 'Valor a Receber']}
          rows={relacaoExibida.map(r => [
            formatDate(r.evento.data), r.evento.cliente, formatCurrency(r.evento.valor),
            statusLabelEvento[r.evento.status] ?? r.evento.status, formatCurrency(r.valorRecebido), formatCurrency(r.valorAReceber),
          ])}
          totalLabel="Valor total contratado" totalValor={formatCurrency(totaisExibidos.valorTotalContratado)}
        />
        <div className="grid grid-cols-3 gap-3 text-xs">
          <p><span className="text-gray-500">Quantidade total de eventos:</span> <span className="font-semibold">{totaisExibidos.quantidade}</span></p>
          <p><span className="text-gray-500">Total recebido:</span> <span className="font-semibold">{formatCurrency(totaisExibidos.totalRecebido)}</span></p>
          <p><span className="text-gray-500">Total a receber:</span> <span className="font-semibold">{formatCurrency(totaisExibidos.totalAReceber)}</span></p>
        </div>
      </div>

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

      <Toast message={toastMsg} />
    </div>
  )
}
