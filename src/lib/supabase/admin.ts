import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Cliente com a service role key — ignora RLS. Uso exclusivo em rotas de API
// (server-side), nunca importar em componentes client.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
