'use client'

// Cadastros que alimentam o orçamento: tipos de evento, comidas, bebidas,
// extras e as tabelas de pacotes (faixa de convidados × opção, ex.: cerveja).
// Opções: qualquer perfil com acesso ao Buffet cadastra. Tabelas de preço:
// só admin/financeiro alteram — operador vê, mas não muda preço de tabela.
// Opção nunca é apagada (pode estar em orçamentos antigos): só desativada.

import { useState } from 'react'
import { Plus, Check, Pencil, X } from 'lucide-react'
import { formatCurrency, mensagemDeErro, parseCurrencyBR } from '@/lib/utils'
import {
  GRUPO_LABEL, excluirFaixa, opcoesDaTabela, salvarFaixa, salvarOpcao, salvarTabela,
  type BuffetOpcao, type BuffetTabela, type GrupoOpcao,
} from '@/lib/buffet'

const inputCls = 'w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none'
const GRUPOS: GrupoOpcao[] = ['tipo_evento', 'comida', 'bebida', 'extra']

export default function CadastrosBuffet({ opcoes, tabelas, podeEditarPrecos, onMudou }: {
  opcoes: BuffetOpcao[]
  tabelas: BuffetTabela[]
  podeEditarPrecos: boolean
  onMudou: () => Promise<void>
}) {
  const [erro, setErro] = useState<string | null>(null)
  async function tentar(fn: () => Promise<unknown>) {
    setErro(null)
    try { await fn(); await onMudou() } catch (e) { setErro(mensagemDeErro(e, 'Não foi possível salvar.')) }
  }

  return (
    <div className="space-y-6">
      {erro && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{erro}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-app-text">Opções do orçamento</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {GRUPOS.map(g => <GrupoCard key={g} grupo={g} itens={opcoes.filter(o => o.grupo === g)} tentar={tentar} />)}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-app-text">Tabelas de pacotes (preço sugerido)</h2>
          {podeEditarPrecos && (
            <button onClick={() => tentar(() => salvarTabela({ nome: 'Nova tabela', ativo: true }))}
              className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-text hover:bg-app-surface2">
              <Plus className="h-3.5 w-3.5" /> Nova tabela
            </button>
          )}
        </div>
        {!podeEditarPrecos && <p className="text-xs text-app-subtle">Só administrador e financeiro alteram preços de tabela.</p>}
        {tabelas.map(t => <TabelaCard key={t.id} tabela={t} pode={podeEditarPrecos} tentar={tentar} />)}
      </section>
    </div>
  )
}

function GrupoCard({ grupo, itens, tentar }: { grupo: GrupoOpcao; itens: BuffetOpcao[]; tentar: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [novo, setNovo] = useState('')
  const [novoDesc, setNovoDesc] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [nomeEd, setNomeEd] = useState('')
  const [descEd, setDescEd] = useState('')

  return (
    <div className="rounded-xl border border-app-border2/60 bg-app-surface p-4 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-app-subtle">{GRUPO_LABEL[grupo]}</h3>
      <ul className="divide-y divide-app-border/50">
        {itens.map(o => (
          <li key={o.id} className="py-1.5">
            {editando === o.id ? (
              <div className="space-y-1.5">
                <input className={inputCls} value={nomeEd} onChange={e => setNomeEd(e.target.value)} />
                <input className={inputCls} placeholder="Descrição (opcional)" value={descEd} onChange={e => setDescEd(e.target.value)} />
                <div className="flex gap-1.5">
                  <button onClick={() => nomeEd.trim() && tentar(() => salvarOpcao({ ...o, nome: nomeEd, descricao: descEd })).then(() => setEditando(null))}
                    className="flex items-center gap-1 rounded-md bg-[#25D366] px-2 py-1 text-xs font-medium text-white"><Check className="h-3 w-3" /> Salvar</button>
                  <button onClick={() => setEditando(null)} className="flex items-center gap-1 rounded-md border border-app-border2 px-2 py-1 text-xs text-app-muted"><X className="h-3 w-3" /> Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div className={`flex-1 min-w-0 ${o.ativo ? '' : 'opacity-50'}`}>
                  <p className="text-sm text-app-text">{o.nome}{!o.ativo && <span className="ml-1 text-[10px] text-app-subtle">(desativada)</span>}</p>
                  {o.descricao && <p className="text-xs text-app-subtle">{o.descricao}</p>}
                </div>
                <button onClick={() => { setEditando(o.id); setNomeEd(o.nome); setDescEd(o.descricao ?? '') }} title="Editar"
                  className="rounded-md p-1 text-app-subtle hover:bg-app-surface2"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => tentar(() => salvarOpcao({ ...o, ativo: !o.ativo }))}
                  className="rounded-md border border-app-border2 px-2 py-0.5 text-[11px] text-app-muted hover:bg-app-surface2">{o.ativo ? 'Desativar' : 'Ativar'}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5 pt-1">
        <div className="flex-1 space-y-1">
          <input className={inputCls} placeholder={`Adicionar em ${GRUPO_LABEL[grupo].toLowerCase()}…`} value={novo} onChange={e => setNovo(e.target.value)} />
          {novo && <input className={inputCls} placeholder="Descrição (opcional)" value={novoDesc} onChange={e => setNovoDesc(e.target.value)} />}
        </div>
        <button disabled={!novo.trim()} onClick={() => tentar(() => salvarOpcao({ grupo, nome: novo, descricao: novoDesc, ordem: itens.length + 1 })).then(() => { setNovo(''); setNovoDesc('') })}
          className="self-start rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

function TabelaCard({ tabela, pode, tentar }: { tabela: BuffetTabela; pode: boolean; tentar: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [dados, setDados] = useState({ nome: tabela.nome, descricao: tabela.descricao ?? '', inclusos: tabela.inclusos ?? '', observacao: tabela.observacao ?? '' })
  const [novaFaixa, setNovaFaixa] = useState('')
  const [novaOpcao, setNovaOpcao] = useState('')
  const opcoes = opcoesDaTabela(tabela)
  const limites = [...new Set(tabela.faixas.map(f => f.ateConvidados))].sort((a, b) => a - b)
  const celula = (ate: number, op: string) => tabela.faixas.find(f => f.ateConvidados === ate && f.opcao === op)
  const mudouDados = dados.nome !== tabela.nome || dados.descricao !== (tabela.descricao ?? '') || dados.inclusos !== (tabela.inclusos ?? '') || dados.observacao !== (tabela.observacao ?? '')

  function salvarCelula(ate: number, op: string, texto: string) {
    const atual = celula(ate, op)
    if (!texto.trim()) {
      if (atual) return tentar(() => excluirFaixa(atual.id))
      return
    }
    const valor = parseCurrencyBR(texto)
    if (atual && Math.abs(atual.valor - valor) < 0.005) return
    return tentar(() => salvarFaixa({ id: atual?.id, tabelaId: tabela.id, ateConvidados: ate, opcao: op, valor }))
  }

  return (
    <div className={`rounded-xl border border-app-border2/60 bg-app-surface p-4 space-y-3 ${tabela.ativo ? '' : 'opacity-60'}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={`${inputCls} font-semibold`} disabled={!pode} value={dados.nome} onChange={e => setDados(d => ({ ...d, nome: e.target.value }))} />
        <input className={inputCls} disabled={!pode} placeholder="Descrição" value={dados.descricao} onChange={e => setDados(d => ({ ...d, descricao: e.target.value }))} />
        <textarea rows={4} className={`${inputCls} resize-none`} disabled={!pode} placeholder="O que está incluso (um item por linha)" value={dados.inclusos} onChange={e => setDados(d => ({ ...d, inclusos: e.target.value }))} />
        <textarea rows={4} className={`${inputCls} resize-none`} disabled={!pode} placeholder="Observação que sai no rodapé da proposta" value={dados.observacao} onChange={e => setDados(d => ({ ...d, observacao: e.target.value }))} />
      </div>
      {pode && (
        <div className="flex gap-2">
          {mudouDados && (
            <button onClick={() => tentar(() => salvarTabela({ id: tabela.id, ...dados, ativo: tabela.ativo }))}
              className="flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white"><Check className="h-3.5 w-3.5" /> Salvar dados da tabela</button>
          )}
          <button onClick={() => tentar(() => salvarTabela({ id: tabela.id, nome: tabela.nome, descricao: tabela.descricao, inclusos: tabela.inclusos, observacao: tabela.observacao, ativo: !tabela.ativo }))}
            className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2">{tabela.ativo ? 'Desativar tabela' : 'Ativar tabela'}</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-app-border2/60">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-app-border bg-app-surface2">
              <th className="px-2 py-2 text-left font-medium text-app-subtle">Convidados</th>
              {opcoes.map(op => <th key={op} className="px-2 py-2 text-left font-medium text-app-subtle">{op}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border/50">
            {limites.map(ate => (
              <tr key={ate}>
                <td className="px-2 py-1.5 text-app-text whitespace-nowrap">Até {ate.toLocaleString('pt-BR')}</td>
                {opcoes.map(op => {
                  const c = celula(ate, op)
                  return (
                    <td key={op} className="px-2 py-1">
                      {pode ? (
                        <input key={`${c?.id}-${c?.valor}`} defaultValue={c ? formatCurrency(c.valor).replace(/^R\$\s*/, '') : ''} inputMode="decimal"
                          onBlur={e => salvarCelula(ate, op, e.target.value)}
                          className="w-28 rounded-md border border-app-border2 bg-app-surface2 px-2 py-1 text-xs text-app-text focus:outline-none" />
                      ) : <span className="text-app-text">{c ? formatCurrency(c.valor) : '—'}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pode && (
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex gap-1.5 items-center">
            <input className="w-32 rounded-md border border-app-border2 bg-app-surface2 px-2 py-1" inputMode="numeric" placeholder="Nova faixa: até…" value={novaFaixa} onChange={e => setNovaFaixa(e.target.value.replace(/\D/g, ''))} />
            <button disabled={!novaFaixa} onClick={() => tentar(() => salvarFaixa({ tabelaId: tabela.id, ateConvidados: Number(novaFaixa), opcao: opcoes[0] ?? 'Padrão', valor: 0 })).then(() => setNovaFaixa(''))}
              className="rounded-md border border-app-border2 px-2 py-1 font-medium hover:bg-app-surface2 disabled:opacity-40">+ Faixa</button>
          </div>
          <div className="flex gap-1.5 items-center">
            <input className="w-36 rounded-md border border-app-border2 bg-app-surface2 px-2 py-1" placeholder="Nova opção (ex.: Brahma)" value={novaOpcao} onChange={e => setNovaOpcao(e.target.value)} />
            <button disabled={!novaOpcao.trim()} onClick={() => tentar(() => salvarFaixa({ tabelaId: tabela.id, ateConvidados: limites[0] ?? 100, opcao: novaOpcao, valor: 0 })).then(() => setNovaOpcao(''))}
              className="rounded-md border border-app-border2 px-2 py-1 font-medium hover:bg-app-surface2 disabled:opacity-40">+ Opção</button>
          </div>
          <p className="w-full text-app-subtle">Edite os valores direto na grade; salva ao sair do campo. Deixar uma célula vazia remove aquele preço.</p>
        </div>
      )}
    </div>
  )
}
