'use client'

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface SidebarUIContextValue {
  open: boolean
  toggle: () => void
  close: () => void
}

const SidebarUIContext = createContext<SidebarUIContextValue | null>(null)

export function SidebarUIProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <SidebarUIContext.Provider value={{
      open,
      toggle: () => setOpen(v => !v),
      close: () => setOpen(false),
    }}>
      {children}
    </SidebarUIContext.Provider>
  )
}

export function useSidebarUI(): SidebarUIContextValue {
  const ctx = useContext(SidebarUIContext)
  if (!ctx) throw new Error('useSidebarUI must be used inside SidebarUIProvider')
  return ctx
}
