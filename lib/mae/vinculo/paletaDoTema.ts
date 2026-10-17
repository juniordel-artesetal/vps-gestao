// Lote 21 (item 254): PALETA DO TEMA — os tons que já existem nos papéis e elementos do tema, para escolher a cor do
// nome, do contorno, da faixa, das formas e da transição com cor sem "chutar" no seletor. Puro (sem DOM): recebe os
// pixels (RGB) e devolve 5 a 8 cores principais, cada uma com um tom mais claro e um mais escuro.

export interface CorDaPaleta { cor: string; clara: string; escura: string; peso: number }

const hexa = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
const misturar = (c: number[], alvo: number, t: number) => c.map(v => v + (alvo - v) * t)
const dist2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

/**
 * k-means determinístico (início pelo ponto mais distante) sobre os pixels RGB (`[r,g,b, r,g,b, …]`).
 * Junta tons quase iguais, descarta os que pesam menos de 2% e devolve de 5 a 8 (ou menos, se a arte tem poucas cores).
 */
export function paletaDePixels(rgb: ArrayLike<number>, o: { max?: number; min?: number } = {}): CorDaPaleta[] {
  const max = o.max ?? 8, min = o.min ?? 5
  const n = Math.floor(rgb.length / 3)
  if (!n) return []
  // amostra de até ~4 mil pixels (passo fixo: o mesmo resultado sempre)
  const passo = Math.max(1, Math.floor(n / 4000))
  const pts: number[][] = []
  for (let i = 0; i < n; i += passo) pts.push([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]])
  const k = Math.min(12, pts.length)
  // início: a média e depois sempre o ponto mais longe dos centros já escolhidos
  const media = [0, 1, 2].map(c => pts.reduce((s, p) => s + p[c], 0) / pts.length)
  const centros: number[][] = [pts.reduce((m, p) => (dist2(p, media) < dist2(m, media) ? p : m), pts[0]).slice()]
  const dMin = pts.map(p => dist2(p, centros[0]))
  while (centros.length < k) {
    let j = 0
    for (let i = 1; i < pts.length; i++) if (dMin[i] > dMin[j]) j = i
    if (dMin[j] === 0) break
    centros.push(pts[j].slice())
    for (let i = 0; i < pts.length; i++) dMin[i] = Math.min(dMin[i], dist2(pts[i], pts[j]))
  }
  const grupo = new Array<number>(pts.length).fill(0)
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < pts.length; i++) {
      let b = 0, bd = Infinity
      for (let c = 0; c < centros.length; c++) { const d = dist2(pts[i], centros[c]); if (d < bd) { bd = d; b = c } }
      grupo[i] = b
    }
    const soma = centros.map(() => [0, 0, 0, 0])
    for (let i = 0; i < pts.length; i++) { const s = soma[grupo[i]]; s[0] += pts[i][0]; s[1] += pts[i][1]; s[2] += pts[i][2]; s[3]++ }
    soma.forEach((s, c) => { if (s[3]) centros[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]] })
  }
  const peso = centros.map(() => 0)
  for (const g of grupo) peso[g]++
  let lista = centros.map((c, i) => ({ c, p: peso[i] / pts.length })).filter(x => x.p > 0).sort((a, b) => b.p - a.p)
  // junta tons quase iguais (a olho, a mesma cor)
  const juntos: { c: number[]; p: number }[] = []
  for (const x of lista) {
    const igual = juntos.find(y => dist2(y.c, x.c) < 28 * 28)
    if (igual) { const t = igual.p + x.p; igual.c = igual.c.map((v, i) => (v * igual.p + x.c[i] * x.p) / t); igual.p = t } else juntos.push({ ...x })
  }
  lista = juntos.sort((a, b) => b.p - a.p)
  const fortes = lista.filter(x => x.p >= 0.02)
  const escolhidas = (fortes.length >= min ? fortes : lista.slice(0, Math.max(fortes.length, min))).slice(0, max)
  return escolhidas.map(x => ({
    cor: hexa(x.c[0], x.c[1], x.c[2]),
    clara: hexa(...(misturar(x.c, 255, 0.4) as [number, number, number])),
    escura: hexa(...(misturar(x.c, 0, 0.35) as [number, number, number])),
    peso: Math.round(x.p * 1000) / 1000,
  }))
}

/** Os arquivos de imagem que o tema usa (papéis, elementos e páginas de tema pronto — não marcas/moldes), na ordem em que aparecem — sem repetir. */
export function imagensDoTema(tema: unknown): string[] {
  const out = new Set<string>()
  const andar = (v: unknown) => {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) { v.forEach(andar); return }
    for (const [k, x] of Object.entries(v)) {
      if (k === 'path' && typeof x === 'string' && !/^(Marcas|Moldes|Identidade)\//i.test(x) && /\.(png|jpe?g|webp)$/i.test(x)) out.add(x)
      else andar(x)
    }
  }
  andar(tema)
  return [...out]
}
