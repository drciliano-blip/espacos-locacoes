'use client'

import { formatCurrency } from '@/lib/utils'
import type { Receita } from '@/contexts/ReceitasContext'
import type { ContaPagar, Evento } from '@/types'

export const statusBadgeClass: Record<string, string> = {
  pago: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  atrasado: 'bg-red-500/10 text-red-400 border-red-500/20',
  pendente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

export const SUBCATEGORIA_LABEL: Record<string, string> = {
  aluguel: 'Aluguel', energia: 'Energia', internet: 'Internet', funcionários: 'Funcionários',
  manutenção: 'Manutenção', fornecedores: 'Fornecedores', extras: 'Extras', outros: 'Outros',
}

export const CATEGORIA_CONTA_LABEL: Record<string, string> = {
  operacional: 'Operacional', obra: 'Obra', financeiro: 'Financeiro', retirada_socio: 'Retirada Sócio',
  fundo_caixa: 'Fundo de Caixa', reembolso_evento: 'Reembolso de Evento',
}

// Tabelas completas de lançamentos (receita/despesa) — usadas em todo o módulo de
// Relatórios (Relatório Mensal e Fluxo de Caixa por Espaço) para que nenhum campo
// cadastrado fique de fora da visualização, seja na tela ou nas exportações.

export function ReceitasTable({ receitas, eventosPorId }: { receitas: Receita[]; eventosPorId: Map<string, Evento> }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-app-border2">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-app-border bg-app-surface2">
            {['Descrição', 'Categoria', 'Evento', 'Cliente/Pagador', 'Vencimento', 'Recebimento', 'Valor', 'Forma Pgto.', 'Status', 'Observações'].map(h => (
              <th key={h} className="px-3 py-2 text-left text-app-subtle font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border/40">
          {receitas.map(r => {
            const evento = r.eventoId ? eventosPorId.get(r.eventoId) : undefined
            const observacoes = [r.observacoes, evento?.tipoContrato === 'parceria' && evento.condicoesParceria ? `Condições da Parceria: ${evento.condicoesParceria}` : null]
              .filter(Boolean).join(' — ')
            return (
              <tr key={r.id} className="hover:bg-app-surface2/30 transition-colors align-top">
                <td className="px-3 py-2 text-app-text max-w-[180px] truncate">{r.descricao}{r.parcelaLabel ? ` (${r.parcelaLabel})` : ''}</td>
                <td className="px-3 py-2 text-app-muted whitespace-nowrap">{r.categoriaNome}</td>
                <td className="px-3 py-2 text-app-muted whitespace-nowrap max-w-[140px] truncate">{evento?.nomeEvento || evento?.tipo || '—'}</td>
                <td className="px-3 py-2 text-app-muted whitespace-nowrap">{r.cliente ?? '—'}</td>
                <td className="px-3 py-2 text-app-muted whitespace-nowrap">{r.data.split('-').reverse().join('/')}</td>
                <td className="px-3 py-2 text-app-muted whitespace-nowrap">{r.dataRecebimento ? r.dataRecebimento.split('-').reverse().join('/') : '—'}</td>
                <td className="px-3 py-2 font-semibold text-app-text whitespace-nowrap">{formatCurrency(r.valor)}</td>
                <td className="px-3 py-2 text-app-muted whitespace-nowrap">{r.metodoPagamento ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${statusBadgeClass[r.status]}`}>{r.status}</span>
                </td>
                <td className="px-3 py-2 text-app-muted max-w-[220px] truncate">{observacoes || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function DespesasTable({ despesas }: { despesas: ContaPagar[] }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-app-border2">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-app-border bg-app-surface2">
            {['Descrição', 'Categoria', 'Subcategoria', 'Fornecedor/Beneficiário', 'Vencimento', 'Pagamento', 'Valor', 'Status', 'Observações'].map(h => (
              <th key={h} className="px-3 py-2 text-left text-app-subtle font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border/40">
          {despesas.map(c => (
            <tr key={c.id} className="hover:bg-app-surface2/30 transition-colors align-top">
              <td className="px-3 py-2 text-app-text max-w-[180px] truncate">{c.descricao}</td>
              <td className="px-3 py-2 text-app-muted whitespace-nowrap">{CATEGORIA_CONTA_LABEL[c.categoria] ?? c.categoria}</td>
              <td className="px-3 py-2 text-app-muted whitespace-nowrap">{SUBCATEGORIA_LABEL[c.subcategoria] ?? c.subcategoria}</td>
              <td className="px-3 py-2 text-app-muted whitespace-nowrap">{c.fornecedor ?? '—'}</td>
              <td className="px-3 py-2 text-app-muted whitespace-nowrap">{c.dataVencimento.split('-').reverse().join('/')}</td>
              <td className="px-3 py-2 text-app-muted whitespace-nowrap">{c.dataPagamento ? c.dataPagamento.split('-').reverse().join('/') : '—'}</td>
              <td className="px-3 py-2 font-semibold text-app-text whitespace-nowrap">{formatCurrency(c.valor)}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${statusBadgeClass[c.status]}`}>{c.status}</span>
              </td>
              <td className="px-3 py-2 text-app-muted max-w-[220px] truncate">{c.observacoes ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
