'use client'

import { usePathname } from 'next/navigation'
import { User, Sun, Moon, Menu } from 'lucide-react'
import { getEspacoBySlug } from '@/lib/espacos-config'
import { useTheme } from '@/components/ThemeProvider'
import { useSidebarUI } from '@/contexts/SidebarUIContext'
import NotificationBell from '@/components/layout/NotificationBell'
import EspacoSwitcher from '@/components/layout/EspacoSwitcher'
import AvisoEspaco from '@/components/layout/AvisoEspaco'
import type { NivelAcesso } from '@/types'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/agenda': 'Agenda',
  '/pagamentos': 'Pagamentos',
  '/eventos': 'Eventos e Contratos',
  '/contas-a-pagar': 'Contas a Pagar',
  '/usuarios': 'Gestão de Usuários',
  '/calculadora-staff': 'Calculadora de Staff',
  '/credenciamento': 'Credenciamento de Terceirizados',
}

interface HeaderProps {
  userName: string
  userRole: NivelAcesso
}

export default function Header({ userName, userRole }: HeaderProps) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const { toggle: toggleSidebar } = useSidebarUI()
  // Credenciamento não trabalha com espaço (só cadastro de terceirizados).
  const comSeletorDeEspaco = userRole !== 'credenciamento'

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
    socio: 'Sócio',
    credenciamento: 'Credenciamento',
  }

  return (
    <>
    <header className="flex h-16 items-center justify-between gap-2 border-b border-app-border bg-app-surface px-4 sm:px-6 print-hidden">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          title="Abrir menu"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        {comSeletorDeEspaco && <EspacoSwitcher />}
        {/* No celular o seletor ocupa o espaço do título — o menu lateral já mostra a tela atual. */}
        <h1 className={`text-base font-semibold text-app-text truncate ${comSeletorDeEspaco ? 'hidden sm:block' : ''}`}>{title}</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <NotificationBell />

        <div className="flex items-center gap-2 pl-1 border-l border-app-border ml-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/15 border border-[#25D366]/30">
            <User className="h-4 w-4 text-[#25D366]" />
          </div>
          <div className="leading-tight hidden sm:block">
            <p className="text-sm text-app-text2 font-medium leading-none">{userName}</p>
            <p className="text-xs text-app-subtle">{roleLabel[userRole]}</p>
          </div>
        </div>
      </div>
    </header>
    {comSeletorDeEspaco && <AvisoEspaco />}
    </>
  )
}
