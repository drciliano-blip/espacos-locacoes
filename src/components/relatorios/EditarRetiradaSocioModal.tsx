'use client'

import { useRef, useState } from 'react'
import { X, Save, Landmark, Paperclip, Camera, Trash2 } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { parseCurrencyBR, formatCurrency } from '@/lib/utils'
import { saveFile } from '@/lib/file-storage'
import { DIVISAO_SOCIOS } from '@/lib/socios-config'
import type { ContaPagar } from '@/types'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

interface Props {
  conta: ContaPagar
  onClose: () => void
  onSave: (c: ContaPagar) => Promise<void>
  onExcluir: (id: string) => Promise<void>
}

// Edita uma retirada de sócio já lançada — nunca cria um registro novo, só
// atualiza o existente (mesmo id). Como Financeiro/Relatórios/saldo do sócio
// leem tudo de ContasPagarContext, salvar aqui já propaga pra tela toda.
export default function EditarRetiradaSocioModal({ conta, onClose, onSave, onExcluir }: Props) {
  const { espacosNomes } = useEspacos()
  const [espaco, setEspaco] = useState(conta.espaco !== 'Todos' ? conta.espaco : '')
  const [socio, setSocio] = useState(conta.fornecedor ?? '')
  const [valor, setValor] = useState(String(conta.valor))
  const [data, setData] = useState(conta.dataPagamento ?? conta.dataVencimento)
  const [descricao, setDescricao] = useState(conta.descricao)
  const [observacoes, setObservacoes] = useState(conta.observacoes ?? '')
  const [novoComprovante, setNovoComprovante] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const sociosDoEspaco = espaco ? (DIVISAO_SOCIOS[espaco] ?? []).map(s => s.nome) : []

  const errors = {
    espaco: !espaco,
    socio: !socio,
    valor: !valor || parseCurrencyBR(valor) <= 0,
    data: !data,
    descricao: !descricao.trim(),
  }
  const hasErrors = Object.values(errors).some(Boolean)

  async function handleSalvar() {
    setSubmitted(true)
    if (hasErrors) return
    setSaving(true)
    setErro(null)
    try {
      await onSave({
        ...conta,
        descricao: descricao.trim(),
        espaco: espaco as ContaPagar['espaco'],
        valor: parseCurrencyBR(valor),
        dataVencimento: data,
        dataPagamento: data,
        fornecedor: socio,
        observacoes: observacoes.trim() || undefined,
      })
      if (novoComprovante) {
        try {
          await saveFile(novoComprovante, {
            module: 'contas',
            entityId: conta.id,
            entityName: descricao.trim(),
            espaco,
            categoria: 'comprovante_retirada_socio',
          })
        } catch {
          setErro('Retirada atualizada, mas não foi possível anexar o novo comprovante. Tente novamente pela lista de documentos.')
          return
        }
      }
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? `Falha ao salvar: ${err.message}` : 'Falha ao salvar a retirada. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleExcluir() {
    setExcluindo(true)
    try {
      await onExcluir(conta.id)
      onClose()
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-app-surface rounded-2xl border border-app-border shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <Landmark className="h-4 w-4 text-fuchsia-500" />
            Editar Retirada de Sócio
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Espaço<span className="text-red-400 ml-0.5">*</span></label>
              <select
                value={espaco}
                onChange={e => { setEspaco(e.target.value); setSocio('') }}
                className={`w-full cursor-pointer rounded-lg border ${submitted && errors.espaco ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              >
                <option value="">— Selecione —</option>
                {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Sócio<span className="text-red-400 ml-0.5">*</span></label>
              <select
                value={socio}
                onChange={e => setSocio(e.target.value)}
                disabled={!espaco}
                className={`w-full cursor-pointer rounded-lg border ${submitted && errors.socio ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none disabled:opacity-60 disabled:cursor-default`}
              >
                <option value="">{espaco ? '— Selecione —' : 'Selecione o espaço primeiro'}</option>
                {sociosDoEspaco.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                {socio && !sociosDoEspaco.includes(socio) && <option value={socio}>{socio}</option>}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Data<span className="text-red-400 ml-0.5">*</span></label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className={`w-full rounded-lg border ${submitted && errors.data ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
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
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Descrição<span className="text-red-400 ml-0.5">*</span></label>
            <input
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              className={`w-full rounded-lg border ${submitted && errors.descricao ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
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
                Excluir "{conta.descricao}" — {formatCurrency(conta.valor)}? Esta ação não pode ser desfeita.
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
              Excluir esta retirada
            </button>
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
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
