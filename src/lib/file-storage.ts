// Supabase-backed file storage — bucket privado 'arquivos' + tabela 'files' (metadados)

import { createClient } from '@/lib/supabase/client'

export interface StoredFile {
  id: string
  name: string
  mimeType: string
  size: number
  module: 'contas' | 'contratos' | 'agenda' | 'pagamentos' | 'espacos' | 'funcionarios' | 'fichas' | 'receitas'
  entityId: string
  entityName: string
  espaco?: string
  categoria?: string
  uploadedAt: string
}

interface FileRow {
  id: string
  name: string
  mime_type: string
  size: number
  module: StoredFile['module']
  entity_id: string
  entity_name: string
  espaco: string | null
  categoria: string | null
  storage_path: string
  uploaded_at: string
}

const BUCKET = 'arquivos'

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

function randomId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function fromRow(row: FileRow): StoredFile {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    size: row.size,
    module: row.module,
    entityId: row.entity_id,
    entityName: row.entity_name,
    espaco: row.espaco ?? undefined,
    categoria: row.categoria ?? undefined,
    uploadedAt: row.uploaded_at,
  }
}

export async function saveFile(
  file: File,
  ctx: { module: StoredFile['module']; entityId: string; entityName: string; espaco?: string; categoria?: string },
): Promise<StoredFile> {
  const supabase = createClient()
  const path = `${ctx.module}/${ctx.entityId}/${randomId()}-${sanitizeName(file.name)}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
  })
  if (uploadError) throw uploadError

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('files')
    .insert({
      name: file.name,
      mime_type: file.type || 'application/octet-stream',
      size: file.size,
      module: ctx.module,
      entity_id: ctx.entityId,
      entity_name: ctx.entityName,
      espaco: ctx.espaco ?? null,
      categoria: ctx.categoria ?? null,
      storage_path: path,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }

  return fromRow(data as FileRow)
}

export async function getFiles(filters?: {
  module?: StoredFile['module']
  entityId?: string
  espaco?: string
}): Promise<StoredFile[]> {
  const supabase = createClient()
  let query = supabase.from('files').select('*')
  if (filters?.module)   query = query.eq('module', filters.module)
  if (filters?.entityId) query = query.eq('entity_id', filters.entityId)
  if (filters?.espaco)   query = query.eq('espaco', filters.espaco)

  const { data, error } = await query.order('uploaded_at', { ascending: false })
  if (error) throw error
  return (data as FileRow[]).map(fromRow)
}

export async function deleteFile(id: string): Promise<void> {
  const supabase = createClient()
  const { data: row } = await supabase.from('files').select('storage_path').eq('id', id).single()
  if (!row) return
  await supabase.storage.from(BUCKET).remove([row.storage_path])
  await supabase.from('files').delete().eq('id', id)
}

export async function downloadFile(id: string): Promise<void> {
  const supabase = createClient()
  const { data: row } = await supabase.from('files').select('storage_path, name').eq('id', id).single()
  if (!row) return
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 60, { download: row.name })
  if (!data) return
  window.location.href = data.signedUrl
}

export async function getFileUrl(id: string): Promise<string | null> {
  const supabase = createClient()
  const { data: row } = await supabase.from('files').select('storage_path').eq('id', id).single()
  if (!row) return null
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 3600)
  return data?.signedUrl ?? null
}

export async function viewFile(id: string): Promise<void> {
  const supabase = createClient()
  const { data: row } = await supabase.from('files').select('storage_path').eq('id', id).single()
  if (!row) return
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 60)
  if (!data) return
  window.open(data.signedUrl, '_blank')
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
