// mae-exportar — MONTAGEM DO PDF (pdf-lib; navegador e Node): página em mm EXATOS, a arte (PNG 300 dpi
// do MESMO motor da tela) e, por cima, em VETOR: identidade (QR em quadradinhos vetoriais + logo), linhas
// de corte/dobra (as detectadas ou a página original do molde em PDF) e a marca de registro (a página da
// marca em tamanho real). "Imprimir em tamanho real" vai gravado no arquivo (PrintScaling = None).
import { PDFDocument, PrintScaling, degrees, rgb, type PDFPage } from 'pdf-lib'
import QRCode from 'qrcode'
import type { Pt } from '../faces/geometria'
import { caminhoCorte, caminhoDobra, type Linhas } from './linhas'
import { naPagina, type Encaixe } from './marca'

export const PT_POR_MM = 72 / 25.4

export interface MoldePdf {
  bytes: Uint8Array
  /** Página do molde no PDF original (1, 2, …). */
  pagina: number
  /** Recorte do molde dentro da página (mm, y para baixo). */
  crop?: { xMm: number; yMm: number; wMm: number; hMm: number }
  /** Onde o recorte cai na arte (mm). */
  xMm: number; yMm: number
}

export interface PaginaPdf {
  /** Tamanho da página em mm (a folha da marca, ou a própria arte). */
  larguraMm: number; alturaMm: number
  arte: { bytes: Uint8Array; tipo: 'png' | 'jpg'; larguraMm: number; alturaMm: number }
  /** Como a arte entra na página (girada 90° na marca retrato, centralizada se o tamanho difere). */
  encaixe?: Encaixe
  /** Linhas de corte/dobra detectadas (mm da arte). */
  linhas?: Linhas | null
  /** Linhas ORIGINAIS: a página do molde em PDF desenhada por cima (vetor exato do arquivo). */
  moldesPdf?: MoldePdf[]
  /** Marca de registro por cima; `girar` = a MARCA gira 90° para caber na folha; dx/dy = centralizada (mm). */
  marca?: { bytes: Uint8Array; pagina: number; girar?: boolean; dx?: number; dy?: number } | null
  identidade?: {
    qr?: { texto: string; xMm: number; yMm: number; ladoMm: number; rotationDeg?: number }[]
    logo?: { bytes: Uint8Array; tipo: 'png' | 'jpg'; xMm: number; yMm: number; wMm: number; hMm: number; rotationDeg?: number }[]
  }
  /** Lote 4 (item 21): elementos "pode vazar da face" (PNG transparente do tamanho da arte), POR CIMA das linhas. */
  sobreLinhas?: { bytes: Uint8Array; larguraMm: number; alturaMm: number }
  /** Cor e espessura das linhas (mm). */
  corLinha?: [number, number, number]
  larguraLinhaMm?: number
}

const SEM_ENCAIXE: Encaixe = { girar: false, diferente: false, dx: 0, dy: 0 }

/** Retângulo da arte (mm, canto superior esquerdo) → opções de desenho do pdf-lib na página. */
export function colocar(e: Encaixe, artH: number, paginaH: number, x: number, y: number, w: number, h: number) {
  // canto inferior esquerdo do retângulo (é onde o pdf-lib ancora a imagem)
  const [u, v] = naPagina(e, artH, x, y + h)
  return { x: u * PT_POR_MM, y: (paginaH - v) * PT_POR_MM, width: w * PT_POR_MM, height: h * PT_POR_MM, rotate: degrees(e.girar ? -90 : 0) }
}

const f3 = (v: number) => Math.round(v * 1000) / 1000

/** QR em módulos vetoriais (caminho SVG em mm da arte, com zona de silêncio de 1 módulo). */
export function caminhoQr(texto: string, x: number, y: number, lado: number): string {
  const q = QRCode.create(texto, { errorCorrectionLevel: 'M' })
  const n = q.modules.size, m = lado / (n + 2)
  let d = ''
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!q.modules.get(j, i)) continue
    const x0 = x + (i + 1) * m, y0 = y + (j + 1) * m
    d += `M${f3(x0)} ${f3(y0)}h${f3(m)}v${f3(m)}h${f3(-m)}Z`
  }
  return d
}

/** Leva um caminho (só M/L/h/v/Z absolutos ou relativos simples) da arte para a página da marca. */
function caminhoNaPagina(d: string, e: Encaixe, artH: number): string {
  if (!e.girar && !e.dx && !e.dy) return d
  return transformarCaminho(d, (x, y) => naPagina(e, artH, x, y))
}

/** Gira um caminho (mm da arte) em volta de (cx, cy) — logo/QR girados da identidade (Lote 1). */
export function girarCaminho(d: string, cx: number, cy: number, graus: number): string {
  if (!graus) return d
  const t = (graus * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t)
  return transformarCaminho(d, (x, y) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c])
}

/** Converte para absoluto (M/L/Z) e transforma ponto a ponto. */
function transformarCaminho(d: string, f: (x: number, y: number) => [number, number]): string {
  let out = '', cx = 0, cy = 0, sx = 0, sy = 0
  const re = /([MLHVZmlhvz])([^MLHVZmlhvz]*)/g
  let r: RegExpExecArray | null
  const p = (x: number, y: number) => { const [u, v] = f(x, y); return `${f3(u)} ${f3(v)}` }
  while ((r = re.exec(d))) {
    const t = r[1], v = (r[2].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number)
    if (t === 'Z' || t === 'z') { out += 'Z'; cx = sx; cy = sy; continue }
    if (t === 'M' || t === 'L') { cx = v[0]; cy = v[1]; if (t === 'M') { sx = cx; sy = cy } out += t + p(cx, cy) }
    else if (t === 'm' || t === 'l') { cx += v[0]; cy += v[1]; if (t === 'm') { sx = cx; sy = cy } out += t.toUpperCase() + p(cx, cy) }
    else if (t === 'H') { cx = v[0]; out += 'L' + p(cx, cy) } else if (t === 'h') { cx += v[0]; out += 'L' + p(cx, cy) }
    else if (t === 'V') { cy = v[0]; out += 'L' + p(cx, cy) } else if (t === 'v') { cy += v[0]; out += 'L' + p(cx, cy) }
  }
  return out
}

/**
 * Lote 5 (item 79): cache dos objetos do PDF — a MESMA página repetida (PDF na quantidade do pedido: kit 42 =
 * 7 de cada caixa) reaproveita a imagem e a marca já embutidas (`drawImage`/`drawPage` de novo, sem re-embutir):
 * 42 páginas de 6 caixas diferentes ficam quase do tamanho e do tempo de 6.
 */
interface CachePdf { imagens: Map<Uint8Array, Awaited<ReturnType<PDFDocument['embedPng']>>>; marcas: Map<Uint8Array, Awaited<ReturnType<PDFDocument['embedPdf']>>[number]> }

async function desenharPagina(doc: PDFDocument, pg: PaginaPdf, cache: CachePdf = { imagens: new Map(), marcas: new Map() }): Promise<PDFPage> {
  const e = pg.encaixe ?? SEM_ENCAIXE
  const page = doc.addPage([pg.larguraMm * PT_POR_MM, pg.alturaMm * PT_POR_MM])
  const H = pg.alturaMm, artH = pg.arte.alturaMm
  // 1) arte (raster 300 dpi do motor) — embutida UMA vez por imagem
  let img = cache.imagens.get(pg.arte.bytes)
  if (!img) { img = pg.arte.tipo === 'png' ? await doc.embedPng(pg.arte.bytes) : await doc.embedJpg(pg.arte.bytes); cache.imagens.set(pg.arte.bytes, img) }
  page.drawImage(img, colocar(e, artH, H, 0, 0, pg.arte.larguraMm, pg.arte.alturaMm))
  // 2) identidade em vetor (QR) e logo
  for (const l of pg.identidade?.logo ?? []) {
    let li = cache.imagens.get(l.bytes)
    if (!li) { li = l.tipo === 'png' ? await doc.embedPng(l.bytes) : await doc.embedJpg(l.bytes); cache.imagens.set(l.bytes, li) }
    const g = l.rotationDeg ?? 0
    if (!g) { page.drawImage(li, colocar(e, artH, H, l.xMm, l.yMm, l.wMm, l.hMm)); continue }
    // girada: o pdf-lib gira em volta do canto inferior esquerdo → leva esse canto (já girado em volta do
    // centro) para a página e gira a imagem pelo mesmo ângulo (horário na arte = negativo no PDF)
    const cxm = l.xMm + l.wMm / 2, cym = l.yMm + l.hMm / 2, t = (g * Math.PI) / 180
    const bx = l.xMm - cxm, by = l.yMm + l.hMm - cym
    const [u, v] = naPagina(e, artH, cxm + bx * Math.cos(t) - by * Math.sin(t), cym + bx * Math.sin(t) + by * Math.cos(t))
    page.drawImage(li, { x: u * PT_POR_MM, y: (H - v) * PT_POR_MM, width: l.wMm * PT_POR_MM, height: l.hMm * PT_POR_MM, rotate: degrees((e.girar ? -90 : 0) - g) })
  }
  for (const q of pg.identidade?.qr ?? []) {
    const g = q.rotationDeg ?? 0, cxm = q.xMm + q.ladoMm / 2, cym = q.yMm + q.ladoMm / 2
    const ret = girarCaminho(`M${q.xMm} ${q.yMm}h${q.ladoMm}v${q.ladoMm}h${-q.ladoMm}Z`, cxm, cym, g)
    page.drawSvgPath(caminhoNaPagina(ret, e, artH), { x: 0, y: H * PT_POR_MM, scale: PT_POR_MM, color: rgb(1, 1, 1) })
    page.drawSvgPath(caminhoNaPagina(girarCaminho(caminhoQr(q.texto, q.xMm, q.yMm, q.ladoMm), cxm, cym, g), e, artH), { x: 0, y: H * PT_POR_MM, scale: PT_POR_MM, color: rgb(0, 0, 0) })
  }
  // 3) linhas de corte/dobra em vetor
  const [r, g, b] = pg.corLinha ?? [0.1, 0.1, 0.1]
  const lw = pg.larguraLinhaMm ?? 0.25
  for (const m of pg.moldesPdf ?? []) {
    const src = await PDFDocument.load(m.bytes, { ignoreEncryption: true })
    const sp = src.getPage(Math.max(0, (m.pagina ?? 1) - 1))
    const mb = sp.getMediaBox()
    const spH = mb.height / PT_POR_MM
    const c = m.crop ?? { xMm: 0, yMm: 0, wMm: mb.width / PT_POR_MM, hMm: spH }
    const emb = await doc.embedPage(sp, {
      left: mb.x + c.xMm * PT_POR_MM, right: mb.x + (c.xMm + c.wMm) * PT_POR_MM,
      bottom: mb.y + (spH - c.yMm - c.hMm) * PT_POR_MM, top: mb.y + (spH - c.yMm) * PT_POR_MM,
    })
    page.drawPage(emb, colocar(e, artH, H, m.xMm, m.yMm, c.wMm, c.hMm))
  }
  if (pg.linhas) {
    const corte = caminhoCorte(pg.linhas), dobra = caminhoDobra(pg.linhas)
    const op = { x: 0, y: H * PT_POR_MM, scale: PT_POR_MM, borderColor: rgb(r, g, b), borderWidth: lw }
    if (corte) page.drawSvgPath(caminhoNaPagina(corte, e, artH), op)
    if (dobra) page.drawSvgPath(caminhoNaPagina(dobra, e, artH), op)
  }
  // 3b) Lote 4 (item 21): o que pode vazar da face fica inteiro por cima da linha do molde
  if (pg.sobreLinhas) {
    let so = cache.imagens.get(pg.sobreLinhas.bytes)
    if (!so) { so = await doc.embedPng(pg.sobreLinhas.bytes); cache.imagens.set(pg.sobreLinhas.bytes, so) }
    page.drawImage(so, colocar(e, artH, H, 0, 0, pg.sobreLinhas.larguraMm, pg.sobreLinhas.alturaMm))
  }
  // 4) marca de registro em tamanho real, por cima de tudo
  if (pg.marca) {
    let mp = cache.marcas.get(pg.marca.bytes)
    if (!mp) { [mp] = await doc.embedPdf(pg.marca.bytes, [Math.max(0, pg.marca.pagina - 1)]); cache.marcas.set(pg.marca.bytes, mp) }
    const dx = (pg.marca.dx ?? 0) * PT_POR_MM, topo = (H - (pg.marca.dy ?? 0)) * PT_POR_MM
    // girada: −90° em volta do canto de cima/esquerda — a largura da marca desce, a altura vai para a direita
    if (pg.marca.girar) page.drawPage(mp, { x: dx, y: topo, width: mp.width, height: mp.height, rotate: degrees(-90) })
    else page.drawPage(mp, { x: dx, y: topo - mp.height, width: mp.width, height: mp.height })
  }
  return page
}

/** Monta o PDF (uma página por item). Páginas em mm exatos; impressão em tamanho real gravada. */
export async function montarPdf(paginas: PaginaPdf[], titulo: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(titulo); doc.setCreator('SOA · Método MAE'); doc.setProducer('SOA · Método MAE')
  const cache: CachePdf = { imagens: new Map(), marcas: new Map() }
  for (const p of paginas) await desenharPagina(doc, p, cache)
  const vp = doc.catalog.getOrCreateViewerPreferences()
  vp.setPrintScaling(PrintScaling.None)
  vp.setPickTrayByPDFSize(true)
  return doc.save()
}

/** Tamanho (mm) de uma página de um PDF — a folha da marca de registro. */
export async function tamanhoDaPagina(bytes: Uint8Array, pagina = 1): Promise<{ wMm: number; hMm: number; paginas: number }> {
  const d = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const p = d.getPage(Math.max(0, pagina - 1))
  const { width, height } = p.getSize()
  return { wMm: width / PT_POR_MM, hMm: height / PT_POR_MM, paginas: d.getPageCount() }
}

/** Linhas (mm da arte) → mm da página (para checar conflitos com a marca). */
export function regioesNaPagina(rs: Pt[][], e: Encaixe, artH: number): Pt[][] {
  return rs.map(r => r.map(([x, y]) => naPagina(e, artH, x, y)))
}
