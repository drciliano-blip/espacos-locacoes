'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Landmark } from 'lucide-react'
import { useConciliacao, type ImportarExtratoResultado } from '@/contexts/ConciliacaoContext'
import { useCurrentUser } from '@/contexts/UserContext'
import { useEspacoAtivo } from '@/contexts/EspacoAtivoContext'
import { formatCurrency } from '@/lib/utils'
import Toast from '@/components/shared/Toast'
import ImportarExtratoModal from './ImportarExtratoModal'

// Tela de conferência banco x sistema. Nesta primeira etapa (importação),
// ainda não tem a tabela de conciliação em si — só a lista dos extratos já
// importados. A conferência lado a lado entra na próxima etapa, usando o
// motor puro em src/lib/conciliacao-bancaria.ts.
export default function ConciliacaoBancariaClient() {
  const { extratos, movimentacoes, loading, importarExtrato } = useConciliacao()
  const { role } = useCurrentUser()
  const { espacoUnico } = useEspacoAtivo()
  const podeImportar = role === 'admin' || role === 'financeiro'

  const [importOpen, setImportOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  function handleImportado(resultado: ImportarExtratoResultado) {
    const partes = [`${resultado.totalNovas} movimentação(ões) importada(s)`]
    if (resultado.totalDuplicadas > 0) partes.push(`${resultado.totalDuplicadas} já existente(s), ignorada(s)`)
    showToast(partes.join(' — ') + '.')
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link href="/fechamento" className="inline-flex items-center gap-1 text-xs text-app-subtle hover:text-app-text transition-colors">
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar ao Financeiro
      </Link>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold text-app-text flex items-center gap-2">
          <Landmark className="h-5 w-5 text-[#25D366]" />
          Conciliação Bancária
        </h1>
        {podeImportar && (
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: '#25D366' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#128C7E' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#25D366' }}
          >
            <Plus className="h-4 w-4" />
            Importar Extrato
          </button>
        )}
      </div>

      <p className="text-xs text-app-subtle">
        Importe o extrato do banco (OFX, CSV, XLS ou PDF) pra conferir se cada movimentação bate com o que já está lançado no sistema. A importação nunca cria ou altera lançamentos sozinha.
      </p>

      <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
        <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Extratos importados</h4>

        {loading ? (
          <p className="text-sm text-app-subtle text-center py-6">Carregando…</p>
        ) : extratos.length === 0 ? (
          <p className="text-sm text-app-subtle text-center py-6">
            {podeImportar ? 'Nenhum extrato importado ainda.' : 'Nenhum extrato importado ainda — só admin e financeiro podem importar.'}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-app-border2/60">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-app-border bg-app-surface2">
                  {['Arquivo', 'Espaço', 'Banco/Conta', 'Período', 'Movimentações', 'Saldo Final', 'Importado em'].map(h => (
                    <th key={h} className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/50">
                {extratos.map(e => (
                  <tr key={e.id}>
                    <td className="px-2 py-2 font-medium text-app-text whitespace-nowrap">{e.nomeArquivo}</td>
                    <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{e.espaco ?? 'Empresa toda'}</td>
                    <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{[e.banco, e.conta].filter(Boolean).join(' — ') || '—'}</td>
                    <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{e.periodoInicio && e.periodoFim ? `${e.periodoInicio} a ${e.periodoFim}` : '—'}</td>
                    <td className="px-2 py-2 text-app-text2 whitespace-nowrap">
                      {movimentacoes.filter(m => m.extratoId === e.id).length} de {e.totalMovimentacoes}
                    </td>
                    <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{e.saldoFinal != null ? formatCurrency(e.saldoFinal) : '—'}</td>
                    <td className="px-2 py-2 text-app-subtle whitespace-nowrap">{new Date(e.createdAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {importOpen && (
        <ImportarExtratoModal
          espacoPadrao={espacoUnico ?? undefined}
          onClose={() => setImportOpen(false)}
          onImportar={importarExtrato}
          onImportado={handleImportado}
        />
      )}

      <Toast message={toastMsg} />
    </div>
  )
}
