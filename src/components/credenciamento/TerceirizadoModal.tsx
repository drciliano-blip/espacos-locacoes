'use client'

import { useState } from 'react'
import { BadgeCheck, X, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { maskCPF, maskPhone, mensagemDeErro } from '@/lib/utils'
import { FUNCOES_CREDENCIAMENTO } from '@/lib/credenciamento-config'
import type { EmpresaTerceirizada, Terceirizado, TipoContratacao } from '@/types'
import { GREEN, INPUT_CLASS, SELECT_TERCEIRIZADO, terceirizadoFromRow, type TerceirizadoRow } from './dados'

const OUTRA_FUNCAO = '__outra__'

interface Props {
  pessoa: Terceirizado | null
  empresas: EmpresaTerceirizada[]
  onClose: () => void
  onSaved: (pessoa: Terceirizado, criada: boolean) => void
}

export default function TerceirizadoModal({ pessoa, empresas, onClose, onSaved }: Props) {
  const funcaoForaDaLista = !!pessoa && !FUNCOES_CREDENCIAMENTO.includes(pessoa.funcao)

  const [nomeCompleto, setNomeCompleto] = useState(pessoa?.nomeCompleto ?? '')
  const [cpf, setCpf] = useState(pessoa?.cpf ?? '')
  const [rg, setRg] = useState(pessoa?.rg ?? '')
  const [dataNascimento, setDataNascimento] = useState(pessoa?.dataNascimento ?? '')
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? '')
  const [email, setEmail] = useState(pessoa?.email ?? '')
  const [funcaoSelecionada, setFuncaoSelecionada] = useState(funcaoForaDaLista ? OUTRA_FUNCAO : (pessoa?.funcao ?? ''))
  const [funcaoLivre, setFuncaoLivre] = useState(funcaoForaDaLista ? pessoa!.funcao : '')
  const [tipoContratacao, setTipoContratacao] = useState<TipoContratacao>(pessoa?.tipoContratacao ?? 'direto')
  const [empresaId, setEmpresaId] = useState(pessoa?.empresaId ?? '')
  const [status, setStatus] = useState<'ativo' | 'inativo'>(pessoa?.status ?? 'ativo')
  const [observacoes, setObservacoes] = useState(pessoa?.observacoes ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const funcao = funcaoSelecionada === OUTRA_FUNCAO ? funcaoLivre.trim() : funcaoSelecionada
  const errors = {
    nomeCompleto: !nomeCompleto.trim(),
    funcao: !funcao,
    empresa: tipoContratacao === 'empresa' && !empresaId,
  }
  const hasErrors = Object.values(errors).some(Boolean)

  async function handleSave() {
    setSubmitted(true)
    setErro(null)
    if (hasErrors) return

    setBusy(true)
    const supabase = createClient()
    const valores = {
      nome_completo: nomeCompleto.trim(),
      cpf: cpf.trim() || null,
      rg: rg.trim() || null,
      data_nascimento: dataNascimento || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      funcao,
      tipo_contratacao: tipoContratacao,
      empresa_id: tipoContratacao === 'empresa' ? empresaId : null,
      status,
      observacoes: observacoes.trim() || null,
    }

    const consulta = pessoa
      ? supabase.from('terceirizados').update(valores).eq('id', pessoa.id)
      : supabase.from('terceirizados').insert(valores)
    const { data, error } = await consulta.select(SELECT_TERCEIRIZADO).single()

    setBusy(false)
    if (error) return setErro(mensagemDeErro(error, 'Não foi possível salvar a ficha. Tente novamente.'))
    onSaved(terceirizadoFromRow(data as unknown as TerceirizadoRow), !pessoa)
  }

  const erroClass = (comErro: boolean) => submitted && comErro ? `${INPUT_CLASS} border-red-500/50` : INPUT_CLASS

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-[#25D366]" />
            {pessoa ? 'Editar ficha' : 'Nova ficha cadastral'}
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs text-app-muted mb-1">Nome completo *</label>
              <input value={nomeCompleto} onChange={e => setNomeCompleto(e.target.value)} className={erroClass(errors.nomeCompleto)} />
              {submitted && errors.nomeCompleto && <p className="text-xs text-red-400 mt-0.5">Campo obrigatório</p>}
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">CPF</label>
              <input value={cpf} onChange={e => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">RG</label>
              <input value={rg} onChange={e => setRg(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">Data de nascimento</label>
              <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">Telefone</label>
              <input value={telefone} onChange={e => setTelefone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" className={INPUT_CLASS} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-app-muted mb-1">E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={INPUT_CLASS} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-app-border/50">
            <div>
              <label className="block text-xs text-app-muted mb-1">Função *</label>
              <select value={funcaoSelecionada} onChange={e => setFuncaoSelecionada(e.target.value)} className={`${erroClass(errors.funcao)} cursor-pointer`}>
                <option value="">— Selecione —</option>
                {FUNCOES_CREDENCIAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
                <option value={OUTRA_FUNCAO}>Outra função…</option>
              </select>
              {submitted && errors.funcao && <p className="text-xs text-red-400 mt-0.5">Informe a função</p>}
            </div>
            {funcaoSelecionada === OUTRA_FUNCAO && (
              <div>
                <label className="block text-xs text-app-muted mb-1">Qual função?</label>
                <input value={funcaoLivre} onChange={e => setFuncaoLivre(e.target.value)} className={erroClass(errors.funcao)} />
              </div>
            )}
            <div>
              <label className="block text-xs text-app-muted mb-1">Situação</label>
              <select value={status} onChange={e => setStatus(e.target.value as 'ativo' | 'inativo')} className={`${INPUT_CLASS} cursor-pointer`}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-app-border/50">
            <div>
              <label className="block text-xs text-app-muted mb-1">Contratação</label>
              <select value={tipoContratacao} onChange={e => setTipoContratacao(e.target.value as TipoContratacao)} className={`${INPUT_CLASS} cursor-pointer`}>
                <option value="direto">Contratado direto</option>
                <option value="empresa">Por empresa terceirizada</option>
              </select>
            </div>
            {tipoContratacao === 'empresa' && (
              <div>
                <label className="block text-xs text-app-muted mb-1">Empresa *</label>
                <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} className={`${erroClass(errors.empresa)} cursor-pointer`}>
                  <option value="">— Selecione —</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                {submitted && errors.empresa && (
                  <p className="text-xs text-red-400 mt-0.5">
                    {empresas.length === 0 ? 'Cadastre a empresa primeiro, na aba Empresas.' : 'Selecione a empresa'}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-app-muted mb-1">Observações</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className={INPUT_CLASS} />
          </div>

          {!pessoa && (
            <p className="text-xs text-app-subtle italic">Os documentos e autorizações são anexados depois de salvar, abrindo a ficha na lista.</p>
          )}
          {erro && <p className="text-xs text-red-400">{erro}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={busy}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: GREEN }}>
            <Save className="h-3.5 w-3.5" />
            {busy ? 'Salvando…' : 'Salvar ficha'}
          </button>
        </div>
      </div>
    </div>
  )
}
