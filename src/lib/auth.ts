import type { NivelAcesso } from '@/types'

// Relatórios foi incorporado na aba Financeiro (visualização + exportação
// PDF/Excel) — não existe mais como página própria.
export const ROLE_PERMISSIONS: Record<NivelAcesso, string[]> = {
  admin: ['dashboard', 'agenda', 'pagamentos', 'eventos', 'fechamento', 'espacos', 'contas-a-pagar', 'usuarios', 'calculadora-staff', 'credenciamento'],
  financeiro: ['dashboard', 'pagamentos', 'eventos', 'fechamento', 'contas-a-pagar'],
  operacional: ['dashboard', 'agenda', 'eventos', 'espacos', 'calculadora-staff', 'credenciamento'],
  visualizador: ['dashboard'],
  // Somente leitura, e restrito aos espaços vinculados a ele via RLS —
  // o filtro de dados por espaço acontece no banco, isso aqui só libera as páginas.
  // Financeiro mostra dado societário sensível (aporte/retirada por sócio).
  socio: ['dashboard', 'agenda', 'eventos', 'fechamento', 'espacos'],
  // Login só de cadastro de terceirizados: uma página e nada mais. O bloqueio
  // de dados é do banco (policies restritivas da migration 0042).
  credenciamento: ['credenciamento'],
}

// Perfis que não podem chamar as rotas /api (leitura de boleto por IA, agenda
// do Google...) — elas só exigem sessão, não checam página.
export const ROLES_SEM_API: NivelAcesso[] = ['credenciamento']

// Pra onde mandar quem cai numa página que não pode ver. Não dá pra mandar
// todo mundo pro Dashboard: quem não tem o Dashboard entraria em loop.
export function paginaInicial(role: NivelAcesso): string {
  return `/${ROLE_PERMISSIONS[role]?.[0] ?? 'login'}`
}

export function canAccess(role: NivelAcesso, page: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(page) ?? false
}
