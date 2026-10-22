'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Banknote, Pencil, Check, Repeat } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { statusEfetivo } from '@/contexts/ContasPagarContext'
import { useReceitas, statusEfetivoReceita, type Receita, type BaixaReceitaInput } from '@/contexts/ReceitasContext'
import { useEventos } from '@/contexts/EventosContext'
import { useRepasses } from '@/contexts/RepassesContext'
import { aplicarBaixaComRepasseAutomatico } from '@/lib/repasse-socio'
import { EditarParcelaModal } from '@/components/eventos/PlanoPagamentoSection'
import { formatCurrency, hojeISO, mensagemDeErro } from '@/lib/utils'
import { eventoAtivo, type ContaPagar } from '@/types'

// Cor sólida da etiqueta por tipo de despesa (subcategoria) — mesmos tons dos
// selos da lista de Contas a Pagar. Verde fica reservado para "a receber".
const COR_SUBCATEGORIA: Record<string, string> = {
  aluguel: 'bg-violet-600', energia: 'bg-yellow-600', agua: 'bg-cyan-600', iptu: 'bg-rose-600',
  internet: 'bg-sky-600', funcionários: 'bg-blue-600', manutenção: 'bg-orange-600', fornecedores: 'bg-fuchsia-600',
  extras: 'bg-zinc-500', outros: 'bg-slate-600', despesa_a_comprovar: 'bg-red-700',
}
const COR_RECEBER = 'bg-emerald-600'
const MAX_ETIQUETAS = 4

type Item =
  | { tipo: 'pagar'; id: string; data: string; texto: string; valor: number; feito: boolean; atrasado: boolean; cor: string; conta: ContaPagar }
  | { tipo: 'receber'; id: string; data: string; texto: string; valor: number; feito: boolean; atrasado: boolean; cor: string; receita: Receita }

interface Props {
  contas: ContaPagar[]                     // já filtradas pelo espaço ativo
  espacosEmEscopo: string[] | undefined
  subcategoriaLabel: Record<string, string>
  onNovaConta: (vencimento: string) => void
  onDarBaixa: (c: ContaPagar) => void
  onEditar: (c: ContaPagar) => void
  showToast: (msg: string) => void
}

export default function CalendarioFinanceiro({ contas, espacosEmEscopo, subcategoriaLabel, onNovaConta, onDarBaixa, onEditar, showToast }: Props) {
  const { receitas, updateReceita } = useReceitas()
  const { eventos } = useEventos()
  const { repasses, addRepasse } = useRepasses()
  const [mes, setMes] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1) })
  const [diaSel, setDiaSel] = useState<Date | null>(() => new Date())
  const [verPagar, setVerPagar] = useState(true)
  const [verReceber, setVerReceber] = useState(true)
  const [verFeitos, setVerFeitos] = useState(true)
  const [parcelaBaixa, setParcelaBaixa] = useState<Receita | null>(null)

  const itens = useMemo<Item[]>(() => {
    const hoje = hojeISO()
    const out: Item[] = []
    for (const c of contas) {
      const st = statusEfetivo(c)
      const feito = st === 'pago'
      const serie = c.serieId ? ` (${c.serieNumero}/${c.serieTotal})` : ''
      out.push({
        tipo: 'pagar', id: c.id, data: feito ? (c.dataPagamento ?? c.dataVencimento) : c.dataVencimento,
        texto: `${c.descricao}${serie}`, valor: c.valor, feito, atrasado: st === 'atrasado',
        cor: COR_SUBCATEGORIA[c.subcategoria] ?? 'bg-slate-600', conta: c,
      })
    }
    // A receber: parcelas de eventos (contratos). Pré-evento e evento cancelado não entram.
    const eventosPorId = new Map(eventos.map(e => [e.id, e]))
    for (const r of receitas) {
      if (r.tipoEntrada !== 'evento') continue
      if (espacosEmEscopo && !(r.espaco && espacosEmEscopo.includes(r.espaco))) continue
      const ev = r.eventoId ? eventosPorId.get(r.eventoId) : undefined
      if (ev && (!eventoAtivo(ev) || ev.status === 'em_negociacao')) continue
      const st = statusEfetivoReceita(r)
      const feito = st === 'pago'
      const parcela = r.parcelaLabel ?? r.descricao
      out.push({
        tipo: 'receber', id: r.id, data: feito ? (r.dataRecebimento ?? r.data) : r.data,
        texto: `${ev?.cliente ?? r.cliente ?? ''} — ${parcela}`, valor: r.valor, feito, atrasado: !feito && r.data < hoje,
        cor: COR_RECEBER, receita: r,
      })
    }
    return out
  }, [contas, receitas, eventos, espacosEmEscopo])

  const visiveis = itens.filter(i => (i.tipo === 'pagar' ? verPagar : verReceber) && (verFeitos || !i.feito))
  const porDia = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const i of visiveis) m.set(i.data, [...(m.get(i.data) ?? []), i])
    for (const lst of m.values()) lst.sort((a, b) => Number(a.feito) - Number(b.feito) || (a.tipo === b.tipo ? 0 : a.tipo === 'receber' ? -1 : 1))
    return m
  }, [visiveis])

  const chaveMes = format(mes, 'yyyy-MM')
  const doMes = itens.filter(i => i.data.startsWith(chaveMes))
  const soma = (f: (i: Item) => boolean) => doMes.filter(f).reduce((s, i) => s + i.valor, 0)
  const aPagar = soma(i => i.tipo === 'pagar' && !i.feito)
  const pago = soma(i => i.tipo === 'pagar' && i.feito)
  const aReceber = soma(i => i.tipo === 'receber' && !i.feito)
  const recebido = soma(i => i.tipo === 'receber' && i.feito)

  const dias = eachDayOfInterval({ start: startOfMonth(mes), end: endOfMonth(mes) })
  const vazios = getDay(startOfMonth(mes))
  const iso = (d: Date) => format(d, 'yyyy-MM-dd')
  const itensDiaSel = diaSel ? (porDia.get(iso(diaSel)) ?? []) : []

  async function salvarBaixaParcela(r: Receita, patch: BaixaReceitaInput) {
    try {
      await aplicarBaixaComRepasseAutomatico(r, patch, updateReceita, addRepasse, repasses)
      showToast(patch.status === 'pago' ? 'Recebimento registrado.' : 'Parcela atualizada.')
    } catch (err) {
      showToast(mensagemDeErro(err, 'Falha ao registrar o recebimento.'))
      throw err
    }
  }

  function etiqueta(i: Item) {
    return (
      <span key={`${i.tipo}-${i.id}`}
        title={`${i.tipo === 'receber' ? 'A receber' : 'A pagar'} · ${i.texto} · ${formatCurrency(i.valor)}${i.feito ? (i.tipo === 'receber' ? ' · recebido' : ' · pago') : i.atrasado ? ' · vencido' : ''}`}
        className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold leading-tight text-white ${i.cor} ${i.feito ? 'opacity-45' : ''} ${i.atrasado ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-app-surface' : ''}`}>
        {i.feito ? '✓ ' : i.tipo === 'receber' ? '+ ' : ''}{i.texto} · {formatCurrency(i.valor)}
      </span>
    )
  }

  const toggle = (ativo: boolean, set: (v: boolean) => void, rotulo: string, cor: string) => (
    <button onClick={() => set(!ativo)}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${ativo ? 'border-app-border2 bg-app-surface2 text-app-text' : 'border-app-border text-app-subtle line-through'}`}>
      <span className={`h-2.5 w-2.5 rounded-sm ${cor}`} />{rotulo}
    </button>
  )

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-3 sm:p-5 space-y-4">
      {/* Cabeçalho: mês e resumo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-md text-app-muted hover:bg-app-surface2"><ChevronLeft className="h-4 w-4" /></button>
          <h2 className="min-w-[140px] text-center text-base font-semibold text-app-text capitalize">{format(mes, 'MMMM yyyy', { locale: ptBR })}</h2>
          <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-md text-app-muted hover:bg-app-surface2"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => { const h = new Date(); setMes(new Date(h.getFullYear(), h.getMonth(), 1)); setDiaSel(h) }} className="rounded-lg border border-app-border2 px-2.5 py-1 text-xs text-app-muted hover:bg-app-surface2">Hoje</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {toggle(verPagar, setVerPagar, 'Contas a pagar', 'bg-violet-600')}
          {toggle(verReceber, setVerReceber, 'A receber', COR_RECEBER)}
          {toggle(verFeitos, setVerFeitos, 'Pagos / recebidos', 'bg-zinc-400')}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {[
          ['A pagar no mês', aPagar, 'text-red-600'], ['Pago no mês', pago, 'text-app-text'],
          ['A receber no mês', aReceber, 'text-emerald-600'], ['Recebido no mês', recebido, 'text-app-text'],
          ['Saldo previsto (a receber − a pagar)', aReceber - aPagar, aReceber - aPagar >= 0 ? 'text-emerald-600' : 'text-red-600'],
        ].map(([rotulo, valor, cor]) => (
          <div key={rotulo as string} className="rounded-lg border border-app-border bg-app-surface2/40 px-3 py-2">
            <p className="text-[11px] text-app-muted">{rotulo as string}</p>
            <p className={`text-sm font-bold ${cor as string}`}>{formatCurrency(valor as number)}</p>
          </div>
        ))}
      </div>

      {/* Mês */}
      <div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="text-center text-xs font-medium text-app-subtle py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: vazios }).map((_, i) => <div key={`v${i}`} />)}
          {dias.map(dia => {
            const lst = porDia.get(iso(dia)) ?? []
            const sel = diaSel ? isSameDay(dia, diaSel) : false
            const hoje = isSameDay(dia, new Date())
            return (
              <button key={iso(dia)} onClick={() => setDiaSel(dia)}
                className={`flex flex-col items-center sm:items-stretch rounded-lg p-1 sm:p-1.5 min-h-[52px] sm:min-h-[120px] border text-left transition-colors ${sel ? 'border-[#25D366]/50 bg-[#25D366]/5' : 'border-app-border/60 hover:bg-app-surface2'}`}>
                <span className={`text-xs font-medium mb-1 h-5 w-5 flex items-center justify-center rounded-full sm:self-end shrink-0 ${hoje ? 'text-white' : 'text-app-text2'}`}
                  style={hoje ? { backgroundColor: '#25D366' } : undefined}>{format(dia, 'd')}</span>
                {/* Celular: só pontos; a lista do dia aparece abaixo. */}
                <div className="flex sm:hidden flex-wrap gap-0.5 justify-center">
                  {lst.slice(0, 4).map(i => <span key={`${i.tipo}-${i.id}`} className={`h-1.5 w-1.5 rounded-full ${i.cor} ${i.feito ? 'opacity-45' : ''}`} />)}
                </div>
                <div className="hidden sm:flex flex-col gap-0.5 min-w-0">
                  {lst.slice(0, MAX_ETIQUETAS).map(etiqueta)}
                  {lst.length > MAX_ETIQUETAS && <span className="px-1 text-[10px] text-app-subtle">+{lst.length - MAX_ETIQUETAS} mais</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Dia selecionado */}
      {diaSel && (
        <div className="border-t border-app-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-app-text capitalize">{format(diaSel, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
            <button onClick={() => onNovaConta(iso(diaSel))}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: '#25D366' }}>
              <Plus className="h-3.5 w-3.5" /> Nova conta neste dia
            </button>
          </div>
          {itensDiaSel.length === 0 ? (
            <p className="text-xs text-app-subtle">Nada neste dia.</p>
          ) : (
            <div className="space-y-1.5">
              {itensDiaSel.map(i => (
                <div key={`${i.tipo}-${i.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-app-border px-3 py-2">
                  <span className={`h-3 w-3 rounded-sm shrink-0 ${i.cor}`} />
                  <div className="flex-1 min-w-0 basis-48">
                    <p className="text-sm text-app-text truncate">{i.texto}</p>
                    <p className="text-[11px] text-app-subtle">
                      {i.tipo === 'receber' ? 'A receber' : `A pagar · ${subcategoriaLabel[i.conta.subcategoria] ?? i.conta.subcategoria}`}
                      {i.tipo === 'pagar' && i.conta.serieId && <span className="inline-flex items-center gap-0.5 ml-1"><Repeat className="h-3 w-3" /> conta fixa</span>}
                      {i.feito ? (i.tipo === 'receber' ? ' · recebido' : ' · pago') : i.atrasado ? ' · vencido' : ''}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${i.tipo === 'receber' ? 'text-emerald-600' : 'text-app-text'}`}>{formatCurrency(i.valor)}</p>
                  {i.feito ? (
                    <span className="flex items-center gap-1 text-xs text-app-subtle"><Check className="h-3.5 w-3.5" /> {i.tipo === 'receber' ? 'Recebido' : 'Pago'}</span>
                  ) : i.tipo === 'pagar' ? (
                    <button onClick={() => onDarBaixa(i.conta)} className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20">
                      <Banknote className="h-3.5 w-3.5" /> Dar baixa
                    </button>
                  ) : (
                    <button onClick={() => setParcelaBaixa(i.receita)} className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20">
                      <Banknote className="h-3.5 w-3.5" /> Registrar recebimento
                    </button>
                  )}
                  {i.tipo === 'pagar' && (
                    <button onClick={() => onEditar(i.conta)} title="Editar" className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {parcelaBaixa && (
        <EditarParcelaModal parcela={parcelaBaixa} onClose={() => setParcelaBaixa(null)} onSalvar={patch => salvarBaixaParcela(parcelaBaixa, patch)} />
      )}
    </div>
  )
}
