// SOA Edition — tela provisória (Parte 0: módulo disponível para iterar em produção).
import Link from 'next/link'
import { ArrowLeft, Hammer } from 'lucide-react'

export default function Pagina() {
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <Link href="/estudio" className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> SOA Edition</Link>
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center space-y-2">
        <Hammer className="w-8 h-8 mx-auto text-orange-400" />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Meus arquivos</h1>
        <p className="text-sm text-gray-500">Aqui vão ficar seus moldes, fontes e artes geradas, com pastas e tags.</p>
      </div>
    </div>
  )
}
