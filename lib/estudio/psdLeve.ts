// SOA Edition — leitura de PSD/PSB GRANDE sem estourar memória. A memória é limitada pela RESOLUÇÃO DE
// TRABALHO, não pelo tamanho do arquivo:
//   1. ag-psd com useRawData: lê a estrutura e guarda cada camada COMPRIMIDA (como está no arquivo);
//   2. camada por camada: decodifica → reduz na hora para a resolução de trabalho → apara o transparente →
//      comprime (WebP) → LIBERA o pixel cheio e os dados brutos → próxima;
//   3. a tela só recebe as camadas leves (Blob), e desenha uma de cada vez.
// Roda no Web Worker (psd.worker.ts) e, se não houver worker, na própria página.
import { readPsd, getLayerCanvas, getLayerImageData, getLayerMaskImageData, initializeCanvas } from 'ag-psd'

export interface NoLeve {
  name?: string; hidden?: boolean; opacity?: number; blendMode?: string; clipping?: boolean
  /** Caixa já na resolução de trabalho (aparada). */
  left?: number; top?: number; right?: number; bottom?: number
  /** Pixels da camada (WebP/PNG leve), já reduzidos e aparados. */
  blob?: Blob
  children?: NoLeve[]
  text?: unknown
  effects?: unknown
  /** Prancheta (artboard) do Photoshop: retângulo na resolução de trabalho → vira PÁGINA no editor. */
  artboard?: { left: number; top: number; right: number; bottom: number }
  /** A camada tinha máscara (de camada/vetorial, própria ou do grupo) — já aplicada nos pixels. */
  mascarada?: boolean
}
export interface PsdLeve { width: number; height: number; escala: number; children?: NoLeve[]; camadas: number; puladas: number }
export type Progresso = (feitas: number, total: number) => void

/** Lado máximo de trabalho: A4/A3 a 300 dpi cabem inteiros; maiores são reduzidos. */
export const LADO_TRABALHO = 4000

type Bruto = {
  name?: string; hidden?: boolean; opacity?: number; blendMode?: string; clipping?: boolean
  left?: number; top?: number; right?: number; bottom?: number; children?: Bruto[]; text?: Record<string, unknown>; effects?: unknown
  rawData?: unknown; canvas?: unknown; imageData?: unknown
  mask?: { top?: number; left?: number; bottom?: number; right?: number; defaultColor?: number; disabled?: boolean }
  vectorMask?: { invert?: boolean; disable?: boolean; paths?: { open: boolean; operation?: string; knots: { points: number[] }[]; fillRule?: string }[] }
  artboard?: { rect: { top: number; left: number; bottom: number; right: number } }
}

let canvasPronto = false
function prepararCanvas() {
  if (canvasPronto) return
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') {
    initializeCanvas(
      (w: number, h: number) => new OffscreenCanvas(Math.max(1, w), Math.max(1, h)) as unknown as HTMLCanvasElement,
      (w: number, h: number) => new ImageData(Math.max(1, w), Math.max(1, h)),
    )
  }
  canvasPronto = true
}
const novo = (w: number, h: number): HTMLCanvasElement | OffscreenCanvas => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c
}
const paraBlob = (c: HTMLCanvasElement | OffscreenCanvas): Promise<Blob> =>
  'convertToBlob' in c ? c.convertToBlob({ type: 'image/webp', quality: 0.95 }) : new Promise((res, rej) => (c as HTMLCanvasElement).toBlob(b => (b ? res(b) : rej(new Error('camada'))), 'image/webp', 0.95))

/**
 * Lê o PSD e devolve a árvore LEVE. `maxLado` define a resolução de trabalho. Nunca guarda mais de uma
 * camada em resolução cheia ao mesmo tempo.
 */
export async function lerPsdLeve(buf: ArrayBuffer, maxLado = LADO_TRABALHO, progresso?: Progresso): Promise<PsdLeve> {
  prepararCanvas()
  const psd = readPsd(buf, { skipThumbnail: true, skipCompositeImageData: true, skipLinkedFilesData: true, useRawData: true }) as unknown as { width: number; height: number; children?: Bruto[] }
  const k = Math.min(1, maxLado / Math.max(psd.width, psd.height))
  const folhas: Bruto[] = []
  const contar = (ns?: Bruto[]) => { for (const n of ns || []) { if (n.children) contar(n.children); else folhas.push(n) } }
  contar(psd.children)
  let feitas = 0, puladas = 0
  progresso?.(0, folhas.length)
  const converter = async (ns?: Bruto[], grupos: Bruto[] = [], oculto = false): Promise<NoLeve[] | undefined> => {
    if (!ns) return undefined
    const out: NoLeve[] = []
    for (const n of ns) {
      const no: NoLeve = { name: n.name, hidden: n.hidden, opacity: n.opacity, blendMode: n.blendMode, clipping: n.clipping }
      if (n.artboard?.rect) { const r = n.artboard.rect; no.artboard = { left: r.left * k, top: r.top * k, right: r.right * k, bottom: r.bottom * k } }
      if (n.children) {
        // máscara do GRUPO vale para tudo dentro dele (Photoshop)
        const temMascara = (n.mask && !n.mask.disabled) || (n.vectorMask && !n.vectorMask.disable && n.vectorMask.paths?.length)
        no.children = await converter(n.children, temMascara ? [...grupos, n] : grupos, oculto || !!n.hidden)
        n.rawData = undefined
        out.push(no); continue
      }
      // texto e efeitos na mesma escala da resolução de trabalho
      if (n.text) {
        const t = structuredClone(n.text) as { transform?: number[]; style?: { fontSize?: number } }
        if (Array.isArray(t.transform)) { t.transform = [...t.transform]; t.transform[4] *= k; t.transform[5] *= k }
        if (t.style && typeof t.style.fontSize === 'number') t.style.fontSize *= k
        no.text = t
      }
      if (n.effects) no.effects = escalarEfeitos(structuredClone(n.effects), k)
      const L = n.left || 0, T = n.top || 0
      if (!n.hidden && !oculto && n.rawData && (n.right ?? 0) > L && (n.bottom ?? 0) > T) {
        try {
          const r = await reduzida(n, k)
          if (r) {
            const { red, w, h } = r
            const g = red.getContext('2d') as CanvasRenderingContext2D
            // máscaras (da camada e dos grupos acima): o que o Photoshop esconde, some aqui também
            for (const m of [...grupos, n]) if (await aplicarMascara(g, w, h, m, L, T, k)) no.mascarada = true
            const a = aparar(g, w, h)
            if (a) {
              const rec = novo(a.w, a.h)
              ;(rec.getContext('2d') as CanvasRenderingContext2D).drawImage(red as CanvasImageSource, a.x, a.y, a.w, a.h, 0, 0, a.w, a.h)
              no.blob = await paraBlob(rec)
              rec.width = 1; rec.height = 1
              no.left = L * k + a.x; no.top = T * k + a.y; no.right = no.left + a.w; no.bottom = no.top + a.h
            }
            red.width = 1; red.height = 1
          }
        } catch { puladas++ /* camada ilegível/grande demais: segue sem pixels (fica listada) */ }
      }
      if (no.left === undefined) { no.left = L * k; no.top = T * k; no.right = (n.right ?? L) * k; no.bottom = (n.bottom ?? T) * k }
      n.rawData = undefined; n.canvas = undefined; n.imageData = undefined   // libera os dados brutos da camada
      feitas++; progresso?.(feitas, folhas.length)
      out.push(no)
    }
    return out
  }
  const children = await converter(psd.children)
  for (const n of folhas) { n.mask = undefined }
  return { width: Math.round(psd.width * k), height: Math.round(psd.height * k), escala: k, children, camadas: folhas.length, puladas }
}

/**
 * Decodifica UMA camada e já devolve reduzida. 8 bits: ImageData → createImageBitmap redimensionando (sem canvas
 * em tamanho cheio — evita o teto de área de canvas do navegador). 16/32 bits ou navegador sem resize: via canvas.
 */
async function reduzida(n: Bruto, k: number): Promise<{ red: HTMLCanvasElement | OffscreenCanvas; w: number; h: number } | null> {
  const px = getLayerImageData(n as never) as { width: number; height: number; data: ArrayLike<number> } | undefined
  if (!px || !px.width || !px.height) return null
  const w = Math.max(1, Math.round(px.width * k)), h = Math.max(1, Math.round(px.height * k))
  const red = novo(w, h), g = red.getContext('2d') as CanvasRenderingContext2D
  g.imageSmoothingQuality = 'high'
  if (px.data instanceof Uint8ClampedArray && typeof createImageBitmap !== 'undefined') {
    try {
      const bmp = await createImageBitmap(new ImageData(px.data as Uint8ClampedArray<ArrayBuffer>, px.width, px.height), { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
      g.drawImage(bmp, 0, 0); bmp.close()
      return { red, w, h }
    } catch { /* cai no caminho por canvas */ }
  }
  const cheio = getLayerCanvas(n as never) as unknown as HTMLCanvasElement | OffscreenCanvas | undefined
  if (!cheio) return null
  g.drawImage(cheio as CanvasImageSource, 0, 0, w, h)
  cheio.width = 1; cheio.height = 1        // solta o pixel cheio já
  return { red, w, h }
}

/**
 * Aplica a máscara de camada (raster, tons de cinza) e a vetorial (caminhos) do nó `m` nos pixels reduzidos de uma
 * camada cuja caixa começa em (L,T) no documento. Devolve true se aplicou algo.
 */
async function aplicarMascara(g: CanvasRenderingContext2D, w: number, h: number, m: Bruto, L: number, T: number, k: number): Promise<boolean> {
  let aplicou = false
  const mk = m.mask
  if (mk && !mk.disabled) {
    const mc = novo(w, h), gm = mc.getContext('2d') as CanvasRenderingContext2D
    // fora da caixa da máscara vale a cor padrão (branco = mostra, preto = esconde)
    if ((mk.defaultColor ?? 0) >= 128) { gm.fillStyle = '#000'; gm.fillRect(0, 0, w, h) }
    const px = getLayerMaskImageData(m as never) as { width: number; height: number; data: ArrayLike<number> } | undefined
    if (px && px.width && px.height && px.data instanceof Uint8ClampedArray) {
      // cinza → alfa (na resolução do arquivo) e reduz na hora
      const d = px.data
      for (let i = 0; i < d.length; i += 4) { d[i + 3] = d[i]; d[i] = d[i + 1] = d[i + 2] = 0 }
      const x = ((mk.left ?? 0) - L) * k, y = ((mk.top ?? 0) - T) * k
      const bw = Math.max(1, Math.round(px.width * k)), bh = Math.max(1, Math.round(px.height * k))
      const bmp = await createImageBitmap(new ImageData(d as Uint8ClampedArray<ArrayBuffer>, px.width, px.height), { resizeWidth: bw, resizeHeight: bh, resizeQuality: 'high' })
      gm.clearRect(x, y, bw, bh); gm.drawImage(bmp, x, y); bmp.close()
      aplicou = true
    } else if ((mk.defaultColor ?? 0) < 128) aplicou = false
    if (aplicou) { g.save(); g.globalCompositeOperation = 'destination-in'; g.drawImage(mc as CanvasImageSource, 0, 0); g.restore() }
    mc.width = 1; mc.height = 1
  }
  const vm = m.vectorMask
  if (vm && !vm.disable && vm.paths?.length) {
    const mc = novo(w, h), gm = mc.getContext('2d') as CanvasRenderingContext2D
    gm.setTransform(k, 0, 0, k, -L * k, -T * k)
    gm.fillStyle = '#000'
    for (const p of vm.paths) {
      if (p.open || p.knots.length < 2) continue
      const path = new Path2D()
      const K = p.knots.map(q => q.points)
      path.moveTo(K[0][2], K[0][3])
      for (let i = 1; i <= K.length; i++) {
        const a = K[i - 1], b = K[i % K.length]
        path.bezierCurveTo(a[4], a[5], b[0], b[1], b[2], b[3])
      }
      path.closePath()
      gm.globalCompositeOperation = p.operation === 'subtract' ? 'destination-out' : p.operation === 'intersect' ? 'destination-in' : p.operation === 'exclude' ? 'xor' : 'source-over'
      gm.fill(path, p.fillRule === 'even-odd' ? 'evenodd' : 'nonzero')
    }
    gm.setTransform(1, 0, 0, 1, 0, 0)
    if (vm.invert) { gm.globalCompositeOperation = 'xor'; gm.fillRect(0, 0, w, h) }
    g.save(); g.globalCompositeOperation = 'destination-in'; g.drawImage(mc as CanvasImageSource, 0, 0); g.restore()
    mc.width = 1; mc.height = 1
    aplicou = true
  }
  return aplicou
}

function aparar(g: CanvasRenderingContext2D, w: number, h: number): { x: number; y: number; w: number; h: number } | null {
  const d = g.getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) {
    const lin = y * w * 4
    for (let x = 0; x < w; x++) if (d[lin + x * 4 + 3] > 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/** Tamanhos em px dos efeitos (traço, sombra, brilho, chanfro) seguem a redução. */
function escalarEfeitos(e: unknown, k: number): unknown {
  const px = (o: unknown) => { const v = o as { value?: number } | undefined; if (v && typeof v.value === 'number') v.value *= k }
  const x = e as Record<string, unknown>
  for (const chave of ['stroke', 'dropShadow', 'innerShadow']) for (const f of (x[chave] as Record<string, unknown>[] | undefined) || []) { px(f.size); px(f.distance) }
  for (const chave of ['outerGlow', 'innerGlow', 'bevel']) { const f = x[chave] as Record<string, unknown> | undefined; if (f) { px(f.size); px(f.distance) } }
  return e
}
