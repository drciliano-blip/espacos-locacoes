'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'
import { useCurrentUser } from '@/contexts/UserContext'
import { useEspacoAtivo } from '@/contexts/EspacoAtivoContext'
import { useContasPagar, statusEfetivo } from '@/contexts/ContasPagarContext'
import CobrancaClientesModal, { useParcelasEmAtraso } from '@/components/contas-a-pagar/CobrancaClientesModal'
import { formatCurrency, hojeISO } from '@/lib/utils'

// "Dispensar" vale só pelo dia: no dia seguinte a faixa volta, enquanto
// houver atraso. Fica no navegador de quem dispensou — é só um lembrete.
const CHAVE_DISPENSA = 'aviso-atraso-dispensado-em'

const ouvintes = new Set<() => void>()
function assinar(cb: () => void) {
  ouvintes.add(cb)
  return () => { ouvintes.delete(cb) }
}
function lerDispensa(): string | null {
  try { return localStorage.getItem(CHAVE_DISPENSA) } catch { return null }
}
function dispensarHoje() {
  try { localStorage.setItem(CHAVE_DISPENSA, hojeISO()) } catch { /* sem storage: some só até recarregar */ }
  ouvintes.forEach(cb => cb())
}

// Faixa no topo de todas as telas lembrando do que está em atraso: parcelas
// de clientes a cobrar e contas a pagar vencidas. Só pra quem pode agir
// (admin/financeiro), dentro do espaço ativo.
export default function AvisoAtrasoBanner() {
  const { role } = useCurrentUser()
  if (role !== 'admin' && role !== 'financeiro') return null
  return <Faixa />
}

function Faixa() {
  const { espacosEmEscopo } = useEspacoAtivo()
  const { contas } = useContasPagar()
  const todasParcelas = useParcelasEmAtraso(espacosEmEscopo)
  // A faixa só lembra do urgente: evento que ainda vai acontecer com parcela
  // vencida. Evento já realizado/sem evento fica na janela, como "a conferir".
  const parcelas = useMemo(() => todasParcelas.filter(p => p.situacao === 'futuro'), [todasParcelas])
  const [cobrancaOpen, setCobrancaOpen] = useState(false)
  const [dispensadaNaSessao, setDispensadaNaSessao] = useState(false)
  // No servidor não há localStorage: renderiza como dispensada e decide no cliente.
  const dispensadaEm = useSyncExternalStore(assinar, lerDispensa, () => hojeISO())

  const contasVencidas = useMemo(() => contas.filter(c =>
    statusEfetivo(c) === 'atrasado' && (!espacosEmEscopo || espacosEmEscopo.includes(c.espaco)),
  ), [contas, espacosEmEscopo])

  const totalClientes = parcelas.reduce((s, p) => s + p.receita.valor, 0)
  const qtdClientes = new Set(parcelas.map(p => p.receita.eventoId ?? `cliente:${p.cliente}`)).size
  const totalContas = contasVencidas.reduce((s, c) => s + c.valor, 0)

  const oculta = dispensadaNaSessao || dispensadaEm === hojeISO() || (parcelas.length === 0 && contasVencidas.length === 0)

  return (
    <>
      {!oculta && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-red-500/30 bg-red-500/10 px-6 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <div className="flex-1 min-w-[200px] text-sm text-red-600">
            {parcelas.length > 0 && (
              <span>
                <strong>{qtdClientes} {qtdClientes === 1 ? 'cliente' : 'clientes'} com parcela vencida antes do evento</strong> · {formatCurrency(totalClientes)}
              </span>
            )}
            {parcelas.length > 0 && contasVencidas.length > 0 && <span className="mx-2 opacity-50">|</span>}
            {contasVencidas.length > 0 && (
              <span>
                <strong>{contasVencidas.length} {contasVencidas.length === 1 ? 'conta a pagar vencida' : 'contas a pagar vencidas'}</strong> · {formatCurrency(totalContas)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {parcelas.length > 0 && (
              <button onClick={() => setCobrancaOpen(true)}
                className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors">
                Ver cobrança
              </button>
            )}
            {contasVencidas.length > 0 && (
              <Link href="/contas-a-pagar?aba=atraso"
                className="rounded-lg border border-red-500/40 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10 transition-colors">
                Ver contas
              </Link>
            )}
            <button onClick={() => { setDispensadaNaSessao(true); dispensarHoje() }} title="Dispensar até amanhã"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600/80 hover:bg-red-500/10 transition-colors">
              <X className="h-3.5 w-3.5" /> Hoje não
            </button>
          </div>
        </div>
      )}
      {cobrancaOpen && <CobrancaClientesModal itens={todasParcelas} onClose={() => setCobrancaOpen(false)} />}
    </>
  )
}
