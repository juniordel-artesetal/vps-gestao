'use client'
// SOA Edition — MÉTODO MÃE (kit de caixas por face) + CAIXA MONTADA. Canvas/pdf.js só no navegador.
import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

const carregando = () => <div className="p-8 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo…</div>
const EditorTemaCaixas = dynamic(() => import('@/components/estudio/caixas/EditorTemaCaixas'), { ssr: false, loading: carregando })
const MoldesKits = dynamic(() => import('@/components/estudio/caixas/MoldesKits'), { ssr: false, loading: carregando })
const GerarCaixas = dynamic(() => import('@/components/estudio/caixas/GerarCaixas'), { ssr: false, loading: carregando })
const CaixaMontada = dynamic(() => import('@/components/estudio/caixas/CaixaMontada'), { ssr: false, loading: carregando })

const ABAS = [
  { id: 'temas', nome: 'Temas por face' },
  { id: 'gerar', nome: 'Gerar em massa' },
  { id: 'montada', nome: 'Caixa montada' },
  { id: 'moldes', nome: 'Moldes e kits' },
] as const

export default function Caixas() {
  const [aba, setAba] = useState<(typeof ABAS)[number]['id']>('temas')
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
      <Link href="/estudio" className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> SOA Edition</Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kit de produtos</h1>
        <p className="text-sm text-gray-500">Monte o tema uma vez por face — frente, laterais, trás e cima — e ele vai para todas as caixas do kit. Depois é só o nome e a idade.</p>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-800">
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${aba === a.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>{a.nome}</button>
        ))}
        <Link href="/estudio/mockups" className="px-3 py-2 text-sm font-medium border-b-2 -mb-px border-transparent text-gray-500 hover:text-orange-600">↳ Mockup com produto</Link>
      </div>
      {aba === 'temas' && <EditorTemaCaixas />}
      {aba === 'gerar' && <GerarCaixas />}
      {aba === 'montada' && <CaixaMontada />}
      {aba === 'moldes' && <MoldesKits />}
    </div>
  )
}
