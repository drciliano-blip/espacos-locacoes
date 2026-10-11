'use client'

import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Plus, Search, Pencil, Trash2, ChevronDown, ChevronUp, Phone, Briefcase, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteFile } from '@/lib/file-storage'
import { hojeISO, mensagemDeErro } from '@/lib/utils'
import { useAtividades } from '@/contexts/AtividadesContext'
import { useCurrentUser } from '@/contexts/UserContext'
import { documentosExigidos, situacaoCredenciamento } from '@/lib/credenciamento-config'
import type { EmpresaTerceirizada, Terceirizado } from '@/types'
import TerceirizadoModal from '@/components/credenciamento/TerceirizadoModal'
import DocumentosCredenciamento from '@/components/credenciamento/DocumentosCredenciamento'
import AnotacoesCredenciamento from '@/components/credenciamento/AnotacoesCredenciamento'
import EmpresasSection from '@/components/credenciamento/EmpresasSection'
import EscalaSection from '@/components/credenciamento/EscalaSection'
import {
  AVALIACAO_LABEL, CONTRATACAO_LABEL, DARK_GREEN, descricaoContratacao, empresaFromRow, GREEN, numeroStaff, SELECT_EMPRESA, SELECT_TERCEIRIZADO,
  SITUACAO_LABEL as SITUACAO, terceirizadoFromRow, VETADO_CLASS,
  type EmpresaRow, type TerceirizadoRow,
} from '@/components/credenciamento/dados'

const FILTRO_CLASS = 'cursor-pointer rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:outline-none'

export default function CredenciamentoPage() {
  const { logAtividade } = useAtividades()
  // Login de cadastro: só cria e edita fichas e empresas e anexa documentos.
  // Escala, exclusão, veto, avaliação e anotações ficam com o produtor.
  const somenteCadastro = useCurrentUser().role === 'credenciamento'
  const [aba, setAba] = useState<'pessoas' | 'escalas' | 'empresas'>('pessoas')
  const [pessoas, setPessoas] = useState<Terceirizado[]>([])
  const [empresas, setEmpresas] = useState<EmpresaTerceirizada[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroFuncao, setFiltroFuncao] = useState('')
  const [filtroContratacao, setFiltroContratacao] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('')
  const [filtroAvaliacao, setFiltroAvaliacao] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Terceirizado | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [subAba, setSubAba] = useState<'documentos' | 'anotacoes'>('documentos')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('terceirizados').select(SELECT_TERCEIRIZADO).order('nome_completo'),
      supabase.from('empresas_terceirizadas').select(SELECT_EMPRESA).order('nome'),
    ]).then(([p, e]) => {
      if (p.error || e.error) setErro(mensagemDeErro(p.error ?? e.error, 'Não foi possível carregar o credenciamento.'))
      setPessoas(((p.data as unknown as TerceirizadoRow[]) ?? []).map(terceirizadoFromRow))
      setEmpresas(((e.data as unknown as EmpresaRow[]) ?? []).map(empresaFromRow))
      setLoading(false)
    })
  }, [])

  const hoje = hojeISO()
  const comSituacao = useMemo(
    () => pessoas.map(p => ({ pessoa: p, situacao: situacaoCredenciamento(p.funcao, p.tipoContratacao, p.documentos, hoje) })),
    [pessoas, hoje],
  )

  const funcoesEmUso = useMemo(() => Array.from(new Set(pessoas.map(p => p.funcao))).sort(), [pessoas])

  const filtradas = comSituacao.filter(({ pessoa, situacao }) => {
    const termo = busca.trim().toLowerCase()
    // Só dígitos na busca = número do staff, exato ("12" não traz o 120).
    const porNumero = /^\d{1,6}$/.test(termo) && pessoa.numero === Number(termo)
    if (termo && !porNumero && ![pessoa.nomeCompleto, pessoa.razaoSocial].some(t => t.toLowerCase().includes(termo))
      && !pessoa.cpf.includes(termo) && !pessoa.cnpj.includes(termo)) return false
    if (filtroFuncao && pessoa.funcao !== filtroFuncao) return false
    // Vetado é uma situação à parte: quem está vetado não entra em
    // apto/vence em breve/pendente, que falam só da documentação.
    if (filtroSituacao === 'vetado' && pessoa.status !== 'vetado') return false
    if (filtroSituacao && filtroSituacao !== 'vetado' && (pessoa.status === 'vetado' || situacao !== filtroSituacao)) return false
    if (filtroAvaliacao === 'sem' && pessoa.avaliacao) return false
    if (filtroAvaliacao && filtroAvaliacao !== 'sem' && pessoa.avaliacao !== filtroAvaliacao) return false
    // O filtro vale um tipo de contratação ou uma empresa específica (id).
    const filtraPorTipo = filtroContratacao === 'direto' || filtroContratacao === 'mei' || filtroContratacao === 'empresa'
    if (filtraPorTipo && pessoa.tipoContratacao !== filtroContratacao) return false
    if (filtroContratacao && !filtraPorTipo && pessoa.empresaId !== filtroContratacao) return false
    return true
  })

  const naoVetados = comSituacao.filter(c => c.pessoa.status !== 'vetado')
  const totais = {
    apto: naoVetados.filter(c => c.situacao === 'apto').length,
    atencao: naoVetados.filter(c => c.situacao === 'atencao').length,
    pendente: naoVetados.filter(c => c.situacao === 'pendente').length,
    vetado: comSituacao.length - naoVetados.length,
  }
  const empresasVetadas = new Set(empresas.filter(e => e.status === 'vetado').map(e => e.id))

  function abrirModal(pessoa: Terceirizado | null) {
    setEditando(pessoa)
    setModalOpen(true)
  }

  async function registrar(acao: string, pessoa: Terceirizado) {
    try {
      await logAtividade({ tipo: 'funcionario', acao, detalhes: `${pessoa.nomeCompleto} — ${pessoa.funcao}` })
    } catch {
      // log é secundário, não deve impedir a operação já concluída
    }
  }

  function handleSaved(pessoa: Terceirizado, criada: boolean) {
    setPessoas(prev => (criada ? [...prev, pessoa] : prev.map(p => p.id === pessoa.id ? pessoa : p))
      .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto)))
    setModalOpen(false)
    // Ficha nova já abre nos documentos — é o passo seguinte do cadastro.
    if (criada) setExpandedId(pessoa.id)
    // O login de cadastro não grava no log de atividades (o banco barra).
    if (!somenteCadastro) registrar(criada ? 'Terceirizado credenciado' : 'Ficha de terceirizado alterada', pessoa)
  }

  async function handleRemove(pessoa: Terceirizado) {
    if (!window.confirm(`Remover a ficha de ${pessoa.nomeCompleto}? Os documentos anexados também serão apagados.`)) return
    setErro(null)
    const supabase = createClient()
    const { error } = await supabase.from('terceirizados').delete().eq('id', pessoa.id)
    if (error) return setErro(mensagemDeErro(error, 'Não foi possível remover a ficha.'))
    // As linhas de documento caem em cascata no banco; os arquivos, não.
    await Promise.all(pessoa.documentos.filter(d => d.fileId).map(d => deleteFile(d.fileId!).catch(() => {})))
    setPessoas(prev => prev.filter(p => p.id !== pessoa.id))
    registrar('Ficha de terceirizado removida', pessoa)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366]/15">
          <BadgeCheck className="h-4 w-4 text-[#25D366]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-app-text">Credenciamento de Terceirizados</p>
          <p className="text-xs text-app-subtle">Ficha cadastral e autorizações de quem trabalha nos eventos</p>
        </div>

        <div className="ml-auto flex rounded-lg border border-app-border2 bg-app-surface p-0.5">
          {([['pessoas', 'Pessoas'], ['escalas', 'Escalas por evento'], ['empresas', 'Empresas']] as const)
            .filter(([id]) => !(somenteCadastro && id === 'escalas'))
            .map(([id, label]) => (
            <button key={id} onClick={() => setAba(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${aba === id ? 'bg-[#25D366]/15 text-[#25D366]' : 'text-app-muted hover:text-app-text'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {erro && <p className="text-xs text-red-400">{erro}</p>}

      {loading ? (
        <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center">
          <p className="text-sm text-app-subtle">Carregando…</p>
        </div>
      ) : aba === 'empresas' ? (
        <EmpresasSection empresas={empresas} pessoas={pessoas} somenteCadastro={somenteCadastro} onChange={setEmpresas} />
      ) : aba === 'escalas' && !somenteCadastro ? (
        <EscalaSection pessoas={pessoas} />
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {(['apto', 'atencao', 'pendente', 'vetado'] as const).map(s => (
              <button key={s} onClick={() => setFiltroSituacao(f => f === s ? '' : s)}
                className={`rounded-xl border bg-app-surface p-4 text-left transition-colors ${filtroSituacao === s ? 'border-[#25D366]/50' : 'border-app-border hover:border-app-border2'}`}>
                <p className="text-xs text-app-muted">{s === 'vetado' ? 'Vetados' : SITUACAO[s].label}</p>
                <p className="text-2xl font-semibold text-app-text mt-1">{totais[s]}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-subtle" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nº do staff, nome, CPF ou CNPJ"
                className="w-full rounded-lg border border-app-border2 bg-app-surface pl-8 pr-3 py-1.5 text-xs text-app-text focus:outline-none focus:border-[#25D366]" />
            </div>
            <select value={filtroFuncao} onChange={e => setFiltroFuncao(e.target.value)} className={FILTRO_CLASS}>
              <option value="">Todas as funções</option>
              {funcoesEmUso.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={filtroContratacao} onChange={e => setFiltroContratacao(e.target.value)} className={FILTRO_CLASS}>
              <option value="">Toda contratação</option>
              <option value="direto">{CONTRATACAO_LABEL.direto}</option>
              <option value="mei">{CONTRATACAO_LABEL.mei}</option>
              <option value="empresa">{CONTRATACAO_LABEL.empresa} (todas)</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <select value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)} className={FILTRO_CLASS}>
              <option value="">Toda situação</option>
              <option value="apto">Apto</option>
              <option value="atencao">Vence em breve</option>
              <option value="pendente">Pendente</option>
              <option value="vetado">Vetado</option>
            </select>
            <select value={filtroAvaliacao} onChange={e => setFiltroAvaliacao(e.target.value)} className={somenteCadastro ? 'hidden' : FILTRO_CLASS}>
              <option value="">Toda avaliação</option>
              <option value="otimo">Ótimo</option>
              <option value="bom">Bom</option>
              <option value="regular">Regular</option>
              <option value="sem">Sem avaliação</option>
            </select>
            <button
              onClick={() => abrirModal(null)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: GREEN }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = DARK_GREEN }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
            >
              <Plus className="h-4 w-4" />
              Nova ficha
            </button>
          </div>

          <div className="space-y-2">
            {filtradas.length === 0 ? (
              <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center">
                <p className="text-sm text-app-subtle">
                  {pessoas.length === 0 ? 'Nenhuma ficha cadastrada.' : 'Nenhuma ficha encontrada com esses filtros.'}
                </p>
              </div>
            ) : filtradas.map(({ pessoa: p, situacao }) => (
              <div key={p.id} className={`rounded-lg border border-app-border2/50 bg-app-surface2/40 overflow-hidden ${p.status === 'inativo' ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-md bg-app-surface px-1.5 py-0.5 text-[11px] font-semibold text-app-muted tabular-nums">{numeroStaff(p.numero)}</span>
                      <p className="text-sm font-medium text-app-text truncate">{p.nomeCompleto}</p>
                      {p.status === 'vetado'
                        ? <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${VETADO_CLASS}`}>Vetado</span>
                        : <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${SITUACAO[situacao].className}`}>{SITUACAO[situacao].label}</span>}
                      {p.status === 'inativo' && <span className="rounded-full border border-app-border2 px-2 py-0.5 text-[11px] text-app-subtle">Inativo</span>}
                      {!somenteCadastro && p.avaliacao && <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${AVALIACAO_LABEL[p.avaliacao].className}`}>{AVALIACAO_LABEL[p.avaliacao].label}</span>}
                      {p.empresaId && empresasVetadas.has(p.empresaId) && <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${VETADO_CLASS}`}>Empresa vetada</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-app-subtle">
                      <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{p.funcao}</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {descricaoContratacao(p)}
                      </span>
                      {p.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.telefone}</span>}
                      {p.cpf && <span>CPF {p.cpf}</span>}
                    </div>
                    {!somenteCadastro && p.status === 'vetado' && p.motivoVeto && <p className="text-xs text-red-400 mt-1">Motivo do veto: {p.motivoVeto}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => abrirModal(p)} title="Editar ficha"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {!somenteCadastro && (
                      <button onClick={() => handleRemove(p)} title="Remover"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => setExpandedId(id => id === p.id ? null : p.id)} title={somenteCadastro ? 'Documentos' : 'Documentos e anotações'}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 transition-colors">
                      {expandedId === p.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {expandedId === p.id && (
                  <div className="px-4 pb-4 pt-3 border-t border-app-border/50 space-y-3">
                    <div className={somenteCadastro ? 'hidden' : 'flex gap-1'}>
                      {([['documentos', `Documentos (${p.documentos.length})`], ['anotacoes', `Anotações (${p.anotacoes.length})`]] as const).map(([id, label]) => (
                        <button key={id} onClick={() => setSubAba(id)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${subAba === id ? 'bg-[#25D366]/15 text-[#25D366]' : 'text-app-muted hover:text-app-text'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {subAba === 'anotacoes' && !somenteCadastro ? (
                      <AnotacoesCredenciamento
                        dono={{ coluna: 'terceirizado_id', id: p.id }}
                        anotacoes={p.anotacoes}
                        onChange={anotacoes => setPessoas(prev => prev.map(x => x.id === p.id ? { ...x, anotacoes } : x))}
                      />
                    ) : (
                    <DocumentosCredenciamento
                      key={`${p.id}-${p.funcao}-${p.tipoContratacao}`}
                      dono={{ tabela: 'terceirizado_documentos', coluna: 'terceirizado_id', id: p.id, nome: p.nomeCompleto }}
                      documentos={p.documentos}
                      exigidos={documentosExigidos(p.funcao, p.tipoContratacao)}
                      tituloExigidos={`Exigidos para ${p.funcao}${p.tipoContratacao === 'mei' ? ' (MEI)' : ''}`}
                      onChange={documentos => setPessoas(prev => prev.map(x => x.id === p.id ? { ...x, documentos } : x))}
                    />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {modalOpen && (
        <TerceirizadoModal
          pessoa={editando}
          empresas={empresas}
          somenteCadastro={somenteCadastro}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
