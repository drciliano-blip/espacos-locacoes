'use client'

import { useState } from 'react'
import { X, Save, Link2 } from 'lucide-react'
import { parseCurrencyBR, formatCurrency } from '@/lib/utils'
import type { MovimentacaoBancaria } from '@/lib/conciliacao-bancaria'
import type { CategoriaReceita, NovaReceitaInput, Receita, TipoEntrada } from '@/contexts/ReceitasContext'
import type { ContaPagar, CategoriaContaPagar, SubcategoriaContaPagar } from '@/types'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

// Mesmas categorias/subcategorias já oferecidas na leitura por IA de
// comprovantes (extract-boleto) — evita opções especiais de uso interno
// (Fundo de Caixa, Reembolso de Evento, Despesa a Comprovar) que têm fluxo
// próprio e não fazem sentido criadas por aqui.
const CATEGORIAS_CONTA: CategoriaContaPagar[] = ['operacional', 'obra', 'financeiro', 'retirada_socio']
const CATEGORIA_LABEL: Record<CategoriaContaPagar, string> = {
  operacional: 'Operacional', obra: 'Obra', financeiro: 'Financeiro', retirada_socio: 'Retirada Sócio',
  fundo_caixa: 'Fundo de Caixa', reembolso_evento: 'Reembolso de Evento',
}
const SUBCATEGORIAS_CONTA: SubcategoriaContaPagar[] = ['aluguel', 'energia', 'agua', 'iptu', 'internet', 'funcionários', 'manutenção', 'fornecedores', 'extras', 'outros']
const SUBCATEGORIA_LABEL: Record<SubcategoriaContaPagar, string> = {
  aluguel: 'Aluguel', energia: 'Energia', agua: 'Água', iptu: 'IPTU', internet: 'Internet', funcionários: 'Funcionários',
  manutenção: 'Manutenção', fornecedores: 'Fornecedores', extras: 'Extras', outros: 'Outros', despesa_a_comprovar: 'Despesa a ser comprovada',
}

const TIPOS_ENTRADA: TipoEntrada[] = ['evento', 'outras_entradas']
const TIPO_ENTRADA_LABEL: Record<TipoEntrada, string> = {
  evento: 'Receita de Evento', aporte_societario: 'Aporte Societário', outras_entradas: 'Outras Entradas',
  retorno_fundo_caixa: 'Retorno do Fundo de Caixa', aporte_obra: 'Aporte para Obra',
}

function valorInicial(v: number): string {
  return v.toFixed(2).replace('.', ',')
}

interface Props {
  movimentacao: MovimentacaoBancaria
  espacoPadrao: string
  categorias: CategoriaReceita[]
  onClose: () => void
  onSaveReceita: (input: NovaReceitaInput) => Promise<Receita>
  onSaveConta: (c: ContaPagar) => Promise<void>
  onVincular: (movimentacaoId: string, lancamentoTipo: 'receita' | 'conta_pagar', lancamentoId: string) => Promise<void>
  onCriado: () => void
}

// Cria uma receita/conta a pagar a partir de uma movimentação bancária que não
// tinha par no sistema, e já vincula a movimentação ao lançamento criado —
// nunca acontece sozinho, sempre exige essa confirmação explícita do usuário.
export default function CriarLancamentoDeBancoModal({
  movimentacao, espacoPadrao, categorias, onClose, onSaveReceita, onSaveConta, onVincular, onCriado,
}: Props) {
  const isEntrada = movimentacao.tipo === 'entrada'

  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? '')
  const [tipoEntrada, setTipoEntrada] = useState<TipoEntrada>('outras_entradas')
  const [categoriaConta, setCategoriaConta] = useState<CategoriaContaPagar>('operacional')
  const [subcategoriaConta, setSubcategoriaConta] = useState<SubcategoriaContaPagar>('outros')
  const [pessoa, setPessoa] = useState(movimentacao.favorecidoPagador ?? '')
  const [descricao, setDescricao] = useState(movimentacao.descricao)
  const [data, setData] = useState(movimentacao.data)
  const [valor, setValor] = useState(valorInicial(movimentacao.valor))
  const [observacoes, setObservacoes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const errors = {
    categoria: isEntrada ? !categoriaId : false,
    descricao: !descricao.trim(),
    data: !data,
    valor: !valor || parseCurrencyBR(valor) <= 0,
  }
  const hasErrors = Object.values(errors).some(Boolean)

  async function handleSalvar() {
    setSubmitted(true)
    if (hasErrors) return
    setSaving(true)
    setErro(null)
    try {
      if (isEntrada) {
        const nova = await onSaveReceita({
          categoriaId,
          espaco: espacoPadrao,
          cliente: pessoa.trim() || undefined,
          descricao: descricao.trim(),
          data,
          dataRecebimento: data,
          valor: parseCurrencyBR(valor),
          status: 'pago',
          observacoes: observacoes.trim() || undefined,
          tipoEntrada,
          comprovanteIdentificador: movimentacao.identificadorTransacao,
          horaRecebimento: movimentacao.hora,
          origem: 'extrato_bancario',
        })
        await onVincular(movimentacao.id, 'receita', nova.id)
      } else {
        const id = crypto.randomUUID()
        await onSaveConta({
          id,
          descricao: descricao.trim(),
          espaco: espacoPadrao as ContaPagar['espaco'],
          categoria: categoriaConta,
          subcategoria: subcategoriaConta,
          valor: parseCurrencyBR(valor),
          status: 'pago',
          dataVencimento: data,
          dataPagamento: data,
          horaPagamento: movimentacao.hora,
          comprovanteIdentificador: movimentacao.identificadorTransacao,
          fornecedor: pessoa.trim() || undefined,
          observacoes: observacoes.trim() || undefined,
          origem: 'extrato_bancario',
        })
        await onVincular(movimentacao.id, 'conta_pagar', id)
      }
      onCriado()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? `Falha ao criar: ${err.message}` : 'Falha ao criar o lançamento. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-app-surface rounded-2xl border border-app-border shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <Link2 className="h-4 w-4 text-[#25D366]" />
            Criar lançamento a partir desta movimentação
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2.5 text-xs text-app-subtle">
            Movimentação do banco: <span className="text-app-text2 font-medium">{movimentacao.data} — {movimentacao.descricao} — {formatCurrency(movimentacao.valor)}</span>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Espaço</label>
            <p className="w-full rounded-lg border border-app-border2 bg-app-surface3 px-2.5 py-1.5 text-sm text-app-text2">{espacoPadrao}</p>
          </div>

          {isEntrada ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Tipo de Entrada</label>
                <select
                  value={tipoEntrada}
                  onChange={e => setTipoEntrada(e.target.value as TipoEntrada)}
                  className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                >
                  {TIPOS_ENTRADA.map(t => <option key={t} value={t}>{TIPO_ENTRADA_LABEL[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Categoria<span className="text-red-400 ml-0.5">*</span></label>
                <select
                  value={categoriaId}
                  onChange={e => setCategoriaId(e.target.value)}
                  className={`w-full cursor-pointer rounded-lg border ${submitted && errors.categoria ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                >
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Categoria</label>
                <select
                  value={categoriaConta}
                  onChange={e => setCategoriaConta(e.target.value as CategoriaContaPagar)}
                  className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                >
                  {CATEGORIAS_CONTA.map(c => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Subcategoria</label>
                <select
                  value={subcategoriaConta}
                  onChange={e => setSubcategoriaConta(e.target.value as SubcategoriaContaPagar)}
                  className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                >
                  {SUBCATEGORIAS_CONTA.map(s => <option key={s} value={s}>{SUBCATEGORIA_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Descrição<span className="text-red-400 ml-0.5">*</span></label>
            <input
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              className={`w-full rounded-lg border ${submitted && errors.descricao ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">{isEntrada ? 'Cliente/Pagador' : 'Fornecedor'}</label>
              <input
                value={pessoa}
                onChange={e => setPessoa(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Data<span className="text-red-400 ml-0.5">*</span></label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className={`w-full rounded-lg border ${submitted && errors.data ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Valor (R$)<span className="text-red-400 ml-0.5">*</span></label>
            <input
              type="text" inputMode="decimal"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="0,00"
              className={`w-full rounded-lg border ${submitted && errors.valor ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
            />
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Observações</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            />
          </div>

          {erro && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">{erro}</p>
            </div>
          )}
          {submitted && hasErrors && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">Preencha todos os campos obrigatórios antes de salvar.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: GREEN }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = DARK_GREEN }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Criando…' : 'Criar e vincular'}
          </button>
        </div>
      </div>
    </div>
  )
}
