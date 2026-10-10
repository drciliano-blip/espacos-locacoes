'use client'

import { useState } from 'react'
import { Trash2, MessageSquarePlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensagemDeErro } from '@/lib/utils'
import type { AnotacaoCredenciamento } from '@/types'
import { anotacoesFromRows, GREEN, INPUT_CLASS, type AnotacaoRow } from './dados'

interface Props {
  // A anotação é de uma pessoa ou de uma empresa — a coluna diz de qual.
  dono: { coluna: 'terceirizado_id' | 'empresa_id'; id: string }
  anotacoes: AnotacaoCredenciamento[]
  onChange: (anotacoes: AnotacaoCredenciamento[]) => void
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AnotacoesCredenciamento({ dono, anotacoes, onChange }: Props) {
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleAdicionar() {
    if (!texto.trim()) return
    setErro(null)
    setBusy(true)
    const supabase = createClient()
    // Autor e data são preenchidos pelo banco.
    const { data, error } = await supabase
      .from('credenciamento_anotacoes')
      .insert({ [dono.coluna]: dono.id, texto: texto.trim() })
      .select()
      .single()
    setBusy(false)
    if (error) return setErro(mensagemDeErro(error, 'Não foi possível salvar a anotação.'))
    onChange([...anotacoesFromRows([data as AnotacaoRow]), ...anotacoes])
    setTexto('')
  }

  async function handleRemover(anotacao: AnotacaoCredenciamento) {
    if (!window.confirm('Remover esta anotação do histórico?')) return
    setErro(null)
    const supabase = createClient()
    const { error } = await supabase.from('credenciamento_anotacoes').delete().eq('id', anotacao.id)
    if (error) return setErro(mensagemDeErro(error, 'Não foi possível remover a anotação.'))
    onChange(anotacoes.filter(a => a.id !== anotacao.id))
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-app-border2/50 bg-app-surface p-3 space-y-2">
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2}
          placeholder="Ex: Chegou atrasado no evento de 12/10. / Equipe elogiada pelo cliente."
          className={INPUT_CLASS} />
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <div className="flex justify-end">
          <button onClick={handleAdicionar} disabled={busy || !texto.trim()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: GREEN }}>
            <MessageSquarePlus className="h-3.5 w-3.5" />
            {busy ? 'Salvando…' : 'Adicionar anotação'}
          </button>
        </div>
      </div>

      {anotacoes.length === 0 ? (
        <p className="text-xs text-app-subtle">Nenhuma anotação no histórico.</p>
      ) : (
        <div className="space-y-1.5">
          {anotacoes.map(a => (
            <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-app-border2/50 bg-app-surface px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-app-text whitespace-pre-wrap break-words">{a.texto}</p>
                <p className="text-[11px] text-app-subtle mt-1">{dataHora(a.criadoEm)}{a.autorNome && ` · ${a.autorNome}`}</p>
              </div>
              <button onClick={() => handleRemover(a)} title="Remover anotação"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-400 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
