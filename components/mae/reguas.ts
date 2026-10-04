// Réguas em mm do editor MAE (topo e esquerda). É moldura da interface, não arte — por isso não passa
// pelo mae-render. Lê o mesmo viewport do palco: o "0" da régua é o canto da prancheta.
import type { Viewport } from '@/lib/mae/render'

export const ESPESSURA_REGUA = 22

/** Passos (mm) de traço menor e de número, conforme o zoom (números a ≥ 50 px de distância). */
function passos(pxPorMm: number): { menor: number; numero: number } {
  // traço menor = 1/10 do passo numerado (1/5 quando o passo é 5 mm → traço de 1 mm)
  for (const numero of [5, 10, 20, 50, 100, 200, 500]) {
    if (numero * pxPorMm >= 50) return { numero, menor: numero / (numero === 5 ? 5 : 10) }
  }
  return { numero: 1000, menor: 100 }
}

export function desenharRegua(canvas: HTMLCanvasElement, orient: 'h' | 'v', v: Viewport, comprimentoPx: number, origemTelaPx: number) {
  const dpr = window.devicePixelRatio || 1
  const W = orient === 'h' ? comprimentoPx : ESPESSURA_REGUA, H = orient === 'h' ? ESPESSURA_REGUA : comprimentoPx
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
  const g = canvas.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.fillStyle = '#f8fafc'; g.fillRect(0, 0, W, H)
  g.strokeStyle = '#cbd5e1'; g.beginPath()
  if (orient === 'h') { g.moveTo(0, H - 0.5); g.lineTo(W, H - 0.5) } else { g.moveTo(W - 0.5, 0); g.lineTo(W - 0.5, H) }
  g.stroke()

  const { menor, numero } = passos(v.escala)
  const offset = (orient === 'h' ? v.x : v.y) - origemTelaPx   // posição do 0 mm na régua
  const ini = Math.floor(-offset / v.escala / menor) * menor
  const fim = (comprimentoPx - offset) / v.escala
  g.fillStyle = '#475569'; g.strokeStyle = '#94a3b8'
  g.font = '10px system-ui, sans-serif'
  g.beginPath()
  for (let mm = ini; mm <= fim; mm += menor) {
    const p = Math.round(offset + mm * v.escala) + 0.5
    const ehNumero = Math.abs(mm / numero - Math.round(mm / numero)) < 1e-6
    const tam = ehNumero ? 10 : (Math.abs(mm / (numero / 2) - Math.round(mm / (numero / 2))) < 1e-6 ? 6 : 3)
    if (orient === 'h') { g.moveTo(p, H); g.lineTo(p, H - tam) } else { g.moveTo(W, p); g.lineTo(W - tam, p) }
    if (ehNumero) {
      const txt = String(Math.round(mm))
      if (orient === 'h') g.fillText(txt, p + 2, 10)
      else { g.save(); g.translate(10, p - 2); g.rotate(-Math.PI / 2); g.fillText(txt, 0, 0); g.restore() }
    }
  }
  g.stroke()
}
