'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { NivelAcesso } from '@/types'

interface UserContextValue {
  role: NivelAcesso
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ role, children }: { role: NivelAcesso; children: ReactNode }) {
  return <UserContext.Provider value={{ role }}>{children}</UserContext.Provider>
}

export function useCurrentUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useCurrentUser must be used inside UserProvider')
  return ctx
}
