'use client'

import { useState } from 'react'
import { X, Save, Edit3, Users, DollarSign, Phone, User, Calendar, ClipboardCheck, Paperclip, Upload, Trash2, FileText, FileCheck, FileWarning, FileBadge, File } from 'lucide-react'
import type { Evento, FormaPagamento, Decoracao, StatusVistoria, TipoEvento, Documento } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

const statusBadge: Record<string, string> = {
  confirmado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  tentativo: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  cancelado: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const vistoriaStyles: Record<StatusVistoria, string> = {
  'aprovada': 'text-emerald-400',
  'aprovada com ressalvas': 'text-amber-400',
  'reprovada': 'text-red-400',
  'pendente': 'text-app-muted',
  'não realizada': 'text-app-subtle',
}

const tipoEventoBadge: Record<TipoEvento, string> = {
  'Festivo': 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  'Corporativo': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'Audiovisual': 'bg-orange-500/15 text-orange-400 border-orange-500/20',
}

const docTypeIcon: Record<string, React.ElementType> = {
  contrato: FileText,
  comprovante: FileCheck,
  autorização: FileWarning,
  observação: FileBadge,
  outro: File,
}

const docTypeColor: Record<string, string> = {
  contrato: 'text-violet-400 bg-violet-500/10',
  comprovante: 'text-emerald-400 bg-emerald-500/10',
  autorização: 'text-amber-400 bg-amber-500/10',
  observação: 'text-sky-400 bg-sky-500/10',
  outro: 'text-zinc-400 bg-zinc-500/10',
}

type DrawerTab = 'detalhes' | 'documentos'

interface EventoDrawerProps {
  evento: Evento
  onClose: () => void
  onUpdate: (updated: Evento) => void
}

export default function EventoDrawer({ evento, onClose, onUpdate }: EventoDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('detalhes')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Evento>({ ...evento })
  const [newDoc, setNewDoc] = useState<{ nome: string; tipo: Documento['tipo'] }>({ nome: '', tipo: 'contrato' })
  const [addingDoc, setAddingDoc] = useState(false)

  function handleSave() {
    onUpdate(draft)
    setEditing(false)
  }

  function handleCancel() {
    setDraft({ ...evento })
    setEditing(false)
  }

  function addDocument() {
    if (!newDoc.nome.trim()) return
    const doc: Documento = {
      id: `d${Date.now()}`,
      nome: newDoc.nome.trim(),
      tipo: newDoc.tipo,
      dataUpload: new Date().toISOString().split('T')[0],
    }
    const updated: Evento = {
      ...draft,
      documentos: [...(draft.documentos ?? []), doc],
    }
    setDraft(updated)
    onUpdate(updated)
    setNewDoc({ nome: '', tipo: 'contrato' })
    setAddingDoc(false)
  }

  function removeDocument(id: string) {
    const updated: Evento = {
      ...draft,
      documentos: (draft.documentos ?? []).filter((d) => d.id !== id),
    }
    setDraft(updated)
    onUpdate(updated)
  }

  const field = <T extends string | number | undefined>(
    label: string,
    value: T,
    draftKey: keyof Evento,
    type: 'text' | 'number' | 'date' | 'select' = 'text',
    options?: string[]
  ) => {
    if (editing) {
      if (type === 'select' && options) {
        return (
          <div>
            <p className="text-xs text-app-subtle mb-0.5">{label}</p>
            <select
              value={draft[draftKey] as string ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [draftKey]: e.target.value }))}
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none cursor-pointer"
            >
              <option value="">—</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )
      }
      return (
        <div>
          <p className="text-xs text-app-subtle mb-0.5">{label}</p>
          <input
            type={type}
            value={draft[draftKey] as string | number ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [draftKey]: type === 'number' ? Number(e.target.value) || undefined : e.target.value }))}
            className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none"
          />
        </div>
      )
    }
    return (
      <div>
        <p className="text-xs text-app-subtle">{label}</p>
        <p className="text-sm font-medium text-app-text mt-0.5">
          {value !== undefined && value !== '' ? String(value) : <span className="text-app-subtle italic">—</span>}
        </p>
      </div>
    )
  }

  const textArea = (label: string, draftKey: keyof Evento) => {
    const val = editing ? (draft[draftKey] as string ?? '') : (evento[draftKey] as string ?? '')
    if (editing) {
      return (
        <div className="col-span-2">
          <p className="text-xs text-app-subtle mb-0.5">{label}</p>
          <textarea
            value={val}
            onChange={(e) => setDraft((d) => ({ ...d, [draftKey]: e.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none resize-none"
          />
        </div>
      )
    }
    return (
      <div className="col-span-2">
        <p className="text-xs text-app-subtle">{label}</p>
        <p className="text-sm text-app-text2 mt-0.5 leading-relaxed">
          {val || <span className="text-app-subtle italic">—</span>}
        </p>
      </div>
    )
  }

  const current = editing ? draft : evento
  const documentos = draft.documentos ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-xl overflow-y-auto bg-app-bg border-l border-app-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-app-border bg-app-bg">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-bold text-app-text">{current.cliente}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-app-muted">{current.tipo} · {current.espaco}</p>
                {current.tipoEvento && (
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tipoEventoBadge[current.tipoEvento]}`}>
                    {current.tipoEvento}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tab === 'detalhes' && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-400 hover:bg-violet-500/20 transition-colors"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar
                </button>
              )}
              {editing && (
                <>
                  <button onClick={handleCancel} className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-muted hover:bg-app-surface2 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleSave} className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 transition-colors">
                    <Save className="h-3.5 w-3.5" />
                    Salvar
                  </button>
                </>
              )}
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 hover:text-app-text transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex px-5 gap-1">
            <button
              onClick={() => setTab('detalhes')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                tab === 'detalhes' ? 'border-violet-500 text-violet-400' : 'border-transparent text-app-muted hover:text-app-text'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Detalhes
            </button>
            <button
              onClick={() => setTab('documentos')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                tab === 'documentos' ? 'border-violet-500 text-violet-400' : 'border-transparent text-app-muted hover:text-app-text'
              }`}
            >
              <Paperclip className="h-3.5 w-3.5" />
              Documentos
              {documentos.length > 0 && (
                <span className="ml-1 rounded-full bg-violet-500/20 text-violet-400 text-xs px-1.5 py-0.5 leading-none">
                  {documentos.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Conteúdo da aba Detalhes */}
        {tab === 'detalhes' && (
          <div className="p-5 space-y-5">
            {/* Status e valor */}
            <div className="flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge[current.status]}`}>
                {current.status}
              </span>
              <span className="text-xl font-bold text-violet-400">{formatCurrency(current.valor)}</span>
            </div>

            {/* Informações básicas */}
            <section>
              <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
                <Calendar className="h-3.5 w-3.5" />
                Informações do Evento
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {field('Data', formatDate(current.data), 'data', 'date')}
                {field('Horário', `${current.horaInicio} – ${current.horaFim}`, 'horaInicio')}
                {field('Tipo de Evento', current.tipo, 'tipo')}
                {field('Espaço', current.espaco, 'espaco')}
                <div>
                  <p className="text-xs text-app-subtle mb-0.5">Categoria</p>
                  {editing ? (
                    <select
                      value={draft.tipoEvento ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, tipoEvento: e.target.value as TipoEvento || undefined }))}
                      className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">— Selecione —</option>
                      <option value="Festivo">Festivo</option>
                      <option value="Corporativo">Corporativo</option>
                      <option value="Audiovisual">Audiovisual</option>
                    </select>
                  ) : (
                    current.tipoEvento
                      ? <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium mt-0.5 ${tipoEventoBadge[current.tipoEvento]}`}>{current.tipoEvento}</span>
                      : <p className="text-sm text-app-subtle italic mt-0.5">—</p>
                  )}
                </div>
              </div>
            </section>

            {/* Capacidade */}
            <section>
              <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
                <Users className="h-3.5 w-3.5" />
                Capacidade e Pessoas
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {field('Nº de Pessoas', current.numeroPessoas, 'numeroPessoas', 'number')}
                {field('Capacidade do Espaço', current.capacidadeUtilizada, 'capacidadeUtilizada', 'number')}
              </div>
              {current.numeroPessoas && current.capacidadeUtilizada && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-app-subtle">Ocupação</span>
                    <span className="text-app-text2 font-medium">
                      {Math.round((current.numeroPessoas / current.capacidadeUtilizada) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-app-surface3">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: `${Math.min(100, Math.round((current.numeroPessoas / current.capacidadeUtilizada) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Financeiro */}
            <section>
              <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
                <DollarSign className="h-3.5 w-3.5" />
                Financeiro
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {field('Faturamento Bruto', current.faturamentoBruto ? formatCurrency(current.faturamentoBruto) : undefined, 'faturamentoBruto', 'number')}
                {field('Faturamento Líquido', current.faturamentoLiquido ? formatCurrency(current.faturamentoLiquido) : undefined, 'faturamentoLiquido', 'number')}
                {field('Forma de Pagamento', current.formaPagamento, 'formaPagamento', 'select', ['PIX', 'Transferência', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Cheque'])}
                {field('Vencimento do Saldo', current.dataVencimentoSaldo ? formatDate(current.dataVencimentoSaldo) : undefined, 'dataVencimentoSaldo', 'date')}
              </div>
            </section>

            {/* Responsável */}
            <section>
              <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
                <User className="h-3.5 w-3.5" />
                Responsável pelo Evento
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {field('Nome do Responsável', current.responsavel, 'responsavel')}
                {field('Telefone de Contato', current.telefoneContato, 'telefoneContato')}
              </div>
            </section>

            {/* Logística */}
            <section>
              <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Logística e Vistoria
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {field('Decoração', current.decoracao, 'decoracao', 'select', ['própria', 'terceirizada', 'não aplicável'])}
                <div>
                  <p className="text-xs text-app-subtle">Status da Vistoria</p>
                  {editing ? (
                    <select
                      value={draft.statusVistoria ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, statusVistoria: e.target.value as StatusVistoria }))}
                      className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none cursor-pointer mt-0.5"
                    >
                      <option value="">—</option>
                      {(['pendente', 'aprovada', 'aprovada com ressalvas', 'reprovada', 'não realizada'] as StatusVistoria[]).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <p className={`text-sm font-medium mt-0.5 ${current.statusVistoria ? vistoriaStyles[current.statusVistoria] : 'text-app-subtle italic'}`}>
                      {current.statusVistoria ?? '—'}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Observações */}
            <section>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {textArea('Observações Gerais', 'observacoes')}
                {textArea('Observações Técnicas', 'observacoesTecnicas')}
              </div>
            </section>
          </div>
        )}

        {/* Conteúdo da aba Documentos */}
        {tab === 'documentos' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-app-text">
                {documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'} anexado{documentos.length !== 1 ? 's' : ''}
              </p>
              {!addingDoc && (
                <button
                  onClick={() => setAddingDoc(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-400 hover:bg-violet-500/20 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Anexar arquivo
                </button>
              )}
            </div>

            {/* Formulário de upload */}
            {addingDoc && (
              <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                <p className="text-xs font-semibold text-violet-400">Novo documento</p>
                <div>
                  <label className="text-xs text-app-subtle mb-1 block">Nome do arquivo</label>
                  <input
                    value={newDoc.nome}
                    onChange={(e) => setNewDoc((d) => ({ ...d, nome: e.target.value }))}
                    placeholder="Ex: Contrato assinado.pdf"
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-app-subtle mb-1 block">Tipo</label>
                  <select
                    value={newDoc.tipo}
                    onChange={(e) => setNewDoc((d) => ({ ...d, tipo: e.target.value as Documento['tipo'] }))}
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none cursor-pointer"
                  >
                    <option value="contrato">Contrato</option>
                    <option value="comprovante">Comprovante de Pagamento</option>
                    <option value="autorização">Autorização</option>
                    <option value="observação">Observação</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setAddingDoc(false)} className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={addDocument}
                    disabled={!newDoc.nome.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Upload className="h-3 w-3" />
                    Anexar
                  </button>
                </div>
              </div>
            )}

            {documentos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Paperclip className="h-8 w-8 text-app-border2 mb-3" />
                <p className="text-sm text-app-muted">Nenhum documento anexado</p>
                <p className="text-xs text-app-subtle mt-1">Clique em "Anexar arquivo" para adicionar contratos, comprovantes e autorizações.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documentos.map((doc) => {
                  const DocIcon = docTypeIcon[doc.tipo] ?? File
                  const colorClass = docTypeColor[doc.tipo] ?? docTypeColor['outro']
                  return (
                    <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-app-border2/50 bg-app-surface2/40 px-3.5 py-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${colorClass}`}>
                        <DocIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-app-text truncate">{doc.nome}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-app-subtle capitalize">{doc.tipo}</span>
                          <span className="text-app-border2">·</span>
                          <span className="text-xs text-app-subtle">{doc.dataUpload.split('-').reverse().join('/')}</span>
                          {doc.tamanho && (
                            <>
                              <span className="text-app-border2">·</span>
                              <span className="text-xs text-app-subtle">{doc.tamanho}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeDocument(doc.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-400 transition-colors shrink-0"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-6 rounded-lg bg-app-surface2/30 border border-app-border2/30 p-3">
              <p className="text-xs text-app-subtle">
                Os documentos são simulados localmente. Em produção, os arquivos seriam armazenados em um serviço de storage (ex: Supabase Storage, S3).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
