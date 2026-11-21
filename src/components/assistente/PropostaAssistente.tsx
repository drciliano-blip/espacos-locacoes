'use client'

// Os dois PDFs que o Assistente de IA prepara para o cliente, no visual da
// proposta "Experiência Churrasco" (creme, azul-marinho e dourado, formato
// alto para ler no celular). Locação e serviços vão em documentos separados;
// o staff da casa e o rider técnico ficam no de locação, como "incluso".
// Só divs: o CSS global de impressão força borda e texto escuro em tabelas.

import { formatCurrency } from '@/lib/utils'
import type { TabelaEspaco } from '@/lib/assistente/tabelas-espacos'
import { br, dataLocal, type DadosEvento, type LinhaOrcamento, type Parcela } from '@/lib/assistente/orcamento'

const NAVY = '#092B40'
const GOLD = '#9A7937'
const CREME = '#F7F3EC'
const ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const diaAbrev = (iso: string) => { const d = dataLocal(iso); return d ? ABREV[d.getDay()] : '' }

interface Props {
  tipo: 'locacao' | 'servicos'
  numero: string
  versao: number
  dados: DadosEvento
  espaco: TabelaEspaco
  linhas: LinhaOrcamento[]
  opcionais: LinhaOrcamento[]
  parcelas: Parcela[]
  condicoesServicos?: string
  fastix?: 'parceria' | 'opcional' | null
}

function Titulo({ t, sub }: { t: string; sub: string }) {
  return (
    <div className="mt-5 mb-2">
      <p className="text-[13px] font-bold uppercase tracking-wide">{t}</p>
      <p className="text-[8px] font-bold tracking-[0.2em]" style={{ color: GOLD }}>{sub}</p>
    </div>
  )
}

function Linha({ l, prestador }: { l: LinhaOrcamento; prestador?: boolean }) {
  return (
    <div className="flex gap-2 bg-white px-2.5 py-1.5 text-[10px]" style={{ borderBottom: '1px solid #e2dacb' }}>
      <div className="flex-1">
        <p>{l.descricao}</p>
        {l.detalhe && <p className="mt-0.5 text-[8.5px]" style={{ color: '#5b6b78' }}>{l.detalhe}</p>}
      </div>
      {prestador && <div className="w-[105px]">{l.prestador || 'E&L'}</div>}
      <div className="w-[85px] text-right whitespace-nowrap">{formatCurrency(l.valor)}</div>
    </div>
  )
}

function Caixa({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div className="bg-white px-2.5 py-2 text-[9.5px] leading-snug" style={{ borderLeft: `3px solid ${GOLD}` }}>
      <p className="mb-1 text-[8.5px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>{titulo}</p>
      {itens.map(i => <p key={i}>• {i}</p>)}
    </div>
  )
}

export default function PropostaAssistente({ tipo, numero, versao, dados, espaco, linhas, opcionais, parcelas, condicoesServicos, fastix }: Props) {
  const locacao = tipo === 'locacao'
  const total = linhas.reduce((s, l) => s + l.valor, 0)
  const sufixo = locacao ? 'E' : 'S'
  const outro = `${numero}-${locacao ? 'S' : 'E'}`
  const caixas = [
    ...(espaco.staffDaCasa.length ? [{ titulo: 'Staff da casa', itens: espaco.staffDaCasa }] : []),
    ...(espaco.estrutura.length ? [{ titulo: 'Estrutura', itens: espaco.estrutura }] : []),
    ...espaco.rider,
  ]

  return (
    <div style={{ background: CREME, color: NAVY, fontFamily: 'Helvetica, Arial, sans-serif' }} className="px-7 pt-7 pb-6">
      <style>{'@page { size: 143mm 254mm; margin: 0 } html, body { background: ' + CREME + ' !important }'}</style>

      {/* Logo da E&L + logo do espaço (recortados das artes oficiais). */}
      <div className="flex items-stretch justify-between gap-4">
        <div className="flex flex-col justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/espacos-e-locacoes.png" alt="Espaços e Locações" className="h-[34px] w-auto self-start" />
          <div className="mt-2 text-[9.5px] font-bold tracking-[0.12em] leading-relaxed">
            <p>{locacao ? 'ORÇAMENTO DE LOCAÇÃO' : 'ORÇAMENTO DE SERVIÇOS'}</p>
            <p style={{ color: GOLD }}>Nº {numero}-{sufixo} · VERSÃO {versao}</p>
          </div>
        </div>
        <div className="flex w-[150px] items-center justify-center px-3 py-2.5" style={{ background: NAVY }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={espaco.logo} alt={espaco.nome} className="max-h-[62px] max-w-full object-contain" />
        </div>
      </div>
      <div className="my-3.5 h-px" style={{ background: GOLD }} />

      <p className="text-[9px] font-bold tracking-[0.3em]" style={{ color: GOLD }}>PROPOSTA PARA</p>
      <p className="mt-1 text-[24px] font-bold uppercase leading-tight">{dados.empresa || dados.cliente || 'Cliente'}</p>
      <p className="mt-1.5 text-[10.5px] uppercase tracking-[0.08em]">
        {dados.tipoEvento || 'Evento'} · {locacao ? espaco.nome : 'serviços do evento'}
      </p>

      <div className="mt-3.5 grid grid-cols-4 text-white" style={{ background: NAVY }}>
        {[
          ['Data', dados.data ? `${diaAbrev(dados.data)}, ${br(dados.data)}` : 'A definir'],
          ['Convidados', dados.convidados ? dados.convidados.toLocaleString('pt-BR') : 'A definir'],
          locacao ? ['Duração', `até ${espaco.horasInclusas} horas`] : ['Local', espaco.nome],
          ['Emitido em', new Date().toLocaleDateString('pt-BR')],
        ].map(([k, v], i) => (
          <div key={k} className="px-2 py-2 text-[8px] uppercase tracking-[0.12em]" style={{ color: '#c9d3da', borderRight: i < 3 ? '1px solid #2c4a5e' : undefined }}>
            {k}<p className="mt-0.5 text-[11px] font-bold normal-case tracking-normal text-white">{v}</p>
          </div>
        ))}
      </div>

      <Titulo t={locacao ? 'Locação do espaço' : 'Serviços contratados'} sub={locacao ? 'VALORES' : 'CADA SERVIÇO COM O SEU RESPONSÁVEL'} />
      <div className="flex px-2.5 py-1.5 text-[8.5px] font-bold uppercase tracking-[0.12em] text-white" style={{ background: NAVY }}>
        <div className="flex-1">{locacao ? 'Item' : 'Serviço'}</div>
        {!locacao && <div className="w-[105px]">Prestado por</div>}
        <div className="w-[85px] text-right">Valor</div>
      </div>
      {linhas.map((l, i) => <Linha key={i} l={l} prestador={!locacao} />)}
      <div className="flex px-2.5 py-2 text-[11.5px] font-bold text-white" style={{ background: NAVY }}>
        <div className="flex-1">{locacao ? 'Total da locação' : 'Total dos serviços'}</div>
        <div className="text-right">{formatCurrency(total)}</div>
      </div>

      {locacao && caixas.length > 0 && (
        <>
          <Titulo t="Incluso na locação" sub="STAFF DA CASA E RIDER TÉCNICO PREVISTOS NO CONTRATO" />
          <div className="grid grid-cols-2 gap-2.5">
            {caixas.map(c => <Caixa key={c.titulo} titulo={c.titulo} itens={c.itens} />)}
          </div>
        </>
      )}

      {locacao && espaco.obrigatorios.length > 0 && (
        <>
          <Titulo t="Obrigatório para o evento" sub="CONFORME CONTRATO DO ESPAÇO" />
          <Caixa titulo="Atenção" itens={espaco.obrigatorios} />
        </>
      )}

      {!locacao && opcionais.length > 0 && (
        <>
          <Titulo t="Para deixar o evento ainda melhor" sub="OPCIONAIS · NÃO SOMADOS AO TOTAL" />
          {opcionais.map((l, i) => <Linha key={i} l={l} prestador />)}
        </>
      )}

      <Titulo t="Condições" sub={locacao ? 'PAGAMENTO E RESERVA' : 'PAGAMENTO'} />
      {parcelas.map((p, i) => (
        <div key={i} className="flex bg-white px-2.5 py-1.5 text-[10px]" style={{ borderBottom: '1px solid #e2dacb' }}>
          <div className="flex-1">{p.descricao}{p.vencimento ? ` (até ${br(p.vencimento)})` : ''}</div>
          <div className="text-right">{formatCurrency(p.valor)}</div>
        </div>
      ))}
      {locacao && fastix && (
        <p className="mt-1.5 text-[9px] leading-snug">
          {fastix === 'parceria'
            ? <><b>Evento em parceria:</b> venda de ingressos obrigatória pela FASTIX, ticketeira oficial, conforme contrato. Pagamento na condição FASTIX.</>
            : <><b>Condição FASTIX:</b> para produtores que vendem os ingressos do evento pela FASTIX, ticketeira oficial.</>}
        </p>
      )}
      {!locacao && condicoesServicos && <p className="mt-1.5 text-[9px] whitespace-pre-line">{condicoesServicos}</p>}

      <p className="mt-2 text-[8.5px] leading-snug" style={{ color: '#4a5b68' }}>
        {locacao
          ? <>Pré-reserva da data válida por 72 h após o aceite. Proposta válida por 7 dias. {espaco.observacoes.join(' ')} Buffet, bebidas, decoração e demais serviços estão no <b>Orçamento de Serviços nº {outro}</b>, enviado junto.</>
          : <>Contratação e pagamento centralizados pela E&amp;L. Proposta válida por 7 dias. A locação do espaço, com staff da casa e rider técnico, está no <b>Orçamento de Locação nº {outro}</b>.{espaco.rider.length > 0 ? ` Som, luz e equipamentos do rider do ${espaco.nome} já estão inclusos na locação.` : ''}</>}
      </p>

      <div className="mt-5 flex items-end justify-between border-t pt-2 text-[8px] font-bold tracking-[0.1em]" style={{ borderColor: GOLD }}>
        <div>ESPAÇOS &amp; LOCAÇÕES<p className="font-normal tracking-normal">WhatsApp (11) 95080-0033 · espacoselocacoes@gmail.com</p></div>
      </div>
    </div>
  )
}
