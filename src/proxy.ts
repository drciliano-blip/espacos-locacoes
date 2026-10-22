import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/proxy'
import { paginaInicial, ROLE_PERMISSIONS, ROLES_SEM_API } from '@/lib/auth'
import type { NivelAcesso } from '@/types'

const publicPaths = ['/login', '/ficha-cliente']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  const { supabase, response } = createClient(request)
  const { data: { user } } = await supabase.auth.getUser()

  // Unauthenticated → login. Chamada de API recebe 401 em JSON, não o
  // redirect: o fetch seguia o redirect e recebia o HTML do login, o
  // `res.json()` quebrava e a tela mostrava erro genérico em vez de tentar
  // de novo (ex.: sessão ainda renovando ao voltar pro app no celular).
  if (!user && !isPublic) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already logged in → skip login page
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Role-based access control (API routes are exempt from per-page permissions —
  // they just require an authenticated session, checked above — except for
  // the roles in ROLES_SEM_API, which can't call them at all)
  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, ativo')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.ativo) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const role = profile.role as NivelAcesso
    if (pathname.startsWith('/api/')) {
      return ROLES_SEM_API.includes(role)
        ? NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
        : response
    }

    const permissions = ROLE_PERMISSIONS[role] ?? []
    const segment = pathname.split('/')[1] // e.g. "agenda", "usuarios"

    if (segment && !permissions.includes(segment)) {
      return NextResponse.redirect(new URL(paginaInicial(role), request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
