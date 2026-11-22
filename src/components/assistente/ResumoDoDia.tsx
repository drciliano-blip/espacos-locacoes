'use client'

// Resumo do assistente (etapas 4 e 5 do plano): o que o assistente escreve
// sozinho todo dia às 8h (e às segundas, sextas e no dia 1º), separado em
// partes. Cada pessoa escolhe em "Personalizar" o que quer ver, de acordo com a
// função dela; a escolha fica salva na conta (assistente_preferencias) ou, sem
// a tabela, neste aparelho. As recomendações têm "Pedir ao assistente", que
// abre o chat já com o pedido. O administrador pode "Gerar agora".

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Loader2, RefreshCw, Sparkles, SlidersHorizontal, Lightbulb, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/contexts/UserContext'
import { canAccess } from '@/lib/auth'
import { pedirAoAssistente } from '@/lib/assistente/pedir'

interface Secao { chave: string; titulo: string; itens: string[] }
interface Recomendacao { texto: string; motivo: string; pedido_ao_assistente: string }
interface Rotina { id: string; tipo: string; data: string; titulo: string; texto: string; created_at: string; secoes: Secao[] | null; recomendacoes: Recomendacao[] | null }

const ORDEM = ['manha', 'fechamento', 'semanal', 'vendas']
const GESTAO = ['admin', 'financeiro']

// O que cada função pode escolher ver (rótulo e para quem a opção existe).
const OPCOES: { chave: string; rotulo: string; so?: string[] }[] = [
  { chave: 'recomendacoes', rotulo: 'Recomendações do assistente' },
  { chave: 'para_hoje', rotulo: 'Para fazer hoje' },
  { chave: 'hoje', rotulo: 'Eventos de hoje' },
  { chave: 'proximos', rotulo: 'Próximos 7 dias' },
  { chave: 'conferir', rotulo: 'Conferir lançamentos (erros e duplicados)', so: GESTAO },
  { chave: 'eventos_financeiro', rotulo: 'Eventos com financeiro incompleto', so: GESTAO },
  { chave: 'a_receber', rotulo: 'A receber na semana', so: GESTAO },
  { chave: 'atrasos', rotulo: 'Em atraso', so: GESTAO },
  { chave: 'orcamentos', rotulo: 'Orçamentos sem resposta' },
  { chave: 'pre_eventos', rotulo: 'Pré-eventos' },
  { chave: 'sabados', rotulo: 'Sábados livres' },
  { chave: 'rotina:semanal', rotulo: 'Conferência da semana (segunda)', so: GESTAO },
  { chave: 'rotina:vendas', rotulo: 'Vendas da semana (sexta)', so: GESTAO },
  { chave: 'rotina:fechamento', rotulo: 'Pré-fechamento do mês (dia 1º)', so: GESTAO },
]
const CHAVE_LOCAL = 'assistente-resumo-ocultas'

export default function ResumoDoDia({ compacto }: { compacto?: boolean }) {
  const { role } = useCurrentUser()
  const [rotinas, setRotinas] = useState<Rotina[]>([])
  const [semTabela, setSemTabela] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocultas, setOcultas] = useState<string[]>([])
  const [prefNoBanco, setPrefNoBanco] = useState(true)
  const [personalizando, setPersonalizando] = useState(false)
  const opcoes = useMemo(() => OPCOES.filter(o => !o.so || o.so.includes(role)), [role])

  const carregar = useCallback(async () => {
    const sb = createClient()
    const desde = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
    const [{ data, error }, pref] = await Promise.all([
      sb.from('assistente_rotinas').select('id, tipo, data, titulo, texto, created_at, secoes:dados->secoes, recomendacoes:dados->recomendacoes').gte('data', desde).order('data', { ascending: false }),
      sb.from('assistente_preferencias').select('ocultas').maybeSingle(),
    ])
    if (pref.error) {
      setPrefNoBanco(false)
      try { setOcultas(JSON.parse(localStorage.getItem(CHAVE_LOCAL) ?? '[]')) } catch { /* sem armazenamento */ }
    } else setOcultas((pref.data?.ocultas as string[] | undefined) ?? [])
    if (error) { setSemTabela(error.code === '42P01' || error.code === 'PGRST205'); return }
    // O mais recente de cada tipo (o da manhã só se for de hoje ou de ontem).
    const ontem = new Date(Date.now() - 864e5 - 3 * 36e5).toISOString().slice(0, 10)
    const porTipo = new Map<string, Rotina>()
    for (const r of (data ?? []) as unknown as Rotina[]) if (!porTipo.has(r.tipo) && (r.tipo !== 'manha' || r.data >= ontem)) porTipo.set(r.tipo, r)
    const lista = [...porTipo.values()].sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo))
    setRotinas(lista)
    setAberto(a => a ?? (compacto ? null : lista[0]?.id ?? null))
  }, [compacto])

  useEffect(() => { queueMicrotask(() => { void carregar() }) }, [carregar])

  async function salvarOcultas(novas: string[]) {
    setOcultas(novas)
    // Guarda também neste aparelho: vale mesmo se a conta não salvar.
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(novas)) } catch { /* sem armazenamento */ }
    if (!prefNoBanco) return
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    const { error } = session?.user
      ? await sb.from('assistente_preferencias').upsert({ usuario_id: session.user.id, ocultas: novas, updated_at: new Date().toISOString() })
      : { error: true }
    if (error) setErro('Não consegui salvar a escolha na sua conta; ela vale só neste aparelho.')
  }

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
  const visiveis = rotinas.filter(r => r.tipo === 'manha' || !ocultas.includes(`rotina:${r.tipo}`))
  if (visiveis.length === 0 && role !== 'admin' && !personalizando) return null
  const podePedir = canAccess(role, 'assistente')
  const verRecomendacoes = !ocultas.includes('recomendacoes')

  return (
    <section className="print:hidden rounded-xl border border-[#9A7937]/30 bg-app-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-app-text"><Sparkles className="h-4 w-4 text-[#9A7937]" /> Resumo do assistente</p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setPersonalizando(p => !p)} aria-label="Personalizar o resumo" title="Personalizar o resumo" className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-app-border2 px-2 py-1 text-xs text-app-text">
            <SlidersHorizontal className="h-3.5 w-3.5" /><span className="hidden sm:inline">Personalizar</span>
          </button>
          {role === 'admin' && (
            <button type="button" onClick={gerarAgora} disabled={gerando} aria-label="Gerar o resumo agora" title="Gerar o resumo agora" className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-app-border2 px-2 py-1 text-xs text-app-text disabled:opacity-50">
              {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}<span className="hidden sm:inline">Gerar agora</span>
            </button>
          )}
        </div>
      </div>

      {personalizando && (
        <div className="mt-2 rounded-lg border border-app-border2 p-3">
          <p className="mb-2 text-xs text-app-muted">Marque o que você quer ver no resumo. A escolha é só sua{prefNoBanco ? ' e vale em qualquer aparelho' : ' e vale neste aparelho'}.</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {opcoes.map(o => (
              <label key={o.chave} className="flex items-center gap-2 text-sm text-app-text">
                <input type="checkbox" className="h-4 w-4" checked={!ocultas.includes(o.chave)}
                  onChange={e => salvarOcultas(e.target.checked ? ocultas.filter(x => x !== o.chave) : [...ocultas, o.chave])} />
                {o.rotulo}
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setPersonalizando(false)} className="mt-2 rounded-lg bg-[#072A43] px-3 py-1.5 text-xs font-semibold text-white">Pronto</button>
        </div>
      )}

      {visiveis.length === 0 && <p className="mt-2 text-xs text-app-muted">Ainda não há resumo. Ele chega todo dia às 8h; o administrador pode tocar em &quot;Gerar agora&quot;.</p>}
      <div className="mt-2 space-y-1.5">
        {visiveis.map(r => {
          const secoes = (r.secoes ?? []).filter(s => r.tipo !== 'manha' || !ocultas.includes(s.chave))
          const recs = verRecomendacoes ? r.recomendacoes ?? [] : []
          return (
            <div key={r.id} className="rounded-lg border border-app-border2">
              <button type="button" onClick={() => setAberto(a => (a === r.id ? null : r.id))} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-app-text">
                <span>{r.titulo}{aberto !== r.id && verRecomendacoes && (r.recomendacoes?.length ?? 0) > 0 && <span className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-[#9A7937]/15 px-2 py-0.5 text-[11px] font-semibold text-[#7a5f2a]">{r.recomendacoes!.length} recomendaç{r.recomendacoes!.length > 1 ? 'ões' : 'ão'}</span>}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-app-muted transition-transform ${aberto === r.id ? 'rotate-180' : ''}`} />
              </button>
              {aberto === r.id && (
                <div className="space-y-3 border-t border-app-border2 px-3 py-2">
                  {recs.length > 0 && (
                    <div className="rounded-lg border border-[#9A7937]/30 bg-[#9A7937]/5 p-2.5">
                      <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-app-text"><Lightbulb className="h-3.5 w-3.5 text-[#9A7937]" /> Recomendações</p>
                      <ul className="space-y-2">
                        {recs.map((x, i) => (
                          <li key={i} className="text-sm text-app-text">
                            <p className="font-medium">{x.texto}</p>
                            <p className="text-xs text-app-muted">{x.motivo}</p>
                            {podePedir && x.pedido_ao_assistente && (
                              <button type="button" onClick={() => pedirAoAssistente(x.pedido_ao_assistente)} className="mt-1 inline-flex items-center gap-1 rounded-lg bg-[#072A43] px-2.5 py-1 text-xs font-semibold text-white">
                                <Send className="h-3 w-3" /> Pedir ao assistente
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {secoes.length > 0
                    ? secoes.map(s => (
                      <div key={s.chave}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-app-muted">{s.titulo}</p>
                        <ul className="mt-1 space-y-0.5">
                          {s.itens.map((t, i) => <li key={i} className="text-sm text-app-text [overflow-wrap:anywhere]">• {t}</li>)}
                        </ul>
                      </div>
                    ))
                    : !r.secoes && <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-app-text">{r.texto}</p>}
                  {r.secoes && secoes.length === 0 && recs.length === 0 && <p className="text-xs text-app-muted">Nada nas partes que você escolheu ver.</p>}
                  <p className="text-[11px] text-app-muted">Escrito pelo assistente em {new Date(r.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Confira os números nas telas antes de agir.</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
    </section>
  )
}
