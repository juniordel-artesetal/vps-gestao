'use client'
// SOA Design — filtro "por segmento" + busca dos produtos do Mockup (biblioteca e gerador).
import { Search } from 'lucide-react'
import { segmentoDe, type MockupPronto } from '@/lib/estudio/mockupCliente'

export function filtrarPorSegmento(itens: MockupPronto[], segmento: string, busca: string): MockupPronto[] {
  const b = busca.trim().toLowerCase()
  return itens.filter(m => (!segmento || segmentoDe(m) === segmento) && (!b || m.nome.toLowerCase().includes(b)))
}

export default function FiltroSegmento({ itens, segmento, onSegmento, busca, onBusca }: {
  itens: MockupPronto[]; segmento: string; onSegmento: (s: string) => void; busca: string; onBusca: (s: string) => void
}) {
  const contagem = new Map<string, number>()
  for (const m of itens) contagem.set(segmentoDe(m), (contagem.get(segmentoDe(m)) || 0) + 1)
  const segs = [...contagem.keys()].sort((a, b) => (a === 'Meus produtos' ? -1 : b === 'Meus produtos' ? 1 : a.localeCompare(b, 'pt-BR')))
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-filtro-segmento>
      <button onClick={() => onSegmento('')} className={`text-xs rounded-full px-2.5 py-0.5 border ${!segmento ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200 font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-600'}`}>Todos ({itens.length})</button>
      {segs.map(s => (
        <button key={s} onClick={() => onSegmento(s)} className={`text-xs rounded-full px-2.5 py-0.5 border ${segmento === s ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200 font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-600'}`}>{s} ({contagem.get(s)})</button>
      ))}
      <span className="relative ml-auto">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
        <input value={busca} onChange={e => onBusca(e.target.value)} placeholder="Buscar produto" className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg pl-7 pr-2 py-1 bg-white dark:bg-gray-800 w-40" />
      </span>
    </div>
  )
}
