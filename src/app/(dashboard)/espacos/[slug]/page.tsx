import { notFound } from 'next/navigation'
import { getEspacoBySlug } from '@/lib/espacos-config'
import EspacoPage from '@/components/espacos/EspacoPage'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function EspacoDetailPage({ params }: Props) {
  const { slug } = await params
  const config = getEspacoBySlug(slug)

  if (!config) {
    notFound()
  }

  return <EspacoPage config={config} />
}

export function generateStaticParams() {
  return [
    { slug: 'usine' },
    { slug: 'fabrique' },
    { slug: 'house-pacaembu' },
    { slug: 'complexo-jussara' },
    { slug: 'espaco-solon' },
  ]
}
