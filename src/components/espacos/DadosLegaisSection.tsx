'use client'

import { useState } from 'react'
import { Pencil, Save, ShieldCheck } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { useCurrentUser } from '@/contexts/UserContext'
import type { DadosLegaisEspaco } from '@/types'

const GREEN = '#25D366'

interface Props {
  espacoId: string
  dadosLegais?: DadosLegaisEspaco
}

export default function DadosLegaisSection({ espacoId, dadosLegais }: Props) {
  const { updateDadosLegais } = useEspacos()
  const { role } = useCurrentUser()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DadosLegaisEspaco>(dadosLegais ?? {})
  const [saving, setSaving] = useState(false)

  function abrirEdicao() {
    setDraft(dadosLegais ?? {})
    setEditing(true)
  }

  async function salvar() {
    setSaving(true)
    try {
      await updateDadosLegais(espacoId, draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const campos: { key: keyof DadosLegaisEspaco; label: string }[] = [
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'responsavelNome', label: 'Responsável (nome)' },
    { key: 'responsavelRg', label: 'Responsável (RG)' },
    { key: 'responsavelCpf', label: 'Responsável (CPF)' },
  ]

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-app-text">
          <ShieldCheck className="h-4 w-4 text-app-subtle" />
          Dados legais (CEDENTE/LOCADORA nos contratos)
        </p>
        {!editing && role === 'admin' && (
          <button
            onClick={abrirEdicao}
            className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-muted hover:bg-app-surface2 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {campos.map(({ key, label }) => (
            <div key={key}>
              <p className="text-xs text-app-subtle">{label}</p>
              <p className="text-sm text-app-text mt-0.5">
                {dadosLegais?.[key] || <span className="text-app-subtle italic">—</span>}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campos.map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs text-app-subtle mb-0.5 block">{label}</label>
                <input
                  value={draft[key] ?? ''}
                  onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: GREEN }}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
