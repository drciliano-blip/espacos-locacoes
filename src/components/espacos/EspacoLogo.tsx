'use client'

import { useEffect, useState } from 'react'
import { getFileUrl } from '@/lib/file-storage'

interface Props {
  fotoFileId?: string
  fallbackLetter: string
  colorClass: string
  bgClass: string
  borderClass: string
  size?: 'sm' | 'lg'
}

export default function EspacoLogo({ fotoFileId, fallbackLetter, colorClass, bgClass, borderClass, size = 'sm' }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!fotoFileId) { setUrl(null); return }
    getFileUrl(fotoFileId).then(u => { if (active) setUrl(u) })
    return () => { active = false }
  }, [fotoFileId])

  const dims = size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'
  const text = size === 'lg' ? 'text-2xl' : 'text-lg'

  return (
    <div className={`shrink-0 flex items-center justify-center rounded-xl border overflow-hidden ${bgClass} ${borderClass} ${dims}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={`font-black ${colorClass} ${text}`}>{fallbackLetter}</span>
      )}
    </div>
  )
}
