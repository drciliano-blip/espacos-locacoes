'use client'

// PDF da proposta enviada ao cliente — mesmo visual dos modelos que a equipe
// já usa (azul-marinho + dourado, marca "Espaços e Locações"), com "BUFFET"
// embaixo do logo para segmentar a linha de negócio. Só aparece na impressão.
// Usa div em vez de <table>: o CSS global de impressão força borda e texto
// escuro em toda célula de tabela, o que apagaria o texto sobre o azul.

import { formatCurrency } from '@/lib/utils'
import type { BuffetOrcamento, BuffetTabela } from '@/lib/buffet'

const NAVY = '#0B2A45'
const GOLD = '#B58A3A'
const BEGE = '#F5F0E8'

const br = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '—')

function horas(h?: number) {
  if (!h) return undefined
  return `${String(h).replace('.', ',')} hora${h === 1 ? '' : 's'}`
}

export default function PropostaBuffet({ o, tabela }: { o: BuffetOrcamento; tabela?: BuffetTabela }) {
  const detalhes: [string, string | undefined][] = [
    ['Data', o.dataEvento ? br(o.dataEvento) : undefined],
    ['Início', o.horarioInicio],
    ['Duração', horas(o.duracaoHoras)],
    ['Convidados', o.convidados ? `Até ${o.convidados.toLocaleString('pt-BR')}` : undefined],
    ['Local', o.local],
  ]
  const colunas: [string, string[]][] = [
    ['Alimentação', o.comidas],
    [o.duracaoHoras ? `Bebidas à vontade por ${horas(o.duracaoHoras)}` : 'Bebidas à vontade', o.bebidas],
    ['Serviços e extras', o.extras],
  ]
  const observacaoFixa = tabela?.observacao ?? 'Locação do espaço não inclusa.'

  return (
    <div style={{ background: BEGE, color: NAVY, fontFamily: 'Helvetica, Arial, sans-serif' }} className="text-[12px] leading-snug">
      {/* Cabeçalho */}
      <div className="flex">
        <div className="flex-1 px-8 pt-8 pb-6">
          <p className="text-[22px] font-extrabold leading-[1.05] tracking-wide">ESPAÇOS<br />E LOCAÇÕES</p>
          <p className="mt-1 text-[13px] font-bold tracking-[0.45em]" style={{ color: GOLD }}>BUFFET</p>
          <div className="mt-3 mb-4 h-[2px] w-12" style={{ background: GOLD }} />
          <p className="text-[9px] tracking-[0.35em]">PROPOSTA Nº {o.numero}</p>
          <p className="mt-2 text-[26px] font-extrabold leading-tight uppercase">{o.tipoEvento || 'Seu evento'}</p>
          <p className="mt-2 text-[12px] uppercase">Para {o.clienteNome}</p>
        </div>
        <div className="w-[38%] px-7 py-8 text-white" style={{ background: NAVY }}>
          {detalhes.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="mb-2.5">
              <p className="text-[8px] tracking-[0.3em] opacity-70">{k.toUpperCase()}</p>
              <p className="text-[13px] font-bold">{v}</p>
            </div>
          ))}
          <div className="mt-3 h-[2px] w-12" style={{ background: GOLD }} />
        </div>
      </div>

      {/* O que está incluso */}
      <div className="px-8 py-6 text-white" style={{ background: NAVY }}>
        <p className="text-[14px] font-extrabold tracking-wide mb-3">O QUE ESTÁ INCLUSO</p>
        <div className="grid grid-cols-3 gap-5">
          {colunas.map(([titulo, itens]) => (
            <div key={titulo} className="border-l pl-3" style={{ borderColor: GOLD }}>
              <p className="text-[10px] font-bold tracking-[0.15em] mb-1.5 uppercase">{titulo}</p>
              {itens.length === 0
                ? <p className="opacity-60">—</p>
                : itens.map(i => <p key={i} className="mb-0.5">• {i}</p>)}
            </div>
          ))}
        </div>
      </div>

      {/* Investimento e condições */}
      <div className="flex gap-6 px-8 py-6">
        <div className="flex-1 space-y-3">
          {o.restricoes && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em]">RESTRIÇÕES ALIMENTARES</p>
              <p className="whitespace-pre-line">{o.restricoes}</p>
            </div>
          )}
          {o.condicoesPagamento && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em]">CONDIÇÕES DE PAGAMENTO</p>
              <p className="whitespace-pre-line">{o.condicoesPagamento}</p>
            </div>
          )}
          {o.observacoes && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em]">OBSERVAÇÕES</p>
              <p className="whitespace-pre-line">{o.observacoes}</p>
            </div>
          )}
          {o.validade && <p className="text-[10px]">Proposta válida até {br(o.validade)}.</p>}
        </div>
        <div className="w-[38%] self-start px-6 py-5 text-white" style={{ background: NAVY }}>
          <p className="text-[9px] tracking-[0.3em] opacity-80">INVESTIMENTO</p>
          <p className="mt-1 text-[24px] font-extrabold">{o.valorFinal !== undefined ? formatCurrency(o.valorFinal) : 'A definir'}</p>
          {o.convidados && <p className="mt-1 text-[10px] opacity-80">Pacote para até {o.convidados.toLocaleString('pt-BR')} convidados</p>}
          <div className="mt-3 h-[2px] w-12" style={{ background: GOLD }} />
        </div>
      </div>

      {/* Rodapé */}
      <div className="flex items-end justify-between border-t px-8 py-5" style={{ borderColor: GOLD }}>
        <div>
          <p className="text-[13px] font-extrabold leading-[1.05]">ESPAÇOS<br />E LOCAÇÕES</p>
          <p className="mt-0.5 text-[9px] font-bold tracking-[0.45em]" style={{ color: GOLD }}>BUFFET</p>
        </div>
        <p className="max-w-[60%] text-right text-[9px]">{observacaoFixa}</p>
      </div>
    </div>
  )
}
