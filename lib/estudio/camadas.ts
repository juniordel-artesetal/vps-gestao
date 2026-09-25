// SOA Edition — NÚCLEO DO EDITOR DE CAMADAS. Só navegador (Fabric 6).
//
// OBJETO INTELIGENTE: a camada de imagem guarda o assetId (EstudioAsset no Blob), nunca a imagem
// embutida. Várias camadas (em vários designs) podem apontar para o MESMO asset: cada uma tem sua
// transformação, todas compartilham o conteúdo — "Substituir conteúdo" troca em todas.
//
// EDIÇÃO LEVE × EXPORTAÇÃO EM ALTA: na tela a camada usa um PROXY (≤ 2000 px no maior lado); o
// original em alta só é carregado na hora de exportar (usarResolucaoCheia). O "mapa" (espaço
// NORMALIZADO 0…1 da imagem original) garante que trocar proxy ↔ original não mexe em nada na tela.
//
// NÃO-DESTRUTIVO: ajustes, máscara de pintura, distorção e efeitos são PARÂMETROS da camada; a
// imagem exibida é sempre recalculada a partir do original: ajustes → máscara → distorção → efeitos.
import { Canvas, StaticCanvas, FabricImage, FabricObject, Group, Rect, Ellipse, Polygon, Point, Gradient, util, classRegistry } from 'fabric'
import { aplicarAjustes, aplicarMascara, ajustarPixels, ehNeutro, type Ajustes } from './ajustes'
import { inverterAlfa, suavizarAlfa, novoCanvas, caixaDaSelecao, tingirSelecao } from './selecao'
import { distorcer, type Distorcao } from './transform'
import { aplicarEfeitosImagem, semEfeitos, type Efeitos } from './efeitos'

export type TipoCamada = 'imagem' | 'texto' | 'forma' | 'grupo'
export interface Mapa { minX: number; minY: number; pxU: number; pxV: number }
export type FormaMascaraTipo = 'retangulo' | 'arredondado' | 'elipse' | 'estrela' | 'coracao'
export interface FormaMascara { forma: FormaMascaraTipo; x: number; y: number; w: number; h: number; invertida: boolean }
export interface FonteDesign { id: string; familia: string; url: string }
/** Corte não-destrutivo (retângulo normalizado 0…1 da imagem original). */
export interface Corte { x: number; y: number; w: number; h: number }
/** Máscara própria da CAMADA DE AJUSTE (em coordenadas normalizadas do design). */
export interface AjusteMascara { forma: 'retangulo' | 'elipse'; x: number; y: number; w: number; h: number; invertida: boolean; suave: number }
/** Estado "de fábrica" de texto/forma antes dos efeitos (para poder tirar os efeitos). */
export interface BaseVetor { fill: unknown; stroke: unknown; strokeWidth: number; shadow: unknown; paintFirst: unknown }

/** Propriedades próprias que viajam no JSON do design. */
export const PROPS_SOA = [
  'soaId', 'soaNome', 'soaTipo', 'soaAssetId', 'soaAjustes', 'soaDistorcao', 'soaMascara', 'soaMapa', 'soaEfeitos', 'soaBase',
  'soaTravado', 'soaClipDe', 'soaFormaMascara', 'soaFonte', 'soaArea', 'soaMoldura', 'soaCorte', 'soaMascaraInvertida',
  'soaMascaraSuave', 'soaAjusteMascara', 'soaGrupo', 'selectable', 'evented',
]

export type Soa = {
  soaId?: string; soaNome?: string; soaTipo?: TipoCamada; soaAssetId?: string | null
  soaAjustes?: Ajustes | null; soaDistorcao?: Distorcao | null; soaMascara?: string | null; soaMapa?: Mapa | null
  soaEfeitos?: Efeitos | null; soaBase?: BaseVetor | null
  soaTravado?: boolean; soaClipDe?: string | null; soaFormaMascara?: FormaMascara | null; soaFonte?: string | null
  /** Camada-ÁREA (retângulo/elipse tracejado): só delimita recorte; nunca sai na exportação. */
  soaArea?: boolean
  /** Moldura/frame: área em forma (círculo, arco…) onde a imagem entra recortada. */
  soaMoldura?: boolean
  soaCorte?: Corte | null
  soaMascaraInvertida?: boolean
  /** Suavizar a borda da máscara: % do menor lado da imagem (0…10). */
  soaMascaraSuave?: number
  soaAjusteMascara?: AjusteMascara | null
  soaAjudante?: boolean
  /** Molde/peça a que a camada pertence (vem do import: pasta do PSD / base do recorte) — agrupa no painel. */
  soaGrupo?: string | null
}
export const soa = (o: FabricObject) => o as FabricObject & Soa
export const novoIdCamada = () => Math.random().toString(36).slice(2, 10)

type Fonte = HTMLImageElement | HTMLCanvasElement
const dimDe = (el: Fonte) => (el instanceof HTMLImageElement ? { w: el.naturalWidth, h: el.naturalHeight } : { w: el.width, h: el.height })

const originais = new WeakMap<FabricObject, Fonte>()      // fonte ATUAL (proxy na tela; original ao exportar)
const proxies = new WeakMap<FabricObject, Fonte>()        // proxy leve (para voltar depois de exportar)
const urlsCheias = new WeakMap<FabricObject, string>()    // onde está o original em alta (Blob ou arquivo local)
const mascaras = new WeakMap<FabricObject, HTMLCanvasElement>()

/** Maior lado do proxy de edição. */
export const LADO_PROXY = 2000

export function carregarImagemUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.decoding = 'async'
    i.onload = () => res(i); i.onerror = () => rej(new Error('Não consegui abrir a imagem.'))
    i.src = url
  })
}

/**
 * Proxy de edição a partir de um arquivo/Blob: decodifica fora da thread principal
 * (createImageBitmap) e reduz para ≤ LADO_PROXY. Devolve também o tamanho do original.
 */
export async function criarProxy(fonte: Blob | Fonte, lado = LADO_PROXY): Promise<{ proxy: HTMLCanvasElement; largura: number; altura: number }> {
  let bmp: ImageBitmap | Fonte
  if (fonte instanceof Blob) {
    try { bmp = await createImageBitmap(fonte) }
    catch { const u = URL.createObjectURL(fonte); try { bmp = await carregarImagemUrl(u) } finally { URL.revokeObjectURL(u) } }
  } else bmp = fonte
  const w = bmp instanceof HTMLImageElement ? bmp.naturalWidth : bmp.width
  const h = bmp instanceof HTMLImageElement ? bmp.naturalHeight : bmp.height
  const k = Math.min(1, lado / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k))
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(bmp, 0, 0, c.width, c.height)
  if (typeof ImageBitmap !== 'undefined' && bmp instanceof ImageBitmap) bmp.close()
  return { proxy: c, largura: w, altura: h }
}

/** O JSON guarda a URL do ORIGINAL (nunca o canvas processado em data URL). */
function fixarSrc(img: FabricImage, url: string) {
  ;(img as unknown as { soaUrl: string }).soaUrl = url
  img.getSrc = () => (img as unknown as { soaUrl: string }).soaUrl
}

/** Liga a camada ao asset (quando o envio em segundo plano termina). */
export function vincularAsset(img: FabricImage, assetId: string, url: string) {
  soa(img).soaAssetId = assetId
  fixarSrc(img, url)
  urlsCheias.set(img, url)
}

/**
 * Nova camada de imagem a partir de um PROXY já pronto (abre na hora). `urlCheia` = onde está o
 * original (Blob, ou object URL do arquivo local enquanto o envio não termina).
 */
export function criarCamadaDeProxy(proxy: HTMLCanvasElement, urlCheia: string, assetId: string | null, nome: string, design: { largura: number; altura: number }): FabricImage {
  const img = new FabricImage(proxy)
  const w = proxy.width, h = proxy.height
  const k = Math.min(1, (design.largura * 0.8) / w, (design.altura * 0.8) / h)
  img.set({ scaleX: k, scaleY: k })
  Object.assign(img, {
    soaId: novoIdCamada(), soaNome: nome, soaTipo: 'imagem', soaAssetId: assetId, soaAjustes: null, soaDistorcao: null,
    soaMascara: null, soaEfeitos: null, soaMapa: { minX: 0, minY: 0, pxU: w, pxV: h },
  } satisfies Soa)
  originais.set(img, proxy); proxies.set(img, proxy); urlsCheias.set(img, urlCheia)
  // Enquanto o envio não termina, a URL é local (blob:) — o editor não salva até ter o asset.
  fixarSrc(img, urlCheia)
  return img
}

/** Camada a partir de uma URL (biblioteca). Usa o proxy do asset se houver. */
export async function criarCamadaImagem(url: string, assetId: string | null, nome: string, design: { largura: number; altura: number }, proxyUrl?: string | null): Promise<FabricImage> {
  const el = await carregarImagemUrl(proxyUrl || url)
  const { proxy } = await criarProxy(el)
  const img = criarCamadaDeProxy(proxy, url, assetId, nome, design)
  fixarSrc(img, url)
  return img
}

/** Troca o elemento exibido mantendo a moldura da imagem original parada na tela. */
function trocarElemento(img: FabricImage, el: Fonte, mapa2: Mapa) {
  const s = soa(img)
  const m1 = s.soaMapa ?? { minX: 0, minY: 0, pxU: img.width, pxV: img.height }
  const W1 = img.width, H1 = img.height
  const { w: W2, h: H2 } = dimDe(el)
  const alvo = { x: mapa2.minX + W2 / (2 * mapa2.pxU), y: mapa2.minY + H2 / (2 * mapa2.pxV) }
  const centro = new Point(m1.pxU * (alvo.x - m1.minX) - W1 / 2, m1.pxV * (alvo.y - m1.minY) - H1 / 2).transform(img.calcOwnMatrix())
  const k = m1.pxU / mapa2.pxU
  img.setElement(el)
  img.set({ scaleX: img.scaleX * k, scaleY: img.scaleY * k })
  s.soaMapa = mapa2
  img.setPositionByOrigin(centro, 'center', 'center')
  img.setCoords()
  img.dirty = true
}

/** Máscara de pintura da camada (resolução ≤ 1024 no maior lado, alfa = visível). */
export async function mascaraDa(img: FabricImage, criarSeFaltar: boolean): Promise<HTMLCanvasElement | null> {
  const ja = mascaras.get(img)
  if (ja) return ja
  const orig = originais.get(img)
  const s = soa(img)
  if (!orig || (!s.soaMascara && !criarSeFaltar)) return null
  const { w, h } = dimDe(orig)
  const k = Math.min(1, 1024 / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k))
  const g = c.getContext('2d')!
  if (s.soaMascara) { const m = await carregarImagemUrl(s.soaMascara); g.drawImage(m, 0, 0, c.width, c.height) }
  else { g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height) }
  mascaras.set(img, c)
  return c
}

/** Conteúdo da camada (ajustes + máscara), SEM distorção/efeitos — é o que vai para um molde. */
async function conteudoBase(img: FabricImage, orig: Fonte): Promise<Fonte> {
  const s = soa(img)
  const { w, h } = dimDe(orig)
  let fonte: Fonte = orig
  if (s.soaAjustes && !ehNeutro(s.soaAjustes)) fonte = aplicarAjustes(orig, w, h, s.soaAjustes) as HTMLCanvasElement
  const bruta = s.soaMascara || mascaras.has(img) ? await mascaraDa(img, false) : null
  if (bruta) {
    let masc: HTMLCanvasElement = bruta
    if (s.soaMascaraInvertida) masc = inverterAlfa(masc)
    if (s.soaMascaraSuave) masc = suavizarAlfa(masc, (s.soaMascaraSuave / 100) * Math.min(masc.width, masc.height))
    if (fonte === orig) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d')!.drawImage(orig, 0, 0); fonte = c }
    aplicarMascara(fonte as HTMLCanvasElement, masc)
  }
  return fonte
}

/** Corte: com distorção, some o que está fora (a malha usa a imagem inteira); sem, recorta de verdade. */
function cortar(el: Fonte, w: number, h: number, c: Corte, recortar: boolean): { el: Fonte; x: number; y: number } {
  const x = Math.max(0, Math.min(1, c.x)), y = Math.max(0, Math.min(1, c.y))
  const cw = Math.max(1 / w, Math.min(1 - x, c.w)), ch = Math.max(1 / h, Math.min(1 - y, c.h))
  if (recortar) {
    const out = novoCanvas(Math.round(cw * w), Math.round(ch * h))
    out.getContext('2d')!.drawImage(el, x * w, y * h, cw * w, ch * h, 0, 0, out.width, out.height)
    return { el: out, x, y }
  }
  const out = novoCanvas(w, h), g = out.getContext('2d')!
  g.drawImage(el, 0, 0, w, h)
  g.globalCompositeOperation = 'destination-in'; g.fillRect(x * w, y * h, cw * w, ch * h)
  return { el: out, x: 0, y: 0 }
}

/**
 * Recalcula a imagem exibida a partir do ORIGINAL: ajustes → máscara → distorção → efeitos.
 * `originalNovo` = outra fonte para o mesmo conteúdo (versão nova do objeto inteligente, ou o
 * original em alta na exportação). A máscara fica em espaço normalizado, então vale nas duas.
 */
export async function processarCamada(img: FabricImage, originalNovo?: Fonte): Promise<void> {
  if (originalNovo) originais.set(img, originalNovo)
  const orig = originais.get(img)
  if (!orig) return
  const s = soa(img)
  const { w, h } = dimDe(orig)
  let el: Fonte = await conteudoBase(img, orig)
  let mapa: Mapa = { minX: 0, minY: 0, pxU: w, pxV: h }
  if (s.soaCorte) {
    // Sem distorção o corte recorta de verdade; o mapa mantém a parte visível parada na tela.
    const r = cortar(el, w, h, s.soaCorte, !s.soaDistorcao)
    el = r.el
    if (!s.soaDistorcao) mapa = { minX: r.x, minY: r.y, pxU: w, pxV: h }
  }
  if (s.soaDistorcao) {
    const d = s.soaDistorcao
    const r = distorcer(el, w, h, { ...d, pontos: d.pontos.map(p => ({ x: p.x * w, y: p.y * h })) })
    el = r.canvas
    mapa = { minX: r.minX / w, minY: r.minY / h, pxU: w * r.escala, pxV: h * r.escala }
  }
  if (!semEfeitos(s.soaEfeitos)) {
    // Efeitos em tamanho "de cena" estável (iguais no proxy e no original): k = px do elemento por
    // px da cena. Escala final do elemento = escala atual × (pxU atual / pxU novo).
    const escalaCena = Math.abs(img.scaleX || 1) * ((s.soaMapa?.pxU || mapa.pxU) / mapa.pxU)
    const k = 1 / Math.max(0.01, escalaCena)
    const { w: ew, h: eh } = dimDe(el)
    const r = aplicarEfeitosImagem(el, ew, eh, s.soaEfeitos!, k)
    el = r.canvas
    mapa = { ...mapa, minX: mapa.minX - r.pad / mapa.pxU, minY: mapa.minY - r.pad / mapa.pxV }
  }
  trocarElemento(img, el, mapa)
}

/** Conteúdo da camada para aplicar num molde (sem a distorção dela): prévia leve ou em alta. */
export async function conteudoDaCamada(img: FabricImage, alta: boolean): Promise<Fonte> {
  if (alta) return conteudoEmAlta(img)
  return conteudoBase(img, proxies.get(img) || originais.get(img)!)
}

/** Conteúdo em ALTA da camada (para aplicar num molde): original + ajustes + máscara, sem distorção. */
export async function conteudoEmAlta(img: FabricImage): Promise<Fonte> {
  const url = urlsCheias.get(img)
  const orig = url ? await carregarImagemUrl(url) : originais.get(img)!
  return conteudoBase(img, orig)
}

/**
 * Troca todas as imagens do canvas para o ORIGINAL em alta (exportação). Devolve a função que
 * volta para os proxies. Proxy e original têm o mesmo mapa normalizado → nada se mexe.
 */
export async function usarResolucaoCheia(canvas: Canvas | StaticCanvas): Promise<() => Promise<void>> {
  const imgs = imagensDo(canvas)
  const trocadas: FabricImage[] = []
  await Promise.all(imgs.map(async img => {
    const url = urlsCheias.get(img)
    if (!url) return
    try { const el = await carregarImagemUrl(url); await processarCamada(img, el); trocadas.push(img) } catch { /* segue no proxy */ }
  }))
  return async () => {
    for (const img of trocadas) { const p = proxies.get(img); if (p) await processarCamada(img, p) }
    canvas.requestRenderAll()
  }
}

export function imagensDo(canvas: Canvas | StaticCanvas): FabricImage[] {
  const out: FabricImage[] = []
  const visitar = (objs: FabricObject[]) => { for (const o of objs) { if (o instanceof FabricImage) out.push(o); if (o instanceof Group) visitar(o.getObjects()) } }
  visitar(canvas.getObjects())
  return out
}

/** Coordenada normalizada da imagem original → ponto da cena (onde a alça da distorção fica). */
export function originalParaCena(img: FabricImage, u: number, v: number): Point {
  const m = soa(img).soaMapa ?? { minX: 0, minY: 0, pxU: img.width, pxV: img.height }
  return new Point(m.pxU * (u - m.minX) - img.width / 2, m.pxV * (v - m.minY) - img.height / 2).transform(img.calcTransformMatrix())
}

/** Duplicar: a cópia é OUTRA INSTÂNCIA do mesmo conteúdo (mesmo asset, transformação própria). */
export async function duplicarCamada(o: FabricObject): Promise<FabricObject> {
  if (o instanceof FabricImage) {
    const src = originais.get(o)!
    const c = new FabricImage(proxies.get(o) || src)
    const obj = (o.toObject as (p: string[]) => Record<string, unknown>).call(o, PROPS_SOA)
    delete obj.src; delete obj.type; delete obj.clipPath
    c.set(obj as Partial<FabricImage>)
    Object.assign(c, JSON.parse(JSON.stringify(PROPS_SOA.reduce((a, k) => ({ ...a, [k]: (o as unknown as Record<string, unknown>)[k] }), {}))))
    originais.set(c, proxies.get(o) || src); proxies.set(c, proxies.get(o) || src)
    const u = urlsCheias.get(o); if (u) urlsCheias.set(c, u)
    fixarSrc(c, (o as unknown as { soaUrl: string }).soaUrl || '')
    const m = mascaras.get(o)
    if (m) { const mc = document.createElement('canvas'); mc.width = m.width; mc.height = m.height; mc.getContext('2d')!.drawImage(m, 0, 0); mascaras.set(c, mc) }
    // o elemento atual pode ser o original em alta; reprocessa a partir do proxy
    soa(c).soaMapa = soa(o).soaMapa ? { ...soa(o).soaMapa! } : null
    c.setElement(o.getElement() as Fonte); c.set({ width: o.width, height: o.height })
    await processarCamada(c, proxies.get(o) || src)
    ajustarCopia(c, o)
    return c
  }
  const c = await o.clone(PROPS_SOA)
  ajustarCopia(c, o)
  if (c instanceof Group && o instanceof Group) await religarGrupo(c, o)
  return c
}
function ajustarCopia(c: FabricObject, o: FabricObject) {
  const s = soa(c)
  if (!(c instanceof FabricImage) && soa(o).soaEfeitos) { s.soaEfeitos = structuredClone(soa(o).soaEfeitos!); instalarEstilos(c); c.dirty = true }
  s.soaId = novoIdCamada()
  s.soaNome = `${soa(o).soaNome || 'Camada'} (cópia)`
  s.soaClipDe = null
  c.clipPath = undefined
}
/** Grupo clonado: as imagens de dentro voltam a ter proxy/original ligados. */
async function religarGrupo(c: Group, o: Group) {
  const a = c.getObjects(), b = o.getObjects()
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i]
    if (x instanceof FabricImage && y instanceof FabricImage) {
      const p = proxies.get(y) || originais.get(y)
      if (p) { originais.set(x, p); proxies.set(x, p) }
      const u = urlsCheias.get(y); if (u) urlsCheias.set(x, u)
      fixarSrc(x, (y as unknown as { soaUrl: string }).soaUrl || '')
      if (p) await processarCamada(x, p)
    } else if (x instanceof Group && y instanceof Group) await religarGrupo(x, y)
  }
}

/** Aplica/retira os estilos de uma camada (imagem → pipeline da camada; texto/forma/grupo → motor sobre o cache). */
export async function aplicarEfeitos(o: FabricObject, e: Efeitos | null): Promise<void> {
  const s = soa(o)
  s.soaEfeitos = semEfeitos(e) ? null : e
  if (o instanceof FabricImage) { await processarCamada(o); return }
  // designs antigos: os efeitos viravam propriedades nativas (contorno/sombra/preenchimento) e o original ficava em
  // soaBase — devolve o original; agora os estilos são desenhados por cima, sem mexer no vetor.
  if (s.soaBase) {
    const b = s.soaBase
    const fill = b.fill && typeof b.fill === 'object' && !(b.fill instanceof Gradient) && (b.fill as { colorStops?: unknown }).colorStops
      ? new Gradient(b.fill as ConstructorParameters<typeof Gradient>[0]) : b.fill
    o.set({ fill, stroke: b.stroke, strokeWidth: b.strokeWidth, shadow: b.shadow, paintFirst: b.paintFirst } as Record<string, unknown>)
    s.soaBase = null
  }
  instalarEstilos(o)
  o.dirty = true
}

// ── ESTILOS EM TEXTO/FORMA/GRUPO: o MESMO motor da imagem, sobre o cache do Fabric ─────────────────
// O Fabric desenha o objeto (vetor) num canvas de cache na resolução da tela/exportação; aqui o cache passa
// pelos estilos (aplicarEfeitosImagem) antes de ir para a tela. O vetor continua intacto e editável
// (texto segue editável) e o resultado fica nítido em qualquer zoom — inclusive na exportação em alta.
type ComCache = FabricObject & {
  _cacheCanvas?: HTMLCanvasElement; _cacheContext?: CanvasRenderingContext2D | null
  zoomX?: number; zoomY?: number; cacheTranslationX?: number; cacheTranslationY?: number; isEditing?: boolean
  __soaEstilo?: { versao: number; chave: string; canvas: HTMLCanvasElement | null; pad: number }
}
function instalarEstilos(o: FabricObject) {
  const x = o as ComCache
  if (x.__soaEstilo) return
  x.__soaEstilo = { versao: 0, chave: '', canvas: null, pad: 0 }
  const proto = Object.getPrototypeOf(o) as ComCache
  // o cache foi redesenhado? (qualquer mudança no objeto) → estilos refeitos no próximo quadro
  x.drawObject = function (this: ComCache, ctx: CanvasRenderingContext2D, ...r: unknown[]) {
    if (ctx === this._cacheContext) this.__soaEstilo!.versao++
    return (proto.drawObject as (...a: unknown[]) => void).call(this, ctx, ...r)
  } as FabricObject['drawObject']
  // com estilo, o objeto sempre usa cache (é sobre ele que os estilos são desenhados)
  x.shouldCache = function (this: ComCache) {
    if (!semEfeitos(soa(this).soaEfeitos) && !this.isEditing) { (this as unknown as { ownCaching: boolean }).ownCaching = true; return true }
    return proto.shouldCache.call(this)
  }
  ;(x as unknown as { drawCacheOnCanvas: (ctx: CanvasRenderingContext2D) => void }).drawCacheOnCanvas = function (this: ComCache, ctx: CanvasRenderingContext2D) {
    const e = soa(this).soaEfeitos, cache = this._cacheCanvas
    if (semEfeitos(e) || !cache || !cache.width || !cache.height) return (proto.drawCacheOnCanvas as (c: CanvasRenderingContext2D) => void).call(this, ctx)
    const st = this.__soaEstilo!, zx = this.zoomX || 1, zy = this.zoomY || 1
    // px do cache por px da cena: o zoom do cache sem a escala do próprio objeto
    const k = zx / Math.max(0.0001, Math.abs(this.getObjectScaling().x))
    const chave = `${st.versao}|${cache.width}x${cache.height}|${zx.toFixed(4)}|${JSON.stringify(e)}`
    if (st.chave !== chave) {
      const r = aplicarEfeitosImagem(cache, cache.width, cache.height, e!, k)
      st.canvas = r.canvas; st.pad = r.pad; st.chave = chave
    }
    ctx.scale(1 / zx, 1 / zy)
    ctx.drawImage(st.canvas!, -(this.cacheTranslationX || 0) - st.pad, -(this.cacheTranslationY || 0) - st.pad)
  }
}

// ── MÁSCARA DE PINTURA ────────────────────────────────────────────────────────────
export function cenaParaOriginal(img: FabricImage, x: number, y: number): { u: number; v: number } {
  const m = soa(img).soaMapa ?? { minX: 0, minY: 0, pxU: img.width, pxV: img.height }
  const p = new Point(x, y).transform(util.invertTransform(img.calcTransformMatrix()))
  return { u: (p.x + img.width / 2) / m.pxU + m.minX, v: (p.y + img.height / 2) / m.pxV + m.minY }
}

export async function pintarMascara(img: FabricImage, de: { x: number; y: number }, ate: { x: number; y: number }, raio: number, modo: 'esconder' | 'revelar') {
  const c = await mascaraDa(img, true)
  if (!c) return
  const a = cenaParaOriginal(img, de.x, de.y), b = cenaParaOriginal(img, ate.x, ate.y)
  const m = soa(img).soaMapa!
  const escalaCena = Math.abs(img.getTotalObjectScaling().x) || 1
  const r = (raio / escalaCena / m.pxU) * c.width
  const g = c.getContext('2d')!
  g.save()
  g.globalCompositeOperation = modo === 'esconder' ? 'destination-out' : 'source-over'
  g.strokeStyle = '#000'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = r * 2
  g.beginPath(); g.moveTo(a.u * c.width, a.v * c.height); g.lineTo(b.u * c.width + 0.01, b.v * c.height); g.stroke()
  g.restore()
}

export function gravarMascara(img: FabricImage) {
  const c = mascaras.get(img)
  if (!c) return
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
  let cheia = true
  for (let i = 3; i < d.length; i += 16) if (d[i] < 255) { cheia = false; break }
  soa(img).soaMascara = cheia ? null : c.toDataURL('image/png')
  if (cheia) mascaras.delete(img)
}

export function limparMascara(img: FabricImage) {
  mascaras.delete(img)
  soa(img).soaMascara = null
}

// ── SELEÇÃO (retângulo / laço / varinha) sobre a camada ───────────────────────────
/** Tamanho do canvas de máscara/seleção da camada (≤ 1024 no maior lado, proporção do original). */
export function dimMascara(img: FabricImage): { w: number; h: number } {
  const o = originais.get(img)
  const { w, h } = o ? dimDe(o) : { w: img.width, h: img.height }
  const k = Math.min(1, 1024 / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

/** Conteúdo leve da camada para a varinha mágica (com ajustes, sem máscara/distorção). */
export function conteudoParaSelecao(img: FabricImage): Fonte {
  const o = proxies.get(img) || originais.get(img)!
  const a = soa(img).soaAjustes
  if (a && !ehNeutro(a)) { const { w, h } = dimDe(o); return aplicarAjustes(o, w, h, a) as HTMLCanvasElement }
  return o
}

/** Aplica a seleção na máscara: esconder o selecionado ou manter só o selecionado. */
export async function aplicarSelecaoNaMascara(img: FabricImage, sel: HTMLCanvasElement, op: 'esconder' | 'manter'): Promise<void> {
  const m = await mascaraDa(img, true)
  if (!m) return
  const g = m.getContext('2d')!
  g.save(); g.globalCompositeOperation = op === 'esconder' ? 'destination-out' : 'destination-in'
  g.drawImage(sel, 0, 0, m.width, m.height); g.restore()
  gravarMascara(img)
}

/** Nova camada com a seleção: outra INSTÂNCIA do mesmo conteúdo, com máscara = seleção e cortada na caixa dela. */
export async function camadaDaSelecao(img: FabricImage, sel: HTMLCanvasElement): Promise<FabricImage | null> {
  const caixa = caixaDaSelecao(sel)
  if (!caixa) return null
  const nova = await duplicarCamada(img) as FabricImage
  const base = await mascaraDa(img, true)
  const m = novoCanvas(base!.width, base!.height)
  const g = m.getContext('2d')!
  g.drawImage(base!, 0, 0)
  g.globalCompositeOperation = 'destination-in'; g.drawImage(sel, 0, 0, m.width, m.height)
  mascaras.set(nova, m); gravarMascara(nova)
  if (!soa(nova).soaMascara) mascaras.delete(nova)
  const s = soa(nova)
  s.soaNome = `${soa(img).soaNome || 'Camada'} (recorte)`
  s.soaMascaraInvertida = false
  if (!s.soaDistorcao) s.soaCorte = caixa
  await processarCamada(nova)
  return nova
}

/** Imagem-ajudante que mostra a seleção por cima da camada (mesma transformação dela). */
export function sobreposicaoSelecao(img: FabricImage, sel: HTMLCanvasElement): FabricImage {
  const t = tingirSelecao(sel)
  const m = soa(img).soaMapa ?? { minX: 0, minY: 0, pxU: img.width, pxV: img.height }
  const mw = t.width, mh = t.height
  const local = [m.pxU / mw, 0, 0, m.pxV / mh, m.pxU / 2 - m.minX * m.pxU - img.width / 2, m.pxV / 2 - m.minY * m.pxV - img.height / 2] as [number, number, number, number, number, number]
  const ajuda = new FabricImage(t, { selectable: false, evented: false, excludeFromExport: true, objectCaching: false })
  util.applyTransformToObject(ajuda, util.multiplyTransformMatrices(img.calcTransformMatrix(), local))
  Object.assign(ajuda, { soaAjudante: true })
  return ajuda
}

// ── MÁSCARA POR FORMA, ÁREA e CLIPPING ────────────────────────────────────────────
export function pontosEstrela(w: number, h: number): { x: number; y: number }[] {
  const out = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.4 : 1, a = -Math.PI / 2 + (i * Math.PI) / 5
    out.push({ x: (Math.cos(a) * r * w) / 2, y: (Math.sin(a) * r * h) / 2 })
  }
  return out
}
export function pontosCoracao(w: number, h: number): { x: number; y: number }[] {
  const out = []
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2
    const x = 16 * Math.sin(t) ** 3, y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    out.push({ x: (x / 34) * w, y: ((y + 2) / 32) * h })
  }
  return out
}
export function pontosPoligono(lados: number, w: number, h: number): { x: number; y: number }[] {
  return Array.from({ length: lados }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / lados; return { x: (Math.cos(a) * w) / 2, y: (Math.sin(a) * h) / 2 } })
}

export function formaParaClip(o: FabricObject, fm: FormaMascara): FabricObject {
  const W = o.width, H = o.height
  const w = fm.w * W, h = fm.h * H
  const cx = (fm.x + fm.w / 2 - 0.5) * W, cy = (fm.y + fm.h / 2 - 0.5) * H
  const base = { left: cx, top: cy, originX: 'center' as const, originY: 'center' as const }
  let c: FabricObject
  if (fm.forma === 'elipse') c = new Ellipse({ ...base, rx: w / 2, ry: h / 2 })
  else if (fm.forma === 'estrela') c = new Polygon(pontosEstrela(w, h), base)
  else if (fm.forma === 'coracao') c = new Polygon(pontosCoracao(w, h), base)
  else c = new Rect({ ...base, width: w, height: h, ...(fm.forma === 'arredondado' ? { rx: Math.min(w, h) * 0.15, ry: Math.min(w, h) * 0.15 } : {}) })
  c.inverted = !!fm.invertida
  return c
}

/** Refaz as máscaras por forma e os recortes "camada recorta camada" / "só na área" do canvas todo. */
export async function aplicarRecortes(canvas: Canvas | StaticCanvas): Promise<void> {
  const objs = camadas(canvas)
  for (const o of objs) {
    const s = soa(o)
    if (o instanceof CamadaAjuste) continue
    if (s.soaClipDe) {
      const base = objs.find(x => soa(x).soaId === s.soaClipDe)
      if (!base) { s.soaClipDe = null; o.clipPath = undefined; continue }
      let cl: FabricObject
      if (base instanceof FabricImage) {
        cl = new FabricImage(base.getElement(), {
          left: base.left, top: base.top, width: base.width, height: base.height, scaleX: base.scaleX, scaleY: base.scaleY,
          angle: base.angle, flipX: base.flipX, flipY: base.flipY, skewX: base.skewX, skewY: base.skewY, originX: base.originX, originY: base.originY,
        })
      } else {
        cl = await base.clone()
        cl.clipPath = undefined
        // Área de recorte: o que vale é o FORMATO (preenchimento sólido), não o tracejado da tela.
        if (soa(base).soaArea) cl.set({ fill: '#000', stroke: null, strokeWidth: 0 })
      }
      cl.set({ opacity: 1, visible: true })
      cl.absolutePositioned = true
      o.clipPath = cl
    } else if (s.soaFormaMascara) {
      o.clipPath = formaParaClip(o, s.soaFormaMascara)
    } else {
      o.clipPath = undefined
    }
    o.dirty = true
  }
}

// ── CAMADA DE AJUSTE (modelo Photoshop) ───────────────────────────────────────────
/**
 * Camada que não desenha nada: ajusta TUDO o que já foi desenhado ABAIXO dela (fundo incluído).
 * Liga/desliga pelo olho (antes × depois). Máscara própria (retângulo/elipse, invertível, suave)
 * limita onde o ajuste vale. Cobre o design inteiro; não recebe clique (edita pelo painel).
 */
export class CamadaAjuste extends FabricObject {
  static type = 'CamadaAjuste'
  declare soaAjustes: Ajustes | null
  declare soaAjusteMascara: AjusteMascara | null
  constructor(opcoes: Record<string, unknown> = {}) {
    super({ ...opcoes, objectCaching: false, selectable: false, evented: false, hasControls: false, hasBorders: false, lockMovementX: true, lockMovementY: true })
  }
  isOnScreen() { return true }
  _render() { /* nada próprio: o efeito é sobre o que está abaixo */ }
  render(ctx: CanvasRenderingContext2D) {
    if (!this.visible || !this.soaAjustes || ehNeutro(this.soaAjustes) || !this.opacity) return
    const T = ctx.getTransform() // design → pixels deste contexto (vale na tela e na exportação)
    const W = ctx.canvas.width, H = ctx.canvas.height
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0)
    const img = ctx.getImageData(0, 0, W, H)
    const antes = this.soaAjusteMascara || this.opacity < 1 ? new Uint8ClampedArray(img.data) : null
    ajustarPixels(img.data, this.soaAjustes)
    if (antes) {
      let pesos: Uint8ClampedArray | null = null
      const m = this.soaAjusteMascara
      if (m) {
        let mc = novoCanvas(W, H)
        const g = mc.getContext('2d')!
        g.setTransform(T)
        const dw = this.width, dh = this.height
        g.fillStyle = '#000'; g.beginPath()
        if (m.forma === 'elipse') g.ellipse((m.x + m.w / 2) * dw, (m.y + m.h / 2) * dh, (m.w / 2) * dw, (m.h / 2) * dh, 0, 0, Math.PI * 2)
        else g.rect(m.x * dw, m.y * dh, m.w * dw, m.h * dh)
        g.fill()
        if (m.invertida) mc = inverterAlfa(mc)
        if (m.suave) mc = suavizarAlfa(mc, (m.suave / 100) * Math.min(W, H))
        pesos = mc.getContext('2d')!.getImageData(0, 0, W, H).data
      }
      const op = this.opacity
      const d = img.data
      for (let i = 0; i < d.length; i += 4) {
        const k = (pesos ? pesos[i + 3] / 255 : 1) * op
        if (k >= 1) continue
        d[i] = antes[i] + (d[i] - antes[i]) * k
        d[i + 1] = antes[i + 1] + (d[i + 1] - antes[i + 1]) * k
        d[i + 2] = antes[i + 2] + (d[i + 2] - antes[i + 2]) * k
      }
    }
    ctx.putImageData(img, 0, 0)
    ctx.restore()
  }
  toObject(props: string[] = []) {
    return { ...super.toObject([...props, 'soaAjustes', 'soaAjusteMascara'] as never[]) }
  }
}
classRegistry.setClass(CamadaAjuste)

/** Nova camada de ajuste cobrindo o design. */
export function novaCamadaAjuste(design: { largura: number; altura: number }, ajustes: Ajustes): CamadaAjuste {
  const c = new CamadaAjuste({ left: 0, top: 0, width: design.largura, height: design.altura, originX: 'left', originY: 'top' })
  Object.assign(c, { soaId: novoIdCamada(), soaNome: 'Ajuste', soaTipo: 'forma', soaAjustes: ajustes, soaAjusteMascara: null } satisfies Soa)
  return c
}

// ── LISTA, GRUPOS ─────────────────────────────────────────────────────────────────
export function camadas(canvas: Canvas | StaticCanvas): FabricObject[] {
  return canvas.getObjects().filter(o => !soa(o).soaAjudante)
}

export function agrupar(canvas: Canvas): Group | null {
  const sel = canvas.getActiveObjects().filter(o => !soa(o).soaAjudante)
  if (sel.length < 2) return null
  const ordem = canvas.getObjects()
  sel.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b))
  const idx = ordem.indexOf(sel[0])
  canvas.discardActiveObject()
  for (const o of sel) { o.clipPath = undefined; soa(o).soaClipDe = null }
  canvas.remove(...sel)
  const g = new Group(sel)
  Object.assign(g, { soaId: novoIdCamada(), soaNome: 'Grupo', soaTipo: 'grupo' } satisfies Soa)
  canvas.insertAt(idx, g)
  canvas.setActiveObject(g)
  return g
}

export function desagrupar(canvas: Canvas, g: Group): FabricObject[] {
  const idx = canvas.getObjects().indexOf(g)
  const filhos = g.removeAll() // o Fabric 6 devolve os filhos já com a transformação absoluta
  canvas.remove(g)
  filhos.forEach((o, i) => canvas.insertAt(idx + i, o))
  return filhos
}

// ── SERIALIZAÇÃO ──────────────────────────────────────────────────────────────────
export interface DesignJson {
  versao: 1
  fabric: Record<string, unknown>
  fontes: FonteDesign[]
  /** Moldes do "Replicar em todos os moldes" (ver lib/estudio/areaMolde). */
  moldes?: unknown[]
  replica?: { fonte: 'camada' | 'design'; camadaId: string | null; formato: 'jpg' | 'png' }
  /** MULTIPÁGINA (estilo Canva): uma entrada por página; `fabric` acima = página 1 (compatível com o antigo). */
  paginas?: { id: string; fabric: Record<string, unknown> }[]
}
export interface AssetRef { url: string; proxyUrl?: string | null; versao?: number }

function percorrer(objs: any[], f: (o: any) => void) {
  for (const o of objs || []) { f(o); if (Array.isArray(o.objects)) percorrer(o.objects, f) }
}

export function serializar(canvas: Canvas | StaticCanvas, fontes: FonteDesign[]): { json: DesignJson; assetIds: string[] } {
  const fabric = canvas.toObject(PROPS_SOA) as Record<string, any>
  const assetIds = new Set<string>()
  percorrer(fabric.objects, o => {
    // camada comum NUNCA sai "travada" por um modo temporário (seleção/pintura desliga o clique de todas);
    // travar é só o cadeado da própria camada (soaTravado)
    if (o.type !== 'CamadaAjuste' && !o.soaAjudante) { o.selectable = true; o.evented = true }
    delete o.clipPath // refeito a partir de soaClipDe / soaFormaMascara
    if (o.soaAssetId) assetIds.add(o.soaAssetId)
    if (o.fill && typeof o.fill === 'object' && o.fill.source) o.fill = o.soaBase?.fill ?? '#1f2937' // textura: refeita dos efeitos
  })
  return { json: { versao: 1, fabric, fontes }, assetIds: [...assetIds] }
}

/**
 * Abre o design: cada objeto inteligente carrega o PROXY da versão atual do asset (rápido); o
 * original em alta fica anotado para a exportação. Efeitos/recortes são refeitos dos parâmetros.
 */
export async function desserializar(canvas: Canvas | StaticCanvas, json: DesignJson, assets: Record<string, AssetRef>): Promise<void> {
  await Promise.all((json.fontes || []).map(async f => {
    try { const ff = new FontFace(f.familia, `url(${f.url})`); await ff.load(); document.fonts.add(ff) } catch { /* segue com fallback */ }
  }))
  const fabric = structuredClone(json.fabric || {}) as Record<string, any>
  const cheia = new Map<string, string>() // src de carga → url do original
  percorrer(fabric.objects, o => {
    if (o.type === 'Image' || o.type === 'image') {
      const a = o.soaAssetId ? assets[o.soaAssetId] : undefined
      const original = a?.url || o.src
      const carga = a?.proxyUrl || original
      o.src = carga; o.crossOrigin = 'anonymous'
      cheia.set(carga, original)
    }
  })
  const bg = fabric.background
  await canvas.loadFromJSON(fabric)
  canvas.backgroundColor = typeof bg === 'string' ? bg : ''
  await Promise.all(imagensDo(canvas).map(async img => {
    const el = img.getElement() as HTMLImageElement
    const original = cheia.get(el.src) || cheia.get(el.getAttribute('src') || '') || el.src
    const { proxy } = await criarProxy(el)
    originais.set(img, proxy); proxies.set(img, proxy); urlsCheias.set(img, original)
    fixarSrc(img, original)
    await processarCamada(img)
  }))
  // estilos em texto/forma/grupo (inclusive dentro de grupos)
  const comEstilo = async (objs: FabricObject[]) => { for (const o of objs) { if (!(o instanceof FabricImage) && soa(o).soaEfeitos) await aplicarEfeitos(o, soa(o).soaEfeitos!); if (o instanceof Group) await comEstilo(o.getObjects()) } }
  await comEstilo(canvas.getObjects())
  // designs salvos durante um modo temporário (seleção/pintura) voltavam com as camadas inclicáveis
  for (const o of canvas.getObjects()) if (!(o instanceof CamadaAjuste) && !soa(o).soaAjudante) { o.selectable = true; o.evented = true }
  await aplicarRecortes(canvas)
  canvas.requestRenderAll()
}

/** Versão nova do objeto inteligente → todas as instâncias DESTE canvas (cada uma no seu lugar). */
export async function trocarFonteDasInstancias(canvas: Canvas | StaticCanvas, assetId: string, url: string, proxyUrl?: string | null): Promise<number> {
  const el = await carregarImagemUrl(proxyUrl || url)
  const { proxy } = await criarProxy(el)
  let n = 0
  for (const o of imagensDo(canvas)) {
    if (soa(o).soaAssetId !== assetId) continue
    fixarSrc(o, url); urlsCheias.set(o, url); proxies.set(o, proxy); mascaras.delete(o)
    await processarCamada(o, proxy); n++
  }
  await aplicarRecortes(canvas)
  canvas.requestRenderAll()
  return n
}

/** Renderiza o design (sem alças e sem camadas-área). `escala` = 1 → tamanho real. */
export function renderizarDesign(canvas: Canvas | StaticCanvas, zoom: number, escala = 1): HTMLCanvasElement {
  return canvas.toCanvasElement(escala / zoom, { filter: o => !soa(o as unknown as FabricObject).soaAjudante && !soa(o as unknown as FabricObject).soaArea })
}

/** Renderiza em ALTA (troca proxies pelos originais, renderiza e volta). */
export async function renderizarEmAlta(canvas: Canvas | StaticCanvas, zoom: number, escala = 1): Promise<HTMLCanvasElement> {
  const voltar = await usarResolucaoCheia(canvas)
  try { return renderizarDesign(canvas, zoom, escala) } finally { await voltar() }
}
