'use client'

// Monta o orçamento peça por peça: o operador escolhe tipo de evento,
// convidados, duração, comidas, bebidas e extras (tudo vem dos cadastros, que
// a equipe vai alimentando). A tabela de pacotes só SUGERE o preço — duração,
// cardápio e bebidas variam de evento para evento, então o valor final é sempre
// editável.

import { useMemo, useState } from 'react'
import { X, Save, Wand2 } from 'lucide-react'
import { formatCurrency, hojeISO, mensagemDeErro, parseCurrencyBR } from '@/lib/utils'
import { useEspacos } from '@/contexts/EspacosContext'
import {
  opcoesDaTabela, sugerirFaixa,
  type BuffetOpcao, type BuffetOrcamento, type BuffetTabela, type GrupoOpcao, type OrcamentoInput,
} from '@/lib/buffet'

const DARK_GREEN = '#128C7E'

function somarDias(iso: string, dias: number) {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(a, m - 1, d + dias)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

interface Form {
  clienteNome: string; clienteTelefone: string; clienteEmail: string; clienteDocumento: string
  tipoEvento: string; dataEvento: string; horarioInicio: string; duracaoHoras: string; local: string; convidados: string
  comidas: string[]; bebidas: string[]; extras: string[]
  tabelaId: string; opcaoPreco: string; valorFinal: string
  condicoesPagamento: string; validade: string; restricoes: string; observacoes: string
}

function formDe(o?: BuffetOrcamento): Form {
  return {
    clienteNome: o?.clienteNome ?? '', clienteTelefone: o?.clienteTelefone ?? '', clienteEmail: o?.clienteEmail ?? '', clienteDocumento: o?.clienteDocumento ?? '',
    tipoEvento: o?.tipoEvento ?? '', dataEvento: o?.dataEvento ?? '', horarioInicio: o?.horarioInicio ?? '',
    duracaoHoras: o?.duracaoHoras ? String(o.duracaoHoras).replace('.', ',') : '', local: o?.local ?? '', convidados: o?.convidados ? String(o.convidados) : '',
    comidas: o?.comidas ?? [], bebidas: o?.bebidas ?? [], extras: o?.extras ?? [],
    tabelaId: o?.tabelaId ?? '', opcaoPreco: o?.opcaoPreco ?? '',
    valorFinal: o?.valorFinal !== undefined ? formatCurrency(o.valorFinal).replace(/^R\$\s*/, '') : '',
    condicoesPagamento: o?.condicoesPagamento ?? '', validade: o?.validade ?? somarDias(hojeISO(), 7),
    restricoes: o?.restricoes ?? '', observacoes: o?.observacoes ?? '',
  }
}

const inputCls = 'w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none'

function Campo({ label, obrig, children, erro }: { label: string; obrig?: boolean; children: React.ReactNode; erro?: boolean }) {
  return (
    <div>
      <label className={`text-xs mb-0.5 block ${erro ? 'text-red-500' : 'text-app-subtle'}`}>{label}{obrig && <span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

export default function OrcamentoModal({ orcamento, titulo, opcoes, tabelas, onClose, onSalvar }: {
  orcamento?: BuffetOrcamento
  titulo?: string
  opcoes: BuffetOpcao[]
  tabelas: BuffetTabela[]
  onClose: () => void
  onSalvar: (input: OrcamentoInput) => Promise<void>
}) {
  const [f, setF] = useState<Form>(() => formDe(orcamento))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const { espacosNomes } = useEspacos()
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(x => ({ ...x, [k]: v }))

  // Opção desativada continua aparecendo se já estiver marcada neste orçamento.
  const ativas = (g: GrupoOpcao, marcados: string[] = []) => opcoes.filter(o => o.grupo === g && (o.ativo || marcados.includes(o.nome)))
  const tabelasAtivas = tabelas.filter(t => t.ativo || t.id === f.tabelaId)
  const tabela = tabelas.find(t => t.id === f.tabelaId)
  const convidadosNum = parseInt(f.convidados, 10) || undefined
  const faixa = useMemo(() => sugerirFaixa(tabela, f.opcaoPreco, convidadosNum), [tabela, f.opcaoPreco, convidadosNum])
  const maiorFaixa = tabela ? Math.max(0, ...tabela.faixas.filter(x => x.opcao === f.opcaoPreco).map(x => x.ateConvidados)) : 0
  const valorFinalNum = f.valorFinal ? parseCurrencyBR(f.valorFinal) : undefined
  const desconto = faixa && valorFinalNum !== undefined ? faixa.valor - valorFinalNum : 0

  const errors = {
    clienteNome: !f.clienteNome.trim(),
    convidados: !convidadosNum,
    valorFinal: valorFinalNum === undefined || valorFinalNum <= 0,
  }

  function alternar(campo: 'comidas' | 'bebidas' | 'extras', nome: string) {
    set(campo, f[campo].includes(nome) ? f[campo].filter(x => x !== nome) : [...f[campo], nome])
  }

  async function salvar() {
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) return
    setSaving(true)
    setErro(null)
    try {
      await onSalvar({
        status: orcamento?.status ?? 'rascunho',
        clienteNome: f.clienteNome.trim(), clienteTelefone: f.clienteTelefone.trim() || undefined,
        clienteEmail: f.clienteEmail.trim() || undefined, clienteDocumento: f.clienteDocumento.trim() || undefined,
        tipoEvento: f.tipoEvento || undefined, dataEvento: f.dataEvento || undefined, horarioInicio: f.horarioInicio || undefined,
        duracaoHoras: f.duracaoHoras ? parseCurrencyBR(f.duracaoHoras) : undefined, local: f.local.trim() || undefined,
        convidados: convidadosNum, comidas: f.comidas, bebidas: f.bebidas, extras: f.extras,
        tabelaId: f.tabelaId || undefined, opcaoPreco: f.opcaoPreco || undefined,
        valorTabela: faixa?.valor, valorFinal: valorFinalNum,
        condicoesPagamento: f.condicoesPagamento.trim() || undefined, validade: f.validade || undefined,
        restricoes: f.restricoes.trim() || undefined, observacoes: f.observacoes.trim() || undefined,
        motivoPerda: orcamento?.motivoPerda,
      })
      onClose()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível salvar o orçamento.'))
    } finally {
      setSaving(false)
    }
  }

  const checks = (grupo: GrupoOpcao, campo: 'comidas' | 'bebidas' | 'extras') => (
    <div className="flex flex-wrap gap-1.5">
      {ativas(grupo, f[campo]).length === 0 && <p className="text-xs text-app-subtle">Nada cadastrado ainda — cadastre em &quot;Cadastros&quot;.</p>}
      {ativas(grupo, f[campo]).map(o => {
        const on = f[campo].includes(o.nome)
        return (
          <button key={o.id} type="button" onClick={() => alternar(campo, o.nome)} title={o.descricao}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? 'border-[#25D366] bg-[#25D366]/15 text-[#128C7E] font-medium' : 'border-app-border2 text-app-muted hover:bg-app-surface2'}`}>
            {on ? '✓ ' : ''}{o.nome}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden" onClick={onClose}>
      <div className="w-full max-w-3xl bg-app-surface rounded-2xl border border-app-border shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <h2 className="text-sm font-semibold text-app-text">{titulo ?? (orcamento ? `Orçamento nº ${orcamento.numero}` : 'Novo orçamento')}</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-app-subtle">Cliente</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo label="Nome" obrig erro={submitted && errors.clienteNome}><input className={inputCls} value={f.clienteNome} onChange={e => set('clienteNome', e.target.value)} /></Campo>
              <Campo label="Telefone / WhatsApp"><input className={inputCls} value={f.clienteTelefone} onChange={e => set('clienteTelefone', e.target.value)} /></Campo>
              <Campo label="E-mail"><input className={inputCls} type="email" value={f.clienteEmail} onChange={e => set('clienteEmail', e.target.value)} /></Campo>
              <Campo label="CPF / CNPJ"><input className={inputCls} value={f.clienteDocumento} onChange={e => set('clienteDocumento', e.target.value)} /></Campo>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-app-subtle">Evento</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Campo label="Tipo de evento">
                <select className={`${inputCls} cursor-pointer`} value={f.tipoEvento} onChange={e => set('tipoEvento', e.target.value)}>
                  <option value="">— Selecione —</option>
                  {ativas('tipo_evento').map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                  {f.tipoEvento && !opcoes.some(o => o.grupo === 'tipo_evento' && o.nome === f.tipoEvento) && <option value={f.tipoEvento}>{f.tipoEvento}</option>}
                </select>
              </Campo>
              <Campo label="Convidados" obrig erro={submitted && errors.convidados}><input className={inputCls} inputMode="numeric" value={f.convidados} onChange={e => set('convidados', e.target.value.replace(/\D/g, ''))} /></Campo>
              <Campo label="Data do evento"><input className={inputCls} type="date" value={f.dataEvento} onChange={e => set('dataEvento', e.target.value)} /></Campo>
              <Campo label="Início"><input className={inputCls} type="time" value={f.horarioInicio} onChange={e => set('horarioInicio', e.target.value)} /></Campo>
              <Campo label="Duração (horas)"><input className={inputCls} inputMode="decimal" placeholder="ex.: 4 ou 4,5" value={f.duracaoHoras} onChange={e => set('duracaoHoras', e.target.value)} /></Campo>
              <Campo label="Local">
                <input className={inputCls} list="buffet-locais" placeholder="Espaço ou endereço" value={f.local} onChange={e => set('local', e.target.value)} />
                <datalist id="buffet-locais">{espacosNomes.map(n => <option key={n} value={n} />)}</datalist>
              </Campo>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-app-subtle">Cardápio e serviços</h3>
            <div><p className="text-xs text-app-subtle mb-1">Comidas</p>{checks('comida', 'comidas')}</div>
            <div><p className="text-xs text-app-subtle mb-1">Bebidas (à vontade durante a duração do evento)</p>{checks('bebida', 'bebidas')}</div>
            <div><p className="text-xs text-app-subtle mb-1">Extras e serviços</p>{checks('extra', 'extras')}</div>
            <Campo label="Restrições alimentares (vegano, sem glúten, alergias…)"><textarea rows={2} className={`${inputCls} resize-none`} value={f.restricoes} onChange={e => set('restricoes', e.target.value)} /></Campo>
          </section>

          <section className="space-y-2 rounded-xl border border-app-border2/60 bg-app-surface2/40 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-app-subtle">Preço</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Campo label="Tabela de referência">
                <select className={`${inputCls} cursor-pointer`} value={f.tabelaId} onChange={e => { set('tabelaId', e.target.value); set('opcaoPreco', '') }}>
                  <option value="">Sem tabela (preço livre)</option>
                  {tabelasAtivas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Opção da tabela">
                <select className={`${inputCls} cursor-pointer`} value={f.opcaoPreco} disabled={!tabela} onChange={e => set('opcaoPreco', e.target.value)}>
                  <option value="">— Selecione —</option>
                  {opcoesDaTabela(tabela).map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </Campo>
              <Campo label="Valor final (R$)" obrig erro={submitted && errors.valorFinal}>
                <input className={inputCls} inputMode="decimal" placeholder="0,00" value={f.valorFinal} onChange={e => set('valorFinal', e.target.value)} />
              </Campo>
            </div>
            {tabela && f.opcaoPreco && convidadosNum && (
              faixa ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-app-muted">Tabela {tabela.nome} · {f.opcaoPreco} · até {faixa.ateConvidados} convidados: <strong className="text-app-text">{formatCurrency(faixa.valor)}</strong></span>
                  <button type="button" onClick={() => set('valorFinal', formatCurrency(faixa.valor).replace(/^R\$\s*/, ''))}
                    className="inline-flex items-center gap-1 rounded-md border border-app-border2 px-2 py-0.5 font-medium hover:bg-app-surface2" style={{ color: DARK_GREEN }}>
                    <Wand2 className="h-3 w-3" /> Usar este valor
                  </button>
                </div>
              ) : (
                <p className="text-xs text-amber-600">A tabela {tabela.nome} vai até {maiorFaixa} convidados nessa opção — defina o valor manualmente.</p>
              )
            )}
            {faixa && valorFinalNum !== undefined && Math.abs(desconto) >= 0.01 && (
              <p className={`text-xs ${desconto > 0 ? 'text-amber-600' : 'text-app-muted'}`}>
                {desconto > 0
                  ? `Desconto de ${formatCurrency(desconto)} (${((desconto / faixa.valor) * 100).toFixed(1).replace('.', ',')}%) sobre a tabela.`
                  : `Acréscimo de ${formatCurrency(-desconto)} sobre a tabela (ex.: horas a mais, itens extras).`}
              </p>
            )}
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Campo label="Condições de pagamento"><textarea rows={2} className={`${inputCls} resize-none`} placeholder="ex.: 50% na assinatura, 50% até 7 dias antes do evento" value={f.condicoesPagamento} onChange={e => set('condicoesPagamento', e.target.value)} /></Campo>
            </div>
            <Campo label="Proposta válida até"><input className={inputCls} type="date" value={f.validade} onChange={e => set('validade', e.target.value)} /></Campo>
            <div className="sm:col-span-3">
              <Campo label="Observações (saem na proposta)"><textarea rows={2} className={`${inputCls} resize-none`} value={f.observacoes} onChange={e => set('observacoes', e.target.value)} /></Campo>
            </div>
          </section>

          {erro && <p className="text-sm text-red-500">{erro}</p>}
          {submitted && Object.values(errors).some(Boolean) && <p className="text-xs text-red-500">Preencha nome do cliente, convidados e valor final.</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-app-border sticky bottom-0 bg-app-surface">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1fb955] disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
