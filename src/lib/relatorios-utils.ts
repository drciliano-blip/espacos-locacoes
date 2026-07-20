import type { Evento } from '@/types'
import type { Receita } from '@/contexts/ReceitasContext'

export interface MonthlyAggregate {
  label: string
  yearMonth: string
  receita: number
  totalEventos: number
  taxaOcupacaoMedia: number
  eventosPorCategoria: Record<string, number>
  eventosPorEspaco: Record<string, number>
  receitaPorEspaco: Record<string, number>
}

export interface ProjecaoMes {
  label: string
  yearMonth: string
  realista: number
  pessimista: number
  otimista: number
  isProjecao: true
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function pad(n: number) { return String(n).padStart(2, '0') }

function makeLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-')
  return `${MONTH_LABELS[parseInt(m) - 1]}/${y.slice(2)}`
}

function ensureMonth(map: Map<string, MonthlyAggregate>, ym: string): MonthlyAggregate {
  if (!map.has(ym)) {
    map.set(ym, {
      label: makeLabel(ym),
      yearMonth: ym,
      receita: 0,
      totalEventos: 0,
      taxaOcupacaoMedia: 0,
      eventosPorCategoria: {},
      eventosPorEspaco: {},
      receitaPorEspaco: {},
    })
  }
  return map.get(ym)!
}

// Agrega eventos + receitas reais em séries mensais, para os gráficos de Relatórios.
export function aggregateMonthly(
  eventos: Evento[],
  receitas: Receita[],
  espacoFilter?: string[],
  dataInicio?: string,
  dataFim?: string,
): MonthlyAggregate[] {
  const map = new Map<string, MonthlyAggregate>()

  const eventosFiltrados = eventos.filter((e) => {
    if (e.status === 'cancelado') return false
    if (espacoFilter && espacoFilter.length > 0 && !espacoFilter.includes(e.espaco)) return false
    if (dataInicio && e.data < dataInicio) return false
    if (dataFim && e.data > dataFim) return false
    return true
  })

  for (const e of eventosFiltrados) {
    const ym = e.data.substring(0, 7)
    const agg = ensureMonth(map, ym)
    agg.totalEventos += 1
    agg.eventosPorCategoria[e.tipo] = (agg.eventosPorCategoria[e.tipo] ?? 0) + 1
    agg.eventosPorEspaco[e.espaco] = (agg.eventosPorEspaco[e.espaco] ?? 0) + 1

    if (e.numeroPessoas && e.capacidadeUtilizada) {
      const occ = Math.min(100, Math.round((e.numeroPessoas / e.capacidadeUtilizada) * 100))
      agg.taxaOcupacaoMedia = Math.round(
        (agg.taxaOcupacaoMedia * (agg.totalEventos - 1) + occ) / agg.totalEventos
      )
    }
  }

  // Receita vem das receitas reais (status pago), consistente com o Dashboard
  const receitasFiltradas = receitas.filter((r) => {
    if (r.status !== 'pago') return false
    if (espacoFilter && espacoFilter.length > 0 && (!r.espaco || !espacoFilter.includes(r.espaco))) return false
    if (dataInicio && r.data < dataInicio) return false
    if (dataFim && r.data > dataFim) return false
    return true
  })

  for (const r of receitasFiltradas) {
    const ym = r.data.substring(0, 7)
    const agg = ensureMonth(map, ym)
    agg.receita += r.valor
    if (r.espaco) {
      agg.receitaPorEspaco[r.espaco] = (agg.receitaPorEspaco[r.espaco] ?? 0) + r.valor
    }
  }

  return Array.from(map.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
}

// Regressão linear sobre os últimos meses reais — matemática pura, não depende da origem dos dados.
export function calcularProjecoes(historico: MonthlyAggregate[], mesesAHead = 6): ProjecaoMes[] {
  if (historico.length < 3) return []

  const window = historico.slice(-Math.min(12, historico.length))
  const n = window.length
  const xs = window.map((_, i) => i)
  const ys = window.map((m) => m.receita)

  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const lastYM = historico[historico.length - 1].yearMonth
  const [ly, lm] = lastYM.split('-').map(Number)

  const projections: ProjecaoMes[] = []
  for (let i = 1; i <= mesesAHead; i++) {
    const totalMonths = lm - 1 + i
    const year = ly + Math.floor(totalMonths / 12)
    const month = (totalMonths % 12) + 1
    const ym = `${year}-${pad(month)}`
    const x = n - 1 + i
    const realista = Math.max(0, Math.round(intercept + slope * x))
    projections.push({
      label: makeLabel(ym),
      yearMonth: ym,
      realista,
      pessimista: Math.round(realista * 0.80),
      otimista: Math.round(realista * 1.20),
      isProjecao: true,
    })
  }

  return projections
}

export function getPeriodRange(periodo: string): { inicio: string; fim: string } {
  const hoje = new Date()
  const ty = hoje.getFullYear()
  const tm = hoje.getMonth() + 1
  const td = hoje.getDate()
  const TODAY = `${ty}-${pad(tm)}-${pad(td)}`

  if (periodo === 'semanal') {
    const d = new Date(ty, tm - 1, td - 7)
    return { inicio: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, fim: TODAY }
  }
  if (periodo === 'mensal') {
    return { inicio: `${ty}-${pad(tm)}-01`, fim: TODAY }
  }
  if (periodo === 'trimestral') {
    const start = tm - 3 <= 0
      ? `${ty - 1}-${pad(12 + (tm - 3))}-01`
      : `${ty}-${pad(tm - 3)}-01`
    return { inicio: start, fim: TODAY }
  }
  if (periodo === 'semestral') {
    const start = tm - 6 <= 0
      ? `${ty - 1}-${pad(12 + (tm - 6))}-01`
      : `${ty}-${pad(tm - 6)}-01`
    return { inicio: start, fim: TODAY }
  }
  // anual (default)
  return { inicio: `${ty - 1}-${pad(tm)}-01`, fim: TODAY }
}
