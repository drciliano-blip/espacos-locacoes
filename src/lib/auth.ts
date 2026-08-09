import type { NivelAcesso } from '@/types'

export const ROLE_PERMISSIONS: Record<NivelAcesso, string[]> = {
  admin: ['dashboard', 'agenda', 'pagamentos', 'eventos', 'relatorios', 'fechamento', 'espacos', 'contas-a-pagar', 'usuarios', 'calculadora-staff'],
  financeiro: ['dashboard', 'pagamentos', 'eventos', 'relatorios', 'fechamento', 'contas-a-pagar'],
  operacional: ['dashboard', 'agenda', 'eventos', 'espacos', 'calculadora-staff'],
  visualizador: ['dashboard'],
  // Somente leitura, e restrito aos espaços vinculados a ele via RLS —
  // o filtro de dados por espaço acontece no banco, isso aqui só libera as páginas.
  // Financeiro mostra dado societário sensível (aporte/retirada por sócio) —
  // mesma visibilidade de Relatórios.
  socio: ['dashboard', 'agenda', 'eventos', 'relatorios', 'fechamento', 'espacos'],
}

export function canAccess(role: NivelAcesso, page: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(page) ?? false
}
