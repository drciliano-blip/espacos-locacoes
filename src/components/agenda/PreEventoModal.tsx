'use client'

import { useState } from 'react'
import { X, CalendarClock, AlertTriangle } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { useEventos } from '@/contexts/EventosContext'
import { formatDate, maskPhone, mensagemDeErro } from '@/lib/utils'
import type { Espaco, Evento } from '@/types'

const GREEN = '#25D366'

// Pré-evento: segura a data na Agenda só com nome e telefone do cliente, data
// e espaço (nome do evento opcional). Horário/valor ficam com valores neutros (as colunas são NOT NULL no
// banco) e são preenchidos de verdade no "Confirmar evento", que abre o
// formulário completo.
export default function PreEventoModal({ espacoPadrao, onClose, onSalvo }: {
  espacoPadrao?: string
  onClose: () => void
  onSalvo?: (msg: string) => void
}) {
  const { espacosNomes } = useEspacos()
  const { eventos, addEvento } = useEventos()
  const [cliente, setCliente] = useState('')
  const [telefone, setTelefone] = useState('')
  const [nomeEvento, setNomeEvento] = useState('')
  const [data, setData] = useState('')
  const [espaco, setEspaco] = useState(espacoPadrao ?? '')
  const [observacoes, setObservacoes] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const erros = { cliente: !cliente.trim(), telefone: telefone.replace(/\D/g, '').length < 10, data: !data, espaco: !espaco }
  const temErro = Object.values(erros).some(Boolean)

  // Só avisa — não impede: pode haver mais de um evento no mesmo dia/espaço.
  const ocupado = data && espaco ? eventos.filter(e => e.data === data && e.espaco === espaco && e.status !== 'cancelado') : []

  async function salvar() {
    setEnviado(true)
    if (temErro) return
    setSalvando(true)
    setErro(null)
    try {
      const evento: Evento = {
        id: crypto.randomUUID(),
        cliente: cliente.trim(),
        nomeEvento: nomeEvento.trim() || undefined,
        telefoneContato: telefone.trim(),
        espaco: espaco as Espaco,
        data,
        horaInicio: '00:00',
        horaFim: '00:00',
        tipo: 'Evento',
        status: 'em_negociacao',
        valor: 0,
        observacoes: observacoes.trim() || undefined,
      }
      await addEvento(evento)
      onSalvo?.(`Pré-evento de ${evento.cliente} em ${formatDate(data)} salvo.`)
      onClose()
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível salvar o pré-evento.'))
    } finally {
      setSalvando(false)
    }
  }

  const campo = (temErroCampo: boolean) =>
    `w-full rounded-lg border ${enviado && temErroCampo ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold text-app-text">Novo pré-evento</p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-app-muted">
            Segura a data enquanto o cliente decide. Quando fechar, abra o pré-evento na Agenda e clique em
            <span className="font-semibold"> Confirmar evento</span> para preencher o restante, gerar a ficha e o contrato.
          </p>
          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Nome do cliente<span className="text-red-400 ml-0.5">*</span></label>
            <input value={cliente} onChange={e => setCliente(e.target.value)} className={campo(erros.cliente)} autoFocus />
          </div>
          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Telefone do cliente<span className="text-red-400 ml-0.5">*</span></label>
            <input value={telefone} onChange={e => setTelefone(maskPhone(e.target.value))} inputMode="tel" placeholder="(11) 90000-0000" className={campo(erros.telefone)} />
          </div>
          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Nome do evento</label>
            <input value={nomeEvento} onChange={e => setNomeEvento(e.target.value)} className={campo(false)} placeholder="Opcional — ex.: Aniversário de 15 anos" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Data<span className="text-red-400 ml-0.5">*</span></label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className={campo(erros.data)} />
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Espaço<span className="text-red-400 ml-0.5">*</span></label>
              <select value={espaco} onChange={e => setEspaco(e.target.value)} className={campo(erros.espaco)}>
                <option value="">Selecione</option>
                {espacosNomes.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Observações</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className={campo(false)} />
          </div>
          {enviado && temErro && <p className="text-xs text-red-400">Preencha os campos marcados com * (telefone com DDD).</p>}
          {ocupado.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
              <p className="text-xs text-app-text">
                Já existe {ocupado.length === 1 ? 'um evento' : `${ocupado.length} eventos`} em {espaco} nesse dia:{' '}
                {ocupado.map(e => `${e.cliente}${e.status === 'em_negociacao' ? ' (pré-evento)' : ''}`).join(', ')}.
              </p>
            </div>
          )}
          {erro && <p className="text-xs text-red-400">{erro}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60" style={{ backgroundColor: GREEN }}>
            {salvando ? 'Salvando…' : 'Salvar pré-evento'}
          </button>
        </div>
      </div>
    </div>
  )
}
