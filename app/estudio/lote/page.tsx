'use client'
// SOA Edition — ações em lote (processa no aparelho: Web Worker/OffscreenCanvas).
import dynamic from 'next/dynamic'

const AcoesLote = dynamic(() => import('@/components/estudio/AcoesLote'), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-gray-400">Abrindo…</p>,
})

export default function Page() {
  return <AcoesLote />
}
