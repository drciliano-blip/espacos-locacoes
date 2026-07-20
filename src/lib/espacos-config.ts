export interface CategoriaEvento {
  label: string
  dotColor: string
  barColor: string
  textColor: string
}

export interface EspacoConfig {
  slug: string
  nome: string
  descricao: string
  capacidade: number
  cor: string
  colorClass: string
  bgClass: string
  borderClass: string
  dotClass: string
  gradientFrom: string
  categorias: CategoriaEvento[]
  id?: string
  fotoFileId?: string
}

export const ESPACOS_CONFIG: EspacoConfig[] = [
  {
    slug: 'usine',
    nome: 'Usine',
    descricao: 'Espaço industrial sofisticado para grandes eventos',
    capacidade: 400,
    cor: 'violet',
    colorClass: 'text-violet-400',
    bgClass: 'bg-violet-500/10',
    borderClass: 'border-violet-500/20',
    dotClass: 'bg-violet-500',
    gradientFrom: 'from-violet-500/20',
    categorias: [
      { label: 'Casamento', dotColor: 'bg-violet-500', barColor: 'bg-violet-500', textColor: 'text-violet-400' },
      { label: 'Show', dotColor: 'bg-purple-500', barColor: 'bg-purple-500', textColor: 'text-purple-400' },
      { label: 'Festival', dotColor: 'bg-fuchsia-500', barColor: 'bg-fuchsia-500', textColor: 'text-fuchsia-400' },
      { label: 'Formatura', dotColor: 'bg-pink-500', barColor: 'bg-pink-500', textColor: 'text-pink-400' },
      { label: 'Festa Corporativa', dotColor: 'bg-rose-500', barColor: 'bg-rose-500', textColor: 'text-rose-400' },
    ],
  },
  {
    slug: 'fabrique',
    nome: 'Fabrique',
    descricao: 'Ambiente versátil para congressos e eventos corporativos',
    capacidade: 250,
    cor: 'indigo',
    colorClass: 'text-indigo-400',
    bgClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/20',
    dotClass: 'bg-indigo-500',
    gradientFrom: 'from-indigo-500/20',
    categorias: [
      { label: 'Congresso', dotColor: 'bg-indigo-500', barColor: 'bg-indigo-500', textColor: 'text-indigo-400' },
      { label: 'Seminário', dotColor: 'bg-blue-500', barColor: 'bg-blue-500', textColor: 'text-blue-400' },
      { label: 'Convenção', dotColor: 'bg-cyan-500', barColor: 'bg-cyan-500', textColor: 'text-cyan-400' },
      { label: 'Workshop', dotColor: 'bg-teal-500', barColor: 'bg-teal-500', textColor: 'text-teal-400' },
      { label: 'Treinamento Corporativo', dotColor: 'bg-sky-500', barColor: 'bg-sky-500', textColor: 'text-sky-400' },
    ],
  },
  {
    slug: 'house-pacaembu',
    nome: 'House Pacaembu',
    descricao: 'Espaço acolhedor para festas e celebrações',
    capacidade: 150,
    cor: 'sky',
    colorClass: 'text-sky-400',
    bgClass: 'bg-sky-500/10',
    borderClass: 'border-sky-500/20',
    dotClass: 'bg-sky-500',
    gradientFrom: 'from-sky-500/20',
    categorias: [
      { label: 'Aniversário', dotColor: 'bg-sky-500', barColor: 'bg-sky-500', textColor: 'text-sky-400' },
      { label: 'Festa 15 anos', dotColor: 'bg-blue-400', barColor: 'bg-blue-400', textColor: 'text-blue-400' },
      { label: 'Casamento', dotColor: 'bg-cyan-400', barColor: 'bg-cyan-400', textColor: 'text-cyan-400' },
      { label: 'Confraternização', dotColor: 'bg-teal-400', barColor: 'bg-teal-400', textColor: 'text-teal-400' },
      { label: 'Festa Infantil', dotColor: 'bg-indigo-400', barColor: 'bg-indigo-400', textColor: 'text-indigo-400' },
    ],
  },
  {
    slug: 'complexo-jussara',
    nome: 'Complexo Jussara',
    descricao: 'Complexo completo para grandes eventos e formaturas',
    capacidade: 600,
    cor: 'emerald',
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    dotClass: 'bg-emerald-500',
    gradientFrom: 'from-emerald-500/20',
    categorias: [
      { label: 'Formatura', dotColor: 'bg-emerald-500', barColor: 'bg-emerald-500', textColor: 'text-emerald-400' },
      { label: 'Convenção', dotColor: 'bg-green-500', barColor: 'bg-green-500', textColor: 'text-green-400' },
      { label: 'Feira', dotColor: 'bg-lime-500', barColor: 'bg-lime-500', textColor: 'text-lime-400' },
      { label: 'Congresso', dotColor: 'bg-teal-500', barColor: 'bg-teal-500', textColor: 'text-teal-400' },
      { label: 'Evento Corporativo', dotColor: 'bg-cyan-600', barColor: 'bg-cyan-600', textColor: 'text-cyan-400' },
    ],
  },
  {
    slug: 'espaco-solon',
    nome: 'Espaço Solon',
    descricao: 'Espaço íntimo para workshops e pequenos eventos',
    capacidade: 80,
    cor: 'orange',
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/20',
    dotClass: 'bg-orange-500',
    gradientFrom: 'from-orange-500/20',
    categorias: [
      { label: 'Workshop', dotColor: 'bg-orange-500', barColor: 'bg-orange-500', textColor: 'text-orange-400' },
      { label: 'Reunião', dotColor: 'bg-amber-500', barColor: 'bg-amber-500', textColor: 'text-amber-400' },
      { label: 'Palestra', dotColor: 'bg-yellow-500', barColor: 'bg-yellow-500', textColor: 'text-yellow-400' },
      { label: 'Aniversário', dotColor: 'bg-red-400', barColor: 'bg-red-400', textColor: 'text-red-400' },
      { label: 'Apresentação', dotColor: 'bg-orange-400', barColor: 'bg-orange-400', textColor: 'text-orange-300' },
    ],
  },
]

export function getEspacoBySlug(slug: string): EspacoConfig | null {
  return ESPACOS_CONFIG.find((e) => e.slug === slug) ?? null
}

export function slugToNome(slug: string): string {
  return getEspacoBySlug(slug)?.nome ?? ''
}
