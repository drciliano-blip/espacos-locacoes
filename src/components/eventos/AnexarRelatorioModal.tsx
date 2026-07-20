'use client'

import { useRef, useState } from 'react'
import { X, Save, Sparkles, Paperclip, FileText } from 'lucide-react'
import { saveFile } from '@/lib/file-storage'
import type { CategoriaReceita, NovaReceitaInput } from '@/contexts/ReceitasContext'
import type { Evento } from '@/types'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

type TipoRelatorio = 'faturamento_evento' | 'bar' | 'ingressos_antecipados' | 'portaria' | 'alimentacao' | 'outros'

interface TipoConfig {
  key: TipoRelatorio
  label: string
  categoriaSlug: string
}

const TIPOS: TipoConfig[] = [
  { key: 'faturamento_evento',    label: 'Faturamento do evento',   categoriaSlug: 'aluguel' },
  { key: 'bar',                   label: 'Bar',                     categoriaSlug: 'bebidas' },
  { key: 'ingressos_antecipados', label: 'Ingressos antecipados',   categoriaSlug: 'ingressos' },
  { key: 'portaria',              label: 'Portaria',                categoriaSlug: 'ingressos' },
  { key: 'alimentacao',           label: 'Alimentação',             categoriaSlug: 'outros' },
  { key: 'outros',                label: 'Outros',                  categoriaSlug: 'outros' },
]

function parseValorBR(valor: string): string {
  const numeric = valor.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3},)/g, '').replace(',', '.')
  const n = parseFloat(numeric)
  return Number.isFinite(n) ? String(n) : ''
}

interface Props {
  evento: Evento
  categorias: CategoriaReceita[]
  onClose: () => void
  onSaveReceita: (input: NovaReceitaInput) => Promise<void>
  onSyncAluguel: (evento: { id: string; cliente: string; espaco: string; data: string; valor: number }) => Promise<void>
}

export default function AnexarRelatorioModal({ evento, categorias, onClose, onSaveReceita, onSyncAluguel }: Props) {
  const [tipo, setTipo] = useState<TipoRelatorio>('bar')
  const [file, setFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const tipoConfig = TIPOS.find(t => t.key === tipo)!
  const isAluguel = tipoConfig.categoriaSlug === 'aluguel'

  async function handleFile(f: File | null) {
    setFile(f)
    setError(null)
    if (!f) return

    setExtracting(true)
    try {
      await saveFile(f, {
        module: 'receitas',
        entityId: evento.id,
        entityName: evento.cliente,
        espaco: evento.espaco,
        categoria: tipo,
      })

      const body = new FormData()
      body.append('file', f)
      const res = await fetch('/api/extract-receita', { method: 'POST', body })
      const data: { valor?: string | null; descricao?: string | null; error?: string } = await res.json()

      if (!res.ok || data.error) {
        setError(data.error ?? 'Não foi possível ler o documento com a IA. Preencha o valor manualmente.')
      } else {
        if (data.valor) setValor(parseValorBR(data.valor))
        if (data.descricao) setDescricao(data.descricao)
      }
    } catch {
      setError('Falha ao enviar o arquivo. Tente novamente.')
    } finally {
      setExtracting(false)
    }
  }

  const hasErrors = !file || !valor || Number.isNaN(Number(valor)) || Number(valor) <= 0 || (!isAluguel && !descricao.trim())

  async function handleSave() {
    setSubmitted(true)
    if (hasErrors) return
    setSaving(true)
    try {
      if (isAluguel) {
        await onSyncAluguel({ id: evento.id, cliente: evento.cliente, espaco: evento.espaco, data: evento.data, valor: Number(valor) })
      } else {
        const categoria = categorias.find(c => c.slug === tipoConfig.categoriaSlug)
        if (!categoria) {
          setError(`Categoria "${tipoConfig.categoriaSlug}" não encontrada.`)
          setSaving(false)
          return
        }
        await onSaveReceita({
          categoriaId: categoria.id,
          eventoId: evento.id,
          espaco: evento.espaco,
          cliente: evento.cliente,
          descricao: descricao.trim(),
          data: evento.data,
          valor: Number(valor),
          status: 'pendente',
        })
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
            <FileText className="h-4 w-4 text-[#25D366]" />
            <h2 className="text-sm font-semibold text-app-text">Anexar relatório</h2>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Tipo de relatório</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value as TipoRelatorio)}
              className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            >
              {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            {isAluguel && (
              <p className="text-xs text-app-subtle mt-1">
                Este tipo atualiza a receita de aluguel já sincronizada com o evento — não cria uma receita nova.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-1 block">Documento (PDF ou imagem)</label>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => handleFile(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={extracting}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {file ? file.name : 'Selecionar arquivo…'}
              </button>
              {extracting && (
                <span className="flex items-center gap-1.5 text-xs text-[#128C7E]">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  Lendo com IA…
                </span>
              )}
            </div>
            {submitted && !file && <p className="text-xs text-red-400 mt-0.5">Anexe o relatório antes de salvar</p>}
          </div>

          {error && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
              <p className="text-xs text-amber-500">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">
                Valor (R$)<span className="text-red-400 ml-0.5">*</span>
              </label>
              <input
                type="number" min="0" step="0.01"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0,00"
                className={`w-full rounded-lg border ${submitted && (!valor || Number(valor) <= 0) ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
            {!isAluguel && (
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">
                  Descrição<span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Ex: Bar — evento Família Silva"
                  className={`w-full rounded-lg border ${submitted && !descricao.trim() ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || extracting}
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
