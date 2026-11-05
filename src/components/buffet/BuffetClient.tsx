'use client'

// Aba BUFFET EL — negócio separado dos espaços (quadro societário próprio).
// Nada aqui lê ou grava receitas/contas dos espaços: só as tabelas buffet_*.
// Etapa 1: orçamentos + cadastros. Contratos, recebimentos, despesas e o
// fechamento próprio do buffet vêm nas próximas etapas.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChefHat, Plus, Search, FileDown, Pencil, Copy, Send, CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import { formatCurrency, formatDate, mensagemDeErro } from '@/lib/utils'
import { useCurrentUser } from '@/contexts/UserContext'
import {
  STATUS_CLASS, STATUS_LABEL, atualizarOrcamento, carregarOpcoes, carregarOrcamentos, carregarTabelas, criarOrcamento, nomeDoUsuarioAtual,
  type BuffetOpcao, type BuffetOrcamento, type BuffetTabela, type OrcamentoInput, type StatusOrcamento,
} from '@/lib/buffet'
import OrcamentoModal from './OrcamentoModal'
import CadastrosBuffet from './CadastrosBuffet'
import PropostaBuffet from './PropostaBuffet'
import Toast from '@/components/shared/Toast'

type Aba = 'orcamentos' | 'cadastros'
const FILTROS: (StatusOrcamento | 'todos')[] = ['todos', 'rascunho', 'enviado', 'aprovado', 'perdido']

export default function BuffetClient() {
  const { role } = useCurrentUser()
  const podeEditarPrecos = role === 'admin' || role === 'financeiro'
  const [aba, setAba] = useState<Aba>('orcamentos')
  const [opcoes, setOpcoes] = useState<BuffetOpcao[]>([])
  const [tabelas, setTabelas] = useState<BuffetTabela[]>([])
  const [orcamentos, setOrcamentos] = useState<BuffetOrcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<StatusOrcamento | 'todos'>('todos')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<BuffetOrcamento | 'novo' | null>(null)
  const [duplicando, setDuplicando] = useState<BuffetOrcamento | null>(null)
  const [imprimindo, setImprimindo] = useState<BuffetOrcamento | null>(null)
  const [perdendo, setPerdendo] = useState<BuffetOrcamento | null>(null)
  const [motivo, setMotivo] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const avisar = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500) }

  const recarregarCadastros = useCallback(async () => {
    const [o, t] = await Promise.all([carregarOpcoes(), carregarTabelas()])
    setOpcoes(o)
    setTabelas(t)
  }, [])

  useEffect(() => {
    let vivo = true
    Promise.all([carregarOpcoes(), carregarTabelas(), carregarOrcamentos()])
      .then(([o, t, orc]) => { if (vivo) { setOpcoes(o); setTabelas(t); setOrcamentos(orc) } })
      .catch(e => { if (vivo) setErro(mensagemDeErro(e, 'Não foi possível carregar o Buffet.')) })
      .finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [])

  // PDF: renderiza a proposta escondida e chama a impressão do navegador.
  useEffect(() => {
    if (!imprimindo) return
    const t = setTimeout(() => window.print(), 80)
    const fim = () => setImprimindo(null)
    window.addEventListener('afterprint', fim)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fim) }
  }, [imprimindo])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return orcamentos.filter(o =>
      (filtro === 'todos' || o.status === filtro) &&
      (!q || [o.clienteNome, o.tipoEvento, o.local, String(o.numero)].some(v => v?.toLowerCase().includes(q))))
  }, [orcamentos, filtro, busca])

  const totais = useMemo(() => {
    const por = (s: StatusOrcamento) => orcamentos.filter(o => o.status === s)
    const soma = (l: BuffetOrcamento[]) => l.reduce((t, o) => t + (o.valorFinal ?? 0), 0)
    const fechados = por('aprovado').length + por('perdido').length
    return {
      emAberto: por('rascunho').length + por('enviado').length,
      valorEnviado: soma(por('enviado')),
      aprovados: por('aprovado').length,
      valorAprovado: soma(por('aprovado')),
      conversao: fechados ? Math.round((por('aprovado').length / fechados) * 100) : undefined,
    }
  }, [orcamentos])

  function trocar(o: BuffetOrcamento) {
    setOrcamentos(prev => {
      const existe = prev.some(x => x.id === o.id)
      return existe ? prev.map(x => (x.id === o.id ? o : x)) : [o, ...prev]
    })
  }

  async function salvar(input: OrcamentoInput, alvo: BuffetOrcamento | 'novo') {
    if (alvo === 'novo') {
      const criado = await criarOrcamento(input, await nomeDoUsuarioAtual())
      trocar(criado)
      avisar(`Orçamento nº ${criado.numero} criado.`)
    } else {
      trocar(await atualizarOrcamento(alvo.id, input))
      avisar('Orçamento atualizado.')
    }
  }

  async function mudarStatus(o: BuffetOrcamento, status: StatusOrcamento, extra: Partial<OrcamentoInput> = {}) {
    try {
      trocar(await atualizarOrcamento(o.id, { status, ...extra, ...(status === 'enviado' && !o.enviadoEm ? { enviadoEm: new Date().toISOString() } : {}) }))
      avisar(`Orçamento nº ${o.numero}: ${STATUS_LABEL[status].toLowerCase()}.`)
    } catch (e) {
      avisar(mensagemDeErro(e, 'Não foi possível mudar a situação.'))
    }
  }

  const btn = 'flex items-center gap-1 rounded-md border border-app-border2 px-2 py-1 text-[11px] font-medium text-app-muted hover:bg-app-surface2 transition-colors'

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="print:hidden space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366]/15"><ChefHat className="h-5 w-5 text-[#128C7E]" /></div>
            <div>
              <h1 className="text-lg font-semibold text-app-text leading-tight">Buffet EL</h1>
              <p className="text-xs text-app-subtle">Empresa separada dos espaços — nada daqui entra no financeiro dos espaços.</p>
            </div>
          </div>
          {aba === 'orcamentos' && (
            <button onClick={() => setEditando('novo')} className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1fb955]">
              <Plus className="h-4 w-4" /> Novo orçamento
            </button>
          )}
        </div>

        <div className="flex gap-1 border-b border-app-border">
          {([['orcamentos', 'Orçamentos'], ['cadastros', 'Cadastros e tabelas']] as [Aba, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setAba(k)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${aba === k ? 'border-[#25D366] text-[#128C7E]' : 'border-transparent text-app-muted hover:text-app-text'}`}>{l}</button>
          ))}
        </div>

        {erro && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{erro}</p>}
        {loading && <p className="text-sm text-app-subtle">Carregando…</p>}

        {!loading && aba === 'orcamentos' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ['Em aberto', String(totais.emAberto)],
                ['Enviados aguardando', formatCurrency(totais.valorEnviado)],
                ['Aprovados', `${totais.aprovados} · ${formatCurrency(totais.valorAprovado)}`],
                ['Conversão', totais.conversao === undefined ? '—' : `${totais.conversao}%`],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-app-border2/60 bg-app-surface p-3">
                  <p className="text-[11px] text-app-subtle">{l}</p>
                  <p className="text-sm font-bold text-app-text">{v}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente, tipo, local ou nº"
                  className="w-full rounded-lg border border-app-border2 bg-app-surface px-8 py-1.5 text-sm text-app-text focus:outline-none" />
              </div>
              {FILTROS.map(s => (
                <button key={s} onClick={() => setFiltro(s)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${filtro === s ? 'border-[#25D366] bg-[#25D366]/15 text-[#128C7E] font-medium' : 'border-app-border2 text-app-muted'}`}>
                  {s === 'todos' ? 'Todos' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            {lista.length === 0 ? (
              <p className="rounded-xl border border-dashed border-app-border2 p-8 text-center text-sm text-app-subtle">
                {orcamentos.length === 0 ? 'Nenhum orçamento ainda. Clique em "Novo orçamento" para começar.' : 'Nenhum orçamento com esse filtro.'}
              </p>
            ) : (
              <div className="space-y-2">
                {lista.map(o => (
                  <div key={o.id} className="rounded-xl border border-app-border2/60 bg-app-surface p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-app-text">
                          <span className="text-app-subtle font-normal">nº {o.numero} · </span>{o.clienteNome}
                          <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                        </p>
                        <p className="text-xs text-app-muted mt-0.5">
                          {[o.tipoEvento, o.dataEvento && formatDate(o.dataEvento), o.convidados && `${o.convidados} convidados`, o.duracaoHoras && `${String(o.duracaoHoras).replace('.', ',')}h`, o.local].filter(Boolean).join(' · ') || 'Evento sem detalhes'}
                        </p>
                        {o.status === 'perdido' && o.motivoPerda && <p className="text-xs text-red-500 mt-0.5">Motivo: {o.motivoPerda}</p>}
                        {o.createdByNome && <p className="text-[11px] text-app-subtle mt-0.5">Criado por {o.createdByNome}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-app-text">{o.valorFinal !== undefined ? formatCurrency(o.valorFinal) : '—'}</p>
                        {o.validade && o.status !== 'aprovado' && o.status !== 'perdido' && <p className="text-[11px] text-app-subtle">válido até {formatDate(o.validade)}</p>}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button className={btn} onClick={() => setEditando(o)}><Pencil className="h-3 w-3" /> Editar</button>
                      <button className={btn} onClick={() => setImprimindo(o)}><FileDown className="h-3 w-3" /> PDF da proposta</button>
                      <button className={btn} onClick={() => setDuplicando(o)}><Copy className="h-3 w-3" /> Duplicar</button>
                      {o.status === 'rascunho' && <button className={btn} onClick={() => mudarStatus(o, 'enviado')}><Send className="h-3 w-3" /> Marcar como enviado</button>}
                      {(o.status === 'rascunho' || o.status === 'enviado') && (
                        <>
                          <button className={btn} onClick={() => mudarStatus(o, 'aprovado')}><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Aprovado</button>
                          <button className={btn} onClick={() => { setPerdendo(o); setMotivo('') }}><XCircle className="h-3 w-3 text-red-500" /> Perdido</button>
                        </>
                      )}
                      {(o.status === 'aprovado' || o.status === 'perdido') && (
                        <button className={btn} onClick={() => mudarStatus(o, 'enviado', { motivoPerda: undefined })}><RotateCcw className="h-3 w-3" /> Reabrir</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && aba === 'cadastros' && (
          <CadastrosBuffet opcoes={opcoes} tabelas={tabelas} podeEditarPrecos={podeEditarPrecos} onMudou={recarregarCadastros} />
        )}
      </div>

      {editando && (
        <OrcamentoModal
          orcamento={editando === 'novo' ? undefined : editando}
          opcoes={opcoes} tabelas={tabelas}
          onClose={() => setEditando(null)}
          onSalvar={input => salvar(input, editando)}
        />
      )}
      {duplicando && (
        <OrcamentoModal
          orcamento={{ ...duplicando, status: 'rascunho', motivoPerda: undefined, validade: undefined }}
          titulo={`Novo orçamento (cópia do nº ${duplicando.numero})`}
          opcoes={opcoes} tabelas={tabelas}
          onClose={() => setDuplicando(null)}
          onSalvar={input => salvar({ ...input, status: 'rascunho', motivoPerda: undefined }, 'novo')}
        />
      )}

      {perdendo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden" onClick={() => setPerdendo(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-surface p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-app-text">Orçamento nº {perdendo.numero} perdido</p>
            <textarea rows={3} autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo (preço, data, fechou com outro buffet…)"
              className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setPerdendo(null)} className="rounded-lg border border-app-border2 px-3 py-1.5 text-sm text-app-muted">Cancelar</button>
              <button onClick={() => { mudarStatus(perdendo, 'perdido', { motivoPerda: motivo.trim() || undefined }); setPerdendo(null) }}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold text-white">Marcar como perdido</button>
            </div>
          </div>
        </div>
      )}

      {imprimindo && (
        <div className="hidden print:block">
          <PropostaBuffet o={imprimindo} tabela={tabelas.find(t => t.id === imprimindo.tabelaId)} />
        </div>
      )}

      <Toast message={toast} />
    </div>
  )
}
