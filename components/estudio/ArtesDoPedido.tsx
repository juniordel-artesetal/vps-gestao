'use client'
// SOA Edition — artes geradas a partir deste pedido, anexadas no detalhe (produção abre e
// imprime daqui). Some sozinho para quem não tem o módulo (API responde 404) ou sem artes.
import { useEffect, useState } from 'react'
import { Printer, Download, WandSparkles } from 'lucide-react'

interface Arte { id: string; nome: string; url: string; mime: string | null; createdAt: string }

export default function ArtesDoPedido({ pedidoId }: { pedidoId: string }) {
  const [artes, setArtes] = useState<Arte[]>([])
  useEffect(() => {
    let vivo = true
    fetch(`/api/estudio/assets?pedidoId=${encodeURIComponent(pedidoId)}`)
      .then(r => (r.ok ? r.json() : { assets: [] }))
      .then(d => { if (vivo) setArtes(d.assets || []) })
      .catch(() => {})
    return () => { vivo = false }
  }, [pedidoId])
  if (!artes.length) return null
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
        <WandSparkles className="w-4 h-4 text-orange-500" /> Artes do SOA Edition
        <span className="text-xs text-gray-400 font-normal">({artes.length})</span>
      </h2>
      <div className="space-y-1.5">
        {artes.map(a => (
          <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-gray-700 dark:text-gray-200">{a.nome}</span>
            <span className="flex items-center gap-2 flex-shrink-0">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-orange-600" title="Abrir para imprimir"><Printer className="w-4 h-4" /></a>
              <a href={a.url} download className="text-gray-500 hover:text-orange-600" title="Baixar"><Download className="w-4 h-4" /></a>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
