// SOA Edition — NÚCLEO DO EDITOR DE CAMADAS (Fase 2). Só navegador (Fabric 6).
//
// Camada de imagem = OBJETO INTELIGENTE: guarda o assetId (EstudioAsset no Blob), nunca a imagem
// embutida. Ajustes, máscara de pintura e distorção ficam como PARÂMETROS na camada; a imagem
// exibida é sempre recalculada a partir do ORIGINAL (não-destrutivo). Trocar o arquivo-fonte do
// asset atualiza toda camada vinculada — em qualquer design — na próxima abertura/render.
//
// "Mapa" da camada: relaciona o elemento exibido com o espaço NORMALIZADO da imagem original
// (0…1). Distorcer muda o tamanho do elemento; o mapa permite recolocar a camada para que a
// moldura original fique parada na tela (a distorção muda a arte, não o lugar da camada).
import { Canvas, FabricImage, FabricObject, Group, Rect, Ellipse, Polygon, Point, util } from 'fabric'
import { aplicarAjustes, aplicarMascara, ehNeutro, type Ajustes } from './ajustes'
import { distorcer, type Distorcao } from './transform'

export type TipoCamada = 'imagem' | 'texto' | 'forma' | 'grupo'
export interface Mapa { minX: number; minY: number; pxU: number; pxV: number }
export type FormaMascaraTipo = 'retangulo' | 'arredondado' | 'elipse' | 'estrela' | 'coracao'
export interface FormaMascara { forma: FormaMascaraTipo; x: number; y: number; w: number; h: number; invertida: boolean }
export interface FonteDesign { id: string; familia: string; url: string }

/** Propriedades próprias que viajam no JSON do design. */
export const PROPS_SOA = [
  'soaId', 'soaNome', 'soaTipo', 'soaAssetId', 'soaAjustes', 'soaDistorcao', 'soaMascara', 'soaMapa',
  'soaTravado', 'soaClipDe', 'soaFormaMascara', 'soaFonte', 'selectable', 'evented',
]

/** Acesso tipado às propriedades soa* de um objeto Fabric. */
export type Soa = {
  soaId?: string; soaNome?: string; soaTipo?: TipoCamada; soaAssetId?: string | null
  soaAjustes?: Ajustes | null; soaDistorcao?: Distorcao | null; soaMascara?: string | null; soaMapa?: Mapa | null
  soaTravado?: boolean; soaClipDe?: string | null; soaFormaMascara?: FormaMascara | null; soaFonte?: string | null
  soaAjudante?: boolean
}
export const soa = (o: FabricObject) => o as FabricObject & Soa

export const novoIdCamada = () => Math.random().toString(36).slice(2, 10)

const originais = new WeakMap<FabricObject, HTMLImageElement>()
const mascaras = new WeakMap<FabricObject, HTMLCanvasElement>()

export function carregarImagemUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous'
    i.onload = () => res(i); i.onerror = () => rej(new Error('Não consegui abrir a imagem.'))
    i.src = url
  })
}

/** O JSON guarda a URL do ORIGINAL (nunca o canvas processado em data URL). */
function fixarSrc(img: FabricImage, url: string) {
  ;(img as unknown as { soaUrl: string }).soaUrl = url
  img.getSrc = () => (img as unknown as { soaUrl: string }).soaUrl
}

/** Nova camada de imagem vinculada a um asset (objeto inteligente), cabendo em ~80% do design. */
export async function criarCamadaImagem(url: string, assetId: string | null, nome: string, design: { largura: number; altura: number }): Promise<FabricImage> {
  const el = await carregarImagemUrl(url)
  const img = new FabricImage(el, { crossOrigin: 'anonymous' })
  const k = Math.min(1, (design.largura * 0.8) / el.naturalWidth, (design.altura * 0.8) / el.naturalHeight)
  img.set({ scaleX: k, scaleY: k })
  Object.assign(img, {
    soaId: novoIdCamada(), soaNome: nome, soaTipo: 'imagem', soaAssetId: assetId, soaAjustes: null, soaDistorcao: null,
    soaMascara: null, soaMapa: { minX: 0, minY: 0, pxU: el.naturalWidth, pxV: el.naturalHeight },
  } satisfies Soa)
  originais.set(img, el)
  fixarSrc(img, url)
  return img
}

/** Troca o elemento exibido mantendo a moldura da imagem original parada na tela. */
function trocarElemento(img: FabricImage, el: HTMLImageElement | HTMLCanvasElement, mapa2: Mapa) {
  const s = soa(img)
  const m1 = s.soaMapa ?? { minX: 0, minY: 0, pxU: img.width, pxV: img.height }
  const W1 = img.width, H1 = img.height
  const W2 = el instanceof HTMLImageElement ? el.naturalWidth : el.width
  const H2 = el instanceof HTMLImageElement ? el.naturalHeight : el.height
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
  const k = Math.min(1, 1024 / Math.max(orig.naturalWidth, orig.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(orig.naturalWidth * k)); c.height = Math.max(1, Math.round(orig.naturalHeight * k))
  const g = c.getContext('2d')!
  if (s.soaMascara) { const m = await carregarImagemUrl(s.soaMascara); g.drawImage(m, 0, 0, c.width, c.height) }
  else { g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height) }
  mascaras.set(img, c)
  return c
}

/**
 * Recalcula a imagem exibida a partir do ORIGINAL: ajustes → máscara → distorção.
 * `originalNovo` = objeto inteligente trocado (nova versão do arquivo-fonte).
 */
export async function processarCamada(img: FabricImage, originalNovo?: HTMLImageElement): Promise<void> {
  if (originalNovo) { originais.set(img, originalNovo); mascaras.delete(img) }
  const orig = originais.get(img)
  if (!orig) return
  const s = soa(img)
  const w = orig.naturalWidth, h = orig.naturalHeight
  let fonte: HTMLImageElement | HTMLCanvasElement = orig
  if (s.soaAjustes && !ehNeutro(s.soaAjustes)) fonte = aplicarAjustes(orig, w, h, s.soaAjustes) as HTMLCanvasElement
  const masc = s.soaMascara || mascaras.has(img) ? await mascaraDa(img, false) : null
  if (masc) {
    if (fonte === orig) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d')!.drawImage(orig, 0, 0); fonte = c }
    aplicarMascara(fonte as HTMLCanvasElement, masc)
  }
  if (s.soaDistorcao) {
    const d = s.soaDistorcao
    const r = distorcer(fonte, w, h, { ...d, pontos: d.pontos.map(p => ({ x: p.x * w, y: p.y * h })) })
    trocarElemento(img, r.canvas, { minX: r.minX / w, minY: r.minY / h, pxU: w * r.escala, pxV: h * r.escala })
  } else {
    trocarElemento(img, fonte, { minX: 0, minY: 0, pxU: w, pxV: h })
  }
}

/** Coordenada normalizada da imagem original → ponto da cena (onde a alça da distorção fica). */
export function originalParaCena(img: FabricImage, u: number, v: number): Point {
  const m = soa(img).soaMapa ?? { minX: 0, minY: 0, pxU: img.width, pxV: img.height }
  return new Point(m.pxU * (u - m.minX) - img.width / 2, m.pxV * (v - m.minY) - img.height / 2).transform(img.calcTransformMatrix())
}

/** Prepara uma cópia (duplicar camada): imagem reusa o original já carregado. */
export async function duplicarCamada(o: FabricObject): Promise<FabricObject> {
  const c = await o.clone(PROPS_SOA)
  const s = soa(c)
  s.soaId = novoIdCamada()
  s.soaNome = `${soa(o).soaNome || 'Camada'} (cópia)`
  s.soaClipDe = null
  c.clipPath = undefined
  if (c instanceof FabricImage && o instanceof FabricImage) {
    const orig = originais.get(o)
    if (orig) { originais.set(c, orig); fixarSrc(c, (o as unknown as { soaUrl: string }).soaUrl || orig.src) }
    const m = mascaras.get(o)
    if (m) { const mc = document.createElement('canvas'); mc.width = m.width; mc.height = m.height; mc.getContext('2d')!.drawImage(m, 0, 0); mascaras.set(c, mc) }
    await processarCamada(c)
  }
  return c
}

// ── MÁSCARA DE PINTURA ────────────────────────────────────────────────────────────
/** Ponto da cena → coordenada normalizada (0…1) da imagem original da camada. */
export function cenaParaOriginal(img: FabricImage, x: number, y: number): { u: number; v: number } {
  const m = soa(img).soaMapa ?? { minX: 0, minY: 0, pxU: img.width, pxV: img.height }
  const p = new Point(x, y).transform(util.invertTransform(img.calcTransformMatrix()))
  return { u: (p.x + img.width / 2) / m.pxU + m.minX, v: (p.y + img.height / 2) / m.pxV + m.minY }
}

/** Pinta na máscara: 'esconder' apaga (fica transparente), 'revelar' devolve. `raio` em px da cena. */
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

/** Grava a máscara na camada (PNG pequeno). Máscara toda opaca = sem máscara. */
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

// ── MÁSCARA POR FORMA e CLIPPING ──────────────────────────────────────────────────
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

/** Forma da máscara no espaço LOCAL do objeto (centro = 0,0), editável pelos parâmetros. */
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

/** Refaz as máscaras por forma e os recortes "camada recorta camada" (clipping) do canvas todo. */
export async function aplicarRecortes(canvas: Canvas): Promise<void> {
  const objs = camadas(canvas)
  for (const o of objs) {
    const s = soa(o)
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

// ── LISTA, GRUPOS ─────────────────────────────────────────────────────────────────
/** Camadas de verdade (sem as alças de edição). */
export function camadas(canvas: Canvas): FabricObject[] {
  return canvas.getObjects().filter(o => !soa(o).soaAjudante)
}

export function agrupar(canvas: Canvas): Group | null {
  const sel = canvas.getActiveObjects().filter(o => !soa(o).soaAjudante)
  if (sel.length < 2) return null
  // Ordem de empilhamento preservada.
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
export interface DesignJson { versao: 1; fabric: Record<string, unknown>; fontes: FonteDesign[] }

function percorrer(objs: any[], f: (o: any) => void) {
  for (const o of objs || []) { f(o); if (Array.isArray(o.objects)) percorrer(o.objects, f) }
}

/** JSON do design: só REFERÊNCIAS de asset; máscaras/recortes voltam como parâmetros. */
export function serializar(canvas: Canvas, fontes: FonteDesign[]): { json: DesignJson; assetIds: string[] } {
  const fabric = canvas.toObject(PROPS_SOA) as Record<string, any>
  const assetIds = new Set<string>()
  percorrer(fabric.objects, o => {
    delete o.clipPath // refeito a partir de soaClipDe / soaFormaMascara
    if (o.soaAssetId) assetIds.add(o.soaAssetId)
  })
  return { json: { versao: 1, fabric, fontes }, assetIds: [...assetIds] }
}

/** Abre o design: troca a URL de cada objeto inteligente pela VERSÃO ATUAL do asset e reprocessa. */
export async function desserializar(canvas: Canvas, json: DesignJson, urlDoAsset: Record<string, string>): Promise<void> {
  for (const f of json.fontes || []) {
    try { const ff = new FontFace(f.familia, `url(${f.url})`); await ff.load(); document.fonts.add(ff) } catch { /* segue com fallback */ }
  }
  const fabric = structuredClone(json.fabric || {}) as Record<string, any>
  percorrer(fabric.objects, o => {
    if (o.soaAssetId && urlDoAsset[o.soaAssetId]) o.src = urlDoAsset[o.soaAssetId]
    if (o.type === 'Image' || o.type === 'image') o.crossOrigin = 'anonymous'
  })
  // O Fabric 6 serializa a cor de fundo como "background"; ausente = fundo transparente.
  const bg = fabric.background
  await canvas.loadFromJSON(fabric)
  canvas.backgroundColor = typeof bg === 'string' ? bg : ''
  const imgs: FabricImage[] = []
  const coletar = (objs: FabricObject[]) => { for (const o of objs) { if (o instanceof FabricImage) imgs.push(o); if (o instanceof Group) coletar(o.getObjects()) } }
  coletar(canvas.getObjects())
  for (const img of imgs) {
    const el = img.getElement() as HTMLImageElement
    originais.set(img, el)
    fixarSrc(img, el.src)
    await processarCamada(img)
  }
  await aplicarRecortes(canvas)
  canvas.requestRenderAll()
}

/** Reabre as camadas com esta versão nova do arquivo-fonte (objeto inteligente trocado). */
export async function trocarFonteDasInstancias(canvas: Canvas, assetId: string, url: string): Promise<number> {
  const el = await carregarImagemUrl(url)
  let n = 0
  const visitar = async (objs: FabricObject[]) => {
    for (const o of objs) {
      if (o instanceof FabricImage && soa(o).soaAssetId === assetId) { fixarSrc(o, url); await processarCamada(o, el); n++ }
      if (o instanceof Group) await visitar(o.getObjects())
    }
  }
  await visitar(canvas.getObjects())
  await aplicarRecortes(canvas)
  canvas.requestRenderAll()
  return n
}

/** Renderiza o design (sem alças de edição; os controles de seleção nunca entram). `escala` = 1 → tamanho real. */
export function renderizarDesign(canvas: Canvas, zoom: number, escala = 1): HTMLCanvasElement {
  return canvas.toCanvasElement(escala / zoom, { filter: o => !soa(o as unknown as FabricObject).soaAjudante })
}
