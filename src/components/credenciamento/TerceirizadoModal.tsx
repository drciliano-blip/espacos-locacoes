'use client'

import { useState } from 'react'
import { BadgeCheck, X, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { maskCNPJ, maskCPF, maskPhone, mensagemDeErro } from '@/lib/utils'
import { FUNCOES_CREDENCIAMENTO } from '@/lib/credenciamento-config'
import type { Avaliacao, EmpresaTerceirizada, StatusCredenciamento, Terceirizado, TipoContratacao } from '@/types'
import CamposSituacao from './CamposSituacao'
import {
  CONTRATACAO_LABEL, GREEN, INPUT_CLASS, numeroStaff, registrarMudancaDeVeto, SELECT_TERCEIRIZADO, terceirizadoFromRow,
  type TerceirizadoRow,
} from './dados'

const OUTRA_FUNCAO = '__outra__'

interface Props {
  pessoa: Terceirizado | null
  empresas: EmpresaTerceirizada[]
  // Login de cadastro: não define situação, veto nem avaliação (o banco
  // também ignora, ver migration 0042).
  somenteCadastro: boolean
  onClose: () => void
  onSaved: (pessoa: Terceirizado, criada: boolean) => void
}

export default function TerceirizadoModal({ pessoa, empresas, somenteCadastro, onClose, onSaved }: Props) {
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
  const [cnpj, setCnpj] = useState(pessoa?.cnpj ?? '')
  const [razaoSocial, setRazaoSocial] = useState(pessoa?.razaoSocial ?? '')
  const [empresaId, setEmpresaId] = useState(pessoa?.empresaId ?? '')
  const [status, setStatus] = useState<StatusCredenciamento>(pessoa?.status ?? 'ativo')
  const [motivoVeto, setMotivoVeto] = useState(pessoa?.motivoVeto ?? '')
  const [avaliacao, setAvaliacao] = useState<Avaliacao | ''>(pessoa?.avaliacao ?? '')
  const [observacoes, setObservacoes] = useState(pessoa?.observacoes ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const funcao = funcaoSelecionada === OUTRA_FUNCAO ? funcaoLivre.trim() : funcaoSelecionada
  const errors = {
    nomeCompleto: !nomeCompleto.trim(),
    funcao: !funcao,
    empresa: tipoContratacao === 'empresa' && !empresaId,
    cnpj: tipoContratacao === 'mei' && !cnpj.trim(),
    motivoVeto: status === 'vetado' && !motivoVeto.trim(),
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
      cnpj: tipoContratacao === 'mei' ? cnpj.trim() : null,
      razao_social: tipoContratacao === 'mei' ? razaoSocial.trim() || null : null,
      empresa_id: tipoContratacao === 'empresa' ? empresaId : null,
      status,
      motivo_veto: status === 'vetado' ? motivoVeto.trim() : null,
      avaliacao: avaliacao || null,
      observacoes: observacoes.trim() || null,
    }

    const consulta = pessoa
      ? supabase.from('terceirizados').update(valores).eq('id', pessoa.id)
      : supabase.from('terceirizados').insert(valores)
    const { data, error } = await consulta.select(SELECT_TERCEIRIZADO).single()

    if (error) {
      setBusy(false)
      return setErro(mensagemDeErro(error, 'Não foi possível salvar a ficha. Tente novamente.'))
    }
    const salva = terceirizadoFromRow(data as unknown as TerceirizadoRow)
    const novas = somenteCadastro ? [] : await registrarMudancaDeVeto({ coluna: 'terceirizado_id', id: salva.id }, pessoa, salva)
    setBusy(false)
    onSaved({ ...salva, anotacoes: [...novas, ...salva.anotacoes] }, !pessoa)
  }

  const erroClass = (comErro: boolean) => submitted && comErro ? `${INPUT_CLASS} border-red-500/50` : INPUT_CLASS

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-[#25D366]" />
            {pessoa ? `Editar ficha — ${numeroStaff(pessoa.numero)}` : 'Nova ficha cadastral'}
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
          </div>

          {!somenteCadastro && (
            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-app-border/50">
              <CamposSituacao
                status={status} motivoVeto={motivoVeto} avaliacao={avaliacao}
                erroMotivo={submitted && errors.motivoVeto}
                onStatus={setStatus} onMotivoVeto={setMotivoVeto} onAvaliacao={setAvaliacao}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-app-border/50">
            <div>
              <label className="block text-xs text-app-muted mb-1">Contratação</label>
              <select value={tipoContratacao} onChange={e => setTipoContratacao(e.target.value as TipoContratacao)} className={`${INPUT_CLASS} cursor-pointer`}>
                <option value="direto">{CONTRATACAO_LABEL.direto}</option>
                <option value="mei">{CONTRATACAO_LABEL.mei}</option>
                <option value="empresa">{CONTRATACAO_LABEL.empresa}</option>
              </select>
            </div>
            {tipoContratacao === 'mei' && (
              <>
                <div>
                  <label className="block text-xs text-app-muted mb-1">CNPJ *</label>
                  <input value={cnpj} onChange={e => setCnpj(maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" className={erroClass(errors.cnpj)} />
                  {submitted && errors.cnpj && <p className="text-xs text-red-400 mt-0.5">Informe o CNPJ</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-app-muted mb-1">Razão social / nome fantasia</label>
                  <input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} className={INPUT_CLASS} />
                </div>
              </>
            )}
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
            <label className="block text-xs text-app-muted mb-1">Observações do cadastro</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className={INPUT_CLASS} />
          </div>

          {!pessoa && (
            <p className="text-xs text-app-subtle italic">O número do staff é gerado ao salvar. Os documentos são anexados em seguida, abrindo a ficha na lista.</p>
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
