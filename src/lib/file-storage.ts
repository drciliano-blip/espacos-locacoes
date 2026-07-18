// IndexedDB-based file storage — persists files in the browser (no cloud needed)

export interface StoredFile {
  id: string
  name: string
  mimeType: string
  size: number
  module: 'contas' | 'contratos' | 'agenda' | 'pagamentos' | 'espacos' | 'funcionarios' | 'fichas'
  entityId: string
  entityName: string
  espaco?: string
  categoria?: string
  uploadedAt: string
}

interface StoredFileInternal extends StoredFile {
  data: ArrayBuffer
}

const DB_NAME = 'el-files'
const DB_VERSION = 1
const STORE = 'files'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' })
        s.createIndex('module',   'module',   { unique: false })
        s.createIndex('entityId', 'entityId', { unique: false })
        s.createIndex('espaco',   'espaco',   { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror  = () => reject(req.error)
  })
}

function strip(f: StoredFileInternal): StoredFile {
  const { data: _, ...rest } = f
  return rest
}

export async function saveFile(
  file: File,
  ctx: { module: StoredFile['module']; entityId: string; entityName: string; espaco?: string; categoria?: string },
): Promise<StoredFile> {
  const data = await file.arrayBuffer()
  const rec: StoredFileInternal = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    uploadedAt: new Date().toISOString(),
    data,
    ...ctx,
  }
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(rec)
    tx.oncomplete = () => resolve(strip(rec))
    tx.onerror   = () => reject(tx.error)
  })
}

export async function getFiles(filters?: {
  module?: StoredFile['module']
  entityId?: string
  espaco?: string
}): Promise<StoredFile[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      let rows = (req.result as StoredFileInternal[]).map(strip)
      if (filters?.module)   rows = rows.filter(f => f.module   === filters.module)
      if (filters?.entityId) rows = rows.filter(f => f.entityId === filters.entityId)
      if (filters?.espaco)   rows = rows.filter(f => f.espaco   === filters.espaco)
      resolve(rows.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror   = () => reject(tx.error)
  })
}

async function getBlobFor(id: string): Promise<{ blob: Blob; name: string } | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
    req.onsuccess = () => {
      const rec = req.result as StoredFileInternal | undefined
      if (!rec) { resolve(null); return }
      resolve({ blob: new Blob([rec.data], { type: rec.mimeType }), name: rec.name })
    }
    req.onerror = () => reject(req.error)
  })
}

export async function downloadFile(id: string): Promise<void> {
  const result = await getBlobFor(id)
  if (!result) return
  const url = URL.createObjectURL(result.blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: result.name })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function viewFile(id: string): Promise<void> {
  const result = await getBlobFor(id)
  if (!result) return
  const url = URL.createObjectURL(result.blob)
  window.open(url, '_blank')
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
