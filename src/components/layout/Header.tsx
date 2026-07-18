'use client'

import { usePathname } from 'next/navigation'
import { Bell, User, Sun, Moon } from 'lucide-react'
import { getEspacoBySlug } from '@/lib/espacos-config'
import { useTheme } from '@/components/ThemeProvider'
import type { NivelAcesso } from '@/types'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/agenda': 'Agenda',
  '/pagamentos': 'Pagamentos',
  '/contratos': 'Contratos',
  '/relatorios': 'Relatórios',
  '/contas-a-pagar': 'Contas a Pagar',
  '/usuarios': 'Gestão de Usuários',
}

interface HeaderProps {
  userName: string
  userRole: NivelAcesso
}

export default function Header({ userName, userRole }: HeaderProps) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

  let title = titles[pathname] ?? 'Painel'
  const espacoMatch = pathname.match(/^\/espacos\/([^/]+)$/)
  if (espacoMatch) {
    const config = getEspacoBySlug(espacoMatch[1])
    title = config ? config.nome : 'Espaço'
  }

  const roleLabel: Record<NivelAcesso, string> = {
    admin: 'Admin',
    financeiro: 'Financeiro',
    operacional: 'Operacional',
    visualizador: 'Visualizador',
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-app-border bg-app-surface px-6 print-hidden">
      <h1 className="text-base font-semibold text-app-text">{title}</h1>
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#25D366]" />
        </button>

        <div className="flex items-center gap-2 pl-1 border-l border-app-border ml-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/15 border border-[#25D366]/30">
            <User className="h-4 w-4 text-[#25D366]" />
          </div>
          <div className="leading-tight">
            <p className="text-sm text-app-text2 font-medium leading-none">{userName}</p>
            <p className="text-xs text-app-subtle">{roleLabel[userRole]}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
