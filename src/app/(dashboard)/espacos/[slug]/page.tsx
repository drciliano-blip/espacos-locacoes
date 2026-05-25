import { notFound } from 'next/navigation'
import { getEspacoBySlug } from '@/lib/espacos-config'
import { eventos as todosEventos } from '@/lib/mock-data'
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

  const eventosEspaco = todosEventos.filter((e) => e.espaco === config.nome)

  return <EspacoPage config={config} eventos={eventosEspaco} />
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
