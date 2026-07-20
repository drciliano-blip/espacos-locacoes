'use client'

import { useRef, useState } from 'react'
import { X, Save, Building2, Image as ImageIcon } from 'lucide-react'
import { saveFile } from '@/lib/file-storage'
import { useEspacos } from '@/contexts/EspacosContext'
import type { EspacoCustomData } from '@/types'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

interface Props {
  onClose: () => void
  onSave: (espaco: EspacoCustomData) => void
}

interface Draft {
  nome: string
  endereco: string
  capacidade: string
  descricao: string
  status: 'ativo' | 'inativo'
}

const EMPTY: Draft = { nome: '', endereco: '', capacidade: '', descricao: '', status: 'ativo' }

export default function NovoEspacoModal({ onClose, onSave }: Props) {
  const { addEspaco } = useEspacos()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [foto, setFoto] = useState<File | null>(null)
  const [espacoId] = useState(() => `esp-${Date.now()}`)
  const fileRef = useRef<HTMLInputElement>(null)

  const errors = {
    nome: !draft.nome.trim(),
  }
  const hasErrors = Object.values(errors).some(Boolean)

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft(d => ({ ...d, [k]: v }))
  }

  async function handleSave() {
    setSubmitted(true)
    if (hasErrors) return
    setSaving(true)

    let fotoFileId: string | undefined
    if (foto) {
      const stored = await saveFile(foto, {
        module: 'espacos',
        entityId: espacoId,
        entityName: draft.nome.trim(),
      })
      fotoFileId = stored.id
    }

    const novo = await addEspaco({
      id: espacoId,
      nome: draft.nome.trim(),
      endereco: draft.endereco.trim(),
      capacidade: Number(draft.capacidade) || 0,
      descricao: draft.descricao.trim(),
      status: draft.status,
      fotoFileId,
    })

    setSaving(false)
    onSave(novo)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-app-surface rounded-2xl border border-app-border shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#25D366]" />
            <h2 className="text-sm font-semibold text-app-text">Novo Espaço</h2>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">
              Nome do espaço<span className="text-red-400 ml-0.5">*</span>
            </label>
            <input
              value={draft.nome}
              onChange={e => set('nome', e.target.value)}
              placeholder="Ex: Villa Jardins"
              className={`w-full rounded-lg border ${submitted && errors.nome ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
              onBlur={e => { e.currentTarget.style.borderColor = '' }}
            />
            {submitted && errors.nome && <p className="text-xs text-red-400 mt-0.5">Campo obrigatório</p>}
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Endereço completo</label>
            <input
              value={draft.endereco}
              onChange={e => set('endereco', e.target.value)}
              placeholder="Rua, número, bairro, cidade/UF"
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
              onBlur={e => { e.currentTarget.style.borderColor = '' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Capacidade máxima</label>
              <input
                type="number" min="0"
                value={draft.capacidade}
                onChange={e => set('capacidade', e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Status</label>
              <select
                value={draft.status}
                onChange={e => set('status', e.target.value as Draft['status'])}
                className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Descrição</label>
            <textarea
              value={draft.descricao}
              onChange={e => set('descricao', e.target.value)}
              rows={3}
              placeholder="Breve descrição do espaço…"
              className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
              onBlur={e => { e.currentTarget.style.borderColor = '' }}
            />
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-1 block">Foto</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFoto(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                {foto ? foto.name : 'Selecionar imagem…'}
              </button>
              {foto && (
                <button onClick={() => { setFoto(null); if (fileRef.current) fileRef.current.value = '' }} className="text-xs text-red-500 hover:underline">
                  remover
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !draft.nome.trim()}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: GREEN }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = DARK_GREEN }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando…' : 'Salvar espaço'}
          </button>
        </div>
      </div>
    </div>
  )
}
