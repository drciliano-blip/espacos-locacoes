'use client'

import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Plus, Search, Pencil, Trash2, ChevronDown, ChevronUp, Phone, Briefcase, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteFile } from '@/lib/file-storage'
import { hojeISO, mensagemDeErro } from '@/lib/utils'
import { useAtividades } from '@/contexts/AtividadesContext'
import { documentosExigidos, situacaoCredenciamento } from '@/lib/credenciamento-config'
import type { EmpresaTerceirizada, Terceirizado } from '@/types'
import TerceirizadoModal from '@/components/credenciamento/TerceirizadoModal'
import DocumentosCredenciamento from '@/components/credenciamento/DocumentosCredenciamento'
import EmpresasSection from '@/components/credenciamento/EmpresasSection'
import EscalaSection from '@/components/credenciamento/EscalaSection'
import {
  DARK_GREEN, empresaFromRow, GREEN, SELECT_EMPRESA, SELECT_TERCEIRIZADO, SITUACAO_LABEL as SITUACAO, terceirizadoFromRow,
  type EmpresaRow, type TerceirizadoRow,
} from '@/components/credenciamento/dados'

const FILTRO_CLASS = 'cursor-pointer rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:outline-none'

export default function CredenciamentoPage() {
  const { logAtividade } = useAtividades()
  const [aba, setAba] = useState<'pessoas' | 'escalas' | 'empresas'>('pessoas')
  const [pessoas, setPessoas] = useState<Terceirizado[]>([])
  const [empresas, setEmpresas] = useState<EmpresaTerceirizada[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroFuncao, setFiltroFuncao] = useState('')
  const [filtroContratacao, setFiltroContratacao] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Terceirizado | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
    () => pessoas.map(p => ({ pessoa: p, situacao: situacaoCredenciamento(p.funcao, p.documentos, hoje) })),
    [pessoas, hoje],
  )

  const funcoesEmUso = useMemo(() => Array.from(new Set(pessoas.map(p => p.funcao))).sort(), [pessoas])

  const filtradas = comSituacao.filter(({ pessoa, situacao }) => {
    const termo = busca.trim().toLowerCase()
    if (termo && !pessoa.nomeCompleto.toLowerCase().includes(termo) && !pessoa.cpf.includes(termo)) return false
    if (filtroFuncao && pessoa.funcao !== filtroFuncao) return false
    if (filtroSituacao && situacao !== filtroSituacao) return false
    if (filtroContratacao === 'direto' && pessoa.tipoContratacao !== 'direto') return false
    if (filtroContratacao && filtroContratacao !== 'direto' && pessoa.empresaId !== filtroContratacao) return false
    return true
  })

  const totais = {
    apto: comSituacao.filter(c => c.situacao === 'apto').length,
    atencao: comSituacao.filter(c => c.situacao === 'atencao').length,
    pendente: comSituacao.filter(c => c.situacao === 'pendente').length,
  }

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
    registrar(criada ? 'Terceirizado credenciado' : 'Ficha de terceirizado alterada', pessoa)
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
          {([['pessoas', 'Pessoas'], ['escalas', 'Escalas por evento'], ['empresas', 'Empresas']] as const).map(([id, label]) => (
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
        <EmpresasSection empresas={empresas} pessoas={pessoas} onChange={setEmpresas} />
      ) : aba === 'escalas' ? (
        <EscalaSection pessoas={pessoas} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['apto', 'atencao', 'pendente'] as const).map(s => (
              <button key={s} onClick={() => setFiltroSituacao(f => f === s ? '' : s)}
                className={`rounded-xl border bg-app-surface p-4 text-left transition-colors ${filtroSituacao === s ? 'border-[#25D366]/50' : 'border-app-border hover:border-app-border2'}`}>
                <p className="text-xs text-app-muted">{SITUACAO[s].label}</p>
                <p className="text-2xl font-semibold text-app-text mt-1">{totais[s]}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-subtle" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou CPF"
                className="w-full rounded-lg border border-app-border2 bg-app-surface pl-8 pr-3 py-1.5 text-xs text-app-text focus:outline-none focus:border-[#25D366]" />
            </div>
            <select value={filtroFuncao} onChange={e => setFiltroFuncao(e.target.value)} className={FILTRO_CLASS}>
              <option value="">Todas as funções</option>
              {funcoesEmUso.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={filtroContratacao} onChange={e => setFiltroContratacao(e.target.value)} className={FILTRO_CLASS}>
              <option value="">Toda contratação</option>
              <option value="direto">Contratado direto</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <select value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)} className={FILTRO_CLASS}>
              <option value="">Toda situação</option>
              <option value="apto">Apto</option>
              <option value="atencao">Vence em breve</option>
              <option value="pendente">Pendente</option>
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
                      <p className="text-sm font-medium text-app-text truncate">{p.nomeCompleto}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${SITUACAO[situacao].className}`}>{SITUACAO[situacao].label}</span>
                      {p.status === 'inativo' && <span className="rounded-full border border-app-border2 px-2 py-0.5 text-[11px] text-app-subtle">Inativo</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-app-subtle">
                      <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{p.funcao}</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {p.tipoContratacao === 'empresa' ? (p.empresaNome || 'Empresa não informada') : 'Contratado direto'}
                      </span>
                      {p.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.telefone}</span>}
                      {p.cpf && <span>CPF {p.cpf}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => abrirModal(p)} title="Editar ficha"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleRemove(p)} title="Remover"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setExpandedId(id => id === p.id ? null : p.id)} title="Documentos"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 transition-colors">
                      {expandedId === p.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {expandedId === p.id && (
                  <div className="px-4 pb-4 pt-3 border-t border-app-border/50">
                    <DocumentosCredenciamento
                      key={`${p.id}-${p.funcao}`}
                      dono={{ tabela: 'terceirizado_documentos', coluna: 'terceirizado_id', id: p.id, nome: p.nomeCompleto }}
                      documentos={p.documentos}
                      exigidos={documentosExigidos(p.funcao)}
                      tituloExigidos={`Exigidos para ${p.funcao}`}
                      onChange={documentos => setPessoas(prev => prev.map(x => x.id === p.id ? { ...x, documentos } : x))}
                    />
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
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
