// O TEXTO SAIU DA FACE? (Lote 1, item 8) — confere a caixa do texto já posicionada (mm da folha) contra o
// polígono da face: qualquer ponto fora, ou a menos de `margemMm` de uma aresta (linha de corte ou de
// dobra), conta como "passou da face". Puro e determinístico (vale na tela, no arquivo e no lote).
import type { Pt } from '../faces/geometria'

function dentro([x, y]: Pt, poly: Pt[]): boolean {
  let d = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) d = !d
  }
  return d
}

function distSegmento([x, y]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy
  const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
}

/** Pontos ao longo do contorno de um quadrilátero (os 4 cantos + `n` por lado). */
export function amostrarContorno(cantos: Pt[], n = 8): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < cantos.length; i++) {
    const a = cantos[i], b = cantos[(i + 1) % cantos.length]
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  return out
}

/** true = algum ponto está fora da face ou encostado (< margem) numa linha de corte/dobra. */
export function passouDaFace(pontos: Pt[], face: Pt[], margemMm = 0.4): boolean {
  if (face.length < 3) return false
  return pontos.some(p => !dentro(p, face) || face.some((a, i) => distSegmento(p, a, face[(i + 1) % face.length]) < margemMm))
}

/** "O nome passou da face na caixa MILK, revise" (IDADE/HASHTAG/@ também). */
export function avisoPassou(variavel: string, caixa: string): string {
  const quem = variavel === 'NOME' ? 'O nome' : variavel === 'IDADE' ? 'A idade' : variavel === 'HASHTAG' ? 'A hashtag' : variavel === 'ARROBA' ? 'O @' : `O texto ${variavel}`
  return `${quem} passou da face na caixa ${caixa}, revise`
}
