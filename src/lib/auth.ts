// Demo auth — replace with Supabase auth in production
export const DEMO_USER = {
  email: 'admin@espacoslocacoes.com.br',
  password: 'admin123',
  name: 'Administrador',
}

export function checkDemoLogin(email: string, password: string): boolean {
  return email === DEMO_USER.email && password === DEMO_USER.password
}
