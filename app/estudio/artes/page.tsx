'use client'
// SOA Edition — Edição em massa: só consome um template pronto (template → lista → exportar).
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const EdicaoEmMassa = dynamic(() => import('@/components/estudio/EdicaoEmMassa'), {
  ssr: false,
  loading: () => <div className="p-10 flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo…</div>,
})

export default function Pagina() {
  return <EdicaoEmMassa />
}
