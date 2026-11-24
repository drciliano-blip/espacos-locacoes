import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirPerfil } from '@/lib/whatsapp/acesso'
import { cotaUsada } from '@/lib/whatsapp/campanhas'
import { cloudConfigurado, limiteDiario, listarModelos, type ModeloMeta } from '@/lib/whatsapp/cloud'

// Situação do WhatsApp (Meta) para a tela: configurado?, cota de 24 h e modelos aprovados.
export async function GET() {
  const quem = await exigirPerfil(['admin', 'operacional'])
  if (quem instanceof NextResponse) return quem
  let modelos: ModeloMeta[] = []
  let erroModelos: string | undefined
  if (quem.role === 'admin') {
    try { modelos = (await listarModelos()).filter(m => m.status !== 'REJECTED' && m.status !== 'DISABLED') } catch (e) { erroModelos = e instanceof Error ? e.message : String(e) }
  }
  return NextResponse.json({
    configurado: cloudConfigurado(),
    webhookPronto: !!(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN),
    limite: limiteDiario(),
    usada: await cotaUsada(createAdminClient()),
    modelos, erroModelos,
  })
}
