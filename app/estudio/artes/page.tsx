'use client'
// SOA Edition — Edição em massa de artes. Fabric e pdf.js precisam do navegador (window,
// canvas), então o editor carrega só no cliente.
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const EditorArtes = dynamic(() => import('@/components/estudio/EditorArtes'), {
  ssr: false,
  loading: () => (
    <div className="p-10 flex items-center justify-center gap-2 text-sm text-gray-500">
      <Loader2 className="w-4 h-4 animate-spin" /> Abrindo o editor…
    </div>
  ),
})

export default function Pagina() {
  return <EditorArtes />
}
