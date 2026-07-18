import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { getAuthUserFromCookie } from '@/lib/auth'
import { EventosProvider } from '@/contexts/EventosContext'
import { EspacosProvider } from '@/contexts/EspacosContext'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const authCookie = cookieStore.get('auth')

  if (!authCookie?.value) {
    redirect('/login')
  }

  const user = getAuthUserFromCookie(authCookie.value)
  if (!user) {
    redirect('/login')
  }

  return (
    <EspacosProvider>
      <EventosProvider>
        <div className="flex h-screen bg-app-bg overflow-hidden">
          <Sidebar userRole={user.role} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header userName={user.nome} userRole={user.role} />
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </EventosProvider>
    </EspacosProvider>
  )
}
