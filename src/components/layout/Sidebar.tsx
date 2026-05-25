'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  CalendarDays,
  CreditCard,
  FileText,
  Building2,
  LogOut,
  ChevronDown,
  ChevronRight,
  BarChart2,
} from 'lucide-react'
import { ESPACOS_CONFIG } from '@/lib/espacos-config'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/pagamentos', label: 'Pagamentos', icon: CreditCard },
  { href: '/contratos', label: 'Contratos', icon: FileText },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart2 },
]

const espacoDotColors: Record<string, string> = {
  'Usine': 'bg-violet-500',
  'Fabrique': 'bg-indigo-500',
  'House Pacaembu': 'bg-sky-500',
  'Complexo Jussara': 'bg-emerald-500',
  'Espaço Solon': 'bg-orange-500',
}

export default function Sidebar() {
  const pathname = usePathname()
  const [espacosOpen, setEspacosOpen] = useState(pathname.startsWith('/espacos'))

  function handleLogout() {
    document.cookie = 'auth=; path=/; max-age=0'
    window.location.href = '/login'
  }

  return (
    <aside className="flex h-screen w-64 flex-col bg-app-surface border-r border-app-border">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-app-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20 border border-violet-500/30">
          <Building2 className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-app-text leading-none">Espaços &</p>
          <p className="text-sm font-semibold text-violet-400 leading-tight">Locações</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                  : 'text-app-muted hover:text-app-text hover:bg-app-surface2'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-violet-400' : ''}`} />
              {label}
            </Link>
          )
        })}

        {/* Espaços section */}
        <div className="pt-1">
          <button
            onClick={() => setEspacosOpen(!espacosOpen)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              pathname.startsWith('/espacos')
                ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                : 'text-app-muted hover:text-app-text hover:bg-app-surface2'
            }`}
          >
            <Building2 className={`h-4 w-4 ${pathname.startsWith('/espacos') ? 'text-violet-400' : ''}`} />
            <span className="flex-1 text-left">Espaços</span>
            {espacosOpen
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />}
          </button>

          {espacosOpen && (
            <div className="mt-1 ml-3 pl-3 border-l border-app-border2/50 space-y-0.5">
              {ESPACOS_CONFIG.map((espaco) => {
                const href = `/espacos/${espaco.slug}`
                const active = pathname === href
                return (
                  <Link
                    key={espaco.slug}
                    href={href}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all ${
                      active
                        ? 'text-app-text bg-app-surface2'
                        : 'text-app-subtle hover:text-app-text hover:bg-app-surface2/60'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${espacoDotColors[espaco.nome]}`} />
                    <span className="truncate">{espaco.nome}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-app-border">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-app-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
