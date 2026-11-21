'use client'

// Comando por voz do Assistente de IA: usa o reconhecimento de fala do próprio
// navegador (Chrome, Edge, Android e Safari recentes), em português. Enquanto
// a pessoa fala, o texto aparece na caixa; ao terminar, envia sozinho.
// Navegador sem suporte: avisa e sugere o microfone do teclado do celular.

import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'

// Tipos mínimos da Web Speech API (não vêm no TypeScript padrão).
interface ResultadoFala { isFinal: boolean; 0: { transcript: string } }
interface EventoFala { resultIndex: number; results: ArrayLike<ResultadoFala> }
interface Reconhecedor {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: EventoFala) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void; abort: () => void
}
type ConstrutorReconhecedor = new () => Reconhecedor

function construtor(): ConstrutorReconhecedor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: ConstrutorReconhecedor; webkitSpeechRecognition?: ConstrutorReconhecedor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const ERROS: Record<string, string> = {
  'not-allowed': 'O navegador bloqueou o microfone. Libere o acesso ao microfone para este site e tente de novo.',
  'service-not-allowed': 'O navegador bloqueou o reconhecimento de voz. Use o microfone do teclado do celular.',
  'no-speech': 'Não ouvi nada. Toque no microfone e fale de novo.',
  'audio-capture': 'Não encontrei microfone neste aparelho.',
  network: 'O reconhecimento de voz precisa de internet. Tente de novo.',
}

export default function BotaoVoz({ onParcial, onFinal, disabled, onErro }: {
  onParcial: (texto: string) => void // texto enquanto fala (vai para a caixa)
  onFinal: (texto: string) => void // fala terminada: envia
  onErro: (msg: string) => void
  disabled?: boolean
}) {
  const [ouvindo, setOuvindo] = useState(false)
  const rec = useRef<Reconhecedor | null>(null)
  const texto = useRef('')

  useEffect(() => () => rec.current?.abort(), [])

  function iniciar() {
    const C = construtor()
    if (!C) {
      onErro('Este navegador não tem comando por voz. Use o Chrome ou, no celular, o microfone do teclado para ditar.')
      return
    }
    const r = new C()
    r.lang = 'pt-BR'
    r.continuous = false
    r.interimResults = true
    texto.current = ''
    r.onresult = e => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      texto.current = t.trim()
      onParcial(texto.current)
    }
    r.onerror = e => { if (e.error !== 'aborted') onErro(ERROS[e.error] ?? 'Não consegui ouvir. Tente de novo.') }
    r.onend = () => {
      setOuvindo(false)
      rec.current = null
      if (texto.current) onFinal(texto.current)
    }
    rec.current = r
    try { r.start(); setOuvindo(true) } catch { onErro('Não consegui ligar o microfone. Tente de novo.') }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => (ouvindo ? rec.current?.stop() : iniciar())}
      aria-label={ouvindo ? 'Parar de ouvir' : 'Falar com o assistente'}
      title={ouvindo ? 'Parar' : 'Falar'}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border disabled:opacity-40 ${ouvindo ? 'animate-pulse border-red-500 bg-red-500 text-white' : 'border-app-border2 bg-app-surface text-app-text'}`}
    >
      {ouvindo ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  )
}
