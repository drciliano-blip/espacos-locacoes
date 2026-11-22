'use client'

// Etapa 3 do assistente: ações que gravam com um toque, direto do chat.
// Usa as MESMAS funções das telas do sistema (com travas de mês fechado e as
// permissões de quem clicou), registra no histórico de atividades que foi
// pelo Assistente de IA e devolve como desfazer.

import { useReceitas, type BaixaReceitaInput, type Receita } from '@/contexts/ReceitasContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { useAtividades } from '@/contexts/AtividadesContext'
import { normalizarTexto } from '@/lib/conciliacao-bancaria'
import type { AcaoProposta } from '@/lib/assistente/ferramentas'
import type { CategoriaContaPagar, ContaPagar } from '@/types'

export type AcaoBaixa = Extract<AcaoProposta, { tipo: 'baixa' }>
export type AcaoConta = Extract<AcaoProposta, { tipo: 'conta' }>

// Formas que gravam direto. Repasse de sócio e lucro de sócio têm regras
// próprias (geram repasse): só pela janela "Editar parcela".
export const FORMAS_DIRETAS = ['PIX', 'Transferência', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Cheque']

// Categorias que lançam direto; retirada de sócio e fundo de caixa só pela tela.
const CATEGORIAS_DIRETAS = ['operacional', 'obra', 'financeiro', 'reembolso_evento']

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
const brData = (d: string) => d.split('-').reverse().join('/')
export const hojeISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

export function useExecutorAcoes() {
  const { receitas, updateReceita } = useReceitas()
  const { contas, addConta, deleteConta } = useContasPagar()
  const { logAtividade } = useAtividades()

  const registrar = (acao: string, detalhes: string, espaco?: string) =>
    logAtividade({ tipo: 'financeiro', acao, detalhes: `${detalhes} · pelo Assistente de IA`, espaco }).catch(() => { /* o registro não pode travar a ação */ })

  function parcelaDe(a: AcaoBaixa): Receita | undefined {
    return receitas.find(r => r.id === a.receitaId)
  }

  // Dá baixa na parcela inteira; devolve a função que volta como estava.
  async function darBaixa(a: AcaoBaixa, dataPagamento: string, forma: string): Promise<() => Promise<void>> {
    const p = parcelaDe(a)
    if (!p) throw new Error('Parcela ainda carregando ou sem acesso. Tente de novo em instantes.')
    if (p.status === 'pago') throw new Error('Esta parcela já está paga.')
    if (!FORMAS_DIRETAS.includes(forma)) throw new Error('Para essa forma de pagamento, use "Abrir para ajustar".')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento) || dataPagamento > hojeISO()) throw new Error('Data de pagamento inválida (não pode ser futura).')
    const patch: BaixaReceitaInput = {
      status: 'pago', valor: p.valor, data: p.data, dataRecebimento: dataPagamento, metodoPagamento: forma,
      observacoes: p.observacoes, comprovanteInstituicao: p.comprovanteInstituicao, comprovanteIdentificador: p.comprovanteIdentificador,
      parcelaLabel: p.parcelaLabel ?? p.descricao, socioRepasse: p.socioResponsavel,
    }
    await updateReceita(p.id, patch)
    const rotulo = `${p.cliente ?? p.descricao} · ${p.parcelaLabel ?? p.descricao} · ${brl(p.valor)} · pago em ${brData(dataPagamento)} (${forma})`
    await registrar('Baixa de parcela', rotulo, p.espaco)
    return async () => {
      await updateReceita(p.id, {
        status: p.status, valor: p.valor, data: p.data, dataRecebimento: p.dataRecebimento, horaRecebimento: p.horaRecebimento,
        metodoPagamento: p.metodoPagamento, observacoes: p.observacoes, comprovanteInstituicao: p.comprovanteInstituicao,
        comprovanteIdentificador: p.comprovanteIdentificador, parcelaLabel: p.parcelaLabel, socioRepasse: p.socioResponsavel,
      })
      await registrar('Baixa desfeita', rotulo, p.espaco)
    }
  }

  // Conta que já parece lançada (mesmo valor e espaço, mesmo mês, mesmo fornecedor ou descrição).
  function possivelDuplicada(a: AcaoConta): ContaPagar | undefined {
    const c = a.campos
    const mes = c.vencimento.slice(0, 7)
    const nome = normalizarTexto(c.fornecedor || c.descricao)
    return contas.find(x => x.valor === c.valor && x.espaco === c.espaco
      && (x.dataVencimento?.slice(0, 7) === mes || x.dataPagamento?.slice(0, 7) === mes)
      && (normalizarTexto(x.fornecedor) === nome || normalizarTexto(x.descricao) === nome))
  }

  function podeLancarDireto(a: AcaoConta): boolean {
    return CATEGORIAS_DIRETAS.includes(a.campos.categoria)
  }

  async function lancarConta(a: AcaoConta): Promise<() => Promise<void>> {
    const c = a.campos
    if (!podeLancarDireto(a)) throw new Error('Essa categoria é lançada só pela tela de Contas a Pagar.')
    const conta: ContaPagar = {
      id: crypto.randomUUID(), descricao: c.descricao, espaco: c.espaco as ContaPagar['espaco'],
      categoria: c.categoria as CategoriaContaPagar, subcategoria: c.subcategoria as ContaPagar['subcategoria'],
      valor: c.valor, status: 'pendente', dataVencimento: c.vencimento, fornecedor: c.fornecedor, observacoes: c.observacoes,
    }
    await addConta(conta)
    const rotulo = `${c.descricao} · ${brl(c.valor)} · venc. ${brData(c.vencimento)}`
    await registrar('Conta a pagar lançada', rotulo, c.espaco)
    return async () => {
      await deleteConta(conta.id)
      await registrar('Lançamento desfeito', rotulo, c.espaco)
    }
  }

  return { parcelaDe, darBaixa, possivelDuplicada, podeLancarDireto, lancarConta }
}
