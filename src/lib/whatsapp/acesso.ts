import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NivelAcesso } from '@/types'

// Confere a sessão de quem chamou a rota. Campanhas e importação: só o
// administrador. Caixa de entrada: administrador e operacional.
export async function exigirPerfil(permitidos: NivelAcesso[]): Promise<{ nome: string | null; role: NivelAcesso } | NextResponse> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { data: perfil } = await sb.from('profiles').select('role, nome, ativo').eq('id', user.id).single()
  const role = perfil?.role as NivelAcesso | undefined
  if (!role || !perfil?.ativo || !permitidos.includes(role)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  return { nome: perfil.nome ?? null, role }
}
