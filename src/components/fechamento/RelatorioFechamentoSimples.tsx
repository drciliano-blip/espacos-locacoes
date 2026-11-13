'use client'

// Relatório de fechamento que vai para o cliente (PDF via "Exportar
// Relatório"). Substitui o PDF antigo, que imprimia a tela inteira, os blocos
// zerados e os textos técnicos, em 9 páginas que o cliente não conseguia ler.
// Aqui ficam quatro blocos: resultado do mês, quanto cada sócio tem a
// receber (resumo + extrato de cada um, com os pagamentos do mês),
// receitas e despesas por tipo. Todos os números saem
// dos mesmos cálculos da tela (calcularFechamento + repasseSociosRows), então
// o PDF sempre bate com o que se vê no sistema.

import type { ContaPagar } from '@/types'
import type { Receita } from '@/contexts/ReceitasContext'
import type { RepasseSocio } from '@/contexts/RepassesContext'
import { SUBCATEGORIA_LABEL } from '@/components/relatorios/LancamentosTables'
import { formatCurrency } from '@/lib/utils'

export interface LinhaSocioRelatorio {
  espaco: string
  socio: string
  percentual: number
  lucro: number
  pendenteHerdado: number
  quitadoAnterior: number
  quitadoComRetirada: number
  ajusteReservaObra?: number
  valorDevido: number
  retirado: number
  jaRepassado: number
  valorPendente: number
}

interface Props {
  espacosLabel: string
  dataInicio: string
  dataFim: string
  totalReceitas: number
  totalDespesas: number
  resultado: number
  socios: LinhaSocioRelatorio[]
  receitas: Receita[]
  despesas: ContaPagar[]
  retiradas: ContaPagar[]
  repasses: RepasseSocio[]
  nomeCanonicoSocio: (nome: string) => string
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const br = (iso: string) => iso.split('-').reverse().join('/')
const ddmm = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/')

function tituloPeriodo(inicio: string, fim: string): string {
  if (!inicio || !fim) return 'Todo o período'
  const [ai, mi, di] = inicio.split('-').map(Number)
  const [af, mf, df] = fim.split('-').map(Number)
  const ultimoDia = new Date(af, mf, 0).getDate()
  if (ai === af && mi === mf && di === 1 && df === ultimoDia) {
    return `${MESES[mi - 1].replace(/^./, c => c.toUpperCase())}/${ai}`
  }
  return `${br(inicio)} a ${br(fim)}`
}

// "outubro" quando o período é um mês fechado; senão "o período".
function nomeDoMes(inicio: string, fim: string): string {
  const t = tituloPeriodo(inicio, fim)
  return /^[A-Za-zçÇ]+\/\d{4}$/.test(t) ? MESES[Number(inicio.split('-')[1]) - 1] : 'o período'
}

// Sem "-R$ 0,00" quando o valor é zero com sinal ou resto de arredondamento.
const dinheiro = (v: number) => formatCurrency(Math.abs(v) < 0.005 ? 0 : v)

function tipoDespesa(c: ContaPagar): string {
  if (c.categoria === 'financeiro') return 'Impostos e encargos'
  return SUBCATEGORIA_LABEL[c.subcategoria] ?? 'Outros'
}

// Descrição sem o nome do cliente repetido ("Parcela 1 — FORMO SAO PAULO").
function descricaoCurta(r: Receita): string {
  if (r.cliente && r.descricao.endsWith(` — ${r.cliente}`)) return r.descricao.slice(0, -(` — ${r.cliente}`).length)
  return r.descricao
}

export default function RelatorioFechamentoSimples(p: Props) {
  const variosEspacos = new Set(p.socios.map(s => s.espaco)).size > 1
  const recebidas = p.receitas.filter(r => r.status === 'pago').sort((a, b) => a.data.localeCompare(b.data))
  const aReceber = p.receitas.filter(r => r.status !== 'pago' && r.valor > 0).sort((a, b) => a.data.localeCompare(b.data))
  const pagas = p.despesas.filter(c => c.status === 'pago')

  const grupos = new Map<string, ContaPagar[]>()
  for (const c of pagas) {
    const t = tipoDespesa(c)
    grupos.set(t, [...(grupos.get(t) ?? []), c])
  }
  const gruposOrdenados = [...grupos.entries()]
    .map(([tipo, itens]) => ({ tipo, itens: itens.sort((a, b) => (a.dataPagamento ?? a.dataVencimento).localeCompare(b.dataPagamento ?? b.dataVencimento)), total: itens.reduce((s, c) => s + c.valor, 0) }))
    .sort((a, b) => b.total - a.total)

  const nomeMes = nomeDoMes(p.dataInicio, p.dataFim)

  // Pagamentos aos sócios no período, cada um com "a que se refere" (saldo
  // anterior ou o mês) — vão no extrato de cada sócio.
  const pagamentos: { data: string; espaco: string; socio: string; valor: number; referente: string; detalhe: string; tipo: string; conta: boolean }[] = []
  const restanteAnterior = new Map<string, number>()
  for (const s of p.socios) restanteAnterior.set(`${s.espaco}|${s.socio}`, s.quitadoAnterior)
  const classificar = (chave: string, valor: number): string => {
    const resto = restanteAnterior.get(chave) ?? 0
    const usado = Math.min(resto, valor)
    restanteAnterior.set(chave, resto - usado)
    if (usado < 0.005) return `Quitou ${nomeMes}`
    if (valor - usado < 0.005) return 'Quitou saldo anterior'
    return `${formatCurrency(usado)} do saldo anterior + ${formatCurrency(valor - usado)} de ${nomeMes}`
  }
  const retiradasPagas = p.retiradas.filter(c => c.status === 'pago')
    .sort((a, b) => (a.dataPagamento ?? a.dataVencimento).localeCompare(b.dataPagamento ?? b.dataVencimento))
  for (const c of retiradasPagas) {
    const socio = c.fornecedor ? p.nomeCanonicoSocio(c.fornecedor) : '—'
    pagamentos.push({
      data: c.dataPagamento ?? c.dataVencimento, espaco: c.espaco, socio, valor: c.valor,
      referente: c.repasseId ? 'Já contado no repasse ligado a ela' : '',
      detalhe: c.descricao, tipo: 'Retirada', conta: !c.repasseId,
    })
  }
  for (const r of [...p.repasses].sort((a, b) => a.data.localeCompare(b.data))) {
    pagamentos.push({ data: r.data, espaco: r.espaco, socio: r.socioNome, valor: r.valor, referente: '', detalhe: r.observacoes ?? '—', tipo: 'Repasse', conta: true })
  }
  // Classifica em ordem de data (não "retiradas antes de repasses"): o total
  // que quitou saldo anterior é o mesmo do cálculo, só a leitura fica na
  // ordem em que o dinheiro saiu.
  pagamentos.sort((a, b) => a.data.localeCompare(b.data))
  for (const pg of pagamentos) if (pg.conta) pg.referente = classificar(`${pg.espaco}|${pg.socio}`, pg.valor)

  return (
    <div className="text-gray-900 text-[11px] leading-snug space-y-6">
      <header className="border-b-2 border-gray-900 pb-3">
        <p className="text-[10px] uppercase tracking-wide text-gray-500">Espaços &amp; Locações</p>
        <h1 className="text-xl font-bold">{p.espacosLabel} — Fechamento de {tituloPeriodo(p.dataInicio, p.dataFim)}</h1>
        <p className="text-[10px] text-gray-500">Gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </header>

      <section className="break-inside-avoid">
        <h2 className="text-sm font-bold mb-2">1. Resultado do mês</h2>
        <table className="w-full max-w-sm">
          <tbody>
            <tr><td className="py-0.5">Receitas recebidas</td><td className="py-0.5 text-right">{formatCurrency(p.totalReceitas)}</td></tr>
            <tr><td className="py-0.5">(−) Despesas pagas</td><td className="py-0.5 text-right">{formatCurrency(p.totalDespesas)}</td></tr>
            <tr className="border-t border-gray-900 font-bold text-[13px]"><td className="py-1">= Lucro do mês</td><td className="py-1 text-right">{formatCurrency(p.resultado)}</td></tr>
          </tbody>
        </table>
      </section>

      {p.socios.length > 0 && (
        <section>
          <h2 className="text-sm font-bold mb-2">2. Quanto cada sócio tem a receber</h2>
          {/* Resumo primeiro (a pergunta do sócio: quanto eu recebo?), depois
              o extrato de cada um com TODOS os valores — parte do mês, saldo
              anterior, cada pagamento com data e descrição e o que falta. O
              PDF antigo separava "deste mês"/"de antes" em colunas soltas e
              notas de rodapé, e ninguém conseguia refazer a conta. */}
          <table className="w-full border-collapse break-inside-avoid">
            <thead>
              <tr className="border-b border-gray-900 text-left">
                <th className="py-1 pr-2">Sócio</th>
                <th className="py-1 pr-2 text-right">A receber de {nomeMes}</th>
                <th className="py-1 pr-2 text-right">A receber de meses anteriores</th>
                <th className="py-1 text-right">Total a receber</th>
              </tr>
            </thead>
            <tbody>
              {p.socios.map(s => (
                <tr key={`r-${s.espaco}-${s.socio}`} className="border-b border-gray-200">
                  <td className="py-1 pr-2 font-medium">{s.socio}{variosEspacos ? ` (${s.espaco})` : ''}</td>
                  <td className="py-1 pr-2 text-right">{dinheiro(s.valorDevido - s.retirado - s.jaRepassado)}</td>
                  <td className="py-1 pr-2 text-right">{dinheiro(s.pendenteHerdado - s.quitadoAnterior)}</td>
                  <td className="py-1 text-right font-bold text-[12px]">{dinheiro(s.valorPendente)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-1" colSpan={3}>Total a pagar aos sócios</td>
                <td className="py-1 text-right text-[12px]">{dinheiro(p.socios.reduce((t, s) => t + Math.max(0, s.valorPendente), 0))}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 mb-3 text-[10px] text-gray-500">Valor negativo = o sócio recebeu a mais e a diferença é descontada no próximo mês. A conta de cada um está logo abaixo.</p>

          <div className="space-y-3">
            {p.socios.map(s => {
              const meus = pagamentos.filter(pg => pg.socio === s.socio && pg.espaco === s.espaco)
              const contados = meus.filter(pg => pg.conta)
              const pagoNoMes = s.quitadoAnterior + s.retirado + s.jaRepassado
              const somaLista = contados.reduce((t, pg) => t + pg.valor, 0)
              const totalDevido = s.pendenteHerdado + s.valorDevido
              return (
                <div key={`x-${s.espaco}-${s.socio}`} className="rounded border border-gray-400 p-2 break-inside-avoid">
                  <p className="font-bold text-[12px] mb-1">{s.socio} — {s.percentual}%{variosEspacos ? ` · ${s.espaco}` : ''}</p>
                  <table className="w-full">
                    <tbody>
                      <tr><td className="py-0.5">Saldo que ficou a receber dos meses anteriores</td><td className="py-0.5 text-right">{dinheiro(s.pendenteHerdado)}</td></tr>
                      <tr><td className="py-0.5">(+) {s.percentual}% do lucro de {nomeMes} ({formatCurrency(s.lucro)}){Math.abs(s.ajusteReservaObra ?? 0) > 0.005 ? ` + ajuste da reserva de obra (${formatCurrency(s.ajusteReservaObra ?? 0)})` : ''}</td><td className="py-0.5 text-right">{dinheiro(s.valorDevido)}</td></tr>
                      <tr className="border-t border-gray-400 font-semibold"><td className="py-0.5">= Total que {s.socio} tinha a receber</td><td className="py-0.5 text-right">{dinheiro(totalDevido)}</td></tr>
                    </tbody>
                  </table>
                  <p className="mt-1.5 font-semibold">(−) Pagamentos a {s.socio} em {nomeMes}:</p>
                  {meus.length === 0 ? (
                    <p className="text-gray-500 pl-2">Nenhum pagamento no mês.</p>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-300 text-left text-[10px] text-gray-600">
                          <th className="py-0.5 pr-2">Data</th><th className="py-0.5 pr-2">Tipo</th><th className="py-0.5 pr-2">Descrição</th><th className="py-0.5 pr-2">Usado para</th><th className="py-0.5 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meus.map((pg, i) => (
                          <tr key={i} className={`border-b border-gray-100 ${pg.conta ? '' : 'text-gray-400'}`}>
                            <td className="py-0.5 pr-2 whitespace-nowrap">{ddmm(pg.data)}</td>
                            <td className="py-0.5 pr-2">{pg.tipo}</td>
                            <td className="py-0.5 pr-2">{pg.detalhe}</td>
                            <td className="py-0.5 pr-2">{pg.referente}</td>
                            <td className="py-0.5 text-right whitespace-nowrap">{pg.conta ? formatCurrency(pg.valor) : `(${formatCurrency(pg.valor)})`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <table className="w-full mt-1">
                    <tbody>
                      <tr><td className="py-0.5">Total pago em {nomeMes}</td><td className="py-0.5 text-right">{dinheiro(pagoNoMes)}</td></tr>
                      <tr className="border-t-2 border-gray-900 font-bold text-[12px]">
                        <td className="py-1">= {s.valorPendente < -0.005 ? `${s.socio} recebeu a mais (desconta no próximo mês)` : `Falta pagar a ${s.socio}`}</td>
                        <td className="py-1 text-right">{dinheiro(Math.abs(s.valorPendente))}</td>
                      </tr>
                    </tbody>
                  </table>
                  {Math.abs(somaLista - pagoNoMes) > 0.01 && (
                    <p className="text-[10px] text-red-700">Atenção: os pagamentos listados somam {formatCurrency(somaLista)}, diferente do total pago considerado no cálculo — confira os lançamentos deste sócio.</p>
                  )}
                  {meus.some(pg => !pg.conta) && (
                    <p className="text-[10px] text-gray-500">Valores entre parênteses são retiradas ligadas a um repasse: o dinheiro já está contado no repasse e não é somado de novo.</p>
                  )}
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-[10px] text-gray-500">
            Os pagamentos quitam primeiro o que o sócio tinha a receber dos meses anteriores, em ordem de data; o que sobra quita a parte de {nomeMes}. É isso que separa as duas colunas do resumo.
          </p>
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold mb-2">3. Receitas do mês</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-900 text-left">
              <th className="py-1 pr-2">Data</th><th className="py-1 pr-2">Cliente</th><th className="py-1 pr-2">Referente a</th><th className="py-1 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {recebidas.map(r => (
              <tr key={r.id} className="border-b border-gray-200 break-inside-avoid">
                <td className="py-0.5 pr-2 whitespace-nowrap">{ddmm(r.data)}</td>
                <td className="py-0.5 pr-2">{r.cliente ?? '—'}</td>
                <td className="py-0.5 pr-2">{descricaoCurta(r)}</td>
                <td className="py-0.5 text-right whitespace-nowrap">{formatCurrency(r.valor)}</td>
              </tr>
            ))}
            <tr className="font-bold"><td className="py-1" colSpan={3}>Total recebido</td><td className="py-1 text-right">{formatCurrency(p.totalReceitas)}</td></tr>
          </tbody>
        </table>
        {aReceber.length > 0 && (
          <div className="mt-2 break-inside-avoid">
            <p className="font-semibold">Ainda a receber de clientes (não entra no lucro do mês):</p>
            <ul className="list-disc pl-5">
              {aReceber.map(r => <li key={r.id}>{r.cliente ?? r.descricao} — {formatCurrency(r.valor)} ({descricaoCurta(r)})</li>)}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-bold mb-2">4. Despesas do mês por tipo</h2>
        <table className="w-full max-w-sm mb-3 break-inside-avoid">
          <tbody>
            {gruposOrdenados.map(g => (
              <tr key={g.tipo}><td className="py-0.5">{g.tipo}</td><td className="py-0.5 text-right">{formatCurrency(g.total)}</td></tr>
            ))}
            <tr className="border-t border-gray-900 font-bold"><td className="py-1">Total pago</td><td className="py-1 text-right">{formatCurrency(p.totalDespesas)}</td></tr>
          </tbody>
        </table>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-900 text-left">
              <th className="py-1 pr-2">Data</th><th className="py-1 pr-2">Descrição</th><th className="py-1 pr-2">Pago a</th><th className="py-1 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {gruposOrdenados.map(g => [
              <tr key={`h-${g.tipo}`} className="bg-gray-100 font-semibold break-inside-avoid">
                <td className="py-1 px-1" colSpan={3}>{g.tipo}</td><td className="py-1 px-1 text-right">{formatCurrency(g.total)}</td>
              </tr>,
              ...g.itens.map(c => (
                <tr key={c.id} className="border-b border-gray-200 break-inside-avoid">
                  <td className="py-0.5 pr-2 whitespace-nowrap">{ddmm(c.dataPagamento ?? c.dataVencimento)}</td>
                  <td className="py-0.5 pr-2">{c.descricao}</td>
                  <td className="py-0.5 pr-2">{c.fornecedor ?? '—'}</td>
                  <td className="py-0.5 text-right whitespace-nowrap">{formatCurrency(c.valor)}</td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </section>

    </div>
  )
}
