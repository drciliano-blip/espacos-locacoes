import type { Receita } from '@/contexts/ReceitasContext'
import type { RepasseSocio } from '@/contexts/RepassesContext'
import type { ContaPagar } from '@/types'
import { DIVISAO_SOCIOS } from './socios-config'

const MESES_LABEL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const SUBCATEGORIA_LABEL: Record<string, string> = {
  aluguel: 'Aluguel', energia: 'Energia', internet: 'Internet', funcionários: 'Funcionários',
  manutenção: 'Manutenção', fornecedores: 'Fornecedores', extras: 'Extras', outros: 'Outros',
  despesa_a_comprovar: 'Despesa a ser comprovada',
}

export interface DivisaoSocioMes {
  nome: string
  percentual: number
  valorDevido: number
  valorRepassado: number
  valorPendente: number
  situacao: 'pendente' | 'parcial' | 'realizada'
}

export interface FluxoCaixaMes {
  yearMonth: string
  label: string
  temLancamentos: boolean
  // Registros completos (não resumidos) — usados tanto na tela quanto na exportação,
  // pra nenhum campo cadastrado ficar de fora.
  entradas: Receita[]
  saidas: ContaPagar[]
  totalEntradas: number
  totalSaidas: number
  saldoDoMes: number
  partilhaRepassada: number
  saldoAposPartilha: number
  divisaoLucros: DivisaoSocioMes[]
  despesasPorCategoria: { categoria: string; valor: number }[]
}

export function gerarMesesDoPeriodo(dataInicio: string, dataFim: string): { yearMonth: string; label: string }[] {
  const [yi, mi] = dataInicio.split('-').map(Number)
  const [yf, mf] = dataFim.split('-').map(Number)
  const meses: { yearMonth: string; label: string }[] = []
  let y = yi, m = mi
  let guard = 0
  while ((y < yf || (y === yf && m <= mf)) && guard < 120) {
    meses.push({ yearMonth: `${y}-${String(m).padStart(2, '0')}`, label: `${MESES_LABEL[m - 1]} de ${y}` })
    m++
    if (m > 12) { m = 1; y++ }
    guard++
  }
  return meses
}

export function aggregateFluxoCaixa(
  espaco: string,
  meses: { yearMonth: string; label: string }[],
  receitas: Receita[],
  contasPagar: ContaPagar[],
  repasses: RepasseSocio[],
): FluxoCaixaMes[] {
  const entradasEspaco = receitas.filter(r => r.espaco === espaco)
  const saidasEspaco = contasPagar.filter(c => c.espaco === espaco)
  const repassesEspaco = repasses.filter(r => r.espaco === espaco)
  const socios = DIVISAO_SOCIOS[espaco] ?? []

  return meses.map(({ yearMonth, label }) => {
    const entradas = entradasEspaco.filter(r => r.data.startsWith(yearMonth)).sort((a, b) => a.data.localeCompare(b.data))
    const saidas = saidasEspaco.filter(c => c.dataVencimento.startsWith(yearMonth)).sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
    const repassesMes = repassesEspaco.filter(r => r.data.startsWith(yearMonth))

    const totalEntradas = entradas.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
    const totalSaidas = saidas.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
    const saldoDoMes = totalEntradas - totalSaidas
    const partilhaRepassada = repassesMes.reduce((s, r) => s + r.valor, 0)
    const saldoAposPartilha = saldoDoMes - partilhaRepassada

    const divisaoLucros: DivisaoSocioMes[] = socios.map(s => {
      const valorDevido = saldoDoMes * (s.percentual / 100)
      const valorRepassado = repassesMes.filter(r => r.socioNome === s.nome).reduce((sum, r) => sum + r.valor, 0)
      const valorPendente = valorDevido - valorRepassado
      const situacao: DivisaoSocioMes['situacao'] = valorRepassado <= 0 ? 'pendente' : valorPendente <= 0.01 ? 'realizada' : 'parcial'
      return { nome: s.nome, percentual: s.percentual, valorDevido, valorRepassado, valorPendente, situacao }
    })

    const catMap: Record<string, number> = {}
    for (const c of saidas.filter(c => c.status === 'pago')) {
      const catLabel = SUBCATEGORIA_LABEL[c.subcategoria] ?? c.subcategoria
      catMap[catLabel] = (catMap[catLabel] ?? 0) + c.valor
    }
    const despesasPorCategoria = Object.entries(catMap)
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor)

    return {
      yearMonth,
      label,
      temLancamentos: entradas.length > 0 || saidas.length > 0,
      entradas,
      saidas,
      totalEntradas,
      totalSaidas,
      saldoDoMes,
      partilhaRepassada,
      saldoAposPartilha,
      divisaoLucros,
      despesasPorCategoria,
    }
  })
}

export function projecaoProximoMes(meses: FluxoCaixaMes[]): { entradas: number; saidas: number; saldo: number } | null {
  const comMovimento = meses.filter(m => m.temLancamentos)
  if (comMovimento.length === 0) return null
  const entradas = comMovimento.reduce((s, m) => s + m.totalEntradas, 0) / comMovimento.length
  const saidas = comMovimento.reduce((s, m) => s + m.totalSaidas, 0) / comMovimento.length
  return { entradas, saidas, saldo: entradas - saidas }
}
