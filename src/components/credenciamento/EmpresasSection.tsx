'use client'

import { useState } from 'react'
import { Building2, Plus, X, Save, Pencil, Trash2, Phone, User, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteFile } from '@/lib/file-storage'
import { hojeISO, maskCNPJ, maskPhone, mensagemDeErro } from '@/lib/utils'
import { situacaoEmpresa } from '@/lib/credenciamento-config'
import type { EmpresaTerceirizada, Terceirizado } from '@/types'
import DocumentosCredenciamento from './DocumentosCredenciamento'
import { DARK_GREEN, empresaFromRow, GREEN, INPUT_CLASS, SELECT_EMPRESA, SITUACAO_LABEL, type EmpresaRow } from './dados'

interface Props {
  empresas: EmpresaTerceirizada[]
  pessoas: Terceirizado[]
  onChange: (empresas: EmpresaTerceirizada[]) => void
}

const EMPTY = { nome: '', cnpj: '', contatoNome: '', telefone: '', email: '', observacoes: '' }

export default function EmpresasSection({ empresas, pessoas, onChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<EmpresaTerceirizada | null>(null)
  const [draft, setDraft] = useState(EMPTY)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function abrir(empresa: EmpresaTerceirizada | null) {
    setEditando(empresa)
    setDraft(empresa
      ? { nome: empresa.nome, cnpj: empresa.cnpj, contatoNome: empresa.contatoNome, telefone: empresa.telefone, email: empresa.email, observacoes: empresa.observacoes }
      : EMPTY)
    setSubmitted(false)
    setErro(null)
    setModalOpen(true)
  }

  function set<K extends keyof typeof EMPTY>(k: K, v: string) {
    setDraft(d => ({ ...d, [k]: v }))
  }

  async function handleSave() {
    setSubmitted(true)
    setErro(null)
    if (!draft.nome.trim()) return

    setBusy(true)
    const supabase = createClient()
    const valores = {
      nome: draft.nome.trim(),
      cnpj: draft.cnpj.trim() || null,
      contato_nome: draft.contatoNome.trim() || null,
      telefone: draft.telefone.trim() || null,
      email: draft.email.trim() || null,
      observacoes: draft.observacoes.trim() || null,
    }
    const consulta = editando
      ? supabase.from('empresas_terceirizadas').update(valores).eq('id', editando.id)
      : supabase.from('empresas_terceirizadas').insert(valores)
    const { data, error } = await consulta.select(SELECT_EMPRESA).single()

    setBusy(false)
    if (error) return setErro(mensagemDeErro(error, 'Não foi possível salvar a empresa. Tente novamente.'))

    const salva = empresaFromRow(data as unknown as EmpresaRow)
    onChange(editando ? empresas.map(e => e.id === salva.id ? salva : e) : [...empresas, salva].sort((a, b) => a.nome.localeCompare(b.nome)))
    setModalOpen(false)
  }

  async function handleRemove(empresa: EmpresaTerceirizada) {
    setErroLista(null)
    const vinculados = pessoas.filter(p => p.empresaId === empresa.id).length
    if (vinculados > 0) {
      return setErroLista(`${empresa.nome} tem ${vinculados} pessoa${vinculados === 1 ? '' : 's'} vinculada${vinculados === 1 ? '' : 's'}. Altere a ficha dessas pessoas antes de remover a empresa.`)
    }
    if (!window.confirm(`Remover a empresa "${empresa.nome}"? Os documentos anexados também serão apagados.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('empresas_terceirizadas').delete().eq('id', empresa.id)
    if (error) return setErroLista(mensagemDeErro(error, 'Não foi possível remover a empresa.'))
    // As linhas de documento caem em cascata no banco; os arquivos, não.
    await Promise.all(empresa.documentos.filter(d => d.fileId).map(d => deleteFile(d.fileId!).catch(() => {})))
    onChange(empresas.filter(e => e.id !== empresa.id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-semibold text-app-text">{empresas.length} empresa{empresas.length === 1 ? '' : 's'} cadastrada{empresas.length === 1 ? '' : 's'}</p>
        <button
          onClick={() => abrir(null)}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: GREEN }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = DARK_GREEN }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
        >
          <Plus className="h-4 w-4" />
          Nova empresa
        </button>
      </div>

      {erroLista && <p className="text-xs text-red-400">{erroLista}</p>}

      <div className="space-y-2">
        {empresas.length === 0 ? (
          <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center">
            <p className="text-sm text-app-subtle">Nenhuma empresa cadastrada.</p>
          </div>
        ) : empresas.map(e => {
          const vinculados = pessoas.filter(p => p.empresaId === e.id).length
          const situacao = situacaoEmpresa(e.documentos, hojeISO())
          return (
            <div key={e.id} className="rounded-lg border border-app-border2/50 bg-app-surface2/40 overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-app-text truncate">{e.nome}</p>
                  {situacao !== 'apto' && (
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${SITUACAO_LABEL[situacao].className}`}>
                      {situacao === 'pendente' ? 'Documento vencido' : SITUACAO_LABEL[situacao].label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-app-subtle">
                  {e.cnpj && <span>CNPJ {e.cnpj}</span>}
                  {e.contatoNome && <span className="flex items-center gap-1"><User className="h-3 w-3" />{e.contatoNome}</span>}
                  {e.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.telefone}</span>}
                  <span>· {vinculados} pessoa{vinculados === 1 ? '' : 's'}</span>
                  <span>· {e.documentos.length} documento{e.documentos.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => abrir(e)} title="Editar"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleRemove(e)} title="Remover"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setExpandedId(id => id === e.id ? null : e.id)} title="Documentos"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 transition-colors">
                  {expandedId === e.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {expandedId === e.id && (
              <div className="px-4 pb-4 pt-3 border-t border-app-border/50">
                <DocumentosCredenciamento
                  dono={{ tabela: 'empresa_documentos', coluna: 'empresa_id', id: e.id, nome: e.nome }}
                  documentos={e.documentos}
                  exigidos={[]}
                  placeholderOutro="Ex: Autorização de funcionamento (Polícia Federal)"
                  onChange={documentos => onChange(empresas.map(x => x.id === e.id ? { ...x, documentos } : x))}
                />
              </div>
            )}
            </div>
          )
        })}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
              <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#25D366]" />
                {editando ? 'Editar empresa' : 'Nova empresa'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-app-muted mb-1">Nome da empresa *</label>
                <input value={draft.nome} onChange={e => set('nome', e.target.value)}
                  className={submitted && !draft.nome.trim() ? `${INPUT_CLASS} border-red-500/50` : INPUT_CLASS} />
                {submitted && !draft.nome.trim() && <p className="text-xs text-red-400 mt-0.5">Campo obrigatório</p>}
              </div>
              <div>
                <label className="block text-xs text-app-muted mb-1">CNPJ</label>
                <input value={draft.cnpj} onChange={e => set('cnpj', maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-xs text-app-muted mb-1">Pessoa de contato</label>
                <input value={draft.contatoNome} onChange={e => set('contatoNome', e.target.value)} className={INPUT_CLASS} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-app-muted mb-1">Telefone</label>
                  <input value={draft.telefone} onChange={e => set('telefone', maskPhone(e.target.value))} placeholder="(11) 99999-9999" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="block text-xs text-app-muted mb-1">E-mail</label>
                  <input type="email" value={draft.email} onChange={e => set('email', e.target.value)} className={INPUT_CLASS} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-app-muted mb-1">Observações</label>
                <textarea value={draft.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} className={INPUT_CLASS} />
              </div>
              {erro && <p className="text-xs text-red-400">{erro}</p>}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
              <button onClick={() => setModalOpen(false)} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={busy}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: GREEN }}>
                <Save className="h-3.5 w-3.5" />
                {busy ? 'Salvando…' : 'Salvar empresa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
