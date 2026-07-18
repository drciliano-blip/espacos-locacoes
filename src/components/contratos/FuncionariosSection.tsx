'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, X, Save, ChevronDown, ChevronUp, Phone, Briefcase, Trash2 } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { getFuncionarios, saveFuncionario, removeFuncionario } from '@/lib/funcionarios-store'
import FileList from '@/components/shared/FileList'
import FileAttachButton from '@/components/shared/FileAttachButton'
import type { Funcionario } from '@/types'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

interface Draft {
  nomeCompleto: string
  cargo: string
  espacoVinculado: string
  telefone: string
}

const EMPTY: Draft = { nomeCompleto: '', cargo: '', espacoVinculado: '', telefone: '' }

export default function FuncionariosSection() {
  const { espacosNomes } = useEspacos()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [filterEspaco, setFilterEspaco] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [submitted, setSubmitted] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setFuncionarios(getFuncionarios())
  }, [])

  const errors = { nomeCompleto: !draft.nomeCompleto.trim() }
  const hasErrors = Object.values(errors).some(Boolean)

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft(d => ({ ...d, [k]: v }))
  }

  function handleSave() {
    setSubmitted(true)
    if (hasErrors) return
    const novo: Funcionario = {
      id: `func-${Date.now()}`,
      nomeCompleto: draft.nomeCompleto.trim(),
      cargo: draft.cargo.trim(),
      espacoVinculado: draft.espacoVinculado,
      telefone: draft.telefone.trim(),
      criadoEm: new Date().toISOString(),
    }
    saveFuncionario(novo)
    setFuncionarios(prev => [novo, ...prev])
    setDraft(EMPTY)
    setSubmitted(false)
    setModalOpen(false)
  }

  function handleRemove(id: string) {
    removeFuncionario(id)
    setFuncionarios(prev => prev.filter(f => f.id !== id))
  }

  const filtered = filterEspaco ? funcionarios.filter(f => f.espacoVinculado === filterEspaco) : funcionarios

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366]/15">
            <Users className="h-4 w-4 text-[#25D366]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-app-text">{funcionarios.length} funcionários cadastrados</p>
          </div>
        </div>

        <select
          value={filterEspaco}
          onChange={e => setFilterEspaco(e.target.value)}
          className="ml-auto cursor-pointer rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:outline-none"
        >
          <option value="">Todos os espaços</option>
          {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: GREEN }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = DARK_GREEN }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
        >
          <Plus className="h-4 w-4" />
          Adicionar Funcionário
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center">
            <p className="text-sm text-app-subtle">Nenhum funcionário cadastrado.</p>
          </div>
        ) : filtered.map(f => (
          <div key={f.id} className="rounded-lg border border-app-border2/50 bg-app-surface2/40 overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-app-text truncate">{f.nomeCompleto}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {f.cargo && (
                    <span className="flex items-center gap-1 text-xs text-app-subtle">
                      <Briefcase className="h-3 w-3" />
                      {f.cargo}
                    </span>
                  )}
                  {f.espacoVinculado && <span className="text-xs text-app-subtle">· {f.espacoVinculado}</span>}
                  {f.telefone && (
                    <span className="flex items-center gap-1 text-xs text-app-subtle">
                      <Phone className="h-3 w-3" />
                      {f.telefone}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleRemove(f.id)} title="Remover"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setExpandedId(id => id === f.id ? null : f.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 transition-colors"
                  title="Documentos">
                  {expandedId === f.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {expandedId === f.id && (
              <div className="px-4 pb-4 pt-1 border-t border-app-border/50 space-y-3">
                <p className="text-xs font-medium text-app-muted flex items-center gap-1.5">Documentos anexados</p>
                <div className="flex flex-wrap gap-2">
                  <FileAttachButton module="funcionarios" entityId={f.id} entityName={f.nomeCompleto} espaco={f.espacoVinculado || undefined} categoria="rg_cnh" label="Anexar RG/CNH" />
                  <FileAttachButton module="funcionarios" entityId={f.id} entityName={f.nomeCompleto} espaco={f.espacoVinculado || undefined} categoria="contrato_trabalho" label="Anexar contrato de trabalho" />
                  <FileAttachButton module="funcionarios" entityId={f.id} entityName={f.nomeCompleto} espaco={f.espacoVinculado || undefined} categoria="outro" label="Outros documentos" />
                </div>
                <FileList module="funcionarios" entityId={f.id} entityName={f.nomeCompleto} espaco={f.espacoVinculado || undefined} showAttach={false} compact />
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
              <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
                <Users className="h-4 w-4 text-[#25D366]" />
                Novo Funcionário
              </h2>
              <button onClick={() => setModalOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-app-muted mb-1">Nome completo *</label>
                <input value={draft.nomeCompleto} onChange={e => set('nomeCompleto', e.target.value)}
                  className={`w-full rounded-lg border ${submitted && errors.nomeCompleto ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none`}
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                />
                {submitted && errors.nomeCompleto && <p className="text-xs text-red-400 mt-0.5">Campo obrigatório</p>}
              </div>
              <div>
                <label className="block text-xs text-app-muted mb-1">Cargo</label>
                <input value={draft.cargo} onChange={e => set('cargo', e.target.value)}
                  placeholder="Ex: Recepcionista"
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                />
              </div>
              <div>
                <label className="block text-xs text-app-muted mb-1">Espaço vinculado</label>
                <select value={draft.espacoVinculado} onChange={e => set('espacoVinculado', e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                >
                  <option value="">— Selecione —</option>
                  {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-app-muted mb-1">Telefone</label>
                <input value={draft.telefone} onChange={e => set('telefone', e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                />
              </div>
              <p className="text-xs text-app-subtle italic">Os anexos (RG/CNH, contrato de trabalho, outros documentos) podem ser adicionados após salvar, expandindo o funcionário na lista.</p>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
              <button onClick={() => setModalOpen(false)} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: GREEN }}>
                <Save className="h-3.5 w-3.5" />
                Salvar funcionário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
