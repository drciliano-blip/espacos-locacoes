'use client'

import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import CalendarView from '@/components/agenda/CalendarView'
import EventList from '@/components/agenda/EventList'
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

  // Mês exibido na Agenda por mês — controlado pelo CalendarView (setas de
  // navegação), avisado aqui via onMonthChange só pra alimentar a exportação
  // "Exportar Relação", que precisa saber exatamente o que está na tela.
  const [mesExibido, setMesExibido] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  })

  const espacosLabel = espacoUnico ?? (espacosEmEscopo?.length ? espacosEmEscopo.join(', ') : 'Todos os espaços')
  const mesAnoLabel = format(mesExibido, 'MMMM yyyy', { locale: ptBR })

  // Relação do mês exibido — exatamente os eventos do mês/espaço em tela
  // (mesmo escopo de espaço do resto da página), com valor recebido/a
  // receber derivados ao vivo do ReceitasContext, igual ao resto do app
  // (nunca armazenados no Evento, sempre a soma das receitas pagas dele).
  const relacaoDoMes = useMemo(() => {
    return eventosFiltrados
      .filter(e => {
        const [y, m] = e.data.split('-').map(Number)
        return y === mesExibido.getFullYear() && m === mesExibido.getMonth() + 1
      })
      .slice()
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(e => {
        const valorRecebido = receitas.filter(r => r.eventoId === e.id && r.status === 'pago').reduce((s, r) => s + r.valor, 0)
        return { evento: e, valorRecebido, valorAReceber: e.valor - valorRecebido }
      })
  }, [eventosFiltrados, mesExibido, receitas])

  const totaisDoMes = useMemo(() => ({
    quantidade: relacaoDoMes.length,
    valorTotalContratado: relacaoDoMes.reduce((s, r) => s + r.evento.valor, 0),
    totalRecebido: relacaoDoMes.reduce((s, r) => s + r.valorRecebido, 0),
    totalAReceber: relacaoDoMes.reduce((s, r) => s + r.valorAReceber, 0),
  }), [relacaoDoMes])

  function handleExportExcelRelacao() {
    const sheet: ExportSheet = {
      name: 'Relação Mensal',
      rows: [
        ['Mês/Ano', mesAnoLabel],
        ['Espaço', espacosLabel],
        [],
        ['Data', 'Nome do Evento', 'Valor Total', 'Status', 'Valor Recebido', 'Valor a Receber'],
        ...relacaoDoMes.map(r => [
          formatDate(r.evento.data), r.evento.cliente, r.evento.valor,
          statusLabelEvento[r.evento.status] ?? r.evento.status, r.valorRecebido, r.valorAReceber,
        ]),
        [],
        ['Quantidade total de eventos', totaisDoMes.quantidade],
        ['Valor total contratado no mês', totaisDoMes.valorTotalContratado],
        ['Total recebido', totaisDoMes.totalRecebido],
        ['Total a receber', totaisDoMes.totalAReceber],
      ],
    }
    downloadWorkbook([sheet], `relacao-agenda-${format(mesExibido, 'yyyy-MM')}.xlsx`)
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
        <h1 className="text-xl font-bold text-gray-900 capitalize">Relação Mensal — {mesAnoLabel}</h1>
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
            eventos={eventosFiltrados}
            selectedDate={selectedDate}
            onEventoClick={setSelectedEvento}
          />
        </div>

        {/* Google Calendar */}
        <GoogleCalendarView />
      </div>

      {/* Relação Mensal — escondida na tela, só aparece no PDF exportado.
          Reflete exatamente o mês exibido no CalendarView e o espaço ativo,
          nunca uma lista à parte recalculada com outro filtro. */}
      <div className="hidden print:block space-y-3">
        <FullTable
          titulo={`Eventos de ${mesAnoLabel}`}
          headers={['Data', 'Nome do Evento', 'Valor Total', 'Status', 'Valor Recebido', 'Valor a Receber']}
          rows={relacaoDoMes.map(r => [
            formatDate(r.evento.data), r.evento.cliente, formatCurrency(r.evento.valor),
            statusLabelEvento[r.evento.status] ?? r.evento.status, formatCurrency(r.valorRecebido), formatCurrency(r.valorAReceber),
          ])}
          totalLabel="Valor total contratado" totalValor={formatCurrency(totaisDoMes.valorTotalContratado)}
        />
        <div className="grid grid-cols-3 gap-3 text-xs">
          <p><span className="text-gray-500">Quantidade total de eventos:</span> <span className="font-semibold">{totaisDoMes.quantidade}</span></p>
          <p><span className="text-gray-500">Total recebido:</span> <span className="font-semibold">{formatCurrency(totaisDoMes.totalRecebido)}</span></p>
          <p><span className="text-gray-500">Total a receber:</span> <span className="font-semibold">{formatCurrency(totaisDoMes.totalAReceber)}</span></p>
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
