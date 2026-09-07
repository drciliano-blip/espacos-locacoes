'use client'

import { X, Lock } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Fechamento, FechamentoSecaoDetalhe } from '@/contexts/FechamentosContext'

interface Props {
  fechamento: Fechamento
  onClose: () => void
}

function Secao({ titulo, secao, colunaPessoa }: { titulo: string; secao: FechamentoSecaoDetalhe; colunaPessoa: string }) {
  if (secao.lista.length === 0 && secao.total === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">{titulo}</h4>
        <span className="text-sm font-semibold text-app-text">{formatCurrency(secao.total)}</span>
      </div>
      {secao.lista.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-app-border2/60">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-app-border bg-app-surface2">
                <th className="px-2 py-1.5 text-left font-medium text-app-subtle">Data</th>
                <th className="px-2 py-1.5 text-left font-medium text-app-subtle">{colunaPessoa}</th>
                <th className="px-2 py-1.5 text-left font-medium text-app-subtle">Descrição</th>
                <th className="px-2 py-1.5 text-right font-medium text-app-subtle">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/50">
              {secao.lista.map((item, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5 text-app-text2 whitespace-nowrap">{formatDate(item.data)}</td>
                  <td className="px-2 py-1.5 text-app-text2">{item.pessoa}</td>
                  <td className="px-2 py-1.5 text-app-text2">{item.descricao}</td>
                  <td className="px-2 py-1.5 text-right text-app-text2 whitespace-nowrap">{formatCurrency(item.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function FechamentoHistoricoModal({ fechamento: f, onClose }: Props) {
  const semDetalhe = f.detalhes.receitaOperacional.lista.length === 0 && f.detalhes.receitaOperacional.total === 0
    && f.detalhes.despesaOperacional.lista.length === 0 && f.detalhes.despesaOperacional.total === 0
    && f.detalhes.aportes.lista.length === 0 && f.detalhes.aportes.total === 0
    && f.detalhes.despesasObra.lista.length === 0 && f.detalhes.despesasObra.total === 0
    && f.detalhes.retiradas.lista.length === 0 && f.detalhes.retiradas.total === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-app-surface flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <Lock className="h-4 w-4 text-app-subtle" />
            Fechamento — {f.espaco}
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-app-subtle">
            <span>{formatDate(f.dataInicio)} a {formatDate(f.dataFim)}</span>
            <span>Fechado em {formatDate(f.fechadoEm.split('T')[0])}</span>
            <span>Por {f.fechadoPorNome ?? '—'}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-app-border2 bg-app-surface2/50 p-3">
              <p className="text-xs text-app-subtle">Resultado Operacional</p>
              <p className="text-sm font-semibold text-app-text mt-0.5">{formatCurrency(f.resultadoOperacional)}</p>
            </div>
            <div className="rounded-lg border border-app-border2 bg-app-surface2/50 p-3">
              <p className="text-xs text-app-subtle">Resultado Acumulado</p>
              <p className="text-sm font-semibold text-app-text mt-0.5">{formatCurrency(f.resultadoAcumulado)}</p>
            </div>
            <div className="rounded-lg border border-app-border2 bg-app-surface2/50 p-3">
              <p className="text-xs text-app-subtle">(−) Fundo/Reservas</p>
              <p className="text-sm font-semibold text-amber-600 mt-0.5">{formatCurrency(f.fundoReservaDeduzido)}</p>
            </div>
            <div className="rounded-lg border border-app-border2 bg-app-surface2/50 p-3">
              <p className="text-xs text-app-subtle">(−) Já Retirado</p>
              <p className="text-sm font-semibold text-fuchsia-600 mt-0.5">{formatCurrency(f.retiradaDeduzida)}</p>
            </div>
            <div className="rounded-lg border border-app-border2 bg-app-surface2/50 p-3">
              <p className="text-xs text-app-subtle">Disponível do Espaço</p>
              <p className="text-sm font-semibold text-app-text mt-0.5">{formatCurrency(f.disponivelDoEspaco)}</p>
            </div>
            <div className="rounded-lg border border-[#25D366]/25 bg-[#25D366]/5 p-3">
              <p className="text-xs text-app-subtle">Disponível p/ Distribuição</p>
              <p className="text-sm font-bold text-[#128C7E] mt-0.5">{formatCurrency(f.disponivelParaDistribuicao)}</p>
            </div>
          </div>

          <Secao titulo="Receita Operacional" secao={f.detalhes.receitaOperacional} colunaPessoa="Cliente" />
          <Secao titulo="Despesas Operacionais" secao={f.detalhes.despesaOperacional} colunaPessoa="Fornecedor" />
          <Secao titulo="Aportes" secao={f.detalhes.aportes} colunaPessoa="Sócio" />
          <Secao titulo="Despesas de Obra" secao={f.detalhes.despesasObra} colunaPessoa="Fornecedor" />
          <Secao titulo="Retiradas Realizadas" secao={f.detalhes.retiradas} colunaPessoa="Sócio" />

          {semDetalhe && (
            <p className="text-xs text-app-subtle italic">
              Este fechamento foi feito antes do detalhe linha-a-linha existir — só os totais acima ficaram registrados.
            </p>
          )}

          {f.repasseSocios.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Repasse aos Sócios / Pendente por Sócio</h4>
              <div className="overflow-x-auto rounded-lg border border-app-border2/60">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-app-border bg-app-surface2">
                      <th className="px-2 py-1.5 text-left font-medium text-app-subtle">Sócio</th>
                      <th className="px-2 py-1.5 text-right font-medium text-app-subtle">%</th>
                      <th className="px-2 py-1.5 text-right font-medium text-app-subtle">Valor Devido</th>
                      <th className="px-2 py-1.5 text-right font-medium text-app-subtle">Retirado</th>
                      <th className="px-2 py-1.5 text-right font-medium text-app-subtle">Já Repassado</th>
                      <th className="px-2 py-1.5 text-right font-medium text-app-subtle">Pendente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/50">
                    {f.repasseSocios.map(r => (
                      <tr key={r.socio}>
                        <td className="px-2 py-1.5 text-app-text2">{r.socio}</td>
                        <td className="px-2 py-1.5 text-right text-app-text2">{r.percentual}%</td>
                        <td className="px-2 py-1.5 text-right text-app-text2">{formatCurrency(r.valorDevido)}</td>
                        <td className="px-2 py-1.5 text-right text-fuchsia-600">{formatCurrency(r.retirado)}</td>
                        <td className="px-2 py-1.5 text-right text-app-text2">{formatCurrency(r.jaRepassado)}</td>
                        <td className={`px-2 py-1.5 text-right font-semibold ${r.valorPendente > 0.01 ? 'text-amber-500' : 'text-[#128C7E]'}`}>{formatCurrency(r.valorPendente)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">Fechar</button>
        </div>
      </div>
    </div>
  )
}
