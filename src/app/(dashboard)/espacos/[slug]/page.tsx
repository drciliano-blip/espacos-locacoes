'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { useEspacos } from '@/contexts/EspacosContext'
import EspacoPage from '@/components/espacos/EspacoPage'

interface Props {
  params: Promise<{ slug: string }>
}

export default function EspacoDetailPage({ params }: Props) {
  const { slug } = use(params)
  const { espacosConfig } = useEspacos()
  const config = espacosConfig.find(e => e.slug === slug)

  if (!config) {
    notFound()
  }

  return <EspacoPage config={config} />
}
