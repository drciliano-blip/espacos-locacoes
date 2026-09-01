'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, FileText } from 'lucide-react'
import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useEventos } from '@/contexts/EventosContext'
import { useEspacos } from '@/contexts/EspacosContext'
import FullTable from '@/components/shared/FullTable'
import { formatDate } from '@/lib/utils'

// Futuro: alternância Calendário | Lista para este resultado — hoje só Lista.

const DIAS_SEMANA = [
  { valor: 1, label: 'Segunda-feira' },
  { valor: 2, label: 'Terça-feira' },
  { valor: 3, label: 'Quarta-feira' },
  { valor: 4, label: 'Quinta-feira' },
  { valor: 5, label: 'Sexta-feira' },
  { valor: 6, label: 'Sábado' },
  { valor: 0, label: 'Domingo' },
]

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface LinhaDisponibilidade {
  data: string // 'YYYY-MM-DD'
  espaco: string
}

function chave(l: LinhaDisponibilidade): string {
  return `${l.espaco}|${l.data}`
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function diaSemanaLabel(dataStr: string): string {
  const nome = format(parseDateStr(dataStr), 'EEEE', { locale: ptBR })
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

// Agrupa por espaço e depois por mês, no formato pronto pra colar no WhatsApp.
function gerarTextoWhatsapp(linhas: LinhaDisponibilidade[]): string {
  const porEspaco = new Map<string, LinhaDisponibilidade[]>()
  for (const l of linhas) {
    if (!porEspaco.has(l.espaco)) porEspaco.set(l.espaco, [])
    porEspaco.get(l.espaco)!.push(l)
  }
  const blocos: string[] = []
  for (const [espaco, linhasEspaco] of porEspaco) {
    const ordenadas = linhasEspaco.slice().sort((a, b) => a.data.localeCompare(b.data))
    const porMes = new Map<string, LinhaDisponibilidade[]>()
    for (const l of ordenadas) {
      const chaveMes = l.data.slice(0, 7)
      if (!porMes.has(chaveMes)) porMes.set(chaveMes, [])
      porMes.get(chaveMes)!.push(l)
    }
    const partes = [`${espaco} – Datas disponíveis`, '']
    for (const [chaveMes, linhasMes] of porMes) {
      const [y, m] = chaveMes.split('-').map(Number)
      partes.push(`${MESES[m - 1]}/${y}`)
      for (const l of linhasMes) {
        const [, lm, ld] = l.data.split('-')
        partes.push(`• ${ld}/${lm} – ${diaSemanaLabel(l.data)}`)
      }
      partes.push('')
    }
    blocos.push(partes.join('\n').trimEnd())
  }
  return blocos.join('\n\n')
}

const pillClass = (ativo: boolean) =>
  `flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
    ativo ? 'text-white font-bold shadow-md' : 'bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF]'
  }`
const inputClass = 'w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none'

export default function ConsultarDisponibilidadeSection() {
  const { eventos } = useEventos()
  const { espacosNomes } = useEspacos()

  const [espacosSelecionados, setEspacosSelecionados] = useState<string[]>([])
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [mesRapido, setMesRapido] = useState('')
  const [anoRapido, setAnoRapido] = useState('')
  const [diasSemanaSelecionados, setDiasSemanaSelecionados] = useState<number[]>([])
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set())
  const [copiado, setCopiado] = useState(false)
  const [erroCopia, setErroCopia] = useState<string | null>(null)

  const anoAtual = new Date().getFullYear()
  const anosDisponiveis = [anoAtual, anoAtual + 1, anoAtual + 2]

  function toggleEspaco(nome: string) {
    setEspacosSelecionados(prev => prev.includes(nome) ? prev.filter(e => e !== nome) : [...prev, nome])
  }
  function toggleTodosEspacos() {
    setEspacosSelecionados(prev => prev.length === espacosNomes.length ? [] : espacosNomes.slice())
  }
  function toggleDiaSemana(valor: number) {
    setDiasSemanaSelecionados(prev => prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor])
  }
  function preencherPeriodoComMes() {
    if (!mesRapido || !anoRapido) return
    const inicio = startOfMonth(new Date(Number(anoRapido), Number(mesRapido) - 1, 1))
    setPeriodoInicio(toDateStr(inicio))
    setPeriodoFim(toDateStr(endOfMonth(inicio)))
  }

  // Toda data+espaço com evento CONFIRMADO bloqueia a data — cancelado nunca
  // bloqueia. Deriva direto de `eventos` (fonte viva), então a consulta
  // atualiza sozinha conforme a Agenda muda, sem nenhuma sincronização extra.
  const bloqueios = useMemo(() => {
    const set = new Set<string>()
    for (const e of eventos) if (e.status === 'confirmado') set.add(`${e.espaco}|${e.data}`)
    return set
  }, [eventos])

  const { linhas, totalCandidatas, erroPeriodo } = useMemo(() => {
    if (!periodoInicio || !periodoFim || espacosSelecionados.length === 0) {
      return { linhas: [] as LinhaDisponibilidade[], totalCandidatas: 0, erroPeriodo: null as string | null }
    }
    const inicio = parseDateStr(periodoInicio)
    const fim = parseDateStr(periodoFim)
    if (inicio > fim) {
      return { linhas: [] as LinhaDisponibilidade[], totalCandidatas: 0, erroPeriodo: 'O período final não pode ser anterior ao inicial.' }
    }
    const dias = eachDayOfInterval({ start: inicio, end: fim })
      .filter(d => diasSemanaSelecionados.length === 0 || diasSemanaSelecionados.includes(getDay(d)))

    const resultado: LinhaDisponibilidade[] = []
    let total = 0
    for (const dia of dias) {
      const dataStr = toDateStr(dia)
      for (const espaco of espacosSelecionados) {
        total++
        if (!bloqueios.has(`${espaco}|${dataStr}`)) resultado.push({ data: dataStr, espaco })
      }
    }
    resultado.sort((a, b) => a.data.localeCompare(b.data) || a.espaco.localeCompare(b.espaco))
    return { linhas: resultado, totalCandidatas: total, erroPeriodo: null as string | null }
  }, [periodoInicio, periodoFim, espacosSelecionados, diasSemanaSelecionados, bloqueios])

  // Reseta a seleção só quando os filtros mudam (nova consulta) — não quando
  // `eventos` muda, pra não perder a curadoria do usuário à toa.
  useEffect(() => {
    setDesmarcados(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoInicio, periodoFim, espacosSelecionados.join(','), diasSemanaSelecionados.join(',')])

  const mostrarColunaEspaco = espacosSelecionados.length > 1

  function estaSelecionada(l: LinhaDisponibilidade) { return !desmarcados.has(chave(l)) }
  function toggleLinha(l: LinhaDisponibilidade) {
    setDesmarcados(prev => {
      const next = new Set(prev)
      const k = chave(l)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }
  const linhasSelecionadas = useMemo(() => linhas.filter(estaSelecionada), [linhas, desmarcados])
  const todasSelecionadas = linhas.length > 0 && linhasSelecionadas.length === linhas.length
  function toggleTodasLinhas() {
    setDesmarcados(todasSelecionadas ? new Set(linhas.map(chave)) : new Set())
  }

  const periodoLabel = periodoInicio && periodoFim ? `${formatDate(periodoInicio)} a ${formatDate(periodoFim)}` : ''
  const espacosLabel = espacosSelecionados.join(', ')

  async function handleCopiarDatas() {
    if (linhasSelecionadas.length === 0) return
    setErroCopia(null)
    try {
      await navigator.clipboard.writeText(gerarTextoWhatsapp(linhasSelecionadas))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setErroCopia('Não foi possível copiar automaticamente. Selecione o texto manualmente.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="print:hidden space-y-4">
        <div className="rounded-xl border border-app-border bg-app-surface p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-app-text">Consultar Disponibilidade</h3>
            <p className="text-xs text-app-subtle mt-0.5">
              Veja rapidamente quais datas estão livres e gere uma lista pronta pra enviar ao cliente.
            </p>
          </div>

          <div>
            <p className="text-xs text-app-subtle mb-1.5">Espaço</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={toggleTodosEspacos} className={pillClass(espacosSelecionados.length === espacosNomes.length)} style={espacosSelecionados.length === espacosNomes.length ? { backgroundColor: '#25D366' } : undefined}>
                {espacosSelecionados.length === espacosNomes.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
              {espacosNomes.map(esp => {
                const ativo = espacosSelecionados.includes(esp)
                return (
                  <button key={esp} onClick={() => toggleEspaco(esp)} className={pillClass(ativo)} style={ativo ? { backgroundColor: '#25D366' } : undefined}>
                    {ativo && <Check className="h-3 w-3" />}
                    {esp}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Período inicial</label>
              <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Período final</label>
              <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Preencher por mês (opcional)</label>
              <select value={mesRapido} onChange={e => setMesRapido(e.target.value)} className={`${inputClass} cursor-pointer`}>
                <option value="">Mês</option>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <select value={anoRapido} onChange={e => setAnoRapido(e.target.value)} className={`${inputClass} cursor-pointer w-auto`}>
              <option value="">Ano</option>
              {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button
              onClick={preencherPeriodoComMes}
              disabled={!mesRapido || !anoRapido}
              className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-muted hover:bg-app-surface2 hover:text-app-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Preencher período
            </button>
          </div>

          <div>
            <p className="text-xs text-app-subtle mb-1.5">
              Dia da semana <span className="italic">— nenhum marcado considera todos os dias</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map(d => {
                const ativo = diasSemanaSelecionados.includes(d.valor)
                return (
                  <button key={d.valor} onClick={() => toggleDiaSemana(d.valor)} className={pillClass(ativo)} style={ativo ? { backgroundColor: '#25D366' } : undefined}>
                    {ativo && <Check className="h-3 w-3" />}
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-app-border bg-app-surface p-5 space-y-3">
          {erroPeriodo && <p className="text-xs text-red-500">{erroPeriodo}</p>}

          {!erroPeriodo && linhas.length === 0 && (
            <p className="text-sm text-app-subtle text-center py-6">
              {espacosSelecionados.length === 0 || !periodoInicio || !periodoFim
                ? 'Selecione ao menos um espaço e um período para consultar.'
                : totalCandidatas > 0
                  ? `Nenhuma data disponível para os filtros selecionados — todas as ${totalCandidatas} combinações estão ocupadas.`
                  : 'Nenhuma data no período/critérios informados.'}
            </p>
          )}

          {linhas.length > 500 && (
            <p className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              Período amplo — {linhas.length} datas encontradas. Considere reduzir o intervalo para facilitar a seleção.
            </p>
          )}

          {linhas.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-app-subtle">
                  <span className="font-semibold text-app-text">{linhasSelecionadas.length}</span> de {linhas.length} datas selecionadas
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopiarDatas}
                    disabled={linhasSelecionadas.length === 0}
                    className="flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-3 py-2 text-xs font-medium text-app-muted hover:bg-app-surface2 hover:text-app-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5 text-[#25D366]" />
                    {copiado ? 'Copiado!' : 'Copiar Datas'}
                  </button>
                  <button
                    onClick={() => setTimeout(() => window.print(), 60)}
                    disabled={linhasSelecionadas.length === 0}
                    className="flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-3 py-2 text-xs font-medium text-app-muted hover:bg-app-surface2 hover:text-app-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-red-400" />
                    Exportar PDF
                  </button>
                </div>
              </div>

              {erroCopia && <p className="text-xs text-red-500">{erroCopia}</p>}

              <div className="overflow-x-auto rounded-lg border border-app-border2/60">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-app-border bg-app-surface2">
                      <th className="px-2 py-2 text-left">
                        <input type="checkbox" checked={todasSelecionadas} onChange={toggleTodasLinhas} className="h-4 w-4 rounded border-app-border2 accent-[#25D366]" />
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">Data</th>
                      <th className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">Dia da semana</th>
                      {mostrarColunaEspaco && (
                        <th className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">Espaço</th>
                      )}
                      <th className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/50">
                    {linhas.map(l => (
                      <tr key={chave(l)}>
                        <td className="px-2 py-2">
                          <input type="checkbox" checked={estaSelecionada(l)} onChange={() => toggleLinha(l)} className="h-4 w-4 rounded border-app-border2 accent-[#25D366]" />
                        </td>
                        <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{formatDate(l.data)}</td>
                        <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{diaSemanaLabel(l.data)}</td>
                        {mostrarColunaEspaco && <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{l.espaco}</td>}
                        <td className="px-2 py-2 whitespace-nowrap">
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-xs font-medium">
                            Disponível
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Impressão — só o essencial pro cliente, nunca valor/cliente/evento. */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <p className="text-xs text-gray-500 mb-1">Espaços &amp; Locações</p>
        <h1 className="text-xl font-bold text-gray-900">Datas Disponíveis</h1>
        <p className="text-sm text-gray-600 mt-1">{espacosLabel}</p>
        {periodoLabel && <p className="text-sm text-gray-600">Período consultado: {periodoLabel}</p>}
        <p className="text-xs text-gray-400 mt-0.5">
          Gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>
      <div className="hidden print:block space-y-3">
        <FullTable
          titulo="Datas Disponíveis"
          headers={mostrarColunaEspaco ? ['Data', 'Dia da Semana', 'Espaço'] : ['Data', 'Dia da Semana']}
          rows={linhasSelecionadas.map(l => {
            const base = [formatDate(l.data), diaSemanaLabel(l.data)]
            return mostrarColunaEspaco ? [...base, l.espaco] : base
          })}
          totalLabel="Total de datas" totalValor={String(linhasSelecionadas.length)}
        />
      </div>
    </div>
  )
}
