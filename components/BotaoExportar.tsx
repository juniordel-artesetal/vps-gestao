'use client'

// Botão "Exportar" das telas financeiras (Fase 2). Recebe os filtros ATUAIS da tela e leva os
// mesmos na querystring — o arquivo sai com o mesmo recorte que está sendo visto.
import { useState, useRef, useEffect } from 'react'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'

export default function BotaoExportar({ fonte, filtros }: { fonte: 'previstos' | 'lancamentos'; filtros: Record<string, string | number | boolean | null | undefined> }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  function qs(extra: Record<string, string> = {}) {
    const p = new URLSearchParams({ fonte })
    for (const [k, v] of Object.entries(filtros)) {
      if (v === null || v === undefined || v === '' || v === false) continue
      p.set(k, v === true ? '1' : String(v))
    }
    for (const [k, v] of Object.entries(extra)) p.set(k, v)
    return p.toString()
  }

  const item = 'w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 text-left'

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setAberto(v => !v)}
        className="flex items-center gap-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
        <Download size={14} /> Exportar
      </button>
      {aberto && (
        <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-30">
          <a href={`/api/financeiro/relatorio?${qs()}`} onClick={() => setAberto(false)} className={item}>
            <FileSpreadsheet size={14} className="text-green-600" /> Excel (.xlsx)
          </a>
          <a href={`/api/financeiro/relatorio?${qs({ formato: 'csv' })}`} onClick={() => setAberto(false)} className={item}>
            <FileSpreadsheet size={14} className="text-gray-400" /> CSV
          </a>
          <a href={`/financeiro/relatorio/print?${qs()}`} target="_blank" rel="noreferrer" onClick={() => setAberto(false)} className={item}>
            <Printer size={14} className="text-orange-500" /> PDF (imprimir)
          </a>
        </div>
      )}
    </div>
  )
}
