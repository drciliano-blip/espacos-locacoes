import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/server'
import { EventosProvider } from '@/contexts/EventosContext'
import { EspacosProvider } from '@/contexts/EspacosContext'
import { ReceitasProvider } from '@/contexts/ReceitasContext'
import { ContratosProvider } from '@/contexts/ContratosContext'
import { ContasPagarProvider } from '@/contexts/ContasPagarContext'
import { UserProvider } from '@/contexts/UserContext'
import { SidebarUIProvider } from '@/contexts/SidebarUIContext'
import type { NivelAcesso } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, role, ativo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.ativo) {
    redirect('/login')
  }

  const role = profile.role as NivelAcesso

  return (
    <UserProvider role={role}>
      <EspacosProvider>
        <ReceitasProvider>
          <EventosProvider>
            <ContratosProvider>
              <ContasPagarProvider>
                <SidebarUIProvider>
                  <div className="flex h-screen bg-app-bg overflow-hidden">
                    <Sidebar userRole={role} />
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <Header userName={profile.nome} userRole={role} />
                      <main className="flex-1 overflow-y-auto p-6">
                        {children}
                      </main>
                    </div>
                  </div>
                </SidebarUIProvider>
              </ContasPagarProvider>
            </ContratosProvider>
          </EventosProvider>
        </ReceitasProvider>
      </EspacosProvider>
    </UserProvider>
  )
}
