'use client'

import { CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  message: string | null
  type?: 'success' | 'error'
}

export default function Toast({ message, type = 'success' }: Props) {
  if (!message) return null

  const cor = type === 'error' ? '#EF4444' : '#25D366'
  const Icon = type === 'error' ? AlertCircle : CheckCircle2

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 rounded-lg border px-4 py-3 shadow-2xl bg-app-surface" style={{ borderColor: `${cor}4D` }}>
      <Icon className="h-4 w-4 shrink-0" style={{ color: cor }} />
      <span className="text-sm text-app-text">{message}</span>
    </div>
  )
}
