'use client'
// SOA Edition — Mockup com produto real (Fase 3). Canvas só no navegador.
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

const PainelMockups = dynamic(() => import('@/components/estudio/mockup/PainelMockups'), {
  ssr: false,
  loading: () => <div className="p-8 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo…</div>,
})

export default function Mockups() {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
      <Link href="/estudio" className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> SOA Edition</Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mockup com produto</h1>
        <p className="text-sm text-gray-500">Sua arte aplicada na foto do produto — com perspectiva, luz e sombra — e o kit de fotos do anúncio pronto para cada marketplace.</p>
      </div>
      <PainelMockups />
    </div>
  )
}
