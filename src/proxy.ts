import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const auth = request.cookies.get('auth')
  const { pathname } = request.nextUrl

  const publicPaths = ['/login']
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  if (!auth && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (auth && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
