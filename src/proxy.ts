import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin:        ['dashboard', 'agenda', 'pagamentos', 'contratos', 'relatorios', 'espacos', 'contas-a-pagar', 'usuarios'],
  financeiro:   ['dashboard', 'pagamentos', 'contratos', 'relatorios', 'contas-a-pagar'],
  operacional:  ['dashboard', 'agenda', 'contratos', 'espacos'],
  visualizador: ['dashboard'],
}

export function proxy(request: NextRequest) {
  const auth = request.cookies.get('auth')
  const { pathname } = request.nextUrl

  const publicPaths = ['/login', '/ficha-cliente']
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  // Unauthenticated → login
  if (!auth && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already logged in → skip login page
  if (auth && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Role-based access control (API routes are exempt from per-page permissions —
  // they just require an authenticated session, checked above)
  if (auth && !isPublic && !pathname.startsWith('/api/')) {
    try {
      const user = JSON.parse(decodeURIComponent(auth.value))
      const role: string = user.role ?? 'visualizador'
      const permissions = ROLE_PERMISSIONS[role] ?? []
      const segment = pathname.split('/')[1] // e.g. "agenda", "usuarios"

      if (segment && !permissions.includes(segment)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
