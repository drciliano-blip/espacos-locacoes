'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import PaymentsTable from '@/components/pagamentos/PaymentsTable'
import NovaReceitaModal from '@/components/pagamentos/NovaReceitaModal'
import Toast from '@/components/shared/Toast'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useEspacoAtivo, MSG_ESPACO_ESPECIFICO_NECESSARIO } from '@/contexts/EspacoAtivoContext'

export default function PagamentosPage() {
  const { receitas, categorias, addReceita } = useReceitas()
  const { espacoUnico, precisaEspacoEspecifico } = useEspacoAtivo()
  const [novaOpen, setNovaOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (precisaEspacoEspecifico()) { showToast(MSG_ESPACO_ESPECIFICO_NECESSARIO); return }
            setNovaOpen(true)
          }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#25D366' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#128C7E' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#25D366' }}
        >
          <Plus className="h-4 w-4" />
          Nova Entrada
        </button>
      </div>

      <PaymentsTable receitas={receitas} categorias={categorias} />

      {novaOpen && (
        <NovaReceitaModal
          categorias={categorias}
          espacoPadrao={espacoUnico ?? undefined}
          onClose={() => setNovaOpen(false)}
          onSave={addReceita}
        />
      )}

      <Toast message={toastMsg} />
    </div>
  )
}
