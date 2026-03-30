'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

// Exportada para uso externo (ex: config/geral/page.tsx aplica cor sem reload)
export function aplicarTema(hex: string) {
  document.documentElement.style.setProperty('--cor-primaria', hex)
  document.documentElement.style.setProperty('--cor-primaria-hover', escurecer(hex, 10))
  document.documentElement.style.setProperty('--cor-primaria-light', hex + '1a')
}

function escurecer(hex: string, pct: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r   = Math.max(0, (num >> 16) - Math.round(2.55 * pct))
  const g   = Math.max(0, ((num >> 8) & 0xff) - Math.round(2.55 * pct))
  const b   = Math.max(0, (num & 0xff) - Math.round(2.55 * pct))
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

const ROTAS_PUBLICAS = ['/master', '/landing', '/login', '/register', '/setup', '/trocar-senha']

export function ThemeLoader() {
  const { data: session } = useSession()
  const pathname          = usePathname()

  useEffect(() => {
    // Rotas públicas e master sempre usam laranja padrão
    if (ROTAS_PUBLICAS.some(r => pathname?.startsWith(r))) {
      aplicarTema('#f97316')
      return
    }

    if (!session?.user?.workspaceId) return

    fetch('/api/config/geral')
      .then(r => r.ok ? r.json() : null)
      .then(data => aplicarTema(data?.corPrimaria || '#f97316'))
      .catch(() => aplicarTema('#f97316'))
  }, [session?.user?.workspaceId, pathname])

  return null
}
