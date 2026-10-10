'use client'

import { useRef, useState } from 'react'
import { Eye, Download, Trash2, Paperclip, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveFile, deleteFile, viewFile, downloadFile } from '@/lib/file-storage'
import { formatDate, hojeISO, mensagemDeErro } from '@/lib/utils'
import { situacaoDaValidade, situacaoDoExigido, type DocumentoExigido } from '@/lib/credenciamento-config'
import type { DocumentoCredenciamento } from '@/types'
import { documentoFromRow, GREEN, INPUT_CLASS, type DocumentoRow } from './dados'

const ACCEPT = '.pdf,.png,.jpg,.jpeg'
const MAX_MB = 20
const OUTRO = '__outro__'

// De quem são os documentos: a pessoa ou a empresa. As duas tabelas têm o
// mesmo formato, só muda a coluna que aponta pro dono.
export type DonoDocumentos =
  | { tabela: 'terceirizado_documentos'; coluna: 'terceirizado_id'; id: string; nome: string }
  | { tabela: 'empresa_documentos'; coluna: 'empresa_id'; id: string; nome: string }

interface Props {
  dono: DonoDocumentos
  documentos: DocumentoCredenciamento[]
  exigidos: DocumentoExigido[]
  tituloExigidos?: string
  placeholderOutro?: string
  onChange: (documentos: DocumentoCredenciamento[]) => void
}

function SituacaoExigido({ exigido, documentos }: { exigido: DocumentoExigido; documentos: DocumentoCredenciamento[] }) {
  const { situacao, validade, dias } = situacaoDoExigido(exigido, documentos, hojeISO())

  let Icon = CheckCircle2
  let cor = 'text-emerald-400'
  let texto = validade ? `Válido até ${formatDate(validade)}` : 'Anexado'

  if (situacao === 'falta') { Icon = XCircle; cor = 'text-red-400'; texto = 'Falta anexar' }
  if (situacao === 'vencido') { Icon = XCircle; cor = 'text-red-400'; texto = `Vencido em ${formatDate(validade!)}` }
  if (situacao === 'sem_validade') { Icon = AlertTriangle; cor = 'text-amber-400'; texto = 'Anexado sem data de validade' }
  if (situacao === 'vence_em_breve') {
    Icon = AlertTriangle
    cor = 'text-amber-400'
    texto = dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia${dias === 1 ? '' : 's'} (${formatDate(validade!)})`
  }

  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cor}`} />
      <div className="min-w-0">
        <p className="text-app-text">{exigido.tipo}</p>
        <p className={cor}>{texto}</p>
      </div>
    </div>
  )
}

function ValidadeDoAnexo({ validade }: { validade?: string }) {
  if (!validade) return null
  const { situacao, dias } = situacaoDaValidade(validade, hojeISO())
  if (situacao === 'vencido') return <span className="text-red-400">Vencido em {formatDate(validade)}</span>
  if (situacao === 'vence_em_breve') {
    return <span className="text-amber-400">{dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia${dias === 1 ? '' : 's'}`} ({formatDate(validade)})</span>
  }
  return <span>Validade {formatDate(validade)}</span>
}

export default function DocumentosCredenciamento({ dono, documentos, exigidos, tituloExigidos, placeholderOutro, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [tipoSelecionado, setTipoSelecionado] = useState(exigidos[0]?.tipo ?? OUTRO)
  const [tipoLivre, setTipoLivre] = useState('')
  const [numero, setNumero] = useState('')
  const [validade, setValidade] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const tipo = tipoSelecionado === OUTRO ? tipoLivre.trim() : tipoSelecionado
  const exigeValidade = exigidos.find(e => e.tipo === tipo)?.temValidade ?? false

  async function handleAnexar() {
    setErro(null)
    if (!tipo) return setErro('Informe qual é o documento.')
    if (!arquivo) return setErro('Escolha o arquivo do documento.')
    if (arquivo.size > MAX_MB * 1024 * 1024) return setErro(`O arquivo excede ${MAX_MB} MB.`)
    if (exigeValidade && !validade) return setErro('Informe a data de validade deste documento.')

    setBusy(true)
    let fileId: string | null = null
    try {
      const stored = await saveFile(arquivo, {
        module: 'credenciamento', entityId: dono.id, entityName: dono.nome, categoria: tipo,
      })
      fileId = stored.id

      const supabase = createClient()
      const { data, error } = await supabase
        .from(dono.tabela)
        .insert({
          [dono.coluna]: dono.id,
          tipo,
          numero: numero.trim() || null,
          validade: validade || null,
          file_id: stored.id,
        })
        .select()
        .single()
      if (error) throw error

      onChange([documentoFromRow(data as DocumentoRow), ...documentos])
      setNumero('')
      setValidade('')
      setTipoLivre('')
      setArquivo(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      // Arquivo subiu mas o registro não gravou: não deixa o arquivo órfão.
      if (fileId) await deleteFile(fileId).catch(() => {})
      setErro(mensagemDeErro(err, 'Não foi possível anexar o documento. Tente novamente.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleRemover(doc: DocumentoCredenciamento) {
    if (!window.confirm(`Remover o documento "${doc.tipo}"?`)) return
    const supabase = createClient()
    const { error } = await supabase.from(dono.tabela).delete().eq('id', doc.id)
    if (error) return setErro(mensagemDeErro(error, 'Não foi possível remover o documento.'))
    if (doc.fileId) await deleteFile(doc.fileId).catch(() => {})
    onChange(documentos.filter(d => d.id !== doc.id))
  }

  return (
    <div className="space-y-4">
      {exigidos.length > 0 && (
        <div>
          <p className="text-xs font-medium text-app-muted mb-2">{tituloExigidos ?? 'Documentos exigidos'}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {exigidos.map(e => <SituacaoExigido key={e.tipo} exigido={e} documentos={documentos} />)}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-app-muted mb-2">Documentos anexados</p>
        {documentos.length === 0 ? (
          <p className="text-xs text-app-subtle">Nenhum documento anexado.</p>
        ) : (
          <div className="space-y-1.5">
            {documentos.map(doc => (
              <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-app-border2/50 bg-app-surface px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-app-text truncate">{doc.tipo}</p>
                  <p className="text-xs text-app-subtle">
                    {doc.numero && <span>Nº {doc.numero}</span>}
                    {doc.numero && doc.validade && ' · '}
                    <ValidadeDoAnexo validade={doc.validade} />
                    {!doc.numero && !doc.validade && 'Sem número nem validade'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {doc.fileId && (
                    <>
                      <button onClick={() => viewFile(doc.fileId!)} title="Visualizar"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 transition-colors">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => downloadFile(doc.fileId!)} title="Baixar"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 transition-colors">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  <button onClick={() => handleRemover(doc)} title="Remover"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-app-border2/50 bg-app-surface p-3 space-y-3">
        <p className="text-xs font-medium text-app-muted">Anexar documento</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {exigidos.length > 0 && (
            <div className="sm:col-span-2">
              <label className="block text-xs text-app-muted mb-1">Documento</label>
              <select value={tipoSelecionado} onChange={e => setTipoSelecionado(e.target.value)} className={`${INPUT_CLASS} cursor-pointer`}>
                {exigidos.map(e => <option key={e.tipo} value={e.tipo}>{e.tipo}</option>)}
                <option value={OUTRO}>Outro documento…</option>
              </select>
            </div>
          )}
          {tipoSelecionado === OUTRO && (
            <div className="sm:col-span-2">
              <label className="block text-xs text-app-muted mb-1">Qual documento?</label>
              <input value={tipoLivre} onChange={e => setTipoLivre(e.target.value)} placeholder={placeholderOutro ?? 'Ex: Certificado NR-35'} className={INPUT_CLASS} />
            </div>
          )}
          <div>
            <label className="block text-xs text-app-muted mb-1">Número / registro</label>
            <input value={numero} onChange={e => setNumero(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div>
            <label className="block text-xs text-app-muted mb-1">Validade{exigeValidade ? ' *' : ''}</label>
            <input type="date" value={validade} onChange={e => setValidade(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-app-muted mb-1">Arquivo (PDF ou foto, até {MAX_MB} MB)</label>
            <input ref={inputRef} type="file" accept={ACCEPT} onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-app-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-app-surface2 file:px-3 file:py-1.5 file:text-xs file:text-app-text" />
          </div>
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <div className="flex justify-end">
          <button onClick={handleAnexar} disabled={busy}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: GREEN }}>
            <Paperclip className="h-3.5 w-3.5" />
            {busy ? 'Enviando…' : 'Anexar'}
          </button>
        </div>
      </div>
    </div>
  )
}
