// Aplica no orçamento do atendimento o que o assistente decidiu no chat e
// calcula os totais. Código puro (sem banco): o servidor usa para mostrar à IA
// os valores certos, e a tela usa para aplicar a mesma mudança.

import type { BuffetTabela } from '@/lib/buffet'
import type { EstadoAtendimento } from './atendimentos'
import { DADOS_VAZIOS, linhasLocacao, parcelas, soma, type LinhaOrcamento, type TipoDia } from './orcamento'
import { PAGAMENTO_FASTIX, TABELAS_ESPACOS, tabelaPorSlug } from './tabelas-espacos'
import { questionario } from './roteiro'

export const PAGAMENTO_SERVICOS = [
  { descricao: 'Na contratação', pct: 50 },
  { descricao: 'Até 8 dias antes do evento', pct: 50, diasAntes: 8 },
]

// O que a ferramenta atualizar_orcamento recebe (tudo opcional).
export interface PatchOrcamento {
  cliente?: string; empresa?: string; telefone?: string; email?: string
  tipo_evento?: string; data?: string; convidados?: number; duracao_horas?: number
  tipo_dia?: TipoDia; observacoes?: string
  espaco?: string | null
  contratacao?: 'locacao' | 'parceria'; fastix?: boolean
  staff_complementar?: number; montagem?: boolean; valor_locacao?: number | null
  buffet?: { tabela: string; opcao?: string; valor?: number } | null
  servicos?: { descricao: string; prestador?: string; valor: number; detalhe?: string }[]
  opcionais?: { descricao: string; prestador?: string; valor: number; detalhe?: string }[]
}

export const ESTADO_INICIAL: EstadoAtendimento = {
  versao: 1, dados: DADOS_VAZIOS, pedidos: [], falta: [], slug: '', montagem: false, contratacao: 'locacao',
  fastixOpcional: false, staffComplementar: 0, valorManual: null, buffetId: '', buffetOpcao: '', buffetValor: null,
  extras: [], opcionais: [], condicoesServicos: '', upsell: [], alertas: [],
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function acharEspaco(v: string) {
  const q = norm(v)
  return tabelaPorSlug(v) ?? TABELAS_ESPACOS.find(t => norm(t.nome) === q || norm(t.nome).includes(q) || q.includes(norm(t.nome.replace(/^(espaço|armazém)\s+/i, ''))))
}

function linhas(xs: PatchOrcamento['servicos']): LinhaOrcamento[] {
  return (xs ?? []).filter(x => x && x.descricao).map(x => ({ descricao: x.descricao, prestador: x.prestador || '[Parceiro credenciado]', valor: Number(x.valor) || 0, detalhe: x.detalhe }))
}

export function aplicarPatch(base: Partial<EstadoAtendimento>, p: PatchOrcamento, buffets: BuffetTabela[]): { estado: EstadoAtendimento; avisos: string[] } {
  const e: EstadoAtendimento = { ...ESTADO_INICIAL, ...base, dados: { ...DADOS_VAZIOS, ...(base.dados ?? {}) } }
  const avisos: string[] = []
  const d = { ...e.dados }
  if (p.cliente !== undefined) d.cliente = p.cliente
  if (p.empresa !== undefined) d.empresa = p.empresa
  if (p.telefone !== undefined) d.telefone = p.telefone
  if (p.email !== undefined) d.email = p.email
  if (p.tipo_evento !== undefined) d.tipoEvento = p.tipo_evento
  if (p.data !== undefined) { if (/^\d{4}-\d{2}-\d{2}$/.test(p.data)) d.data = p.data; else avisos.push('Data ignorada: use AAAA-MM-DD.') }
  if (p.convidados !== undefined) d.convidados = p.convidados
  if (p.duracao_horas !== undefined) d.duracaoHoras = p.duracao_horas
  if (p.tipo_dia !== undefined) d.tipoDia = p.tipo_dia
  if (p.observacoes !== undefined) d.observacoes = p.observacoes
  e.dados = d
  if (p.espaco !== undefined) {
    if (p.espaco === null || p.espaco === '') e.slug = ''
    else {
      const t = acharEspaco(p.espaco)
      if (t) { if (t.slug !== e.slug) { e.valorManual = null; e.montagem = false } e.slug = t.slug }
      else avisos.push(`Espaço "${p.espaco}" não está na tabela do assistente (Complexo Jussara é atendido pessoalmente).`)
    }
  }
  if (p.contratacao !== undefined) e.contratacao = p.contratacao
  if (p.fastix !== undefined) e.fastixOpcional = p.fastix
  if (p.staff_complementar !== undefined) e.staffComplementar = Math.max(0, Number(p.staff_complementar) || 0)
  if (p.montagem !== undefined) e.montagem = p.montagem
  if (p.valor_locacao !== undefined) e.valorManual = p.valor_locacao && p.valor_locacao > 0 ? p.valor_locacao : null
  if (p.buffet !== undefined) {
    if (!p.buffet) { e.buffetId = ''; e.buffetOpcao = ''; e.buffetValor = null }
    else {
      const q = norm(p.buffet.tabela)
      const t = buffets.find(b => norm(b.nome) === q) ?? buffets.find(b => norm(b.nome).includes(q) || q.includes(norm(b.nome)))
      if (!t) avisos.push(`Tabela de buffet "${p.buffet.tabela}" não encontrada. Tabelas: ${buffets.map(b => b.nome).join(', ') || 'nenhuma'}.`)
      else {
        const opcoes = [...new Set(t.faixas.map(f => f.opcao))]
        e.buffetId = t.id
        e.buffetOpcao = opcoes.find(o => norm(o) === norm(p.buffet?.opcao ?? '')) ?? opcoes[0] ?? ''
        e.buffetValor = p.buffet.valor && p.buffet.valor > 0 ? p.buffet.valor : null
      }
    }
  }
  if (p.servicos !== undefined) e.extras = linhas(p.servicos)
  if (p.opcionais !== undefined) e.opcionais = linhas(p.opcionais)
  return { estado: e, avisos }
}

function faixaBuffet(t: BuffetTabela | undefined, opcao: string, convidados: number | null) {
  if (!t || !opcao || !convidados) return undefined
  return t.faixas.filter(f => f.opcao === opcao && f.ateConvidados >= convidados).sort((a, b) => a.ateConvidados - b.ateConvidados)[0]
}

export function calcular(e: EstadoAtendimento, buffets: BuffetTabela[]) {
  const espaco = tabelaPorSlug(e.slug)
  const linhasLoc = espaco ? linhasLocacao(espaco, e.dados, { montagem: e.montagem, staffComplementar: e.staffComplementar, valorManual: e.valorManual }) : []
  const totalLoc = soma(linhasLoc)
  const fastix: 'parceria' | 'opcional' | null = e.contratacao === 'parceria' ? 'parceria' : e.fastixOpcional ? 'opcional' : null
  const regraLoc = espaco ? (fastix ? PAGAMENTO_FASTIX : espaco.pagamento) : []
  const tabela = buffets.find(t => t.id === e.buffetId)
  const faixa = faixaBuffet(tabela, e.buffetOpcao, e.dados.convidados)
  const linhaBuffet: LinhaOrcamento | null = tabela ? {
    descricao: [tabela.nome, e.buffetOpcao].filter(Boolean).join(' · '),
    detalhe: [faixa ? `até ${faixa.ateConvidados.toLocaleString('pt-BR')} convidados` : e.dados.convidados ? `${e.dados.convidados} convidados` : '', tabela.inclusos].filter(Boolean).join(' · '),
    prestador: 'E&L',
    valor: e.buffetValor ?? faixa?.valor ?? 0,
  } : null
  const linhasServ = [...(linhaBuffet ? [linhaBuffet] : []), ...e.extras.filter(x => x.descricao.trim())]
  const totalServ = soma(linhasServ)
  return {
    espaco, linhasLoc, totalLoc, fastix, regraLoc, parcelasLoc: parcelas(totalLoc, regraLoc, e.dados.data),
    tabela, faixa, linhasServ, totalServ, parcelasServ: parcelas(totalServ, PAGAMENTO_SERVICOS, e.dados.data),
    perguntas: questionario(e.dados, espaco?.nome),
    buffetSemFaixa: !!tabela && !faixa && e.buffetValor === null,
  }
}
