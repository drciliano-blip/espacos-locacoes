'use client'

import { CheckCircle2 } from 'lucide-react'

interface Props {
  message: string | null
}

export default function Toast({ message }: Props) {
  if (!message) return null

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 rounded-lg border border-[#25D366]/30 bg-app-surface px-4 py-3 shadow-2xl">
      <CheckCircle2 className="h-4 w-4 text-[#25D366] shrink-0" />
      <span className="text-sm text-app-text">{message}</span>
    </div>
  )
}
