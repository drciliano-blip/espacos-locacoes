'use client'

import { useRef, useState } from 'react'
import { X, Save, DollarSign, Paperclip, Camera, Handshake } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { parseCurrencyBR } from '@/lib/utils'
import { saveFile } from '@/lib/file-storage'
import { DIVISAO_SOCIOS, SOCIOS_OBRA } from '@/lib/socios-config'
import type { CategoriaReceita, NovaReceitaInput, TipoEntrada } from '@/contexts/ReceitasContext'
import type { FormaPagamento } from '@/types'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

const FORMAS_PAGAMENTO: FormaPagamento[] = [
  'PIX', 'Transferência', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Cheque',
]

const TIPO_ENTRADA_LABEL: Record<TipoEntrada, string> = {
  evento: 'Receita de Evento',
  aporte_societario: 'Aporte Societário',
  outras_entradas: 'Outras Entradas',
  retorno_fundo_caixa: 'Retorno do Fundo de Caixa',
  aporte_obra: 'Aporte para Obra',
}

interface Props {
  categorias: CategoriaReceita[]
  onClose: () => void
  onSave: (input: NovaReceitaInput) => Promise<{ id: string }>
  eventoId?: string
  espacoPadrao?: string
  clientePadrao?: string
  excludeSlugs?: string[]
  // Abre já travado num tipo específico (ex: "+" de Aporte Societário em
  // Relatórios) — esconde o seletor de tipo, igual já acontece quando vem de
  // dentro de um evento.
  fixedTipoEntrada?: TipoEntrada
}

interface Draft {
  tipoEntrada: TipoEntrada
  categoriaId: string
  espaco: string
  cliente: string
  descricao: string
  data: string
  dataRecebimento: string
  valor: string
  status: 'pago' | 'pendente' | 'atrasado'
  metodoPagamento: string
  observacoes: string
  socioResponsavel: string
}

function emptyDraft(categoriaId: string, espaco: string, cliente: string, tipoEntrada: TipoEntrada): Draft {
  return {
    tipoEntrada, categoriaId, espaco, cliente, descricao: '', data: '', dataRecebimento: '',
    valor: '', status: 'pendente', metodoPagamento: '', observacoes: '', socioResponsavel: '',
  }
}

export default function NovaReceitaModal({
  categorias, onClose, onSave, eventoId, espacoPadrao, clientePadrao, excludeSlugs, fixedTipoEntrada,
}: Props) {
  const { espacosNomes } = useEspacos()
  // Aberta de dentro de um evento, ou com um tipo já travado (ex: "+" de Aporte
  // Societário em Relatórios) — o tipo já está implícito, não faz sentido perguntar.
  const permiteEscolherTipo = !eventoId && !fixedTipoEntrada
  const categoriasDisponiveis = excludeSlugs
    ? categorias.filter(c => !excludeSlugs.includes(c.slug))
    : categorias
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(
    categoriasDisponiveis[0]?.id ?? '',
    espacoPadrao ?? '',
    clientePadrao ?? '',
    fixedTipoEntrada ?? 'evento',
  ))
  const [comprovante, setComprovante] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft(d => ({ ...d, [k]: v }))
  }

  const isAporteSocietario = draft.tipoEntrada === 'aporte_societario'
  const isAporteObra = draft.tipoEntrada === 'aporte_obra'
  const isAporte = isAporteSocietario || isAporteObra
  const isRetornoFundo = draft.tipoEntrada === 'retorno_fundo_caixa'
  const sociosDoEspaco: string[] = !draft.espaco ? [] : isAporteObra
    ? (SOCIOS_OBRA[draft.espaco] ?? [])
    : (DIVISAO_SOCIOS[draft.espaco] ?? []).map(s => s.nome)

  const errors = isAporte
    ? {
        socioResponsavel: !draft.socioResponsavel,
        espaco: !draft.espaco,
        data: !draft.data,
        valor: !draft.valor || parseCurrencyBR(draft.valor) <= 0,
        descricao: !draft.descricao.trim(),
      }
    : isRetornoFundo
    ? {
        espaco: !draft.espaco,
        data: !draft.data,
        valor: !draft.valor || parseCurrencyBR(draft.valor) <= 0,
        descricao: !draft.descricao.trim(),
      }
    : {
        categoriaId: !draft.categoriaId,
        descricao: !draft.descricao.trim(),
        data: !draft.data,
        valor: !draft.valor || parseCurrencyBR(draft.valor) <= 0,
      }
  const hasErrors = Object.values(errors).some(Boolean)

  async function handleSave() {
    setSubmitted(true)
    if (hasErrors) return
    setSaving(true)
    setErro(null)
    try {
      // Aporte societário e retorno do Fundo de Caixa não têm categoria própria
      // no cadastro — usam "Outros" e já entram como transação concluída (são
      // sempre um movimento já efetivado, nunca pendente).
      const categoriaAporte = categorias.find(c => c.slug === 'outros')?.id ?? categoriasDisponiveis[0]?.id ?? ''
      const nova = await onSave(isAporte ? {
        categoriaId: categoriaAporte,
        eventoId,
        espaco: draft.espaco,
        descricao: draft.descricao.trim(),
        data: draft.data,
        dataRecebimento: draft.data,
        valor: parseCurrencyBR(draft.valor),
        status: 'pago',
        observacoes: draft.observacoes.trim() || undefined,
        tipoEntrada: isAporteObra ? 'aporte_obra' : 'aporte_societario',
        socioResponsavel: draft.socioResponsavel,
      } : isRetornoFundo ? {
        categoriaId: categoriaAporte,
        eventoId,
        espaco: draft.espaco,
        descricao: draft.descricao.trim(),
        data: draft.data,
        dataRecebimento: draft.data,
        valor: parseCurrencyBR(draft.valor),
        status: 'pago',
        observacoes: draft.observacoes.trim() || undefined,
        tipoEntrada: 'retorno_fundo_caixa',
      } : {
        categoriaId: draft.categoriaId,
        eventoId,
        espaco: draft.espaco || undefined,
        cliente: draft.cliente.trim() || undefined,
        descricao: draft.descricao.trim(),
        data: draft.data,
        dataRecebimento: draft.dataRecebimento || undefined,
        valor: parseCurrencyBR(draft.valor),
        status: draft.status,
        metodoPagamento: draft.metodoPagamento || undefined,
        observacoes: draft.observacoes.trim() || undefined,
        tipoEntrada: draft.tipoEntrada,
      })

      if (comprovante) {
        try {
          await saveFile(comprovante, {
            module: 'receitas',
            entityId: nova.id,
            entityName: draft.descricao.trim(),
            espaco: draft.espaco || undefined,
            categoria: isAporteObra ? 'comprovante_aporte_obra' : isAporteSocietario ? 'comprovante_aporte' : isRetornoFundo ? 'comprovante_retorno_fundo' : 'comprovante',
          })
        } catch {
          setErro('Entrada salva, mas não foi possível anexar o comprovante automaticamente. Anexe depois pela lista.')
          return
        }
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-app-border bg-app-surface shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[#25D366]" />
            <h2 className="text-sm font-semibold text-app-text">Nova Entrada</h2>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {permiteEscolherTipo && (
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">
                Tipo de Entrada<span className="text-red-400 ml-0.5">*</span>
              </label>
              <select
                value={draft.tipoEntrada}
                onChange={e => set('tipoEntrada', e.target.value as TipoEntrada)}
                className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              >
                {(Object.keys(TIPO_ENTRADA_LABEL) as TipoEntrada[]).map(t => (
                  <option key={t} value={t}>{TIPO_ENTRADA_LABEL[t]}</option>
                ))}
              </select>
              {isAporteSocietario && (
                <p className="text-xs text-app-subtle mt-1">
                  Não conta como faturamento — aumenta o caixa, mas fica separado nos relatórios.
                </p>
              )}
              {isAporteObra && (
                <p className="text-xs text-app-subtle mt-1">
                  Não conta como faturamento nem como receita operacional — entra só no Fechamento da Obra.
                </p>
              )}
              {isRetornoFundo && (
                <p className="text-xs text-app-subtle mt-1">
                  Não é receita — é só uma transferência de saldo do Fundo de Caixa de volta pro caixa disponível.
                </p>
              )}
            </div>
          )}

          {isRetornoFundo ? (
            <>
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Espaço<span className="text-red-400 ml-0.5">*</span></label>
                <select
                  value={draft.espaco}
                  onChange={e => set('espaco', e.target.value)}
                  className={`w-full cursor-pointer rounded-lg border ${submitted && errors.espaco ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                >
                  <option value="">— Selecione —</option>
                  {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">Data do retorno<span className="text-red-400 ml-0.5">*</span></label>
                  <input
                    type="date"
                    value={draft.data}
                    onChange={e => set('data', e.target.value)}
                    className={`w-full rounded-lg border ${submitted && errors.data ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                  />
                </div>
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">Valor do retorno (R$)<span className="text-red-400 ml-0.5">*</span></label>
                  <input
                    type="text" inputMode="decimal"
                    value={draft.valor}
                    onChange={e => set('valor', e.target.value)}
                    placeholder="0,00"
                    className={`w-full rounded-lg border ${submitted && errors.valor ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">
                  Descrição / motivo<span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  value={draft.descricao}
                  onChange={e => set('descricao', e.target.value)}
                  placeholder="Ex: Retorno parcial do Fundo de Caixa — Complexo Jussara"
                  className={`w-full rounded-lg border ${submitted && errors.descricao ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                />
              </div>

              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Observações</label>
                <textarea
                  value={draft.observacoes}
                  onChange={e => set('observacoes', e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                />
              </div>
            </>
          ) : isAporte ? (
            <>
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Espaço<span className="text-red-400 ml-0.5">*</span></label>
                <select
                  value={draft.espaco}
                  onChange={e => { set('espaco', e.target.value); set('socioResponsavel', '') }}
                  className={`w-full cursor-pointer rounded-lg border ${submitted && errors.espaco ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                >
                  <option value="">— Selecione —</option>
                  {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-app-subtle mb-0.5 flex items-center gap-1.5">
                  <Handshake className="h-3.5 w-3.5" />
                  Sócio responsável pelo aporte<span className="text-red-400 ml-0.5">*</span>
                </label>
                <select
                  value={draft.socioResponsavel}
                  onChange={e => set('socioResponsavel', e.target.value)}
                  disabled={!draft.espaco}
                  className={`w-full cursor-pointer rounded-lg border ${submitted && errors.socioResponsavel ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none disabled:opacity-60 disabled:cursor-default`}
                >
                  <option value="">{draft.espaco ? '— Selecione —' : 'Selecione o espaço primeiro'}</option>
                  {sociosDoEspaco.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">Data do aporte<span className="text-red-400 ml-0.5">*</span></label>
                  <input
                    type="date"
                    value={draft.data}
                    onChange={e => set('data', e.target.value)}
                    className={`w-full rounded-lg border ${submitted && errors.data ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                  />
                </div>
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">Valor do aporte (R$)<span className="text-red-400 ml-0.5">*</span></label>
                  <input
                    type="text" inputMode="decimal"
                    value={draft.valor}
                    onChange={e => set('valor', e.target.value)}
                    placeholder="0,00"
                    className={`w-full rounded-lg border ${submitted && errors.valor ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">
                  Descrição / motivo<span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  value={draft.descricao}
                  onChange={e => set('descricao', e.target.value)}
                  placeholder="Ex: Reforço de caixa pra obra do telhado"
                  className={`w-full rounded-lg border ${submitted && errors.descricao ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                />
              </div>

              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Observações</label>
                <textarea
                  value={draft.observacoes}
                  onChange={e => set('observacoes', e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">
                  Categoria<span className="text-red-400 ml-0.5">*</span>
                </label>
                <select
                  value={draft.categoriaId}
                  onChange={e => set('categoriaId', e.target.value)}
                  className={`w-full cursor-pointer rounded-lg border ${submitted && errors.categoriaId ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                >
                  {categoriasDisponiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">
                  Descrição<span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  value={draft.descricao}
                  onChange={e => set('descricao', e.target.value)}
                  placeholder="Ex: Venda de bebidas — evento Família Silva"
                  className={`w-full rounded-lg border ${submitted && errors.descricao ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">Cliente</label>
                  <input
                    value={draft.cliente}
                    onChange={e => set('cliente', e.target.value)}
                    placeholder="Opcional"
                    disabled={!!clientePadrao}
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none disabled:opacity-60 disabled:cursor-default"
                  />
                </div>
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">Espaço</label>
                  <select
                    value={draft.espaco}
                    onChange={e => set('espaco', e.target.value)}
                    disabled={!!espacoPadrao}
                    className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none disabled:opacity-60 disabled:cursor-default"
                  >
                    <option value="">— Nenhum —</option>
                    {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">
                    Data<span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <input
                    type="date"
                    value={draft.data}
                    onChange={e => set('data', e.target.value)}
                    className={`w-full rounded-lg border ${submitted && errors.data ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                  />
                </div>
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">
                    Valor (R$)<span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <input
                    type="text" inputMode="decimal"
                    value={draft.valor}
                    onChange={e => set('valor', e.target.value)}
                    placeholder="0,00"
                    className={`w-full rounded-lg border ${submitted && errors.valor ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">Status</label>
                  <select
                    value={draft.status}
                    onChange={e => set('status', e.target.value as Draft['status'])}
                    className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="atrasado">Atrasado</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">Data de recebimento</label>
                  <input
                    type="date"
                    value={draft.dataRecebimento}
                    onChange={e => set('dataRecebimento', e.target.value)}
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Método de pagamento</label>
                <select
                  value={draft.metodoPagamento}
                  onChange={e => set('metodoPagamento', e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                >
                  <option value="">— Selecione —</option>
                  {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Observações</label>
                <textarea
                  value={draft.observacoes}
                  onChange={e => set('observacoes', e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Comprovante {isAporte ? '' : '(opcional)'}</label>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
              onChange={e => setComprovante(e.target.files?.[0] ?? null)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => setComprovante(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
                <Paperclip className="h-3.5 w-3.5" />
                {comprovante ? comprovante.name : 'Selecionar arquivo…'}
              </button>
              <button type="button" onClick={() => cameraRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
                <Camera className="h-3.5 w-3.5" />
                Tirar foto
              </button>
            </div>
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
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: GREEN }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = DARK_GREEN }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
