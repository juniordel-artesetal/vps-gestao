'use client'
'use no memo'
// CAIXA DE TRANSFORMAÇÃO (Lote 1, item 9; Lote 3, item 28) — o "Ctrl+T do Photoshop" no palco, para logo,
// QR, @, NOME, IDADE e HASHTAG:
//   · arrastar o contorno MOVE;
//   · alças dos CANTOS mudam o tamanho mantendo a proporção, presas no canto oposto (com Alt: a partir do centro);
//   · alças do MEIO das laterais (quando a caixa aceita) esticam só a largura ou só a altura;
//   · a alça de cima GIRA (com Shift, de 15° em 15°).
// O contorno acompanha o mouse durante o arraste (prévia ao vivo); a mudança vale ao soltar. O cursor muda
// conforme a alça. Coordenadas = as do grupo onde ela está (mm).
import { useState } from 'react'
import { Circle, Group, Line, Rect } from 'react-konva'
import type Konva from 'konva'
import type { Pt } from '@/lib/mae/faces/geometria'

export interface PropsCaixa {
  /** Os 4 cantos (sentido horário a partir do de cima à esquerda), já girados. */
  cantos: Pt[]
  /** Fator px→mm da tela (para as alças terem tamanho fixo em pixels). */
  fino: number
  /** Muda quando o objeto muda (recria as alças na posição nova). */
  chave: string
  cor?: string
  /** `alt`: Alt apertado ao soltar (Lote 4, item 52: Alt + arrastar duplica). */
  onMover: (dx: number, dy: number, alt?: boolean) => void
  /** `k` = fator de tamanho; `desloc` = quanto o CENTRO andou (mm) — escala presa no canto oposto. */
  onEscalar: (k: number, desloc: [number, number]) => void
  /** Esticar só um eixo da caixa ('x' = largura, 'y' = altura). Sem isto, as alças das laterais não aparecem. */
  onEsticar?: (eixo: 'x' | 'y', k: number, desloc: [number, number]) => void
  /** `graus` = quanto girou neste arraste; `shift` = arredondar o ângulo final de 15 em 15. */
  onGirar: (graus: number, shift: boolean) => void
}

const parar = (ev: Konva.KonvaEventObject<PointerEvent>) => { ev.evt.stopPropagation() }
const cursor = (ev: Konva.KonvaEventObject<MouseEvent>, c: string) => { const el = ev.target.getStage()?.container(); if (el) el.style.cursor = c }
// seta curva (girar), em SVG
const CURSOR_GIRAR = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="white" stroke-width="4.4"/><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>')}") 12 12, grab`
const meio = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]]
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1]
/** Fator do arraste: projeção de (p − âncora) na direção (alça − âncora). */
const fatorDe = (p: Pt, alca: Pt, ancora: Pt) => { const d = sub(alca, ancora), n = dot(d, d); return n > 1e-9 ? dot(sub(p, ancora), d) / n : 1 }

export default function CaixaTransformavel({ cantos, fino, chave, cor = '#f97316', onMover, onEscalar, onEsticar, onGirar }: PropsCaixa) {
  const cx = cantos.reduce((s, p) => s + p[0], 0) / 4, cy = cantos.reduce((s, p) => s + p[1], 0) / 4
  const C: Pt = [cx, cy]
  // alça de giro: um pouco acima do meio da aresta de cima, na direção "para fora"
  const topo = meio(cantos[0], cantos[1])
  const dir = [topo[0] - cx, topo[1] - cy], L = Math.hypot(dir[0], dir[1]) || 1
  const giro: Pt = [topo[0] + (dir[0] / L) * 16 * fino, topo[1] + (dir[1] / L) * 16 * fino]
  const [previa, setPrevia] = useState<Pt[] | null>(null)
  const r = 5 * fino, alvo = 12   // raio visível (mm na tela ≈ 5 px) e área de clique (px)

  /** Cantos escalados por `k` em volta de `ancora` (todos os eixos). */
  const escalados = (k: number, ancora: Pt) => cantos.map(p => [ancora[0] + (p[0] - ancora[0]) * k, ancora[1] + (p[1] - ancora[1]) * k] as Pt)
  /** Cantos esticados só na direção `eixoDir` (unitário), por `k`, em volta de `ancora`. */
  const esticados = (k: number, ancora: Pt, eixoDir: Pt) => cantos.map(p => { const t = dot(sub(p, ancora), eixoDir); return [p[0] + eixoDir[0] * t * (k - 1), p[1] + eixoDir[1] * t * (k - 1)] as Pt })
  const girados = (graus: number) => { const t = (graus * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t); return cantos.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c] as Pt) }

  const pos = (ev: Konva.KonvaEventObject<DragEvent>): Pt => [ev.target.x(), ev.target.y()]
  const lados = [0, 1, 2, 3].map(i => ({ i, m: meio(cantos[i], cantos[(i + 1) % 4]), eixo: (i % 2 === 0 ? 'y' : 'x') as 'x' | 'y' }))

  return (
    <Group key={`cx:${chave}`} data-caixa-transformar>
      <Line points={cantos.flat()} closed stroke={cor} strokeWidth={2} strokeScaleEnabled={false} dash={[6 * fino, 4 * fino]} fill="rgba(249,115,22,0.06)" draggable
        onPointerDown={parar} onMouseEnter={ev => cursor(ev, 'move')} onMouseLeave={ev => cursor(ev, '')}
        onDragMove={ev => setPrevia(cantos.map(([x, y]) => [x + ev.target.x(), y + ev.target.y()] as Pt))}
        onDragEnd={ev => { const dx = ev.target.x(), dy = ev.target.y(); ev.target.position({ x: 0, y: 0 }); setPrevia(null); if (Math.hypot(dx, dy) > 0.05) onMover(dx, dy, ev.evt.altKey) }} />
      {previa && <Line points={previa.flat()} closed stroke={cor} strokeWidth={1.5} strokeScaleEnabled={false} fill="rgba(249,115,22,0.12)" listening={false} data-previa-transformar />}
      {cantos.map(([x, y], i) => {
        const oposto = cantos[(i + 2) % 4]
        const ancoraDe = (alt: boolean) => (alt ? C : oposto)
        return (
          <Circle key={`esc${i}:${chave}`} x={x} y={y} radius={r} fill="#ffffff" stroke={cor} strokeWidth={1.5} strokeScaleEnabled={false} hitStrokeWidth={alvo} draggable
            onPointerDown={parar} onMouseEnter={ev => cursor(ev, i % 2 === 0 ? 'nwse-resize' : 'nesw-resize')} onMouseLeave={ev => cursor(ev, '')}
            onDragMove={ev => { const a = ancoraDe(ev.evt.altKey); setPrevia(escalados(Math.max(0.05, fatorDe(pos(ev), [x, y], a)), a)) }}
            onDragEnd={ev => {
              const a = ancoraDe(ev.evt.altKey), k = fatorDe(pos(ev), [x, y], a)
              setPrevia(null); ev.target.position({ x, y })
              if (Number.isFinite(k) && k > 0.05 && Math.abs(k - 1) > 0.002) onEscalar(k, [(a[0] + (cx - a[0]) * k) - cx, (a[1] + (cy - a[1]) * k) - cy])
            }} data-alca-tamanho={i} />
        )
      })}
      {onEsticar && lados.map(({ i, m, eixo }) => {
        const oposto = lados[(i + 2) % 4].m
        const d = sub(m, C), n = Math.hypot(d[0], d[1]) || 1, eixoDir: Pt = [d[0] / n, d[1] / n]
        const ancoraDe = (alt: boolean) => (alt ? C : oposto)
        const vertical = Math.abs(eixoDir[1]) > Math.abs(eixoDir[0])
        return (
          <Rect key={`lado${i}:${chave}`} x={m[0]} y={m[1]} width={2 * r} height={2 * r} offsetX={r} offsetY={r} fill="#ffffff" stroke={cor} strokeWidth={1.5} strokeScaleEnabled={false} hitStrokeWidth={alvo} draggable
            onPointerDown={parar} onMouseEnter={ev => cursor(ev, vertical ? 'ns-resize' : 'ew-resize')} onMouseLeave={ev => cursor(ev, '')}
            onDragMove={ev => { const a = ancoraDe(ev.evt.altKey); setPrevia(esticados(Math.max(0.05, fatorDe(pos(ev), m, a)), a, eixoDir)) }}
            onDragEnd={ev => {
              const a = ancoraDe(ev.evt.altKey), k = fatorDe(pos(ev), m, a)
              setPrevia(null); ev.target.position({ x: m[0], y: m[1] })
              const t = dot(sub(C, a), eixoDir) * (k - 1)
              if (Number.isFinite(k) && k > 0.05 && Math.abs(k - 1) > 0.002) onEsticar(eixo, k, [eixoDir[0] * t, eixoDir[1] * t])
            }} data-alca-lado={eixo} />
        )
      })}
      <Line points={[...topo, ...giro]} stroke={cor} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
      <Circle key={`giro:${chave}`} x={giro[0]} y={giro[1]} radius={r} fill={cor} stroke="#ffffff" strokeWidth={1.5} strokeScaleEnabled={false} hitStrokeWidth={alvo} draggable
        onPointerDown={parar} onMouseEnter={ev => cursor(ev, CURSOR_GIRAR)} onMouseLeave={ev => cursor(ev, '')}
        onDragMove={ev => { const a0 = Math.atan2(giro[1] - cy, giro[0] - cx), a1 = Math.atan2(ev.target.y() - cy, ev.target.x() - cx); setPrevia(girados(((a1 - a0) * 180) / Math.PI)) }}
        onDragEnd={ev => {
          const a0 = Math.atan2(giro[1] - cy, giro[0] - cx), a1 = Math.atan2(ev.target.y() - cy, ev.target.x() - cx)
          setPrevia(null); ev.target.position({ x: giro[0], y: giro[1] })
          onGirar(((a1 - a0) * 180) / Math.PI, ev.evt.shiftKey)
        }} data-alca-girar />
    </Group>
  )
}

/** Ângulo final normalizado (−180..180), com Shift de 15 em 15. */
export function anguloFinal(atual: number, delta: number, shift: boolean): number {
  let r = ((atual + delta + 540) % 360) - 180
  if (shift) r = Math.round(r / 15) * 15
  return Math.round(r * 10) / 10
}

/** Os 4 cantos de um retângulo (x, y, w, h) girado `graus` em volta do centro. */
export function cantosGirados(x: number, y: number, w: number, h: number, graus = 0): Pt[] {
  const cx = x + w / 2, cy = y + h / 2, t = (graus * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t)
  return ([[x, y], [x + w, y], [x + w, y + h], [x, y + h]] as Pt[]).map(([px, py]) => [cx + (px - cx) * c - (py - cy) * s, cy + (px - cx) * s + (py - cy) * c])
}
