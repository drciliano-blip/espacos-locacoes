// Uso único (29/10/2026): troca as minutas dos espaços pelas da pasta
// "Minutas Atualizada". Backup das antigas antes; só apaga se tudo subiu.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const PASTA = 'C:/Users/usuario/Documents/camilinho/Minutas Atualizada/PDF/'
const BACKUP = 'C:/Users/usuario/Documents/camilinho/dash EL/backups/minutas-antigas-2026-10-29/'
const ESP = {
  Fabrique: '82a17b6d-0dd5-4fd0-bcea-51d0f54a7379',
  Usine: '7c225e20-7d5d-4a75-97ab-ad79c7ade329',
  'House Pacaembu': 'c1fc784a-a181-4c32-88a8-42e007b0b904',
  'Complexo Jussara': 'cf2fd95d-1763-4ae9-8e15-9564eba2e8ab',
  'Espaço Solon': '359987ad-d7fc-4183-8fba-57fed7a2b205',
}
const NOVAS = [
  ['Fabrique', 'minuta_locacao', 'CONTRATO_FABRIQUE_ALUGUEL__SEM_STAFF_.pdf'],
  ['Fabrique', 'minuta_locacao_staff', 'CONTRATO_FABRIQUE_ALUGUEL__COM_STAFF_.pdf'],
  ['Usine', 'minuta_locacao', 'CONTRATO_USINE_ALUGUEL__SEM_STAFF_.pdf'],
  ['Usine', 'minuta_locacao_staff', 'CONTRATO_USINE_ALUGUEL__COM_STAFF_.pdf'],
  ['House Pacaembu', 'minuta_locacao_staff', 'CONTRATO_HOUSE_ALUGUEL__COM_STAFF_.pdf'],
  ['Complexo Jussara', 'minuta_locacao', 'CONTRATO_JUSSARA.pdf'],
  ['Espaço Solon', 'minuta_locacao', 'CONTRATO_SOLON.pdf'],
]

// 1) Backup das antigas (PDF + metadados)
const { data: antigas, error: e1 } = await sb.from('files').select('*').like('categoria', 'minuta%')
if (e1) throw e1
mkdirSync(BACKUP, { recursive: true })
writeFileSync(BACKUP + 'files-rows.json', JSON.stringify(antigas, null, 2))
for (const f of antigas) {
  const { data, error } = await sb.storage.from('arquivos').download(f.storage_path)
  if (error) throw new Error(`backup ${f.name}: ${error.message}`)
  writeFileSync(BACKUP + `${f.entity_name} - ${f.categoria} - ${f.name}`, Buffer.from(await data.arrayBuffer()))
  console.log('backup ok:', f.entity_name, f.categoria, f.name)
}

// 2) Sobe as novas
for (const [espaco, categoria, arquivo] of NOVAS) {
  const id = ESP[espaco]
  const bytes = readFileSync(PASTA + arquivo)
  const path = `espacos/${id}/${randomUUID()}-${arquivo}`
  const { error: eu } = await sb.storage.from('arquivos').upload(path, bytes, { contentType: 'application/pdf' })
  if (eu) throw new Error(`upload ${arquivo}: ${eu.message}`)
  const { error: ei } = await sb.from('files').insert({
    name: arquivo, mime_type: 'application/pdf', size: bytes.length, module: 'espacos',
    entity_id: id, entity_name: espaco, categoria, storage_path: path, uploaded_by: null,
  })
  if (ei) throw new Error(`registro ${arquivo}: ${ei.message}`)
  console.log('nova ok:', espaco, categoria, arquivo)
}

// 3) Apaga as antigas
for (const f of antigas) {
  const { error: es } = await sb.storage.from('arquivos').remove([f.storage_path])
  if (es) throw new Error(`storage ${f.name}: ${es.message}`)
  const { data, error } = await sb.from('files').delete().eq('id', f.id).select('id')
  if (error || !data?.length) throw new Error(`apagar ${f.name}: ${error?.message ?? 'nada apagado'}`)
  console.log('apagada:', f.entity_name, f.categoria, f.name)
}
