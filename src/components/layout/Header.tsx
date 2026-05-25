'use client'

import { usePathname } from 'next/navigation'
import { Bell, User, Sun, Moon } from 'lucide-react'
import { getEspacoBySlug } from '@/lib/espacos-config'
import { useTheme } from '@/components/ThemeProvider'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/agenda': 'Agenda',
  '/pagamentos': 'Pagamentos',
  '/contratos': 'Contratos',
  '/relatorios': 'Relatórios',
}

export default function Header() {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

  let title = titles[pathname] ?? 'Painel'
  const espacoMatch = pathname.match(/^\/espacos\/([^/]+)$/)
  if (espacoMatch) {
    const config = getEspacoBySlug(espacoMatch[1])
    title = config ? config.nome : 'Espaço'
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-app-border bg-app-surface px-6 print-hidden">
      <h1 className="text-base font-semibold text-app-text">{title}</h1>
      <div className="flex items-center gap-2">

        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-violet-400" />
        </button>

        <div className="flex items-center gap-2 pl-1 border-l border-app-border ml-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20 border border-violet-500/30">
            <User className="h-4 w-4 text-violet-400" />
          </div>
          <span className="text-sm text-app-text2 font-medium">Admin</span>
        </div>
      </div>
    </header>
  )
}
