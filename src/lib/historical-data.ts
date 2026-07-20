import type { Evento } from '@/types'
import { ESPACOS_CONFIG } from '@/lib/espacos-config'

// Gerador de dados sintéticos para os gráficos de tendência ficarem populados
// mesmo sem histórico real ainda no banco — não lê mais dados reais (mock-data
// foi removido), então não há mais meses "reais" a pular.
const eventosAtuais: Evento[] = []

// Simple LCG (Linear Congruential Generator) — deterministic, no Math.random()
function makeLCG(seed: number) {
  let s = seed >>> 0
  return () => {
    s = ((1664525 * s + 1013904223) >>> 0)
    return s / 4294967295
  }
}

const ESPACO_BASE: Record<string, { eventsPerMonth: number; avgValue: number }> = {
  'Usine':            { eventsPerMonth: 3,  avgValue: 17000 },
  'Fabrique':         { eventsPerMonth: 4,  avgValue: 10500 },
  'House Pacaembu':   { eventsPerMonth: 3,  avgValue:  9000 },
  'Complexo Jussara': { eventsPerMonth: 3,  avgValue: 22000 },
  'Espaço Solon':     { eventsPerMonth: 5,  avgValue:  5500 },
}

// Seasonal multiplier by 0-indexed month
const SEASONAL = [0.60, 0.75, 0.90, 1.10, 1.10, 0.85, 0.85, 0.85, 1.00, 1.00, 1.30, 1.30]

// Monthly growth rate: ~1.8% per month (≈38% over 18 months)
const MONTHLY_GROWTH = 0.018

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function pad(n: number) { return String(n).padStart(2, '0') }

// Generate historical events from startYear/startMonth to endYear/endMonth (inclusive)
// Skips months that already exist in eventosAtuais
export function generateHistoricalEventos(): Evento[] {
  const result: Evento[] = []

  // Historical window: Nov 2024 – Apr 2026 (18 months)
  const START_YEAR = 2024
  const START_MONTH = 10 // 0-indexed → November
  const END_YEAR = 2026
  const END_MONTH = 3   // 0-indexed → April

  const existingMonths = new Set(
    eventosAtuais.map((e) => e.data.substring(0, 7))
  )

  let monthIndex = 0

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const mStart = year === START_YEAR ? START_MONTH : 0
    const mEnd = year === END_YEAR ? END_MONTH : 11

    for (let month = mStart; month <= mEnd; month++) {
      const yearMonthStr = `${year}-${pad(month + 1)}`
      if (existingMonths.has(yearMonthStr)) { monthIndex++; continue }

      const seed = year * 100000 + month * 1000
      const rand = makeLCG(seed)
      const seasonal = SEASONAL[month]
      const growthFactor = 1 + MONTHLY_GROWTH * monthIndex
      const days = daysInMonth(year, month)

      for (const espaco of ESPACOS_CONFIG) {
        const base = ESPACO_BASE[espaco.nome]
        if (!base) continue

        // Determine number of events this month
        const expectedEvents = base.eventsPerMonth * seasonal
        const numEvents = Math.max(1, Math.round(expectedEvents * (0.7 + rand() * 0.6)))

        for (let i = 0; i < numEvents; i++) {
          const r1 = rand()
          const r2 = rand()
          const r3 = rand()
          const r4 = rand()
          const r5 = rand()

          const day = Math.max(1, Math.min(days, Math.ceil(r1 * days)))
          const hora = 14 + Math.floor(r2 * 5) // 14–18h start
          const duracao = 4 + Math.floor(r3 * 5) // 4–8h duration
          const endHora = Math.min(hora + duracao, 23)

          const catIndex = Math.floor(r4 * espaco.categorias.length)
          const tipo = espaco.categorias[catIndex]?.label ?? 'Evento'

          const valueVariance = 0.80 + r5 * 0.40 // ±20%
          const valor = Math.round(base.avgValue * seasonal * growthFactor * valueVariance)

          const numeroPessoas = Math.round(espaco.capacidade * (0.50 + rand() * 0.45))
          const faturamentoBruto = valor
          const faturamentoLiquido = Math.round(valor * 0.85)

          const status: Evento['status'] = rand() < 0.93 ? 'confirmado' : 'cancelado'

          const id = `h-${year}${pad(month + 1)}-${espaco.slug.substring(0, 3)}-${i}`

          result.push({
            id,
            cliente: `Cliente ${id}`,
            espaco: espaco.nome as Evento['espaco'],
            data: `${year}-${pad(month + 1)}-${pad(day)}`,
            horaInicio: `${pad(hora)}:00`,
            horaFim: `${pad(endHora)}:00`,
            tipo,
            status,
            valor,
            numeroPessoas,
            capacidadeUtilizada: espaco.capacidade,
            faturamentoBruto,
            faturamentoLiquido,
          })
        }
      }

      monthIndex++
    }
  }

  return result
}

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

function makeLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-')
  return `${MONTH_LABELS[parseInt(m) - 1]}/${y.slice(2)}`
}

let _cachedHistorico: Evento[] | null = null
export function getAllEventos(): Evento[] {
  if (!_cachedHistorico) {
    _cachedHistorico = [...generateHistoricalEventos(), ...eventosAtuais]
  }
  return _cachedHistorico
}

export function getMonthlyAggregates(
  espacoFilter?: string[],
  dataInicio?: string,
  dataFim?: string
): MonthlyAggregate[] {
  const todos = getAllEventos()

  const filtered = todos.filter((e) => {
    if (e.status === 'cancelado') return false
    if (espacoFilter && espacoFilter.length > 0 && !espacoFilter.includes(e.espaco)) return false
    if (dataInicio && e.data < dataInicio) return false
    if (dataFim && e.data > dataFim) return false
    return true
  })

  const map = new Map<string, MonthlyAggregate>()

  for (const e of filtered) {
    const ym = e.data.substring(0, 7)
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
    const agg = map.get(ym)!
    agg.receita += e.valor
    agg.totalEventos += 1
    agg.eventosPorCategoria[e.tipo] = (agg.eventosPorCategoria[e.tipo] ?? 0) + 1
    agg.eventosPorEspaco[e.espaco] = (agg.eventosPorEspaco[e.espaco] ?? 0) + 1
    agg.receitaPorEspaco[e.espaco] = (agg.receitaPorEspaco[e.espaco] ?? 0) + e.valor

    if (e.numeroPessoas && e.capacidadeUtilizada) {
      const occ = Math.min(100, Math.round((e.numeroPessoas / e.capacidadeUtilizada) * 100))
      // running average
      agg.taxaOcupacaoMedia = Math.round(
        (agg.taxaOcupacaoMedia * (agg.totalEventos - 1) + occ) / agg.totalEventos
      )
    }
  }

  return Array.from(map.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
}

// Linear regression on last N months to project forward
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

// Returns date range strings for each period type, relative to today (May 23 2026)
const TODAY = '2026-05-23'

export function getPeriodRange(periodo: string): { inicio: string; fim: string } {
  const [ty, tm, td] = TODAY.split('-').map(Number)

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
