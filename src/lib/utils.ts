import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  try {
    const { twMerge } = require('tailwind-merge')
    return twMerge(clsx(inputs))
  } catch {
    return clsx(inputs)
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}
