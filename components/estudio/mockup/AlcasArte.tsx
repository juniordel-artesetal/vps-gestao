'use client'
// SOA Design — ALÇAS DA ARTE dentro da Smart Area ("mexer na imagem"): a moldura da arte segue a perspectiva da área;
// arrastar = mover, cantos = ampliar/reduzir, bolinha de cima = girar, rodinha do mouse = zoom. A arte pode ficar
// MAIOR que a área (a área só recorta). Tudo em fração da imagem (coordenadas normalizadas).
'use no memo'
import { useEffect, useRef } from 'react'
import { quadroDaArte, uvParaFoto, type AreaFoto, type Pt, type Realismo, type TransformArte } from '@/lib/estudio/mockupFoto'

export const ESCALA_MIN = 0.1, ESCALA_MAX = 10
const limitar = (s: number) => Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, s))

export default function AlcasArte({ area, W, H, arte, t, ajuste, palco, onMudar }: {
  area: AreaFoto; W: number; H: number; arte: { w: number; h: number }; t: TransformArte; ajuste?: Realismo['ajuste']
  palco: React.RefObject<HTMLDivElement | null>; onMudar: (t: TransformArte) => void
}) {
  const q = quadroDaArte(area, W, H, arte, t, ajuste ?? 'cobrir')
  const atual = useRef({ t, onMudar })
  useEffect(() => { atual.current = { t, onMudar } })
  // rodinha = zoom (listener não-passivo para não rolar a página)
  useEffect(() => {
    const el = palco.current
    if (!el) return
    const roda = (e: WheelEvent) => { e.preventDefault(); const { t: t0, onMudar: f } = atual.current; f({ ...t0, escala: limitar(t0.escala * (e.deltaY < 0 ? 1.08 : 1 / 1.08)) }) }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
  }, [palco])

  const px = (p: Pt) => { const b = palco.current!.getBoundingClientRect(); return { x: b.left + p.x * b.width, y: b.top + p.y * b.height } }
  function arrastar(e: React.PointerEvent, tipo: 'mover' | 'escala' | 'giro') {
    if (e.button !== 0) return
    e.stopPropagation(); e.preventDefault()
    const t0 = { ...t }, c = px(q.centro), x0 = e.clientX, y0 = e.clientY
    // eixos da área na tela (para o arrastar andar em fração da área, mesmo em perspectiva)
    const o = px(uvParaFoto(area, 0.5, 0.5)), eu = px(uvParaFoto(area, 1, 0.5)), ev = px(uvParaFoto(area, 0.5, 1))
    const ux = (eu.x - o.x) * 2, uy = (eu.y - o.y) * 2, vx = (ev.x - o.x) * 2, vy = (ev.y - o.y) * 2, det = ux * vy - uy * vx || 1
    const d0 = Math.hypot(x0 - c.x, y0 - c.y) || 1, a0 = Math.atan2(y0 - c.y, x0 - c.x)
    const mover = (ev2: PointerEvent) => {
      const dx = ev2.clientX - x0, dy = ev2.clientY - y0
      if (tipo === 'mover') atual.current.onMudar({ ...t0, dx: t0.dx + (dx * vy - dy * vx) / det, dy: t0.dy + (ux * dy - uy * dx) / det })
      else if (tipo === 'escala') atual.current.onMudar({ ...t0, escala: limitar(t0.escala * (Math.hypot(ev2.clientX - c.x, ev2.clientY - c.y) / d0)) })
      else { let r = t0.rot + ((Math.atan2(ev2.clientY - c.y, ev2.clientX - c.x) - a0) * 180) / Math.PI; r = ((r + 540) % 360) - 180; if (ev2.shiftKey) r = Math.round(r / 15) * 15; atual.current.onMudar({ ...t0, rot: Math.round(r) }) }
    }
    const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar) }
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar)
  }
  // arte bem maior que a imagem: a alça fica presa na borda (continua alcançável; a escala é pela distância ao centro)
  const preso = (v: number) => Math.max(-0.015, Math.min(1.015, v))
  const pct = (p: Pt) => ({ left: `${preso(p.x) * 100}%`, top: `${preso(p.y) * 100}%` })
  return (
    <>
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" data-alcas-arte>
        <polygon points={q.contorno.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(249,115,22,0.04)" stroke="#f97316" strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'all', cursor: 'move' }} onPointerDown={e => arrastar(e, 'mover')} data-moldura-arte />
        <line x1={q.topo.x} y1={q.topo.y} x2={q.giro.x} y2={q.giro.y} stroke="#f97316" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      </svg>
      {q.cantos.map((p, i) => <span key={i} data-alca-escala={i} title="Arraste para ampliar/reduzir (ou use a rodinha do mouse)" onPointerDown={e => arrastar(e, 'escala')}
        className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-orange-500 rounded-sm cursor-nwse-resize z-10" style={pct(p)} />)}
      <span data-alca-giro title="Arraste para girar (Shift = de 15 em 15°)" onPointerDown={e => arrastar(e, 'giro')}
        className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 bg-orange-500 border-2 border-white rounded-full cursor-grab shadow z-10" style={pct(q.giro)} />
    </>
  )
}
