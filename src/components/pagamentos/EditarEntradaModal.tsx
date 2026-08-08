'use client'

import { useRef, useState } from 'react'
import { X, Save, Pencil, Paperclip, Camera, Trash2, Handshake } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { parseCurrencyBR, formatCurrency } from '@/lib/utils'
import { saveFile } from '@/lib/file-storage'
import { DIVISAO_SOCIOS, SOCIOS_OBRA } from '@/lib/socios-config'
import type { CategoriaReceita, EditarReceitaInput, Receita, TipoEntrada } from '@/contexts/ReceitasContext'
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
  receita: Receita
  categorias: CategoriaReceita[]
  onClose: () => void
  onSave: (id: string, patch: EditarReceitaInput) => Promise<void>
  onExcluir: (id: string) => Promise<void>
}

export default function EditarEntradaModal({ receita, categorias, onClose, onSave, onExcluir }: Props) {
  const { espacosNomes } = useEspacos()
  const [tipoEntrada, setTipoEntrada] = useState<TipoEntrada>(receita.tipoEntrada)
  const [categoriaId, setCategoriaId] = useState(receita.categoriaId)
  const [espaco, setEspaco] = useState(receita.espaco ?? '')
  const [cliente, setCliente] = useState(receita.cliente ?? '')
  const [descricao, setDescricao] = useState(receita.descricao)
  const [data, setData] = useState(receita.data)
  const [dataRecebimento, setDataRecebimento] = useState(receita.dataRecebimento ?? '')
  const [valor, setValor] = useState(String(receita.valor))
  const [status, setStatus] = useState<Receita['status']>(receita.status)
  const [metodoPagamento, setMetodoPagamento] = useState(receita.metodoPagamento ?? '')
  const [observacoes, setObservacoes] = useState(receita.observacoes ?? '')
  const [socioResponsavel, setSocioResponsavel] = useState(receita.socioResponsavel ?? '')
  const [novoComprovante, setNovoComprovante] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const isAporteObra = tipoEntrada === 'aporte_obra'
  const isAporte = tipoEntrada === 'aporte_societario' || isAporteObra
  const sociosDoEspaco: string[] = !espaco ? [] : isAporteObra
    ? (SOCIOS_OBRA[espaco] ?? [])
    : (DIVISAO_SOCIOS[espaco] ?? []).map(s => s.nome)

  const errors = {
    descricao: !descricao.trim(),
    data: !data,
    valor: !valor || parseCurrencyBR(valor) <= 0,
    socioResponsavel: isAporte && !socioResponsavel,
    categoriaId: !isAporte && !categoriaId,
  }
  const hasErrors = Object.values(errors).some(Boolean)

  async function handleSave() {
    setSubmitted(true)
    if (hasErrors) return
    setSaving(true)
    setErro(null)
    try {
      const categoriaAporte = categorias.find(c => c.slug === 'outros')?.id ?? categoriaId
      await onSave(receita.id, {
        categoriaId: isAporte ? categoriaAporte : categoriaId,
        espaco: espaco || undefined,
        cliente: isAporte ? undefined : (cliente.trim() || undefined),
        descricao: descricao.trim(),
        data,
        dataRecebimento: isAporte ? data : (dataRecebimento || undefined),
        valor: parseCurrencyBR(valor),
        status: isAporte ? 'pago' : status,
        metodoPagamento: isAporte ? undefined : (metodoPagamento || undefined),
        observacoes: observacoes.trim() || undefined,
        tipoEntrada,
        socioResponsavel: isAporte ? socioResponsavel : undefined,
      })

      if (novoComprovante) {
        try {
          await saveFile(novoComprovante, {
            module: 'receitas',
            entityId: receita.id,
            entityName: descricao.trim(),
            espaco: espaco || undefined,
            categoria: isAporteObra ? 'comprovante_aporte_obra' : isAporte ? 'comprovante_aporte' : 'comprovante',
          })
        } catch {
          setErro('Entrada atualizada, mas não foi possível anexar o novo comprovante. Tente novamente pela lista de documentos.')
          return
        }
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleExcluir() {
    setExcluindo(true)
    try {
      await onExcluir(receita.id)
      onClose()
    } finally {
      setExcluindo(false)
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
            <Pencil className="h-4 w-4 text-[#25D366]" />
            <h2 className="text-sm font-semibold text-app-text">Editar Entrada</h2>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Tipo de Entrada</label>
            <select
              value={tipoEntrada}
              onChange={e => setTipoEntrada(e.target.value as TipoEntrada)}
              className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            >
              {(Object.keys(TIPO_ENTRADA_LABEL) as TipoEntrada[]).map(t => (
                <option key={t} value={t}>{TIPO_ENTRADA_LABEL[t]}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Espaço</label>
              <select
                value={espaco}
                onChange={e => { setEspaco(e.target.value); setSocioResponsavel('') }}
                className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              >
                <option value="">— Nenhum —</option>
                {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            {isAporte ? (
              <div>
                <label className="text-xs text-app-subtle mb-0.5 flex items-center gap-1.5">
                  <Handshake className="h-3.5 w-3.5" />
                  Sócio responsável<span className="text-red-400 ml-0.5">*</span>
                </label>
                <select
                  value={socioResponsavel}
                  onChange={e => setSocioResponsavel(e.target.value)}
                  disabled={!espaco}
                  className={`w-full cursor-pointer rounded-lg border ${submitted && errors.socioResponsavel ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none disabled:opacity-60`}
                >
                  <option value="">{espaco ? '— Selecione —' : 'Selecione o espaço primeiro'}</option>
                  {sociosDoEspaco.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Categoria<span className="text-red-400 ml-0.5">*</span></label>
                <select
                  value={categoriaId}
                  onChange={e => setCategoriaId(e.target.value)}
                  className={`w-full cursor-pointer rounded-lg border ${submitted && errors.categoriaId ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                >
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
          </div>

          {!isAporte && (
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Cliente</label>
              <input
                value={cliente}
                onChange={e => setCliente(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">
              Descrição{isAporte ? ' / motivo' : ''}<span className="text-red-400 ml-0.5">*</span>
            </label>
            <input
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              className={`w-full rounded-lg border ${submitted && errors.descricao ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">
                Data{isAporte ? ' do aporte' : ''}<span className="text-red-400 ml-0.5">*</span>
              </label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className={`w-full rounded-lg border ${submitted && errors.data ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">
                Valor (R$)<span className="text-red-400 ml-0.5">*</span>
              </label>
              <input
                type="text" inputMode="decimal"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0,00"
                className={`w-full rounded-lg border ${submitted && errors.valor ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
          </div>

          {!isAporte && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as Receita['status'])}
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
                    value={dataRecebimento}
                    onChange={e => setDataRecebimento(e.target.value)}
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Método de pagamento</label>
                <select
                  value={metodoPagamento}
                  onChange={e => setMetodoPagamento(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                >
                  <option value="">— Selecione —</option>
                  {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Observações</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Substituir comprovante (opcional)</label>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
              onChange={e => setNovoComprovante(e.target.files?.[0] ?? null)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => setNovoComprovante(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
                <Paperclip className="h-3.5 w-3.5" />
                {novoComprovante ? novoComprovante.name : 'Selecionar novo arquivo…'}
              </button>
              <button type="button" onClick={() => cameraRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
                <Camera className="h-3.5 w-3.5" />
                Tirar foto
              </button>
            </div>
            <p className="text-xs text-app-subtle mt-1">O anexo antigo continua disponível — isso adiciona um novo, não apaga o anterior.</p>
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

          {confirmarExclusao ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
              <p className="text-xs text-red-400">
                Excluir "{receita.descricao}" — {formatCurrency(receita.valor)}? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmarExclusao(false)} disabled={excluindo}
                  className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleExcluir} disabled={excluindo}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                  {excluindo ? 'Excluindo…' : 'Confirmar exclusão'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmarExclusao(true)}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
              Excluir esta entrada
            </button>
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
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
