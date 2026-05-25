import type { NivelAcesso } from '@/types'
import { usuarios } from '@/lib/mock-data'

export interface AuthUser {
  id: string
  nome: string
  email: string
  role: NivelAcesso
}

export function checkDemoLogin(email: string, password: string): AuthUser | null {
  const user = usuarios.find((u) => u.email === email && u.senha === password && u.ativo)
  if (!user) return null
  return { id: user.id, nome: user.nome, email: user.email, role: user.role }
}

export function getAuthUserFromCookie(cookieValue: string): AuthUser | null {
  try {
    return JSON.parse(decodeURIComponent(cookieValue)) as AuthUser
  } catch {
    return null
  }
}

export const ROLE_PERMISSIONS: Record<NivelAcesso, string[]> = {
  admin: ['dashboard', 'agenda', 'pagamentos', 'contratos', 'relatorios', 'espacos', 'contas-a-pagar', 'usuarios'],
  financeiro: ['dashboard', 'pagamentos', 'contratos', 'relatorios', 'contas-a-pagar'],
  operacional: ['dashboard', 'agenda', 'contratos', 'espacos'],
  visualizador: ['dashboard'],
}

export function canAccess(role: NivelAcesso, page: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(page) ?? false
}
