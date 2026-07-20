'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import PaymentsTable from '@/components/pagamentos/PaymentsTable'
import NovaReceitaModal from '@/components/pagamentos/NovaReceitaModal'
import { useReceitas } from '@/contexts/ReceitasContext'

export default function PagamentosPage() {
  const { receitas, categorias, addReceita } = useReceitas()
  const [novaOpen, setNovaOpen] = useState(false)

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setNovaOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#25D366' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#128C7E' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#25D366' }}
        >
          <Plus className="h-4 w-4" />
          Nova Receita
        </button>
      </div>

      <PaymentsTable receitas={receitas} categorias={categorias} />

      {novaOpen && (
        <NovaReceitaModal
          categorias={categorias}
          onClose={() => setNovaOpen(false)}
          onSave={addReceita}
        />
      )}
    </div>
  )
}
