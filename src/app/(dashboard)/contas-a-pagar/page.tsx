'use client'

import { useState, useMemo, useRef } from 'react'
import {
  Receipt, TrendingDown, CheckCircle2, AlertCircle, Clock,
  Filter, X, Plus, FolderOpen, Paperclip, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { formatCurrency } from '@/lib/utils'
import { saveFile } from '@/lib/file-storage'
import FileList from '@/components/shared/FileList'
import FileSearchModal from '@/components/shared/FileSearchModal'
import Toast from '@/components/shared/Toast'
import type { ContaPagar, CategoriaContaPagar, StatusContaPagar } from '@/types'

interface BoletoExtracao {
  vencimento: string | null
  valor: string | null
  fornecedor: string | null
  cnpj: string | null
}

function parseValorBR(valor: string): string {
  const numeric = valor.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3},)/g, '').replace(',', '.')
  const n = parseFloat(numeric)
  return Number.isFinite(n) ? String(n) : ''
}

function parseDataBR(data: string): string {
  const match = data.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return ''
  const [, dd, mm, yyyy] = match
  return `${yyyy}-${mm}-${dd}`
}

const GREEN = '#25D366'

const statusBadge: Record<StatusContaPagar, string> = {
  pago:      'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  pendente:  'bg-amber-500/10 text-amber-600 border-amber-500/20',
  atrasado:  'bg-red-500/10 text-red-600 border-red-500/20',
}
const statusLabel: Record<StatusContaPagar, string> = { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado' }

const SUB_FIXAS:    string[] = ['aluguel', 'energia', 'internet', 'funcionários']
const SUB_VARIAVEIS:string[] = ['manutenção', 'fornecedores', 'extras']
const subcategoriaLabel: Record<string, string> = {
  aluguel: 'Aluguel', energia: 'Energia', internet: 'Internet', funcionários: 'Funcionários',
  manutenção: 'Manutenção', fornecedores: 'Fornecedores', extras: 'Extras',
}
const subcategoriaBadge: Record<string, string> = {
  aluguel: 'bg-violet-500/10 text-violet-600', energia: 'bg-yellow-500/10 text-yellow-600',
  internet: 'bg-sky-500/10 text-sky-600', funcionários: 'bg-blue-500/10 text-blue-600',
  manutenção: 'bg-orange-500/10 text-orange-600', fornecedores: 'bg-teal-500/10 text-teal-600',
  extras: 'bg-zinc-500/10 text-zinc-600',
}

interface FormState {
  descricao: string
  valor: string
  dataVencimento: string
  categoria: CategoriaContaPagar | ''
  subcategoria: string
  espaco: string
  fornecedor: string
  observacoes: string
}

const FORM_EMPTY: FormState = {
  descricao: '', valor: '', dataVencimento: '', categoria: '', subcategoria: '',
  espaco: '', fornecedor: '', observacoes: '',
}

export default function ContasPagarPage() {
  const { espacosNomes } = useEspacos()
  const { contas, addConta } = useContasPagar()
  const [tab,               setTab]               = useState<'apagar' | 'pagas'>('apagar')
  const [filterEspaco,      setFilterEspaco]      = useState('')
  const [filterCategoria,   setFilterCategoria]   = useState<CategoriaContaPagar | ''>('')
  const [filterSubcategoria,setFilterSubcategoria]= useState('')
  const [filterMes,         setFilterMes]         = useState('')
  const [novaContaOpen,     setNovaContaOpen]     = useState(false)
  const [docModalOpen,      setDocModalOpen]      = useState(false)
  const [form,              setForm]              = useState<FormState>({ ...FORM_EMPTY, espaco: espacosNomes[0] ?? '' })
  const [saving,            setSaving]            = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [extraindoIA, setExtraindoIA] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  async function handleAnexoSelecionado(file: File | null) {
    setPendingFile(file)
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/') && ext !== 'pdf') return

    setExtraindoIA(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/extract-boleto', { method: 'POST', body })
      const data: BoletoExtracao & { error?: string } = await res.json()

      if (!res.ok || data.error) {
        showToast(data.error ?? 'Não foi possível ler o documento com a IA.')
        return
      }

      setForm(f => ({
        ...f,
        dataVencimento: data.vencimento ? parseDataBR(data.vencimento) || f.dataVencimento : f.dataVencimento,
        valor: data.valor ? parseValorBR(data.valor) || f.valor : f.valor,
        fornecedor: data.fornecedor ?? f.fornecedor,
      }))
      showToast('Campos preenchidos automaticamente pela IA')
    } catch {
      showToast('Falha ao conectar com a IA. Preencha os campos manualmente.')
    } finally {
      setExtraindoIA(false)
    }
  }

  const meses = [{ value: '2026-05', label: 'Maio 2026' }, { value: '2026-06', label: 'Junho 2026' }]
  const todasContas = contas

  const filtered = useMemo(() => todasContas.filter(c => {
    if (tab === 'apagar' && c.status === 'pago') return false
    if (tab === 'pagas'  && c.status !== 'pago') return false
    if (filterEspaco       && c.espaco       !== filterEspaco)       return false
    if (filterCategoria    && c.categoria    !== filterCategoria)    return false
    if (filterSubcategoria && c.subcategoria !== filterSubcategoria) return false
    if (filterMes          && !c.dataVencimento.startsWith(filterMes)) return false
    return true
  }), [todasContas, tab, filterEspaco, filterCategoria, filterSubcategoria, filterMes])

  const fixas    = filtered.filter(c => c.categoria === 'fixa')
  const variaveis= filtered.filter(c => c.categoria === 'variavel')

  const totalPago     = todasContas.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
  const totalPendente = todasContas.filter(c => c.status === 'pendente').reduce((s, c) => s + c.valor, 0)
  const totalAtrasado = todasContas.filter(c => c.status === 'atrasado').reduce((s, c) => s + c.valor, 0)
  const totalGeral    = todasContas.reduce((s, c) => s + c.valor, 0)

  const subcategorias = filterCategoria === 'fixa' ? SUB_FIXAS : filterCategoria === 'variavel' ? SUB_VARIAVEIS : [...SUB_FIXAS, ...SUB_VARIAVEIS]
  const hasFilters = filterEspaco || filterCategoria || filterSubcategoria || filterMes
  function clearFilters() { setFilterEspaco(''); setFilterCategoria(''); setFilterSubcategoria(''); setFilterMes('') }

  const subOpts = form.categoria === 'fixa' ? SUB_FIXAS : form.categoria === 'variavel' ? SUB_VARIAVEIS : []

  async function salvarNovaConta() {
    if (!form.descricao || !form.valor || !form.dataVencimento || !form.categoria || !form.subcategoria) return
    setSaving(true)
    const id = crypto.randomUUID()
    const nova: ContaPagar = {
      id,
      descricao:       form.descricao,
      espaco:          form.espaco as ContaPagar['espaco'],
      categoria:       form.categoria as CategoriaContaPagar,
      subcategoria:    form.subcategoria as ContaPagar['subcategoria'],
      valor:           parseFloat(form.valor.replace(',', '.')),
      status:          'pendente',
      dataVencimento:  form.dataVencimento,
      fornecedor:      form.fornecedor || undefined,
      observacoes:     form.observacoes || undefined,
    }
    if (pendingFile) {
      await saveFile(pendingFile, {
        module:     'contas',
        entityId:   id,
        entityName: form.descricao,
        espaco:     form.espaco,
      })
    }
    await addConta(nova)
    setForm({ ...FORM_EMPTY, espaco: espacosNomes[0] ?? '' })
    setPendingFile(null)
    setSaving(false)
    setNovaContaOpen(false)
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-app-border bg-app-surface p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingDown className="h-4 w-4 text-app-muted" /><span className="text-xs text-app-muted">Total Geral</span></div>
          <p className="text-xl font-bold text-app-text">{formatCurrency(totalGeral)}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-xs text-emerald-600">Pagas</span></div>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPago)}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-amber-500" /><span className="text-xs text-amber-600">Pendentes</span></div>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(totalPendente)}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-2"><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-xs text-red-600">Atrasadas</span></div>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalAtrasado)}</p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setNovaContaOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
          style={{ backgroundColor: GREEN }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#128C7E' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
        >
          <Plus className="h-4 w-4" />
          Nova Conta
        </button>
        <button
          onClick={() => setDocModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-4 py-2 text-sm font-medium text-app-text hover:bg-app-surface2 transition-colors"
        >
          <FolderOpen className="h-4 w-4 text-[#25D366]" />
          Ver documentos
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-app-border bg-app-surface">
        {/* Tabs */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0 border-b border-app-border">
          <div className="flex gap-1">
            {(['apagar', 'pagas'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? 'border-[#25D366] text-[#128C7E]' : 'border-transparent text-app-muted hover:text-app-text'
                }`}
              >
                <span className="flex items-center gap-2">
                  {t === 'apagar' ? <Receipt className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {t === 'apagar' ? 'Contas a Pagar' : 'Contas Pagas'}
                  <span className={`rounded-full text-xs px-1.5 py-0.5 ${t === 'apagar' ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'}`}>
                    {t === 'apagar' ? todasContas.filter(c => c.status !== 'pago').length : todasContas.filter(c => c.status === 'pago').length}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-app-border bg-app-surface2/30">
          <Filter className="h-3.5 w-3.5 text-app-subtle shrink-0" />
          {[
            { value: filterEspaco, onChange: (v: string) => setFilterEspaco(v), options: [['', 'Todos os espaços'], ['Todos', 'Geral (Todos)'], ...espacosNomes.map(e => [e, e])] },
            { value: filterCategoria, onChange: (v: string) => { setFilterCategoria(v as CategoriaContaPagar | ''); setFilterSubcategoria('') }, options: [['', 'Todas as categorias'], ['fixa', 'Despesas Fixas'], ['variavel', 'Despesas Variáveis']] },
            { value: filterSubcategoria, onChange: (v: string) => setFilterSubcategoria(v), options: [['', 'Todas subcategorias'], ...subcategorias.map(s => [s, subcategoriaLabel[s]])] },
            { value: filterMes, onChange: (v: string) => setFilterMes(v), options: [['', 'Todos os meses'], ...meses.map(m => [m.value, m.label])] },
          ].map((sel, i) => (
            <select key={i} value={sel.value} onChange={e => sel.onChange(e.target.value)}
              className="cursor-pointer rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:outline-none"
              onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
              onBlur={e => { e.currentTarget.style.borderColor = '' }}
            >
              {(sel.options as [string, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-app-muted hover:text-red-500 transition-colors ml-auto">
              <X className="h-3.5 w-3.5" />Limpar
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="p-5 space-y-6">
          {[{ label: 'Despesas Fixas', rows: fixas }, { label: 'Despesas Variáveis', rows: variaveis }].map(({ label, rows }) =>
            rows.length > 0 && (
              <section key={label}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-app-subtle">{label}</h3>
                  <span className="text-xs text-app-subtle">— {formatCurrency(rows.reduce((s, c) => s + c.valor, 0))}</span>
                </div>
                <div className="space-y-2">
                  {rows.map(conta => <ContaRow key={conta.id} conta={conta} />)}
                </div>
              </section>
            )
          )}

          {fixas.length === 0 && variaveis.length === 0 && (
            <p className="text-sm text-app-subtle text-center py-8">Nenhuma conta encontrada.</p>
          )}

          {filtered.length > 0 && (
            <div className="flex justify-between items-center pt-3 border-t border-app-border">
              <span className="text-xs text-app-muted">{filtered.length} contas</span>
              <span className="text-sm font-bold text-app-text">Total: {formatCurrency(filtered.reduce((s, c) => s + c.valor, 0))}</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nova Conta */}
      {novaContaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setNovaContaOpen(false)}>
          <div className="w-full max-w-lg bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
              <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#25D366]" />
                Nova Conta a Pagar
              </h2>
              <button onClick={() => setNovaContaOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-app-muted mb-1">Descrição *</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Aluguel Usine — Jul/2026"
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-app-muted mb-1">Valor (R$) *</label>
                  <input type="number" min="0" step="0.01" value={form.valor}
                    onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                    onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                    onBlur={e => { e.currentTarget.style.borderColor = '' }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-app-muted mb-1">Vencimento *</label>
                  <input type="date" value={form.dataVencimento}
                    onChange={e => setForm(f => ({ ...f, dataVencimento: e.target.value }))}
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                    onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                    onBlur={e => { e.currentTarget.style.borderColor = '' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-app-muted mb-1">Tipo de despesa *</label>
                  <select value={form.categoria}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value as CategoriaContaPagar | '', subcategoria: '' }))}
                    className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                    onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                    onBlur={e => { e.currentTarget.style.borderColor = '' }}
                  >
                    <option value="">Selecionar…</option>
                    <option value="fixa">Despesa Fixa</option>
                    <option value="variavel">Despesa Variável</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-app-muted mb-1">Subcategoria *</label>
                  <select value={form.subcategoria}
                    onChange={e => setForm(f => ({ ...f, subcategoria: e.target.value }))}
                    disabled={!form.categoria}
                    className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none disabled:opacity-50"
                    onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                    onBlur={e => { e.currentTarget.style.borderColor = '' }}
                  >
                    <option value="">Selecionar…</option>
                    {subOpts.map(s => <option key={s} value={s}>{subcategoriaLabel[s]}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-app-muted mb-1">Espaço vinculado *</label>
                  <select value={form.espaco} onChange={e => setForm(f => ({ ...f, espaco: e.target.value }))}
                    className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                    onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                    onBlur={e => { e.currentTarget.style.borderColor = '' }}
                  >
                    <option value="Todos">Todos (Geral)</option>
                    {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-app-muted mb-1">Fornecedor</label>
                  <input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))}
                    placeholder="Nome do fornecedor"
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                    onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                    onBlur={e => { e.currentTarget.style.borderColor = '' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-app-muted mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  rows={2} placeholder="Observações adicionais…"
                  className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                />
              </div>

              {/* Anexo */}
              <div>
                <label className="block text-xs text-app-muted mb-1">Documento (opcional)</label>
                <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.doc,.docx" className="hidden"
                  onChange={e => handleAnexoSelecionado(e.target.files?.[0] ?? null)} />
                <div className="flex items-center gap-2">
                  <button onClick={() => fileRef.current?.click()} disabled={extraindoIA}
                    className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60">
                    <Paperclip className="h-3.5 w-3.5" />
                    {pendingFile ? pendingFile.name : 'Selecionar arquivo…'}
                  </button>
                  {pendingFile && !extraindoIA && (
                    <button onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = '' }}
                      className="text-xs text-red-500 hover:underline">remover</button>
                  )}
                  {extraindoIA && (
                    <span className="flex items-center gap-1.5 text-xs text-[#128C7E]">
                      <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                      Analisando com IA…
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
              <button onClick={() => { setNovaContaOpen(false); setForm({ ...FORM_EMPTY, espaco: espacosNomes[0] ?? '' }); setPendingFile(null) }}
                className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
                Cancelar
              </button>
              <button onClick={salvarNovaConta} disabled={saving || !form.descricao || !form.valor || !form.dataVencimento || !form.categoria || !form.subcategoria}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                style={{ backgroundColor: GREEN }}>
                {saving ? 'Salvando…' : 'Salvar conta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {docModalOpen && <FileSearchModal onClose={() => setDocModalOpen(false)} defaultModule="contas" />}
      <Toast message={toastMsg} />
    </div>
  )
}

function ContaRow({ conta }: { conta: ContaPagar }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-app-border2/50 bg-app-surface2/40 overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-app-text truncate">{conta.descricao}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${subcategoriaBadge[conta.subcategoria]}`}>
              {subcategoriaLabel[conta.subcategoria]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-app-subtle">{conta.espaco}</span>
            {conta.fornecedor && <span className="text-xs text-app-subtle">· {conta.fornecedor}</span>}
            <span className="text-xs text-app-subtle">· Venc. {conta.dataVencimento.split('-').reverse().join('/')}</span>
            {conta.dataPagamento && <span className="text-xs text-emerald-600">· Pago {conta.dataPagamento.split('-').reverse().join('/')}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge[conta.status]}`}>
            {statusLabel[conta.status]}
          </span>
          <span className="text-sm font-bold text-app-text w-24 text-right">{formatCurrency(conta.valor)}</span>
          <button onClick={() => setExpanded(v => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 transition-colors"
            title="Documentos">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-app-border/50 space-y-2">
          <p className="text-xs font-medium text-app-muted flex items-center gap-1.5">
            <Paperclip className="h-3 w-3" />
            Documentos anexados
          </p>
          <FileList
            module="contas"
            entityId={conta.id}
            entityName={conta.descricao}
            espaco={conta.espaco === 'Todos' ? undefined : conta.espaco}
            compact
          />
        </div>
      )}
    </div>
  )
}
