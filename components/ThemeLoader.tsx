'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

export function ThemeLoader() {
  const { data: session } = useSession()
  const pathname = usePathname()

  useEffect(() => {
    // Não aplica tema em rotas master, landing ou login
    if (
      pathname?.startsWith('/master') ||
      pathname?.startsWith('/landing') ||
      pathname?.startsWith('/login') ||
      pathname?.startsWith('/register') ||
      pathname?.startsWith('/setup') ||
      pathname?.startsWith('/trocar-senha')
    ) {
      // Garante que rotas públicas sempre usam cor padrão orange
      document.documentElement.style.setProperty('--cor-primaria', '#f97316')
      document.documentElement.style.setProperty('--cor-primaria-hover', '#ea6c0a')
      document.documentElement.style.setProperty('--cor-primaria-light', 'rgba(249,115,22,0.1)')
      return
    }

    if (!session?.user?.workspaceId) return

    // Busca a cor configurada pelo workspace
    fetch('/api/config/geral')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const cor = data?.corPrimaria || '#f97316'
        aplicarTema(cor)
      })
      .catch(() => {
        aplicarTema('#f97316')
      })
  }, [session?.user?.workspaceId, pathname])

  return null
}

export function aplicarTema(hex: string) {
  document.documentElement.style.setProperty('--cor-primaria', hex)
  document.documentElement.style.setProperty('--cor-primaria-hover', escurecer(hex, 10))
  document.documentElement.style.setProperty('--cor-primaria-light', hex + '1a')
}

// Exportado para uso externo (ex: config/geral/page.tsx aplica cor imediatamente sem reload)
export function aplicarTema(hex: string) {
  aplicarCor(hex)
}

// Escurece uma cor hex em X%
function escurecer(hex: string, pct: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * pct))
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(2.55 * pct))
  const b = Math.max(0, (num & 0xff) - Math.round(2.55 * pct))
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}
