// SOA Edition — AJUSTES NÃO-DESTRUTIVOS de imagem (brilho, contraste, saturação, matiz,
// temperatura, curvas simples, filtros prontos) + máscara de pintura. Funções PURAS sobre
// canvas: rodam no navegador (HTMLCanvasElement) e no Web Worker (OffscreenCanvas).
//
// "Não-destrutivo" = o pixel original nunca é alterado: a camada guarda só os PARÂMETROS e a
// imagem exibida é sempre recalculada a partir do original (ver lib/estudio/camadas).
// Pixel a pixel em JS (e não ctx.filter): o Safari não suporta ctx.filter, e o resultado precisa
// ser idêntico em todo navegador — o que a artesã vê é o que exporta.

export type Canvas2D = HTMLCanvasElement | OffscreenCanvas
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
export type CriarCanvas = (w: number, h: number) => Canvas2D

export const criarCanvasPadrao: CriarCanvas = (w, h) => {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  return new OffscreenCanvas(w, h)
}
export const ctx2d = (c: Canvas2D) => c.getContext('2d', { willReadFrequently: true }) as Ctx2D

export type Filtro = 'nenhum' | 'pb' | 'sepia' | 'vintage' | 'vivo' | 'frio' | 'quente' | 'suave'

export interface Ajustes {
  /** −100…100 */ brilho: number
  /** −100…100 */ contraste: number
  /** −100…100 (−100 = preto e branco) */ saturacao: number
  /** −180…180 graus */ matiz: number
  /** −100 (frio/azulado) … 100 (quente/amarelado) */ temperatura: number
  /** Curva simples em 3 pontos: deslocamento de −60…60 em sombras (64), meios-tons (128) e luzes (192). */
  curvas: { sombras: number; meios: number; luzes: number }
  filtro: Filtro
}

export const AJUSTES_NEUTROS: Ajustes = { brilho: 0, contraste: 0, saturacao: 0, matiz: 0, temperatura: 0, curvas: { sombras: 0, meios: 0, luzes: 0 }, filtro: 'nenhum' }

export const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'nenhum', rotulo: 'Original' }, { id: 'vivo', rotulo: 'Vivo' }, { id: 'suave', rotulo: 'Suave' },
  { id: 'quente', rotulo: 'Quente' }, { id: 'frio', rotulo: 'Frio' }, { id: 'pb', rotulo: 'P&B' },
  { id: 'sepia', rotulo: 'Sépia' }, { id: 'vintage', rotulo: 'Vintage' },
]

export function ehNeutro(a: Ajustes | null | undefined): boolean {
  if (!a) return true
  return !a.brilho && !a.contraste && !a.saturacao && !a.matiz && !a.temperatura &&
    !a.curvas?.sombras && !a.curvas?.meios && !a.curvas?.luzes && (!a.filtro || a.filtro === 'nenhum')
}

/** Filtro pronto = deslocamento dos parâmetros (+ tom sépia). Mantém o filtro editável por cima dos ajustes. */
function efetivos(a: Ajustes): Ajustes & { sepia: number } {
  const e = { ...AJUSTES_NEUTROS, ...a, curvas: { ...AJUSTES_NEUTROS.curvas, ...a.curvas }, sepia: 0 }
  switch (a.filtro) {
    case 'pb': e.saturacao = -100; e.contraste += 10; break
    case 'sepia': e.sepia = 1; break
    case 'vintage': e.sepia = 0.45; e.contraste -= 12; e.curvas.sombras += 18; e.saturacao -= 15; break
    case 'vivo': e.saturacao += 35; e.contraste += 12; break
    case 'suave': e.contraste -= 18; e.curvas.sombras += 12; e.brilho += 6; break
    case 'quente': e.temperatura += 35; break
    case 'frio': e.temperatura -= 35; break
  }
  return e
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

/** Interpolação cúbica MONÓTONA (Fritsch–Carlson): a curva nunca "dobra" nem inverte tons. */
function curvaLUT(pts: [number, number][]): Uint8ClampedArray {
  const n = pts.length
  const dx = [], dy = [], m: number[] = []
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); dy.push(pts[i + 1][1] - pts[i][1]); m.push(dy[i] / dx[i]) }
  const t = [m[0]]
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  t.push(m[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i] }
  }
  const lut = new Uint8ClampedArray(256)
  let seg = 0
  for (let x = 0; x < 256; x++) {
    while (seg < n - 2 && x > pts[seg + 1][0]) seg++
    const h = dx[seg], u = (x - pts[seg][0]) / h
    const h00 = (1 + 2 * u) * (1 - u) ** 2, h10 = u * (1 - u) ** 2, h01 = u * u * (3 - 2 * u), h11 = u * u * (u - 1)
    lut[x] = clamp(Math.round(h00 * pts[seg][1] + h10 * h * t[seg] + h01 * pts[seg + 1][1] + h11 * h * t[seg + 1]))
  }
  return lut
}

/** Matriz 3×3 de cor: saturação + rotação de matiz (mesmas fórmulas do CSS) + sépia. */
function matrizCor(sat: number, matizGraus: number, sepia: number): number[] {
  const s = 1 + sat / 100
  const lr = 0.2126, lg = 0.7152, lb = 0.0722
  let M = [
    lr + (1 - lr) * s, lg - lg * s, lb - lb * s,
    lr - lr * s, lg + (1 - lg) * s, lb - lb * s,
    lr - lr * s, lg - lg * s, lb + (1 - lb) * s,
  ]
  if (matizGraus) {
    const a = (matizGraus * Math.PI) / 180, c = Math.cos(a), n = Math.sin(a)
    const H = [
      0.213 + c * 0.787 - n * 0.213, 0.715 - c * 0.715 - n * 0.715, 0.072 - c * 0.072 + n * 0.928,
      0.213 - c * 0.213 + n * 0.143, 0.715 + c * 0.285 + n * 0.140, 0.072 - c * 0.072 - n * 0.283,
      0.213 - c * 0.213 - n * 0.787, 0.715 - c * 0.715 + n * 0.715, 0.072 + c * 0.928 + n * 0.072,
    ]
    M = mult(H, M)
  }
  if (sepia) {
    const S = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131]
    const I = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    M = mult(I.map((v, i) => v * (1 - sepia) + S[i] * sepia), M)
  }
  return M
}
function mult(a: number[], b: number[]): number[] {
  const r = new Array(9).fill(0)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]
  return r
}

/** Aplica os ajustes NO LUGAR sobre os pixels (RGBA). */
export function ajustarPixels(d: Uint8ClampedArray, a: Ajustes): void {
  const e = efetivos(a)
  const usaMatriz = e.saturacao !== 0 || e.matiz !== 0 || e.sepia > 0
  const M = usaMatriz ? matrizCor(Math.max(-100, e.saturacao), e.matiz, e.sepia) : null

  // LUT por canal: curvas → contraste → brilho → temperatura (R sobe/B desce no quente).
  // Pontos sempre crescentes: a curva clareia/escurece mas nunca inverte tons (vira negativo).
  const y1 = clamp(64 + e.curvas.sombras), y2 = Math.max(y1, clamp(128 + e.curvas.meios)), y3 = Math.max(y2, clamp(192 + e.curvas.luzes))
  const curva = curvaLUT([[0, 0], [64, y1], [128, y2], [192, y3], [255, Math.max(255, y3)]])
  const c = Math.max(-99, Math.min(100, e.contraste))
  const fc = (259 * (c * 2.55 + 255)) / (255 * (259 - c * 2.55))
  const b = e.brilho * 1.6
  const t = e.temperatura * 0.45
  const lutR = new Uint8ClampedArray(256), lutG = new Uint8ClampedArray(256), lutB = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    const v = fc * (curva[i] - 128) + 128 + b
    lutR[i] = clamp(v + t); lutG[i] = clamp(v + t * 0.15); lutB[i] = clamp(v - t)
  }
  for (let p = 0; p < d.length; p += 4) {
    let r = d[p], g = d[p + 1], bl = d[p + 2]
    if (M) {
      const nr = M[0] * r + M[1] * g + M[2] * bl, ng = M[3] * r + M[4] * g + M[5] * bl, nb = M[6] * r + M[7] * g + M[8] * bl
      r = nr < 0 ? 0 : nr > 255 ? 255 : nr | 0; g = ng < 0 ? 0 : ng > 255 ? 255 : ng | 0; bl = nb < 0 ? 0 : nb > 255 ? 255 : nb | 0
    }
    d[p] = lutR[r]; d[p + 1] = lutG[g]; d[p + 2] = lutB[bl]
  }
}

/** Nova imagem com os ajustes (a fonte fica intacta). */
export function aplicarAjustes(src: CanvasImageSource, w: number, h: number, a: Ajustes, criar: CriarCanvas = criarCanvasPadrao): Canvas2D {
  const out = criar(w, h)
  const g = ctx2d(out)
  g.drawImage(src, 0, 0, w, h)
  if (ehNeutro(a)) return out
  const img = g.getImageData(0, 0, w, h)
  ajustarPixels(img.data, a)
  g.putImageData(img, 0, 0)
  return out
}

/** Máscara de pintura: só o que é OPACO na máscara continua visível (destination-in). */
export function aplicarMascara(alvo: Canvas2D, mascara: CanvasImageSource): void {
  const g = ctx2d(alvo)
  g.save()
  g.globalCompositeOperation = 'destination-in'
  g.drawImage(mascara, 0, 0, alvo.width, alvo.height)
  g.restore()
}
