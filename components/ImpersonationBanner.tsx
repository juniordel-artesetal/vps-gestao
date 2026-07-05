'use client'
// components/ImpersonationBanner.tsx
// Banner global sempre visível enquanto o Master está "acessando como" uma assinante.
// Renderizado no layout raiz; só aparece quando a sessão carrega impersonatedBy.

import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { ShieldAlert, LogOut } from 'lucide-react'

export function ImpersonationBanner() {
  const { data: session } = useSession()
  const [saindo, setSaindo] = useState(false)
  const imp = (session?.user as any)?.impersonatedBy
  if (!imp) return null

  async function sair() {
    setSaindo(true)
    try {
      const r = await fetch('/api/master/impersonar/sair', { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      window.location.href = d?.redirect || '/master'
    } catch {
      window.location.href = '/master'
    }
  }

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-amber-500 text-black shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium min-w-0">
          <ShieldAlert size={16} className="flex-shrink-0" />
          <span className="truncate">
            🔓 Acessando como <strong>{session?.user?.workspaceNome || 'assinante'}</strong>
            <span className="hidden sm:inline"> — modo suporte (auditado)</span>
          </span>
        </span>
        <button onClick={sair} disabled={saindo}
          className="flex-shrink-0 flex items-center gap-1.5 bg-black/85 hover:bg-black text-white font-semibold px-3 py-1 rounded-lg transition disabled:opacity-60">
          <LogOut size={14} /> {saindo ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    </div>
  )
}
