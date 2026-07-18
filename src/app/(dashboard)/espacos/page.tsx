'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Users, Building2 } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import NovoEspacoModal from '@/components/espacos/NovoEspacoModal'

export default function EspacosIndexPage() {
  const { espacosConfig, customEspacos } = useEspacos()
  const [novoOpen, setNovoOpen] = useState(false)

  const customSlugs = new Set(customEspacos.map(c => c.slug))

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-app-text">{espacosConfig.length} espaços cadastrados</p>
          <p className="text-xs text-app-muted">Gerencie os espaços disponíveis para locação</p>
        </div>
        <button
          onClick={() => setNovoOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#25D366' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#128C7E' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#25D366' }}
        >
          <Plus className="h-4 w-4" />
          Novo Espaço
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {espacosConfig.map(config => (
          <Link
            key={config.slug}
            href={`/espacos/${config.slug}`}
            className={`rounded-xl border ${config.borderClass} ${config.bgClass} p-5 hover:opacity-90 transition-opacity`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${config.bgClass} border ${config.borderClass}`}>
                <span className={`text-lg font-black ${config.colorClass}`}>{config.nome.charAt(0)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-bold ${config.colorClass} truncate`}>{config.nome}</h3>
                  {customSlugs.has(config.slug) && (
                    <span className="shrink-0 rounded-full bg-app-surface2 border border-app-border2 px-1.5 py-0.5 text-[10px] text-app-subtle">
                      Personalizado
                    </span>
                  )}
                </div>
                <p className="text-xs text-app-muted mt-0.5 line-clamp-2">{config.descricao || 'Sem descrição.'}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-xs text-app-subtle">
                    <Users className="h-3 w-3" />
                    {config.capacidade} pessoas
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {espacosConfig.length === 0 && (
          <div className="col-span-full rounded-xl border border-app-border bg-app-surface p-8 text-center">
            <Building2 className="h-8 w-8 text-app-border2 mx-auto mb-3" />
            <p className="text-sm text-app-subtle">Nenhum espaço cadastrado ainda.</p>
          </div>
        )}
      </div>

      {novoOpen && (
        <NovoEspacoModal onClose={() => setNovoOpen(false)} onSave={() => setNovoOpen(false)} />
      )}
    </div>
  )
}
