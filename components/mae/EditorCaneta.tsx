'use client'
'use no memo'
// CANETA BÉZIER (Sprint 10): desenha uma forma no espaço da PARTE (aparece em todas as faces dela).
// Clique = ponto reto; clique e arraste = ponto com curva. Duplo clique ou "Fechar forma" termina.
import { useEffect, useRef, useState } from 'react'
import { X, Check, Undo2 } from 'lucide-react'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { miniaturaDaParte } from '@/lib/mae/vinculo/resolver'
import { canetaParaCaminho } from '@/lib/mae/edicao/formas'
import type { DocTema } from '@/lib/mae/schema'
import { garantirArquivos, motorDaPagina } from './motorEditor'
import { useEditor } from './estado'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
type No = { x: number; y: number; hx?: number; hy?: number }

export default function EditorCaneta({ partId, A, onFechar }: { partId: string; A: number; onFechar: () => void }) {
  const raiz = useBiblioteca(s => s.raiz)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const W = 640, H = Math.round(W / A)
  const ref = useRef<HTMLCanvasElement>(null)
  const [nos, setNos] = useState<No[]>([])
  const [arrasto, setArrasto] = useState<number | null>(null)
  const [cor, setCor] = useState('#f472b6')

  useEffect(() => {
    if (!tema) return
    let vivo = true
    ;(async () => {
      const p = miniaturaDaParte(tema, partId, A, 30)
      await garantirArquivos(p as never, raiz)
      const r = await motorDaPagina().render(p as never, W / (A * 30), '#ffffff', 'bitmap')
      const c = ref.current
      if (!vivo || !c || !r.bitmap) { r.bitmap?.close(); return }
      c.width = r.bitmap.width; c.height = r.bitmap.height
      c.getContext('2d')!.drawImage(r.bitmap, 0, 0); r.bitmap.close()
    })().catch(() => {})
    return () => { vivo = false }
  }, [tema, partId, A, raiz, W])

  const pt = (e: React.PointerEvent | React.MouseEvent) => { const r = (e.currentTarget as Element).getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H } }
  function concluir(fechado: boolean) {
    // pontos em px → espaço de referência da parte ([0,A] × [0,1])
    const ref1 = nos.map(n => ({ x: (n.x / W) * A, y: n.y / H, ...(n.hx !== undefined ? { hx: (n.hx / W) * A, hy: n.hy! / H } : {}) }))
    const r = canetaParaCaminho(ref1, fechado)
    if (!r) return
    const asp = r.caixa.w / r.caixa.h
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    useMaeTema.getState().aplicar('Caneta: nova forma', t => {
      const l = ((t as DocTema).partContent[partId] ??= [])
      l.push({ id, type: 'shape', name: 'Caneta', kind: 'path', params: { radius: 0, sides: 6, inner: 0.5, d: r.d }, fill: fechado ? cor : null, stroke: fechado ? null : { color: cor, widthMm: 0.8 }, aspect: asp, anchor: 'paper',
        transform: { x: (r.caixa.x0 + r.caixa.w / 2) / A, y: r.caixa.y0 + r.caixa.h / 2, scale: r.caixa.w / Math.max(A, asp), rotationDeg: 0 } } as never)
    })
    useEditor.getState().set({ camada: id })
    onFechar()
  }
  const d = nos.length ? (canetaParaCaminho(nos, false)?.d ?? '') : ''
  // o caminho vem normalizado na caixa: redesenha em px pela caixa
  const cx = canetaParaCaminho(nos, false)?.caixa
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label="Caneta" data-editor-caneta>
      <div className="rounded-xl bg-white dark:bg-gray-900 p-3 shadow-2xl space-y-2">
        <div className="flex items-center gap-1.5 text-xs">
          <b className="mr-2">Caneta</b>
          <input type="color" value={cor} onChange={e => setCor(e.target.value)} className="h-6 w-7" />
          <button className={btn} disabled={!nos.length} onClick={() => setNos(n => n.slice(0, -1))}><Undo2 className="w-3.5 h-3.5" /> Desfazer ponto</button>
          <span className="flex-1" />
          <button className={btn} onClick={onFechar}><X className="w-3.5 h-3.5" /> Cancelar</button>
          <button className={btn} disabled={nos.length < 2} onClick={() => concluir(false)} data-caneta-aberta>Linha aberta</button>
          <button className={btn + ' bg-orange-500 text-white !border-orange-500'} disabled={nos.length < 3} onClick={() => concluir(true)} data-caneta-fechar><Check className="w-3.5 h-3.5" /> Fechar forma</button>
        </div>
        <div className="relative" style={{ width: W, height: H, maxWidth: '90vw' }}>
          <canvas ref={ref} className="absolute inset-0 w-full h-full rounded border border-gray-200" />
          <svg className="absolute inset-0 w-full h-full touch-none cursor-crosshair" viewBox={`0 0 ${W} ${H}`}
            onPointerDown={e => { const p = pt(e); setNos(n => [...n, p]); setArrasto(nos.length); (e.target as Element).setPointerCapture?.(e.pointerId) }}
            onPointerMove={e => { if (arrasto === null || !(e.buttons & 1)) return; const p = pt(e); setNos(n => n.map((q, i) => (i === arrasto && Math.hypot(p.x - q.x, p.y - q.y) > 3 ? { ...q, hx: p.x, hy: p.y } : q))) }}
            onPointerUp={() => setArrasto(null)}
            onDoubleClick={() => nos.length >= 3 && concluir(true)} data-palco-caneta>
            {cx && d && <path d={d} transform={`translate(${cx.x0} ${cx.y0}) scale(${cx.w} ${cx.h})`} fill="none" stroke="#f97316" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
            {nos.map((n, i) => (
              <g key={i}>
                {n.hx !== undefined && <line x1={2 * n.x - n.hx} y1={2 * n.y - n.hy!} x2={n.hx} y2={n.hy} stroke="#7c3aed" strokeWidth={1} />}
                <circle cx={n.x} cy={n.y} r={4} fill="#ffffff" stroke="#f97316" strokeWidth={2} />
              </g>
            ))}
          </svg>
        </div>
        <p className="text-[11px] text-gray-500">Clique = ponto reto · clique e arraste = curva · duplo clique fecha. A forma vale para todas as faces da parte.</p>
      </div>
    </div>
  )
}
