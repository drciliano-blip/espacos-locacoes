'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Building2,
  LogOut,
  ChevronDown,
  ChevronRight,
  BarChart2,
  Receipt,
  Users,
} from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { ROLE_PERMISSIONS } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'
import type { NivelAcesso } from '@/types'

const navItemsBefore = [
  { href: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard, page: 'dashboard' },
  { href: '/relatorios',     label: 'Relatórios',    icon: BarChart2,       page: 'relatorios' },
  { href: '/agenda',         label: 'Agenda',        icon: CalendarDays,    page: 'agenda' },
  { href: '/contas-a-pagar', label: 'Contas a Pagar',icon: Receipt,         page: 'contas-a-pagar' },
]

const navItemsAfter = [
  { href: '/eventos',  label: 'Eventos',  icon: FileText, page: 'eventos' },
  { href: '/usuarios', label: 'Usuários', icon: Users,    page: 'usuarios' },
]

const roleLabels: Record<NivelAcesso, string> = {
  admin:       'Administrador',
  financeiro:  'Financeiro',
  operacional: 'Operacional',
  visualizador:'Visualizador',
}

const roleBadgeColors: Record<NivelAcesso, string> = {
  admin:       'bg-[#25D366]/15 text-[#128C7E]',
  financeiro:  'bg-sky-500/15 text-sky-600',
  operacional: 'bg-emerald-500/15 text-emerald-600',
  visualizador:'bg-zinc-500/15 text-zinc-500',
}

interface SidebarProps {
  userRole: NivelAcesso
}

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? 'bg-[#25D366]/15 text-[#128C7E] border border-[#25D366]/25'
          : 'text-app-muted hover:text-app-text hover:bg-app-surface2'
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? 'text-[#25D366]' : ''}`} />
      {label}
    </Link>
  )
}

export default function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()
  const [espacosOpen, setEspacosOpen] = useState(pathname.startsWith('/espacos'))
  const permissions = ROLE_PERMISSIONS[userRole] ?? []
  const { espacosConfig } = useEspacos()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className="flex h-screen w-64 flex-col bg-app-surface border-r border-app-border">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-app-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366]/15 border border-[#25D366]/30">
          <Building2 className="h-5 w-5 text-[#25D366]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-app-text leading-none">Espaços &</p>
          <p className="text-sm font-semibold text-[#25D366] leading-tight">Locações</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* Items 0–3: Dashboard, Relatórios, Agenda, Contas a Pagar */}
        {navItemsBefore
          .filter(item => permissions.includes(item.page))
          .map(({ href, label, icon }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={pathname === href || pathname.startsWith(href + '/')}
            />
          ))}

        {/* Item 4: Espaços (link + expandable sublist) */}
        {permissions.includes('espacos') && (
          <div className="pt-0.5">
            <div
              className={`flex w-full items-center gap-1 rounded-lg pr-1.5 text-sm font-medium transition-all ${
                pathname.startsWith('/espacos')
                  ? 'bg-[#25D366]/15 text-[#128C7E] border border-[#25D366]/25'
                  : 'text-app-muted hover:text-app-text hover:bg-app-surface2'
              }`}
            >
              <Link href="/espacos" className="flex flex-1 items-center gap-3 px-3 py-2.5">
                <Building2 className={`h-4 w-4 ${pathname.startsWith('/espacos') ? 'text-[#25D366]' : ''}`} />
                <span className="flex-1 text-left">Espaços</span>
              </Link>
              <button
                onClick={() => setEspacosOpen(!espacosOpen)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-app-surface2/60"
                title={espacosOpen ? 'Recolher' : 'Expandir'}
              >
                {espacosOpen
                  ? <ChevronDown className="h-3.5 w-3.5" />
                  : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>

            {espacosOpen && (
              <div className="mt-1 ml-3 pl-3 border-l border-app-border2/50 space-y-0.5">
                {espacosConfig.map((espaco) => {
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
                      <span className={`h-2 w-2 rounded-full shrink-0 ${espaco.dotClass}`} />
                      <span className="truncate">{espaco.nome}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Items 5–6: Contratos/Documentos, Usuários */}
        {navItemsAfter
          .filter(item => permissions.includes(item.page))
          .map(({ href, label, icon }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={pathname === href || pathname.startsWith(href + '/')}
            />
          ))}
      </nav>

      <div className="px-4 py-3 border-t border-app-border space-y-3">
        <div className="flex items-center gap-2 px-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeColors[userRole]}`}>
            {roleLabels[userRole]}
          </span>
        </div>
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
