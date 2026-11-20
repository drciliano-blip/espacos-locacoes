'use client'

// Peças comuns dos formulários públicos (/orcamento e /anuncie), feitos para
// serem embutidos no WordPress por <iframe>. Visual claro fixo (o site é
// claro) e altura avisada à página de fora, para o iframe crescer junto com o
// formulário em vez de abrir uma barra de rolagem dentro do site.

import { useEffect, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'

export const GREEN = '#25D366'

// Avisa a página que embute (WordPress) a altura do conteúdo. O snippet de
// embutir (aba Pedidos → "Como embutir no site") escuta 'el-altura'.
export function useAlturaParaIframe() {
  useEffect(() => {
    if (window.parent === window) return
    const enviar = () => window.parent.postMessage(
      { tipo: 'el-altura', pagina: window.location.pathname, altura: document.documentElement.scrollHeight },
      '*',
    )
    enviar()
    const obs = new ResizeObserver(enviar)
    obs.observe(document.body)
    return () => obs.disconnect()
  }, [])
}

// De onde veio o visitante: ?origem=... na URL do iframe, e a página do
// WordPress que embutiu (referrer). Vai junto no registro.
export function lerOrigem(): { origem: string; paginaOrigem: string | null; params: URLSearchParams } {
  const params = new URLSearchParams(window.location.search)
  const origemParam = params.get('origem') ?? 'site'
  const origem = ['site', 'whatsapp', 'indicacao', 'instagram', 'outro'].includes(origemParam) ? origemParam : 'site'
  return { origem, paginaOrigem: document.referrer || null, params }
}

export function Pagina({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F0F2F5] py-6 px-4 text-stone-900">
      <div className="max-w-2xl mx-auto">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Espaços &amp; Locações</p>
          <h1 className="text-xl font-bold mt-1">{titulo}</h1>
          <p className="text-sm text-stone-600 mt-1">{subtitulo}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm p-5 sm:p-6 space-y-5">{children}</div>
      </div>
    </div>
  )
}

export function Enviado({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="min-h-[60vh] bg-[#F0F2F5] flex items-center justify-center p-4 text-stone-900">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366]/15 mx-auto mb-4">
          <CheckCircle2 className="h-7 w-7" style={{ color: GREEN }} />
        </div>
        <h1 className="text-lg font-bold mb-2">{titulo}</h1>
        <p className="text-sm text-stone-600">{texto}</p>
      </div>
    </div>
  )
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-stone-800">{titulo}</h2>
      {children}
    </div>
  )
}

export function Campo({ label, required, erro, children }: { label: string; required?: boolean; erro?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-stone-600 mb-1 block">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {erro && <span className="text-[11px] text-red-500 mt-0.5 block">Preencha este campo.</span>}
    </label>
  )
}

export const inputCls = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40'

export function Opcoes({ opcoes, valores, onChange }: { opcoes: { valor: string; label: string }[]; valores: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map(o => {
        const ativo = valores.includes(o.valor)
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => onChange(ativo ? valores.filter(v => v !== o.valor) : [...valores, o.valor])}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${ativo ? 'border-[#25D366] bg-[#25D366]/10 text-[#128C7E] font-medium' : 'border-stone-300 text-stone-600 hover:bg-stone-50'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function BotaoEnviar({ enviando, label }: { enviando: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={enviando}
      className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 transition-colors"
      style={{ backgroundColor: GREEN }}
    >
      {enviando ? 'Enviando…' : label}
    </button>
  )
}

// Campo escondido contra robôs: pessoa não vê nem preenche; robô preenche e
// o envio é descartado em silêncio (a tela mostra "enviado" do mesmo jeito).
export function IscaRobo({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      name="empresa_site"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      value={valor}
      onChange={e => onChange(e.target.value)}
      className="absolute left-[-9999px] h-0 w-0 opacity-0"
    />
  )
}
