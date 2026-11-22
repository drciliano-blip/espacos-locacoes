'use client'

// Etapa 4: resumos que o assistente escreve sozinho (todo dia às 8h; às
// segundas, a conferência de lançamentos; no dia 1º, o pré-fechamento).
// Cada pessoa vê só os do seu perfil (o banco filtra). O administrador pode
// pedir "Gerar agora".

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/contexts/UserContext'

interface Rotina { id: string; tipo: string; data: string; titulo: string; texto: string; created_at: string }

const ORDEM = ['manha', 'fechamento', 'semanal']

export default function ResumoDoDia({ compacto }: { compacto?: boolean }) {
  const { role } = useCurrentUser()
  const [rotinas, setRotinas] = useState<Rotina[]>([])
  const [semTabela, setSemTabela] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const sb = createClient()
    const desde = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
    const { data, error } = await sb.from('assistente_rotinas').select('id, tipo, data, titulo, texto, created_at').gte('data', desde).order('data', { ascending: false })
    if (error) { setSemTabela(error.code === '42P01' || error.code === 'PGRST205'); return }
    // O mais recente de cada tipo (o da manhã só se for de hoje ou de ontem).
    const ontem = new Date(Date.now() - 864e5 - 3 * 36e5).toISOString().slice(0, 10)
    const porTipo = new Map<string, Rotina>()
    for (const r of (data ?? []) as Rotina[]) if (!porTipo.has(r.tipo) && (r.tipo !== 'manha' || r.data >= ontem)) porTipo.set(r.tipo, r)
    const lista = [...porTipo.values()].sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo))
    setRotinas(lista)
    setAberto(a => a ?? (compacto ? null : lista[0]?.id ?? null))
  }, [compacto])

  useEffect(() => { queueMicrotask(() => { void carregar() }) }, [carregar])

  async function gerarAgora() {
    if (!window.confirm('Gerar agora as rotinas de hoje? Leva cerca de 1 minuto.')) return
    setGerando(true); setErro(null)
    try {
      const res = await fetch('/api/assistente/rotinas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const j = await res.json().catch(() => ({ error: `O servidor respondeu ${res.status}.` }))
      if (!res.ok || j.error) throw new Error(j.error ?? 'Falha ao gerar.')
      setAberto(null)
      await carregar()
    } catch (e) {
      setErro(e instanceof TypeError ? 'A conexão caiu, mas o resumo pode ter sido gerado: atualize a página em 1 minuto.' : e instanceof Error ? e.message : 'Falha ao gerar.')
    } finally {
      setGerando(false)
    }
  }

  if (semTabela) {
    return role === 'admin'
      ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">Os resumos automáticos do assistente ainda não foram ativados no banco (migration 0053).</p>
      : null
  }
  if (rotinas.length === 0 && role !== 'admin') return null

  return (
    <section className="print:hidden rounded-xl border border-[#9A7937]/30 bg-app-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-app-text"><Sparkles className="h-4 w-4 text-[#9A7937]" /> Resumo do assistente</p>
        {role === 'admin' && (
          <button type="button" onClick={gerarAgora} disabled={gerando} className="inline-flex items-center gap-1 rounded-lg border border-app-border2 px-2 py-1 text-xs text-app-text disabled:opacity-50">
            {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Gerar agora
          </button>
        )}
      </div>
      {rotinas.length === 0 && <p className="mt-2 text-xs text-app-muted">Ainda não há resumo. Ele chega todo dia às 8h; o administrador pode tocar em &quot;Gerar agora&quot;.</p>}
      <div className="mt-2 space-y-1.5">
        {rotinas.map(r => (
          <div key={r.id} className="rounded-lg border border-app-border2">
            <button type="button" onClick={() => setAberto(a => (a === r.id ? null : r.id))} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-app-text">
              <span>{r.titulo}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-app-muted transition-transform ${aberto === r.id ? 'rotate-180' : ''}`} />
            </button>
            {aberto === r.id && (
              <div className="border-t border-app-border2 px-3 py-2">
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-app-text">{r.texto}</p>
                <p className="mt-2 text-[11px] text-app-muted">Escrito pelo assistente em {new Date(r.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Confira os números nas telas antes de agir.</p>
              </div>
            )}
          </div>
        ))}
      </div>
      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
    </section>
  )
}
