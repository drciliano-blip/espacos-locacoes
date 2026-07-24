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

// Interpreta texto digitado em formato brasileiro (ex: "3.000,00", "3000,00", "3000")
// como número — usar sempre que o valor vier de um <input type="text"> de dinheiro.
// Nunca usar Number()/parseFloat() direto num valor digitado por usuário: "3.000,00"
// vira 3 (perde os zeros), porque o ponto é lido como separador decimal em vez de milhar.
export function parseCurrencyBR(input: string): number {
  const cleaned = input.trim().replace(/[^\d,.-]/g, '')
  if (!cleaned) return 0

  if (cleaned.includes(',')) {
    const semSeparadorMilhar = cleaned.replace(/\.(?=\d{3}(\D|$))/g, '')
    const n = parseFloat(semSeparadorMilhar.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  // Sem vírgula: "3.000" (só grupos de 3 dígitos após ponto) é separador de milhar.
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, ''))
  }

  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function maskCPF(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function maskCNPJ(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

export function maskCEP(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{5})(\d{1,3})$/, '$1-$2')
}
