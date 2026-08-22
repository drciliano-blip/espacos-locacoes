'use client'

import { useRef, useState } from 'react'
import { X, Save, Landmark, Paperclip, Camera } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { parseCurrencyBR } from '@/lib/utils'
import { saveFile } from '@/lib/file-storage'
import { DIVISAO_SOCIOS } from '@/lib/socios-config'
import type { ContaPagar } from '@/types'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

function parseValorBR(valor: string): string {
  const n = parseCurrencyBR(valor)
  return n > 0 ? String(n) : ''
}

// Mesma tolerância usada na leitura de comprovantes em Contas a Pagar —
// dia/mês sem zero à esquerda, ano com 2 dígitos ou separador "-".
function parseDataBR(data: string): string {
  const match = data.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (!match) return ''
  let [, dd, mm, yyyy] = match
  dd = dd.padStart(2, '0')
  mm = mm.padStart(2, '0')
  if (yyyy.length === 2) yyyy = `20${yyyy}`
  return `${yyyy}-${mm}-${dd}`
}

interface BoletoExtracao {
  valor?: string | null
  dataPagamento?: string | null
  vencimento?: string | null
}

interface Props {
  // Quando presente, o espaço vem travado nesse valor (seleção global do
  // Dashboard) — o campo aparece só como texto, não como select.
  espacoPadrao?: string
  onClose: () => void
  onSave: (c: ContaPagar) => Promise<void>
  onSaved: () => void
}

// Retirada de Sócio é uma movimentação societária, não despesa (ver
// isDespesaOperacional em ContasPagarContext) — cada retirada fica vinculada
// exatamente ao sócio que recebeu o dinheiro (campo `fornecedor`), nunca
// rateada automaticamente pelo percentual societário.
export default function NovaRetiradaSocioModal({ espacoPadrao, onClose, onSave, onSaved }: Props) {
  const { espacosNomes } = useEspacos()
  const [espaco, setEspaco] = useState(espacoPadrao ?? espacosNomes[0] ?? '')
  const [socio, setSocio] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])
  const [descricao, setDescricao] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [comprovante, setComprovante] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [extraindoIA, setExtraindoIA] = useState(false)
  const [avisoIA, setAvisoIA] = useState<string | null>(null)

  const sociosDoEspaco = espaco ? (DIVISAO_SOCIOS[espaco] ?? []).map(s => s.nome) : []

  // Lê Valor e Data direto do comprovante anexado — mesmo padrão de leitura
  // por IA já usado em Contas a Pagar. Só preenche o que a IA identificar com
  // segurança (nunca inventa); o que não vier, fica em branco pro usuário
  // preencher manualmente. Os dois campos continuam editáveis depois.
  async function handleComprovanteSelecionado(file: File | null) {
    setComprovante(file)
    setAvisoIA(null)
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    const isPdf = file.type === 'application/pdf' || ext === 'pdf'
    const isImage = file.type.startsWith('image/')
    if (!isPdf && !isImage) return

    setExtraindoIA(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/extract-boleto', { method: 'POST', body })
      const extraido: BoletoExtracao & { error?: string } = await res.json()
      if (!res.ok || extraido.error) {
        setAvisoIA('Não foi possível ler o comprovante automaticamente — preencha Data e Valor manualmente.')
        return
      }
      if (!extraido.valor && !extraido.dataPagamento) {
        setAvisoIA('A IA não identificou valor/data neste comprovante — preencha manualmente.')
        return
      }
      if (extraido.valor) setValor(v => parseValorBR(extraido.valor!) || v)
      // "dataPagamento" é a data real da retirada (comprovante de pagamento
      // já efetivado); "vencimento" só existiria num boleto a pagar, o que
      // não se aplica aqui — por isso não é usado como alternativa.
      if (extraido.dataPagamento) setData(d => parseDataBR(extraido.dataPagamento!) || d)
    } catch {
      setAvisoIA('Falha ao conectar com a IA — preencha Data e Valor manualmente.')
    } finally {
      setExtraindoIA(false)
    }
  }

  const errors = {
    espaco: !espaco,
    socio: !socio,
    valor: !valor || parseCurrencyBR(valor) <= 0,
    data: !data,
    descricao: !descricao.trim(),
  }
  const hasErrors = Object.values(errors).some(Boolean)

  async function handleSalvar() {
    setSubmitted(true)
    if (hasErrors) return
    setSaving(true)
    setErro(null)
    const id = crypto.randomUUID()
    try {
      await onSave({
        id,
        descricao: descricao.trim(),
        espaco: espaco as ContaPagar['espaco'],
        categoria: 'retirada_socio',
        subcategoria: 'outros',
        valor: parseCurrencyBR(valor),
        status: 'pago',
        dataVencimento: data,
        dataPagamento: data,
        fornecedor: socio,
        observacoes: observacoes.trim() || undefined,
        origemLancamento: 'retirada_manual',
      })
      if (comprovante) {
        try {
          await saveFile(comprovante, {
            module: 'contas',
            entityId: id,
            entityName: descricao.trim(),
            espaco,
            categoria: 'comprovante_retirada_socio',
          })
        } catch {
          setErro('Retirada registrada, mas não foi possível anexar o comprovante. Anexe depois pela lista.')
          return
        }
      }
      onSaved()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? `Falha ao registrar: ${err.message}` : 'Falha ao registrar a retirada. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-app-surface rounded-2xl border border-app-border shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <Landmark className="h-4 w-4 text-fuchsia-500" />
            Nova Retirada de Sócio
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Espaço<span className="text-red-400 ml-0.5">*</span></label>
              {espacoPadrao ? (
                <p className="w-full rounded-lg border border-app-border2 bg-app-surface3 px-2.5 py-1.5 text-sm text-app-text2">{espaco}</p>
              ) : (
                <select
                  value={espaco}
                  onChange={e => { setEspaco(e.target.value); setSocio('') }}
                  className={`w-full cursor-pointer rounded-lg border ${submitted && errors.espaco ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
                >
                  <option value="">— Selecione —</option>
                  {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Sócio<span className="text-red-400 ml-0.5">*</span></label>
              <select
                value={socio}
                onChange={e => setSocio(e.target.value)}
                disabled={!espaco}
                className={`w-full cursor-pointer rounded-lg border ${submitted && errors.socio ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none disabled:opacity-60 disabled:cursor-default`}
              >
                <option value="">{espaco ? '— Selecione —' : 'Selecione o espaço primeiro'}</option>
                {sociosDoEspaco.map(nome => <option key={nome} value={nome}>{nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Data<span className="text-red-400 ml-0.5">*</span></label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className={`w-full rounded-lg border ${submitted && errors.data ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Valor (R$)<span className="text-red-400 ml-0.5">*</span></label>
              <input
                type="text" inputMode="decimal"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0,00"
                className={`w-full rounded-lg border ${submitted && errors.valor ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Descrição<span className="text-red-400 ml-0.5">*</span></label>
            <input
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Retirada de lucro — Complexo Jussara"
              className={`w-full rounded-lg border ${submitted && errors.descricao ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
            />
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Observações</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Comprovante (opcional)</label>
            <p className="text-[11px] text-app-subtle mb-1.5">Ao anexar, a IA tenta ler Valor e Data direto do comprovante — os campos continuam editáveis.</p>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
              onChange={e => handleComprovanteSelecionado(e.target.files?.[0] ?? null)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleComprovanteSelecionado(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={extraindoIA}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60">
                <Paperclip className="h-3.5 w-3.5" />
                {comprovante ? comprovante.name : 'Selecionar arquivo…'}
              </button>
              <button type="button" onClick={() => cameraRef.current?.click()} disabled={extraindoIA}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60">
                <Camera className="h-3.5 w-3.5" />
                Tirar foto
              </button>
              {extraindoIA && <span className="text-xs text-app-subtle">Lendo comprovante…</span>}
            </div>
            {avisoIA && <p className="text-xs text-amber-600 mt-1.5">{avisoIA}</p>}
          </div>

          {erro && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">{erro}</p>
            </div>
          )}
          {submitted && hasErrors && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">Preencha todos os campos obrigatórios antes de salvar.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: GREEN }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = DARK_GREEN }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando…' : 'Registrar retirada'}
          </button>
        </div>
      </div>
    </div>
  )
}
