'use client'

import { useState } from 'react'
import { Users, Library, Inbox } from 'lucide-react'
import FuncionariosSection from '@/components/contratos/FuncionariosSection'
import BibliotecaContratos from '@/components/contratos/BibliotecaContratos'
import FichasRecebidasSection from '@/components/contratos/FichasRecebidasSection'

type SubTab = 'funcionarios' | 'biblioteca' | 'fichas'

const SUB_TABS: { key: SubTab; label: string; Icon: typeof Users }[] = [
  { key: 'funcionarios', label: 'Documentos de Funcionários', Icon: Users },
  { key: 'biblioteca',   label: 'Biblioteca de Contratos',    Icon: Library },
  { key: 'fichas',       label: 'Fichas recebidas',           Icon: Inbox },
]

export default function DocumentosSection() {
  const [sub, setSub] = useState<SubTab>('funcionarios')

  return (
    <div className="space-y-4">
      <div className="flex border-b border-app-border overflow-x-auto">
        {SUB_TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              sub === key ? 'text-[#128C7E]' : 'text-app-muted hover:text-app-text'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {sub === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#25D366]" />}
          </button>
        ))}
      </div>

      {sub === 'funcionarios' && <FuncionariosSection />}
      {sub === 'biblioteca' && <BibliotecaContratos />}
      {sub === 'fichas' && <FichasRecebidasSection />}
    </div>
  )
}
