'use client'

// "Contratos Espaços e Locação" — as minutas oficiais de cada espaço (PDF
// anexado em Espaços → <espaço> → Documentos, categoria minuta_*). São elas
// que o "Gerar contrato" usa como base. Os dois modelos genéricos que ficavam
// aqui saíram da lista em 09/11/2026, a pedido do cliente; continuam só como
// reserva interna do gerador, para um espaço sem minuta anexada.

import { useEffect, useState } from 'react'
import { Library, Eye, Download, FileText } from 'lucide-react'
import { getFiles, viewFile, downloadFile, formatFileSize, type StoredFile } from '@/lib/file-storage'
import { formatDate, mensagemDeErro } from '@/lib/utils'

const TIPO_LABEL: Record<string, string> = {
  minuta_locacao: 'Locação — sem staff',
  minuta_locacao_staff: 'Locação — com staff',
  minuta_parceria: 'Parceria',
}

export default function BibliotecaContratos() {
  const [minutas, setMinutas] = useState<StoredFile[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    getFiles({ module: 'espacos' })
      .then(arqs => { if (vivo) setMinutas(arqs.filter(f => f.categoria?.startsWith('minuta_'))) })
      .catch(e => { if (vivo) setErro(mensagemDeErro(e, 'Não foi possível carregar as minutas.')) })
      .finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [])

  // Só a mais recente de cada espaço/tipo — é a que o gerador usa.
  const atuais = Object.values(
    minutas.reduce<Record<string, StoredFile>>((acc, f) => {
      const k = `${f.entityName}|${f.categoria}`
      if (!acc[k] || f.uploadedAt > acc[k].uploadedAt) acc[k] = f
      return acc
    }, {}),
  )
  const porEspaco = atuais.reduce<Record<string, StoredFile[]>>((acc, f) => {
    (acc[f.entityName] ??= []).push(f)
    return acc
  }, {})
  const espacos = Object.keys(porEspaco).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366]/15">
          <Library className="h-4 w-4 text-[#25D366]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-app-text">Contratos Espaços e Locação</p>
          <p className="text-xs text-app-muted">
            {loading ? 'Carregando…' : `${atuais.length} minutas oficiais em ${espacos.length} espaços — base usada ao gerar um contrato`}
          </p>
        </div>
      </div>

      {erro && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{erro}</p>}

      {!loading && espacos.length === 0 && !erro && (
        <p className="rounded-lg border border-dashed border-app-border2 p-6 text-center text-sm text-app-subtle">
          Nenhuma minuta anexada. Anexe em Espaços → (espaço) → Documentos.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {espacos.map(espaco => (
          <div key={espaco} className="rounded-lg border border-app-border2/50 bg-app-surface2/40 p-3 space-y-2">
            <p className="text-sm font-semibold text-app-text">{espaco}</p>
            {porEspaco[espaco]
              .sort((a, b) => (a.categoria ?? '').localeCompare(b.categoria ?? ''))
              .map(f => (
                <div key={f.id} className="flex items-center gap-2 rounded-md border border-app-border2/50 bg-app-surface px-2.5 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-app-subtle" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-app-text">{TIPO_LABEL[f.categoria ?? ''] ?? f.categoria}</p>
                    <p className="truncate text-[11px] text-app-subtle">{f.name} · {formatFileSize(f.size)} · atualizada em {formatDate(f.uploadedAt.slice(0, 10))}</p>
                  </div>
                  <button onClick={() => viewFile(f.id)} title="Ver" className="rounded-md p-1.5 text-app-subtle hover:bg-app-surface2 hover:text-[#128C7E]"><Eye className="h-4 w-4" /></button>
                  <button onClick={() => downloadFile(f.id)} title="Baixar" className="rounded-md p-1.5 text-app-subtle hover:bg-app-surface2 hover:text-[#128C7E]"><Download className="h-4 w-4" /></button>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}
