import { NextResponse } from 'next/server'

// Versão publicada agora (commit do deploy na Vercel). A tela compara com a
// versão que carregou para avisar "Há uma versão nova do sistema".
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ versao: process.env.VERCEL_GIT_COMMIT_SHA ?? null }, { headers: { 'Cache-Control': 'no-store' } })
}
