'use client'

import { SessionProvider } from 'next-auth/react'
import IdleLogout from '@/components/IdleLogout'

export function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <IdleLogout />
    </SessionProvider>
  )
}