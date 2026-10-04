// mae-apliques — "ORGANIZAR NA FOLHA" (Sprint 11): MaxRects (regra de cima/esquerda), com 2 mm
// de espaço entre as peças e as ZONAS DA MARCA DE REGISTRO como obstáculos (a arte não entra nos cantos
// que a câmera da plotter lê). Sem girar as peças (o aplique sai na mesma orientação da arte).
// Puro e determinístico; tudo em mm.

export interface Ret { x: number; y: number; w: number; h: number }
export interface Peca { id: string; w: number; h: number }
export interface Colocada extends Ret { id: string }

const cabe = (a: Ret, b: Ret) => a.x >= b.x - 1e-9 && a.y >= b.y - 1e-9 && a.x + a.w <= b.x + b.w + 1e-9 && a.y + a.h <= b.y + b.h + 1e-9
const cruza = (a: Ret, b: Ret) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** Tira o retângulo usado de cada retângulo livre (cortes MaxRects) e limpa os contidos. */
function ocupar(livres: Ret[], u: Ret): Ret[] {
  const novos: Ret[] = []
  for (const f of livres) {
    if (!cruza(f, u)) { novos.push(f); continue }
    if (u.x > f.x) novos.push({ x: f.x, y: f.y, w: u.x - f.x, h: f.h })
    if (u.x + u.w < f.x + f.w) novos.push({ x: u.x + u.w, y: f.y, w: f.x + f.w - (u.x + u.w), h: f.h })
    if (u.y > f.y) novos.push({ x: f.x, y: f.y, w: f.w, h: u.y - f.y })
    if (u.y + u.h < f.y + f.h) novos.push({ x: f.x, y: u.y + u.h, w: f.w, h: f.y + f.h - (u.y + u.h) })
  }
  return novos.filter((a, i) => a.w > 1e-6 && a.h > 1e-6 && !novos.some((b, j) => j !== i && cabe(a, b) && (!cabe(b, a) || j < i)))
}

export interface Resultado { colocadas: Colocada[]; sobraram: string[] }

/**
 * Distribui as peças na folha (w × h mm) dentro da margem, sem tocar nos obstáculos. O espaço entre
 * peças entra como "colchão" de meio espaço em volta de cada uma. Maiores primeiro (mais estável).
 */
export function organizar(pecas: Peca[], folhaW: number, folhaH: number, o: { espacoMm?: number; margemMm?: number; obstaculos?: Ret[] } = {}): Resultado {
  const e = o.espacoMm ?? 2, m = o.margemMm ?? 5
  let livres: Ret[] = [{ x: m - e / 2, y: m - e / 2, w: folhaW - 2 * m + e, h: folhaH - 2 * m + e }]
  for (const z of o.obstaculos ?? []) livres = ocupar(livres, { x: z.x - e / 2, y: z.y - e / 2, w: z.w + e, h: z.h + e })
  const ordem = [...pecas].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h || a.id.localeCompare(b.id))
  const colocadas: Colocada[] = [], sobraram: string[] = []
  for (const p of ordem) {
    const W = p.w + e, H = p.h + e
    // regra "de cima para baixo, da esquerda para a direita" (folha lida como texto); empate: menor sobra
    let melhor: Ret | null = null, nota: [number, number, number] = [Infinity, Infinity, Infinity]
    for (const f of livres) {
      if (W > f.w + 1e-9 || H > f.h + 1e-9) continue
      const n: [number, number, number] = [Math.round((f.y) * 1000) / 1000, Math.round(f.x * 1000) / 1000, Math.min(f.w - W, f.h - H)]
      if (n[0] < nota[0] || (n[0] === nota[0] && (n[1] < nota[1] || (n[1] === nota[1] && n[2] < nota[2])))) { melhor = f; nota = n }
    }
    if (!melhor) { sobraram.push(p.id); continue }
    const u = { x: melhor.x, y: melhor.y, w: W, h: H }
    livres = ocupar(livres, u)
    colocadas.push({ id: p.id, x: u.x + e / 2, y: u.y + e / 2, w: p.w, h: p.h })
  }
  return { colocadas, sobraram }
}
