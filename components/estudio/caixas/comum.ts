'use client'
// SOA Edition — pedaços comuns das telas de caixas/mockup (sessão, armazenamento, classes).
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

/** workspace da sessão + se o armazenamento (Blob) está configurado neste ambiente. */
export function useBaseEstudio() {
  const { data: session } = useSession()
  const workspaceId = (session?.user as { workspaceId?: string } | undefined)?.workspaceId
  const [storage, setStorage] = useState<boolean | null>(null)
  useEffect(() => { fetch('/api/estudio/status').then(r => r.json()).then(d => setStorage(!!d.storage)).catch(() => setStorage(false)) }, [])
  return { workspaceId, storage }
}

export const inp = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800'
export const lbl = 'block text-[11px] font-medium text-gray-500 mb-0.5'
export const btn = 'inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm hover:border-orange-400 disabled:opacity-50'
export const btnP = 'inline-flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50'
export const cartao = 'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4'

/** Número a partir de texto com vírgula (nunca input type=number — regra do SOA). */
export const num = (s: string, padrao = 0) => { const v = Number(String(s).replace(',', '.')); return Number.isFinite(v) ? v : padrao }
