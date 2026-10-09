'use client'
// Um glifo da fonte desenhado em SVG (painel de glifos e troca de letra do Lote 5, item 75).
import { svgDoGlifo, type FonteHB } from '@/lib/mae/texto/fonte'

export default function Glifo({ f, gid, ativo, onClick, titulo }: { f: FonteHB; gid: number; ativo?: boolean; onClick: () => void; titulo: string }) {
  const d = svgDoGlifo(f, gid)
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1)
  const x0 = Math.min(...xs, 0), x1 = Math.max(...xs, f.upem * 0.3), y0 = Math.min(...ys, -f.ascender), y1 = Math.max(...ys, 0)
  const m = (x1 - x0 + y1 - y0) * 0.05
  return (
    <button title={titulo} onClick={onClick} className={`w-10 h-10 rounded border bg-white ${ativo ? 'border-orange-500 ring-1 ring-orange-400' : 'border-gray-200 hover:border-orange-300'}`} data-glifo={gid}>
      <svg viewBox={`${x0 - m} ${y0 - m} ${x1 - x0 + 2 * m} ${y1 - y0 + 2 * m}`} className="w-full h-full"><path d={d} fill="#1f2937" /></svg>
    </button>
  )
}
