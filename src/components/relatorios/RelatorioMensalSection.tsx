'use client'

import { useMemo, useState } from 'react'
import { ArrowUpCircle, ArrowDownCircle, Wallet, Handshake, PlusCircle, Landmark, Vault, ArrowLeftRight, HardHat, Info, Plus } from 'lucide-react'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { useEspacos } from '@/contexts/EspacosContext'
import { useCurrentUser } from '@/contexts/UserContext'
import { formatCurrency } from '@/lib/utils'
import { DIVISAO_SOCIOS, GRUPOS_SOCIOS } from '@/lib/socios-config'
import { calcularFechamento } from '@/lib/fechamento-calc'
import { DespesasTable } from './LancamentosTables'
import NovaReceitaModal from '@/components/pagamentos/NovaReceitaModal'
import EditarEntradaModal from '@/components/pagamentos/EditarEntradaModal'
import NovaRetiradaSocioModal from './NovaRetiradaSocioModal'
import EditarRetiradaSocioModal from './EditarRetiradaSocioModal'
import LancamentoSocioListModal, { type LancamentoSocioRow } from './LancamentoSocioListModal'
import Toast from '@/components/shared/Toast'
import type { Receita } from '@/contexts/ReceitasContext'
import type { ContaPagar } from '@/types'

// Soma um grupo de lançamentos {nome (sócio), valor} por sócio individual, e
// calcula "consolidados" opcionais (ex: GCR = Camilo + Alex) por cima disso —
// nunca reagrupa o lançamento em si, só o total exibido.
function buildSocioBreakdown(
  items: { nome: string; valor: number }[],
  espacosEmEscopo: string[],
): { porSocio: { nome: string; valor: number }[]; grupos: { nome: string; valor: number }[] } {
  const porSocioMap = new Map<string, number>()
  for (const it of items) porSocioMap.set(it.nome, (porSocioMap.get(it.nome) ?? 0) + it.valor)

  const gruposMap = new Map<string, number>()
  for (const espaco of espacosEmEscopo) {
    for (const [grupo, membros] of Object.entries(GRUPOS_SOCIOS[espaco] ?? {})) {
      const soma = membros.reduce((s, m) => s + (porSocioMap.get(m) ?? 0), 0)
      if (soma !== 0) gruposMap.set(grupo, (gruposMap.get(grupo) ?? 0) + soma)
    }
  }
  return {
    porSocio: Array.from(porSocioMap.entries()).map(([nome, valor]) => ({ nome, valor })),
    grupos: Array.from(gruposMap.entries()).map(([nome, valor]) => ({ nome, valor })),
  }
}

interface Props {
  selectedSpaces?: string[]
  dataInicio?: string
  dataFim?: string
}

export default function RelatorioMensalSection({ selectedSpaces, dataInicio, dataFim }: Props) {
  const { receitas, addReceita, editarReceita, deleteReceita, categorias } = useReceitas()
  const { contas: contasPagar, addConta, updateConta, deleteConta } = useContasPagar()
  const { espacosConfig } = useEspacos()
  const { role } = useCurrentUser()
  const podeLancar = role === 'admin' || role === 'financeiro'

  const [novoAporteOpen, setNovoAporteOpen] = useState(false)
  const [novaRetiradaOpen, setNovaRetiradaOpen] = useState(false)
  const [drillDown, setDrillDown] = useState<null | 'aportes' | 'retiradas'>(null)
  const [editandoAporteId, setEditandoAporteId] = useState<string | null>(null)
  const [editandoRetiradaId, setEditandoRetiradaId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const espacos = selectedSpaces?.length
    ? espacosConfig.filter(e => selectedSpaces.includes(e.nome))
    : espacosConfig

  // Toda a aritmética (o que é operacional, obra, societário, Fundo de Caixa)
  // vem de fechamento-calc.ts — a mesma função que alimenta a aba Financeiro,
  // pra garantir que as duas telas nunca mostrem números diferentes.
  const {
    entradasOperacionais, totalEntradas, despesasOperacionais, totalSaidas,
    totalPorCategoriaDespesa: totalPorCategoria, resultado,
    aportes, totalAportes, retiradasSocio, totalRetiradasSocio,
    outrasEntradas, totalOutrasEntradas, transferenciasFundo, totalTransferenciasFundo,
    retornosFundo, totalRetornosFundo,
    saldoFundoAtual, saldoDisponivelForaFundo,
    obraPorEspaco,
  } = useMemo(
    () => calcularFechamento(receitas, contasPagar, { selectedSpaces, dataInicio, dataFim }, espacos),
    [receitas, contasPagar, selectedSpaces, dataInicio, dataFim, espacos],
  )

  const totalCaixa = totalEntradas + totalAportes + totalOutrasEntradas

  const nomesEspacosEmEscopo = useMemo(() => espacos.map(e => e.nome), [espacos])

  const aportesPorSocio = useMemo(() => buildSocioBreakdown(
    aportes.filter(r => r.status === 'pago' && r.socioResponsavel).map(r => ({ nome: r.socioResponsavel as string, valor: r.valor })),
    nomesEspacosEmEscopo,
  ), [aportes, nomesEspacosEmEscopo])

  const retiradasPorSocio = useMemo(() => buildSocioBreakdown(
    retiradasSocio.filter(c => c.status === 'pago' && c.fornecedor).map(c => ({ nome: c.fornecedor as string, valor: c.valor })),
    nomesEspacosEmEscopo,
  ), [retiradasSocio, nomesEspacosEmEscopo])

  const aportesRows: LancamentoSocioRow[] = aportes.map(r => ({
    id: r.id, data: r.data, socio: r.socioResponsavel ?? '—', espaco: r.espaco ?? '—',
    valor: r.valor, descricao: r.descricao, observacoes: r.observacoes,
  }))
  const retiradasRows: LancamentoSocioRow[] = retiradasSocio.map(c => ({
    id: c.id, data: c.dataPagamento ?? c.dataVencimento, socio: c.fornecedor ?? '—', espaco: c.espaco,
    valor: c.valor, descricao: c.descricao, observacoes: c.observacoes,
  }))

  const espacoUnico = selectedSpaces?.length === 1 ? selectedSpaces[0] : undefined

  const porEspaco = useMemo(() => espacos.map(e => {
    // Divisão de lucro entre sócios usa só receita operacional (de evento) e
    // despesa operacional — aporte/outras entradas, retirada de sócio e Fundo de
    // Caixa não entram no lucro, só aparecem separados.
    const entradasEspaco = entradasOperacionais.filter(r => r.espaco === e.nome)
    // Contas com espaço "Todos" são despesas gerais, não entram na divisão por espaço.
    const saidasEspaco = despesasOperacionais.filter(c => c.espaco === e.nome)
    const receitaTotal = entradasEspaco.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
    const despesaTotal = saidasEspaco.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
    const lucro = receitaTotal - despesaTotal
    const aportesEspaco = aportes.filter(r => r.espaco === e.nome && r.status === 'pago').reduce((s, r) => s + r.valor, 0)
    const retiradasEspaco = retiradasSocio.filter(c => c.espaco === e.nome && c.status === 'pago').reduce((s, c) => s + c.valor, 0)
    const transferenciasEspaco = transferenciasFundo.filter(c => c.espaco === e.nome && c.status === 'pago').reduce((s, c) => s + c.valor, 0)
    const retornosEspaco = retornosFundo.filter(r => r.espaco === e.nome && r.status === 'pago').reduce((s, r) => s + r.valor, 0)
    // Repasse aos sócios usa o Disponível para Distribuição (resultado menos o
    // que foi separado pro Fundo de Caixa no período, mais o que voltou dele) —
    // nunca o lucro bruto, senão dinheiro já reservado seria repassado também.
    const disponivelEspaco = lucro - transferenciasEspaco + retornosEspaco
    // Se o espaço não estiver configurado em DIVISAO_SOCIOS, presume-se que não tem sócio.
    const socios = (DIVISAO_SOCIOS[e.nome] ?? []).map(s => ({ ...s, valor: disponivelEspaco * (s.percentual / 100) }))
    return { nome: e.nome, entradasEspaco, saidasEspaco, receitaTotal, despesaTotal, lucro, disponivelEspaco, socios, aportesEspaco, retiradasEspaco, transferenciasEspaco }
  }), [espacos, entradasOperacionais, despesasOperacionais, aportes, retiradasSocio, transferenciasFundo, retornosFundo])

  const saidasGerais = despesasOperacionais.filter(c => c.espaco === 'Todos')
  const totalSaidasGerais = saidasGerais.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-6">
      <h3 className="text-sm font-semibold text-app-text">Relatório Mensal — Entradas, Saídas e Divisão de Lucro</h3>

      {/* Resultado Operacional */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Resultado Operacional</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="min-w-0 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-1"><ArrowUpCircle className="h-4 w-4 shrink-0 text-emerald-500" /><span className="text-xs text-emerald-600 font-medium">Receitas Operacionais</span></div>
            <p className="text-lg font-bold text-emerald-600 break-words">{formatCurrency(totalEntradas)}</p>
            <p className="text-xs text-app-subtle mt-1">{entradasOperacionais.length} lançamentos — de eventos/Agenda</p>
          </div>
          <div className="min-w-0 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-1"><ArrowDownCircle className="h-4 w-4 shrink-0 text-red-500" /><span className="text-xs text-red-600 font-medium">Despesas Operacionais</span></div>
            <p className="text-lg font-bold text-red-600 break-words">{formatCurrency(totalSaidas)}</p>
            <p className="text-xs text-app-subtle mt-1">
              Operacional {formatCurrency(totalPorCategoria('operacional'))} · Financeiro {formatCurrency(totalPorCategoria('financeiro'))}
            </p>
          </div>
          <div className={`min-w-0 rounded-xl border p-4 ${resultado >= 0 ? 'border-[#25D366]/25 bg-[#25D366]/5' : 'border-red-500/20 bg-red-500/5'}`}>
            <div className="flex items-center gap-2 mb-1"><Wallet className={`h-4 w-4 shrink-0 ${resultado >= 0 ? 'text-[#128C7E]' : 'text-red-500'}`} /><span className={`text-xs font-medium ${resultado >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>Resultado</span></div>
            <p className={`text-lg font-bold break-words ${resultado >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(resultado)}</p>
            <p className="text-xs text-app-subtle mt-1">Receitas operacionais − despesas operacionais</p>
          </div>
        </div>
      </section>

      {/* Movimentações Societárias */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Movimentações Societárias</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2"><Handshake className="h-4 w-4 shrink-0 text-violet-500" /><span className="text-xs text-violet-600 font-medium">Aportes Societários</span></div>
              {podeLancar && (
                <button onClick={() => setNovoAporteOpen(true)} title="Novo aporte"
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 hover:bg-violet-500/25 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button onClick={() => setDrillDown('aportes')} className="text-lg font-bold text-violet-600 break-words hover:underline text-left">
              {formatCurrency(totalAportes)}
            </button>
            <p className="text-xs text-app-subtle mt-1">{aportes.length} lançamentos — não conta como faturamento nem despesa</p>
            {(aportesPorSocio.porSocio.length > 0 || aportesPorSocio.grupos.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {aportesPorSocio.porSocio.map(s => (
                  <span key={s.nome} className="flex items-center gap-1 rounded-full bg-app-surface2 border border-app-border2/60 px-2 py-0.5 text-[11px]">
                    <span className="text-app-text font-medium">{s.nome}</span>
                    <span className="text-violet-600 font-semibold">{formatCurrency(s.valor)}</span>
                  </span>
                ))}
                {aportesPorSocio.grupos.map(g => (
                  <span key={g.nome} className="flex items-center gap-1 rounded-full border border-dashed border-violet-400/50 px-2 py-0.5 text-[11px]">
                    <span className="text-app-subtle">{g.nome} consolidado</span>
                    <span className="text-violet-600 font-semibold">{formatCurrency(g.valor)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="min-w-0 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2"><Landmark className="h-4 w-4 shrink-0 text-fuchsia-500" /><span className="text-xs text-fuchsia-600 font-medium">Retiradas de Sócios</span></div>
              {podeLancar && (
                <button onClick={() => setNovaRetiradaOpen(true)} title="Nova retirada"
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-600 hover:bg-fuchsia-500/25 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button onClick={() => setDrillDown('retiradas')} className="text-lg font-bold text-fuchsia-600 break-words hover:underline text-left">
              {formatCurrency(totalRetiradasSocio)}
            </button>
            <p className="text-xs text-app-subtle mt-1">{retiradasSocio.length} lançamentos — não conta como despesa</p>
            {(retiradasPorSocio.porSocio.length > 0 || retiradasPorSocio.grupos.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {retiradasPorSocio.porSocio.map(s => (
                  <span key={s.nome} className="flex items-center gap-1 rounded-full bg-app-surface2 border border-app-border2/60 px-2 py-0.5 text-[11px]">
                    <span className="text-app-text font-medium">{s.nome}</span>
                    <span className="text-fuchsia-600 font-semibold">{formatCurrency(s.valor)}</span>
                  </span>
                ))}
                {retiradasPorSocio.grupos.map(g => (
                  <span key={g.nome} className="flex items-center gap-1 rounded-full border border-dashed border-fuchsia-400/50 px-2 py-0.5 text-[11px]">
                    <span className="text-app-subtle">{g.nome} consolidado</span>
                    <span className="text-fuchsia-600 font-semibold">{formatCurrency(g.valor)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Controle de Caixa */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Controle de Caixa</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="min-w-0 rounded-xl border border-app-border2 bg-app-surface2/40 p-4">
            <div className="flex items-center gap-2 mb-1"><PlusCircle className="h-4 w-4 shrink-0 text-app-muted" /><span className="text-xs text-app-muted font-medium">Outras Entradas</span></div>
            <p className="text-lg font-bold text-app-text break-words">{formatCurrency(totalOutrasEntradas)}</p>
            <p className="text-xs text-app-subtle mt-1">{outrasEntradas.length} lançamentos — não conta como faturamento</p>
          </div>
          <div className="min-w-0 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-1"><Vault className="h-4 w-4 shrink-0 text-amber-500" /><span className="text-xs text-amber-600 font-medium">Transferências p/ Fundo de Caixa</span></div>
            <p className="text-lg font-bold text-amber-600 break-words">{formatCurrency(totalTransferenciasFundo)}</p>
            <p className="text-xs text-app-subtle mt-1">{transferenciasFundo.length} lançamentos no período — não é despesa</p>
          </div>
          <div className="min-w-0 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <div className="flex items-center gap-2 mb-1"><ArrowLeftRight className="h-4 w-4 shrink-0 text-sky-500" /><span className="text-xs text-sky-600 font-medium">Retornos do Fundo de Caixa</span></div>
            <p className="text-lg font-bold text-sky-600 break-words">{formatCurrency(totalRetornosFundo)}</p>
            <p className="text-xs text-app-subtle mt-1">{retornosFundo.length} lançamentos no período — não é receita</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 mb-1"><Vault className="h-4 w-4 shrink-0 text-amber-600" /><span className="text-xs text-amber-700 font-medium">Saldo Atual do Fundo de Caixa</span></div>
            <p className="text-lg font-bold text-amber-700 break-words">{formatCurrency(saldoFundoAtual)}</p>
            <p className="text-xs text-app-subtle mt-1">Acumulado — transferências menos retornos, desde o início</p>
          </div>
          <div className="min-w-0 rounded-xl border border-app-border2 bg-app-surface2/40 p-4">
            <div className="flex items-center gap-2 mb-1"><Wallet className="h-4 w-4 shrink-0 text-app-muted" /><span className="text-xs text-app-muted font-medium">Saldo Disponível fora do Fundo</span></div>
            <p className="text-lg font-bold text-app-text break-words">{formatCurrency(saldoDisponivelForaFundo)}</p>
            <p className="text-xs text-app-subtle mt-1">Acumulado — caixa operacional, sem contar o Fundo de Caixa</p>
          </div>
        </div>
      </section>

      {/* Fechamento da Obra — controle à parte, nunca misturado com a operação */}
      {obraPorEspaco.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Fechamento da Obra</h4>
          <div className="space-y-3">
            {obraPorEspaco.map(o => (
              <div key={o.nome} className="rounded-lg border border-orange-500/25 bg-orange-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-app-text flex items-center gap-1.5">
                    <HardHat className="h-4 w-4 text-orange-500" />
                    {o.nome}
                  </p>
                  <p className="text-xs text-app-subtle">{o.aportesCount} aporte(s) · {o.despesasCount} despesa(s) de obra — acumulado</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-app-subtle">Aportes para Obra</p>
                    <p className="font-semibold text-violet-600">{formatCurrency(o.totalAportes)}</p>
                  </div>
                  <div>
                    <p className="text-app-subtle">Despesas de Obra</p>
                    <p className="font-semibold text-red-500">{formatCurrency(o.totalDespesas)}</p>
                  </div>
                  <div>
                    <p className="text-app-subtle">Saldo da Obra</p>
                    <p className={`font-semibold ${o.saldo >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(o.saldo)}</p>
                  </div>
                </div>

                {o.porSocio.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-app-muted mb-1.5">Aporte realizado por cada sócio</p>
                    <div className="flex flex-wrap gap-2">
                      {o.porSocio.map(s => (
                        <span key={s.nome} className="flex items-center gap-1.5 rounded-full bg-app-surface2 border border-app-border2/60 px-2.5 py-1 text-xs">
                          <span className="text-app-text font-medium">{s.nome}</span>
                          <span className="font-semibold text-violet-600">{formatCurrency(s.valor)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {o.investimentos.length > 0 && (
                  <div className="rounded-lg bg-app-surface2/60 border border-app-border2/60 px-3 py-2 space-y-1">
                    <p className="text-xs font-medium text-app-muted flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Quadro Societário</p>
                    {o.investimentos.map((inv, i) => (
                      <p key={i} className="text-xs text-app-subtle">
                        <span className="text-app-text font-medium">{inv.socio}</span> — {inv.descricao}: {formatCurrency(inv.valor)} (informativo, não é receita nem entra no fechamento da obra)
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Relatório por espaço */}
      <div className="space-y-4">
        {porEspaco.map(e => (
          <EspacoReportCard key={e.nome} {...e} />
        ))}
        {espacos.length === 0 && (
          <p className="text-sm text-app-subtle text-center py-4">Nenhum espaço cadastrado.</p>
        )}
      </div>

      {/* Despesas gerais, não vinculadas a um espaço específico */}
      {saidasGerais.length > 0 && (
        <details className="group rounded-lg border border-app-border2/60 bg-app-bg p-4">
          <summary className="cursor-pointer text-xs font-medium text-app-muted hover:text-app-text transition-colors list-none flex items-center justify-between gap-1">
            <span className="flex items-center gap-1">
              <span className="group-open:hidden">▶</span>
              <span className="hidden group-open:inline">▼</span>
              Despesas gerais (não vinculadas a um espaço) — {saidasGerais.length} lançamentos
            </span>
            <span className="font-semibold text-red-500">{formatCurrency(totalSaidasGerais)}</span>
          </summary>
          <div className="mt-3">
            <DespesasTable despesas={saidasGerais} />
          </div>
        </details>
      )}

      {novoAporteOpen && (
        <NovaReceitaModal
          categorias={categorias}
          fixedTipoEntrada="aporte_societario"
          espacoPadrao={espacoUnico}
          onClose={() => setNovoAporteOpen(false)}
          onSave={async input => {
            const nova = await addReceita(input)
            showToast('Aporte societário registrado.')
            return nova
          }}
        />
      )}

      {novaRetiradaOpen && (
        <NovaRetiradaSocioModal
          onClose={() => setNovaRetiradaOpen(false)}
          onSave={addConta}
          onSaved={() => showToast('Retirada de sócio registrada.')}
        />
      )}

      {drillDown === 'aportes' && (
        <LancamentoSocioListModal
          titulo="Aportes Societários"
          rows={aportesRows}
          fileModule="receitas"
          onClose={() => setDrillDown(null)}
          onEdit={id => setEditandoAporteId(id)}
        />
      )}

      {editandoAporteId && (() => {
        const receitaEditando = receitas.find(r => r.id === editandoAporteId)
        return receitaEditando ? (
          <EditarEntradaModal
            receita={receitaEditando}
            categorias={categorias}
            onClose={() => setEditandoAporteId(null)}
            onSave={async (id, patch) => {
              await editarReceita(id, patch)
              showToast('Aporte atualizado.')
            }}
            onExcluir={async id => {
              await deleteReceita(id)
              setEditandoAporteId(null)
              showToast('Aporte excluído.')
            }}
          />
        ) : null
      })()}
      {drillDown === 'retiradas' && (
        <LancamentoSocioListModal
          titulo="Retiradas de Sócios"
          rows={retiradasRows}
          fileModule="contas"
          onClose={() => setDrillDown(null)}
          onEdit={id => setEditandoRetiradaId(id)}
        />
      )}

      {editandoRetiradaId && (() => {
        const contaEditando = contasPagar.find(c => c.id === editandoRetiradaId)
        return contaEditando ? (
          <EditarRetiradaSocioModal
            conta={contaEditando}
            onClose={() => setEditandoRetiradaId(null)}
            onSave={async c => {
              await updateConta(c)
              showToast('Retirada atualizada.')
            }}
            onExcluir={async id => {
              await deleteConta(id)
              showToast('Retirada excluída.')
            }}
          />
        ) : null
      })()}

      <Toast message={toastMsg} />
    </div>
  )
}

interface EspacoReportCardProps {
  nome: string
  entradasEspaco: Receita[]
  saidasEspaco: ContaPagar[]
  receitaTotal: number
  despesaTotal: number
  lucro: number
  disponivelEspaco: number
  socios: { nome: string; percentual: number; valor: number }[]
  aportesEspaco: number
  retiradasEspaco: number
  transferenciasEspaco: number
}

function EspacoReportCard({ nome, entradasEspaco, saidasEspaco, receitaTotal, despesaTotal, lucro, disponivelEspaco, socios, aportesEspaco, retiradasEspaco, transferenciasEspaco }: EspacoReportCardProps) {
  return (
    <div className="rounded-lg border border-app-border2/60 bg-app-bg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-app-text">{nome}</p>
        <p className="text-xs text-app-subtle">{entradasEspaco.length} receita(s) operacional(is) · {saidasEspaco.length} despesa(s)</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-app-subtle">Receitas Operacionais</p>
          <p className="font-semibold text-emerald-600">{formatCurrency(receitaTotal)}</p>
        </div>
        <div>
          <p className="text-app-subtle">Despesas Operacionais</p>
          <p className="font-semibold text-red-500">{formatCurrency(despesaTotal)}</p>
        </div>
      </div>

      {aportesEspaco > 0 && (
        <p className="text-xs text-violet-500 flex items-center gap-1.5">
          <Handshake className="h-3 w-3" />
          + {formatCurrency(aportesEspaco)} em aportes societários neste espaço (fora do resultado)
        </p>
      )}
      {retiradasEspaco > 0 && (
        <p className="text-xs text-fuchsia-500 flex items-center gap-1.5">
          <Landmark className="h-3 w-3" />
          − {formatCurrency(retiradasEspaco)} em retiradas de sócios neste espaço (fora do resultado)
        </p>
      )}
      {transferenciasEspaco > 0 && (
        <p className="text-xs text-amber-600 flex items-center gap-1.5">
          <Vault className="h-3 w-3" />
          − {formatCurrency(transferenciasEspaco)} transferidos pro Fundo de Caixa neste espaço (fora do resultado)
        </p>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-app-border/50">
        <span className="text-xs font-medium text-app-muted">Resultado</span>
        <span className={`text-sm font-bold ${lucro >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(lucro)}</span>
      </div>
      {disponivelEspaco !== lucro && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-app-subtle">Disponível pra distribuição (após Fundo de Caixa)</span>
          <span className="text-xs font-semibold text-app-text">{formatCurrency(disponivelEspaco)}</span>
        </div>
      )}

      {/* Repasse para os sócios */}
      <div>
        <p className="text-xs font-medium text-app-muted mb-1.5">Repasse para os sócios — sobre o disponível pra distribuição</p>
        {socios.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {socios.map(s => (
              <span key={s.nome} className="flex items-center gap-1.5 rounded-full bg-app-surface2 border border-app-border2/60 px-2.5 py-1 text-xs">
                <span className="text-app-text font-medium">{s.nome}</span>
                <span className="text-app-subtle">{s.percentual}%</span>
                <span className={`font-semibold ${s.valor >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(s.valor)}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-app-subtle italic">Sem sócio configurado para este espaço — o lucro fica integral.</p>
        )}
      </div>
    </div>
  )
}
