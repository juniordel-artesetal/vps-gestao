'use client'
// SOA Edition — ÁREA DE APLICAÇÃO no produto: arraste os 4 cantos (perspectiva) ou os 9 pontos da malha
// (caneca, garrafa, tecido). A prévia mostra a arte já com a luz/sombra da foto.
import { useEffect, useMemo, useRef, useState } from 'react'
import { comporMockup, novoCanvas } from '@/lib/estudio/mockup'
import type { ConfigMockup } from '@/lib/estudio/mockupTipos'

const LADO = 620

export default function EditorArea({ produto, cfg, arte, onCfg }: { produto: HTMLCanvasElement; cfg: ConfigMockup; arte: HTMLCanvasElement; onCfg: (c: ConfigMockup) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [arrastando, setArrastando] = useState<number | null>(null)
  const quadroRef = useRef<HTMLDivElement>(null)
  // cópias leves para a prévia não pesar
  const peq = useMemo(() => {
    const k = Math.min(1, LADO / Math.max(produto.width, produto.height))
    const c = novoCanvas(produto.width * k, produto.height * k); c.getContext('2d')!.drawImage(produto, 0, 0, c.width, c.height); return c
  }, [produto])
  const artePeq = useMemo(() => {
    const k = Math.min(1, 700 / Math.max(arte.width, arte.height))
    const c = novoCanvas(arte.width * k, arte.height * k); c.getContext('2d')!.drawImage(arte, 0, 0, c.width, c.height); return c
  }, [arte])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const c = ref.current; if (!c) return
      const out = comporMockup(peq, artePeq, cfg)
      c.width = out.width; c.height = out.height
      const g = c.getContext('2d')!
      // xadrez = transparente
      const t = 12
      for (let y = 0; y < c.height; y += t) for (let x = 0; x < c.width; x += t) { g.fillStyle = ((x + y) / t) % 2 ? '#f3f4f6' : '#ffffff'; g.fillRect(x, y, t, t) }
      g.drawImage(out, 0, 0)
    })
    return () => cancelAnimationFrame(id)
  }, [peq, artePeq, cfg])

  const pts = cfg.area.pontos
  const { cols, rows } = cfg.area
  function mover(e: React.PointerEvent) {
    if (arrastando === null || !quadroRef.current) return
    const r = quadroRef.current.getBoundingClientRect()
    const x = Math.max(-0.2, Math.min(1.2, (e.clientX - r.left) / r.width)), y = Math.max(-0.2, Math.min(1.2, (e.clientY - r.top) / r.height))
    onCfg({ ...cfg, area: { ...cfg.area, pontos: pts.map((p, i) => (i === arrastando ? { x, y } : p)) } })
  }
  const linhas: [number, number][] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c
    if (c < cols - 1) linhas.push([i, i + 1])
    if (r < rows - 1) linhas.push([i, i + cols])
  }
  return (
    <div ref={quadroRef} className="relative inline-block max-w-full select-none touch-none" onPointerMove={mover} onPointerUp={() => setArrastando(null)} onPointerLeave={() => setArrastando(null)}>
      <canvas ref={ref} className="max-w-full h-auto block rounded-xl border border-gray-200 dark:border-gray-700" />
      <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 1 1" preserveAspectRatio="none">
        {linhas.map(([a, b], i) => <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} stroke="#f97316" strokeWidth={0.004} strokeDasharray="0.012 0.008" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.5 }} />)}
      </svg>
      {pts.map((p, i) => (
        <span key={i} onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setArrastando(i) }}
          className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-white border-2 border-orange-500 shadow cursor-grab active:cursor-grabbing"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />
      ))}
    </div>
  )
}
