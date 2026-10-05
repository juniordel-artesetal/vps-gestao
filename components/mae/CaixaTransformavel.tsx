'use client'
'use no memo'
// CAIXA DE TRANSFORMAÇÃO (Lote 1, item 9) — o "Ctrl+T do Photoshop" no palco, para logo, QR, @, NOME, IDADE
// e HASHTAG: arrastar o contorno MOVE; as alças dos cantos mudam o TAMANHO mantendo a proporção (em volta
// do centro); a alça de cima GIRA (com Shift, de 15° em 15°). Coordenadas = as do grupo onde ela está (mm).
import { Circle, Group, Line } from 'react-konva'
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
  onMover: (dx: number, dy: number) => void
  onEscalar: (k: number) => void
  /** `graus` = quanto girou neste arraste; `shift` = arredondar o ângulo final de 15 em 15. */
  onGirar: (graus: number, shift: boolean) => void
}

const parar = (ev: Konva.KonvaEventObject<PointerEvent>) => { ev.evt.stopPropagation() }

export default function CaixaTransformavel({ cantos, fino, chave, cor = '#f97316', onMover, onEscalar, onGirar }: PropsCaixa) {
  const cx = cantos.reduce((s, p) => s + p[0], 0) / 4, cy = cantos.reduce((s, p) => s + p[1], 0) / 4
  // alça de giro: um pouco acima do meio da aresta de cima, na direção "para fora"
  const topo: Pt = [(cantos[0][0] + cantos[1][0]) / 2, (cantos[0][1] + cantos[1][1]) / 2]
  const dir = [topo[0] - cx, topo[1] - cy], L = Math.hypot(dir[0], dir[1]) || 1
  const giro: Pt = [topo[0] + (dir[0] / L) * 14 * fino, topo[1] + (dir[1] / L) * 14 * fino]
  return (
    <Group key={`cx:${chave}`} data-caixa-transformar>
      <Line points={cantos.flat()} closed stroke={cor} strokeWidth={2} strokeScaleEnabled={false} dash={[6 * fino, 4 * fino]} fill="rgba(249,115,22,0.06)" draggable
        onPointerDown={parar}
        onDragEnd={ev => { const dx = ev.target.x(), dy = ev.target.y(); ev.target.position({ x: 0, y: 0 }); if (Math.hypot(dx, dy) > 0.05) onMover(dx, dy) }} />
      {cantos.map(([x, y], i) => (
        <Circle key={`esc${i}:${chave}`} x={x} y={y} radius={4.5 * fino} fill="#ffffff" stroke={cor} strokeWidth={1.5} strokeScaleEnabled={false} draggable
          onPointerDown={parar}
          onDragEnd={ev => {
            const k = Math.hypot(ev.target.x() - cx, ev.target.y() - cy) / Math.max(1e-6, Math.hypot(x - cx, y - cy))
            if (Number.isFinite(k) && k > 0 && Math.abs(k - 1) > 0.002) onEscalar(k)
          }} data-alca-tamanho={i} />
      ))}
      <Line points={[...topo, ...giro]} stroke={cor} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
      <Circle key={`giro:${chave}`} x={giro[0]} y={giro[1]} radius={4.5 * fino} fill={cor} stroke="#ffffff" strokeWidth={1.5} strokeScaleEnabled={false} draggable
        onPointerDown={parar}
        onDragEnd={ev => {
          const a0 = Math.atan2(giro[1] - cy, giro[0] - cx), a1 = Math.atan2(ev.target.y() - cy, ev.target.x() - cx)
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
