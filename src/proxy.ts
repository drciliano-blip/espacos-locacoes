import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/proxy'
import { ROLE_PERMISSIONS } from '@/lib/auth'
import type { NivelAcesso } from '@/types'

const publicPaths = ['/login', '/ficha-cliente']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  const { supabase, response } = createClient(request)
  const { data: { user } } = await supabase.auth.getUser()

  // Unauthenticated → login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already logged in → skip login page
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Role-based access control (API routes are exempt from per-page permissions —
  // they just require an authenticated session, checked above)
  if (user && !isPublic && !pathname.startsWith('/api/')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, ativo')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.ativo) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const role = profile.role as NivelAcesso
    const permissions = ROLE_PERMISSIONS[role] ?? []
    const segment = pathname.split('/')[1] // e.g. "agenda", "usuarios"

    if (segment && !permissions.includes(segment)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
