// Motor de conciliação bancária — puro (sem React/Supabase), mesmo papel que
// fechamento-calc.ts tem pra Financeiro/Relatórios: única fonte de verdade
// pro cálculo, chamada tanto pela tela quanto por qualquer resumo futuro.
//
// Status de conciliação NUNCA é persistido — é sempre recalculado aqui, a
// partir das movimentações bancárias já importadas e dos lançamentos
// (receitas/contas_pagar) já carregados. Só o vínculo explícito
// (lancamentoTipo/lancamentoId numa movimentação) é dado real de banco.

import type { Receita } from '@/contexts/ReceitasContext'
import type { ContaPagar } from '@/types'
import type { TipoTransacao } from '@/lib/ofx-parser'

export type TipoMovimentacaoBancaria = 'entrada' | 'saida'

export interface MovimentacaoBancaria {
  id: string
  extratoId: string
  espaco?: string
  data: string
  hora?: string
  descricao: string
  valor: number
  tipo: TipoMovimentacaoBancaria
  tipoTransacao?: TipoTransacao
  identificadorTransacao?: string
  favorecidoPagador?: string
  lancamentoTipo?: 'receita' | 'conta_pagar'
  lancamentoId?: string
}

export type StatusConciliacao =
  | 'conciliado'
  | 'nao_encontrado_sistema'
  | 'nao_encontrado_banco'
  | 'divergente'
  | 'duplicidade_possivel'

export interface LancamentoResumo {
  tipo: 'receita' | 'conta_pagar'
  id: string
  descricao: string
  valor: number
  data: string
  espaco?: string
}

export interface ItemConciliacao {
  movimentacao?: MovimentacaoBancaria
  lancamento?: LancamentoResumo
  status: StatusConciliacao
  pontuacao?: number
  vinculoManual?: boolean
}

export interface ResumoConciliacao {
  totalBancoEntradas: number
  totalBancoSaidas: number
  totalSistemaEntradas: number
  totalSistemaSaidas: number
  diferencaEntradas: number
  diferencaSaidas: number
  porStatus: Record<StatusConciliacao, number>
}

export interface ConciliacaoResultado {
  itens: ItemConciliacao[]
  resumo: ResumoConciliacao
}

export interface ConciliacaoOpts {
  toleranciaDiasBase?: number // peso de data decai a zero depois desse tanto de dias — default 3
  toleranciaDiasComIdentificador?: number // tolerância maior quando o identificador da transação bate — default 7
}

const PESO_VALOR = 40
const PESO_DATA = 30
const PESO_IDENTIFICADOR = 20
const PESO_TEXTO = 10

function diasEntre(a: string, b: string): number {
  const ta = new Date(`${a}T00:00:00Z`).getTime()
  const tb = new Date(`${b}T00:00:00Z`).getTime()
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Infinity
  return Math.abs(ta - tb) / 86_400_000
}

function normalizarTexto(s?: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizarIdentificador(s?: string): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, '')
}

function similaridadeTexto(a?: string, b?: string): number {
  const setA = new Set(normalizarTexto(a).split(' ').filter(w => w.length > 2))
  const setB = new Set(normalizarTexto(b).split(' ').filter(w => w.length > 2))
  if (setA.size === 0 || setB.size === 0) return 0
  let intersecao = 0
  for (const w of setA) if (setB.has(w)) intersecao++
  return intersecao / Math.max(setA.size, setB.size)
}

interface Candidato {
  lancamento: LancamentoResumo
  identificador?: string
  valorMatch: boolean
  idMatch: boolean
  dentroTolerancia: boolean
  score: number
}

function avaliarCandidato(
  mov: MovimentacaoBancaria,
  lancamento: LancamentoResumo,
  identificadorLancamento: string | undefined,
  opts: Required<ConciliacaoOpts>,
): Candidato {
  const valorMatch = Math.abs(mov.valor - lancamento.valor) < 0.01
  const idMatch = !!mov.identificadorTransacao && !!identificadorLancamento
    && normalizarIdentificador(mov.identificadorTransacao) === normalizarIdentificador(identificadorLancamento)
  const tolerancia = idMatch ? opts.toleranciaDiasComIdentificador : opts.toleranciaDiasBase
  const diff = diasEntre(mov.data, lancamento.data)
  const dentroTolerancia = diff <= tolerancia

  const scoreValor = valorMatch ? PESO_VALOR : 0
  const scoreData = dentroTolerancia ? PESO_DATA * (1 - diff / (tolerancia || 1)) : 0
  const scoreId = idMatch ? PESO_IDENTIFICADOR : 0
  const scoreTexto = similaridadeTexto(`${mov.descricao} ${mov.favorecidoPagador ?? ''}`, lancamento.descricao) * PESO_TEXTO

  return {
    lancamento,
    identificador: identificadorLancamento,
    valorMatch,
    idMatch,
    dentroTolerancia,
    score: scoreValor + scoreData + scoreId + scoreTexto,
  }
}

export function receitaParaLancamento(r: Receita): LancamentoResumo {
  return { tipo: 'receita', id: r.id, descricao: r.descricao, valor: r.valor, data: r.dataRecebimento ?? r.data, espaco: r.espaco }
}

export function contaParaLancamento(c: ContaPagar): LancamentoResumo {
  return { tipo: 'conta_pagar', id: c.id, descricao: c.descricao, valor: c.valor, data: c.dataPagamento ?? c.dataVencimento, espaco: c.espaco !== 'Todos' ? c.espaco : undefined }
}

export function conciliar(
  movimentacoes: MovimentacaoBancaria[],
  receitas: Receita[],
  contasPagar: ContaPagar[],
  opts?: ConciliacaoOpts,
): ConciliacaoResultado {
  const o: Required<ConciliacaoOpts> = {
    toleranciaDiasBase: opts?.toleranciaDiasBase ?? 3,
    toleranciaDiasComIdentificador: opts?.toleranciaDiasComIdentificador ?? 7,
  }

  const receitasPagas = receitas.filter(r => r.status === 'pago')
  const contasPagas = contasPagar.filter(c => c.status === 'pago')

  const lancamentosPorId = new Map<string, LancamentoResumo>()
  receitasPagas.forEach(r => lancamentosPorId.set(`receita:${r.id}`, receitaParaLancamento(r)))
  contasPagas.forEach(c => lancamentosPorId.set(`conta_pagar:${c.id}`, contaParaLancamento(c)))

  const itens: ItemConciliacao[] = []
  const lancamentosConsumidos = new Set<string>()

  // Vínculo manual explícito é sempre respeitado — se o lançamento vinculado
  // ainda existir no que foi carregado. Se ele tiver sido excluído depois do
  // vínculo (caso raro), a movimentação volta pro matching automático abaixo
  // em vez de mostrar "conciliado" apontando pra um lançamento fantasma.
  const movsSemVinculoValido: MovimentacaoBancaria[] = []
  for (const mov of movimentacoes) {
    if (mov.lancamentoTipo && mov.lancamentoId) {
      const chave = `${mov.lancamentoTipo}:${mov.lancamentoId}`
      const lancamento = lancamentosPorId.get(chave)
      if (lancamento) {
        lancamentosConsumidos.add(chave)
        itens.push({ movimentacao: mov, lancamento, status: 'conciliado', vinculoManual: true })
        continue
      }
    }
    movsSemVinculoValido.push(mov)
  }

  // Matriz de candidatos (só pares com valor exato e dentro da tolerância de
  // data contam pra emparelhamento — divergência é tratada à parte, abaixo).
  function candidatosDe(mov: MovimentacaoBancaria): Candidato[] {
    const pool = mov.tipo === 'entrada' ? receitasPagas.map(r => ({ chave: `receita:${r.id}`, lanc: receitaParaLancamento(r), ident: r.comprovanteIdentificador }))
      : contasPagas.map(c => ({ chave: `conta_pagar:${c.id}`, lanc: contaParaLancamento(c), ident: c.comprovanteIdentificador }))
    return pool
      .filter(p => !lancamentosConsumidos.has(p.chave))
      .map(p => ({ ...avaliarCandidato(mov, p.lanc, p.ident, o), chave: p.chave } as Candidato & { chave: string }))
  }

  type Par = { movId: string; lancChave: string; score: number }
  const pares: Par[] = []
  const candidatosPorMov = new Map<string, (Candidato & { chave: string })[]>()
  for (const mov of movsSemVinculoValido) {
    const candidatos = candidatosDe(mov) as (Candidato & { chave: string })[]
    candidatosPorMov.set(mov.id, candidatos)
    for (const cand of candidatos) {
      if (cand.valorMatch && cand.dentroTolerancia) pares.push({ movId: mov.id, lancChave: cand.chave, score: cand.score })
    }
  }
  pares.sort((a, b) => b.score - a.score)

  const movClaimed = new Map<string, { chave: string; score: number }>()
  const lancClaimed = new Set<string>()
  for (const par of pares) {
    if (movClaimed.has(par.movId) || lancClaimed.has(par.lancChave)) continue
    movClaimed.set(par.movId, { chave: par.lancChave, score: par.score })
    lancClaimed.add(par.lancChave)
  }

  for (const mov of movsSemVinculoValido) {
    const claim = movClaimed.get(mov.id)
    if (claim) {
      itens.push({ movimentacao: mov, lancamento: lancamentosPorId.get(claim.chave), status: 'conciliado', pontuacao: claim.score })
      lancamentosConsumidos.add(claim.chave)
      continue
    }

    const candidatos = candidatosPorMov.get(mov.id) ?? []
    const tinhaCandidatoQualificado = candidatos.some(c => c.valorMatch && c.dentroTolerancia)
    if (tinhaCandidatoQualificado) {
      // Tinha pelo menos um par válido, mas todos foram levados por outras
      // movimentações com pontuação melhor — mais de uma movimentação
      // plausível disputando os mesmos lançamentos.
      itens.push({ movimentacao: mov, status: 'duplicidade_possivel' })
      continue
    }

    const valorOkDataFora = candidatos.some(c => c.valorMatch && !c.dentroTolerancia)
    const idDataOkValorFora = candidatos.some(c => c.idMatch && c.dentroTolerancia && !c.valorMatch)
    if (valorOkDataFora || idDataOkValorFora) {
      itens.push({ movimentacao: mov, status: 'divergente' })
      continue
    }

    itens.push({ movimentacao: mov, status: 'nao_encontrado_sistema' })
  }

  // Lançamentos pagos que nenhuma movimentação reivindicou (nem manual, nem
  // automático) — não são uma linha própria de movimentação, só aparecem do
  // lado "sistema" sem par do lado "banco".
  for (const [chave, lancamento] of lancamentosPorId) {
    if (!lancamentosConsumidos.has(chave)) {
      itens.push({ lancamento, status: 'nao_encontrado_banco' })
    }
  }

  const totalBancoEntradas = movimentacoes.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
  const totalBancoSaidas = movimentacoes.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
  const totalSistemaEntradas = receitasPagas.reduce((s, r) => s + r.valor, 0)
  const totalSistemaSaidas = contasPagas.reduce((s, c) => s + c.valor, 0)

  const porStatus: Record<StatusConciliacao, number> = {
    conciliado: 0,
    nao_encontrado_sistema: 0,
    nao_encontrado_banco: 0,
    divergente: 0,
    duplicidade_possivel: 0,
  }
  for (const item of itens) porStatus[item.status]++

  return {
    itens,
    resumo: {
      totalBancoEntradas,
      totalBancoSaidas,
      totalSistemaEntradas,
      totalSistemaSaidas,
      diferencaEntradas: totalBancoEntradas - totalSistemaEntradas,
      diferencaSaidas: totalBancoSaidas - totalSistemaSaidas,
      porStatus,
    },
  }
}

// Hash determinístico e barato (não-criptográfico) pra dedupe de movimentação
// dentro de um extrato — não precisa resistir a colisão adversarial, só
// detectar reimportação do mesmo arquivo/linha. data+valor+tipo+descrição
// (primeiros 40 chars) é suficiente pra bater igual em reimportações e
// diferente entre movimentações reais distintas no mesmo dia.
export function computeDedupeHash(mov: Pick<MovimentacaoBancaria, 'data' | 'valor' | 'tipo' | 'descricao' | 'identificadorTransacao'>): string {
  const base = mov.identificadorTransacao
    ? `id:${normalizarIdentificador(mov.identificadorTransacao)}`
    : `${mov.data}|${mov.valor.toFixed(2)}|${mov.tipo}|${normalizarTexto(mov.descricao).slice(0, 40)}`
  let hash = 0
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) | 0
  }
  return `${base.length}-${(hash >>> 0).toString(36)}`
}
