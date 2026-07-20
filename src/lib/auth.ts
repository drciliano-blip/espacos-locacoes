import type { NivelAcesso } from '@/types'

export const ROLE_PERMISSIONS: Record<NivelAcesso, string[]> = {
  admin: ['dashboard', 'agenda', 'pagamentos', 'eventos', 'relatorios', 'espacos', 'contas-a-pagar', 'usuarios'],
  financeiro: ['dashboard', 'pagamentos', 'eventos', 'relatorios', 'contas-a-pagar'],
  operacional: ['dashboard', 'agenda', 'eventos', 'espacos'],
  visualizador: ['dashboard'],
}

export function canAccess(role: NivelAcesso, page: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(page) ?? false
}
