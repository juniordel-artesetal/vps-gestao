// mae-edição — FORMAS (Sprint 10): retângulo (cantos arredondados), elipse, polígono, estrela, coração,
// linha, seta (Sprint 13) e caminho da caneta Bézier — todas desenhadas no QUADRADO UNITÁRIO da camada (0..1), que a
// matriz da camada leva para a face. Puro.
import type { Cmd } from '../texto/fonte'

const K = 0.5522847498   // círculo por 4 Béziers

export interface ParamsForma { radius?: number; sides?: number; inner?: number; d?: string }

export function formaEmCmds(kind: string, p: ParamsForma = {}): Cmd[] {
  switch (kind) {
    case 'rect': {
      const r = Math.min(0.5, Math.max(0, p.radius ?? 0))
      if (!r) return [['M', 0, 0], ['L', 1, 0], ['L', 1, 1], ['L', 0, 1], ['Z']]
      const c = r * K
      return [['M', r, 0], ['L', 1 - r, 0], ['C', 1 - r + c, 0, 1, r - c, 1, r], ['L', 1, 1 - r], ['C', 1, 1 - r + c, 1 - r + c, 1, 1 - r, 1],
        ['L', r, 1], ['C', r - c, 1, 0, 1 - r + c, 0, 1 - r], ['L', 0, r], ['C', 0, r - c, r - c, 0, r, 0], ['Z']]
    }
    case 'ellipse': {
      const c = 0.5 * K
      return [['M', 1, 0.5], ['C', 1, 0.5 + c, 0.5 + c, 1, 0.5, 1], ['C', 0.5 - c, 1, 0, 0.5 + c, 0, 0.5], ['C', 0, 0.5 - c, 0.5 - c, 0, 0.5, 0], ['C', 0.5 + c, 0, 1, 0.5 - c, 1, 0.5], ['Z']]
    }
    case 'polygon': case 'star': {
      const n = Math.max(3, Math.min(24, p.sides ?? (kind === 'star' ? 5 : 6))), inner = p.inner ?? 0.5
      const pts: [number, number][] = []
      const tot = kind === 'star' ? n * 2 : n
      for (let i = 0; i < tot; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / tot, r = kind === 'star' && i % 2 ? 0.5 * inner : 0.5
        pts.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)])
      }
      return [['M', ...pts[0]], ...pts.slice(1).map(q => ['L', ...q] as Cmd), ['Z']]
    }
    case 'heart':
      return [['M', 0.5, 0.25], ['C', 0.5, 0.05, 0.12, 0, 0.04, 0.24], ['C', -0.04, 0.48, 0.25, 0.7, 0.5, 1],
        ['C', 0.75, 0.7, 1.04, 0.48, 0.96, 0.24], ['C', 0.88, 0, 0.5, 0.05, 0.5, 0.25], ['Z']]
    case 'line': return [['M', 0, 0.5], ['L', 1, 0.5]]
    // seta (vinda do SOA Design): haste + ponta, preenchida
    case 'arrow': return [['M', 0, 0.38], ['L', 0.62, 0.38], ['L', 0.62, 0.12], ['L', 1, 0.5], ['L', 0.62, 0.88], ['L', 0.62, 0.62], ['L', 0, 0.62], ['Z']]
    case 'path': return p.d ? svgParaCmds(p.d) : []
    // Lote 10 (item 157): ESCALOPE (moldura de babados) e NUVEM — bolinhas em volta de um círculo
    case 'scallop': case 'cloud': {
      const n = Math.max(3, Math.min(24, p.sides ?? (kind === 'cloud' ? 7 : 12)))
      const fundo = Math.max(0.5, Math.min(0.97, p.inner ?? (kind === 'cloud' ? 0.72 : 0.86)))
      const passos = n * 10, pts: [number, number][] = []
      for (let i = 0; i < passos; i++) {
        const t = (i / passos) * Math.PI * 2
        const bolha = Math.sqrt(Math.abs(Math.sin((n * t) / 2)))
        const r = 0.5 * (fundo + (1 - fundo) * bolha)
        pts.push([0.5 + r * Math.cos(t - Math.PI / 2), 0.5 + r * Math.sin(t - Math.PI / 2)])
      }
      return [['M', ...pts[0]], ...pts.slice(1).map(q => ['L', ...q] as Cmd), ['Z']]
    }
    default: return []
  }
}

/**
 * Lote 10 (itens 157/158): o CONTORNO da forma como polígonos (no quadrado 0..1), com as curvas achatadas — base da
 * moldurinha afastada da borda e do contorno das peças do conjunto de aplique.
 */
export function contornoDaForma(kind: string, p: ParamsForma = {}, passos = 16): [number, number][][] {
  const out: [number, number][][] = []
  let atual: [number, number][] = [], x = 0, y = 0
  for (const c of formaEmCmds(kind, p)) {
    if (c[0] === 'M') { if (atual.length > 2) out.push(atual); atual = [[c[1], c[2]]]; x = c[1]; y = c[2] }
    else if (c[0] === 'L') { atual.push([c[1], c[2]]); x = c[1]; y = c[2] }
    else if (c[0] === 'C') {
      for (let i = 1; i <= passos; i++) {
        const t = i / passos, u = 1 - t
        atual.push([u * u * u * x + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5], u * u * u * y + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6]])
      }
      x = c[5]; y = c[6]
    } else if (c[0] === 'Q') {
      for (let i = 1; i <= passos; i++) { const t = i / passos, u = 1 - t; atual.push([u * u * x + 2 * u * t * c[1] + t * t * c[3], u * u * y + 2 * u * t * c[2] + t * t * c[4]]) }
      x = c[3]; y = c[4]
    } else if (c[0] === 'Z') { if (atual.length > 2) out.push(atual); atual = [] }
  }
  if (atual.length > 2) out.push(atual)
  return out
}

/** Lê um caminho SVG simples (M, L, C, Q, Z absolutos — é o que a caneta grava). */
export function svgParaCmds(d: string): Cmd[] {
  const out: Cmd[] = []
  const re = /([MLCQZ])([^MLCQZ]*)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) {
    const t = m[1].toUpperCase(), v = (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number)
    if (t === 'Z') out.push(['Z'])
    else if (t === 'M' || t === 'L') for (let i = 0; i + 1 < v.length; i += 2) out.push([i === 0 ? t : 'L', v[i], v[i + 1]] as Cmd)
    else if (t === 'C') for (let i = 0; i + 5 < v.length; i += 6) out.push(['C', v[i], v[i + 1], v[i + 2], v[i + 3], v[i + 4], v[i + 5]])
    else if (t === 'Q') for (let i = 0; i + 3 < v.length; i += 4) out.push(['Q', v[i], v[i + 1], v[i + 2], v[i + 3]])
  }
  return out
}

/**
 * Caneta Bézier: pontos clicados (com alças opcionais, "arrastar = curva") → caminho SVG no quadrado
 * unitário da caixa dos pontos. Devolve também a caixa (para posicionar a camada).
 */
export function canetaParaCaminho(nos: { x: number; y: number; hx?: number; hy?: number }[], fechado: boolean): { d: string; caixa: { x0: number; y0: number; w: number; h: number } } | null {
  if (nos.length < 2) return null
  const xs = nos.flatMap(n => [n.x, n.hx ?? n.x, 2 * n.x - (n.hx ?? n.x)]), ys = nos.flatMap(n => [n.y, n.hy ?? n.y, 2 * n.y - (n.hy ?? n.y)])
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(1e-6, Math.max(...xs) - x0), h = Math.max(1e-6, Math.max(...ys) - y0)
  const u = (x: number) => +((x - x0) / w).toFixed(4), v = (y: number) => +((y - y0) / h).toFixed(4)
  let d = `M${u(nos[0].x)} ${v(nos[0].y)}`
  const seg = (a: typeof nos[0], b: typeof nos[0]) => {
    // alça de saída de a = (hx,hy); alça de entrada de b = espelho da alça de b
    const c1x = a.hx ?? a.x, c1y = a.hy ?? a.y, c2x = b.hx !== undefined ? 2 * b.x - b.hx : b.x, c2y = b.hy !== undefined ? 2 * b.y - b.hy : b.y
    d += a.hx === undefined && b.hx === undefined ? `L${u(b.x)} ${v(b.y)}` : `C${u(c1x)} ${v(c1y)} ${u(c2x)} ${v(c2y)} ${u(b.x)} ${v(b.y)}`
  }
  for (let i = 1; i < nos.length; i++) seg(nos[i - 1], nos[i])
  if (fechado) { seg(nos[nos.length - 1], nos[0]); d += 'Z' }
  return { d, caixa: { x0, y0, w, h } }
}
