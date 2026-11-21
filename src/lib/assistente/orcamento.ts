// Cálculo dos dois orçamentos do Assistente de IA. Tudo aqui é determinístico:
// a IA só lê a mensagem e escreve a resposta; preço sai sempre da tabela.

import type { TabelaEspaco } from './tabelas-espacos'

export type TipoDia = 'normal' | 'vespera' | 'feriado'

export const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

export interface DadosEvento {
  cliente: string
  empresa: string
  telefone: string
  email: string
  tipoEvento: string
  data: string // AAAA-MM-DD
  convidados: number | null
  duracaoHoras: number | null
  tipoDia: TipoDia
  observacoes: string
}

export const DADOS_VAZIOS: DadosEvento = {
  cliente: '', empresa: '', telefone: '', email: '', tipoEvento: '', data: '',
  convidados: null, duracaoHoras: null, tipoDia: 'normal', observacoes: '',
}

export interface LinhaOrcamento {
  descricao: string
  detalhe?: string
  prestador?: string
  valor: number
}

export interface Parcela {
  descricao: string
  valor: number
  vencimento?: string // AAAA-MM-DD
}

// Data ISO sem fuso: new Date('2026-12-11') vira 10/12 às 21h em São Paulo.
export function dataLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function isoDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function br(iso?: string): string {
  return iso ? iso.split('-').reverse().join('/') : '—'
}

export function diaDaSemana(iso: string): string {
  const d = dataLocal(iso)
  return d ? DIAS_SEMANA[d.getDay()] : ''
}

export interface OpcoesLocacao {
  montagem: boolean
  staffComplementar: number
  valorManual: number | null // espaço sem tabela, ou ajuste combinado
}

export function linhasLocacao(t: TabelaEspaco, dados: DadosEvento, op: OpcoesLocacao): LinhaOrcamento[] {
  const d = dataLocal(dados.data)
  const linhas: LinhaOrcamento[] = []
  let base = 0
  let rotulo = 'Locação'
  if (op.valorManual !== null && op.valorManual > 0) {
    base = op.valorManual
    rotulo = d ? `Locação · ${DIAS_SEMANA[d.getDay()]}` : 'Locação'
  } else if (d && !t.semTabela) {
    const dia = d.getDay()
    if (dados.tipoDia === 'vespera' && t.vespera) { base = t.vespera; rotulo = 'Locação · véspera de feriado' }
    else if (dados.tipoDia === 'feriado' && t.feriado) { base = t.feriado; rotulo = 'Locação · feriado' }
    else { base = t.precos[dia]; rotulo = `Locação · ${DIAS_SEMANA[dia]}` }
  }
  linhas.push({
    descricao: `${rotulo} — ${t.nome}`,
    detalhe: [t.endereco, `até ${t.capacidade.toLocaleString('pt-BR')} pessoas`, `até ${t.horasInclusas} h de evento`].filter(Boolean).join(' · '),
    valor: base,
  })
  if (d && d.getMonth() === 11 && t.acrescimoDezembroPct && base > 0) {
    linhas.push({ descricao: `Acréscimo de dezembro (${t.acrescimoDezembroPct}% sobre a locação)`, valor: Math.round(base * t.acrescimoDezembroPct) / 100 })
  }
  if (op.montagem && t.montagemDiaAnterior) {
    linhas.push({ descricao: 'Montagem 1 dia antes', valor: t.montagemDiaAnterior })
  }
  if (op.staffComplementar > 0) {
    linhas.push({
      descricao: 'Staff complementar obrigatório',
      detalhe: dados.convidados ? `Dimensionado para ${dados.convidados.toLocaleString('pt-BR')} convidados, conforme contrato do espaço` : 'Conforme contrato do espaço',
      valor: op.staffComplementar,
    })
  }
  return linhas
}

export function soma(linhas: LinhaOrcamento[]): number {
  return Math.round(linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0) * 100) / 100
}

// Parcelas na regra do espaço (ex.: 50% na reserva, 50% até 8 dias antes).
// Última parcela absorve o arredondamento.
export function parcelas(total: number, regra: { descricao: string; pct: number; diasAntes?: number }[], dataEvento: string): Parcela[] {
  const d = dataLocal(dataEvento)
  let acumulado = 0
  return regra.map((r, i) => {
    const valor = i === regra.length - 1 ? Math.round((total - acumulado) * 100) / 100 : Math.round(total * r.pct) / 100
    acumulado += valor
    let vencimento: string | undefined
    if (d && r.diasAntes) {
      const v = new Date(d)
      v.setDate(v.getDate() - r.diasAntes)
      vencimento = isoDe(v)
    }
    return { descricao: `${r.pct}% ${r.descricao.charAt(0).toLowerCase()}${r.descricao.slice(1)}`, valor, vencimento }
  })
}

// Número do par de orçamentos. Sem tabela no banco nesta etapa: data + hora
// garantem que dois orçamentos do mesmo dia não se repitam na prática.
export function novoNumero(agora = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `EL-${agora.getFullYear()}-${p(agora.getMonth() + 1)}${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}`
}
