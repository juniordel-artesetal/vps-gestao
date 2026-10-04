// mae-importação — LEITURA DOS ARQUIVOS NO NAVEGADOR (PDF, SVG, DXF, PNG, JPG). Cada arquivo vira uma ou
// mais FONTES (uma por página no PDF), já em mm, que sabem se desenhar em qualquer escala. Depois o
// `prepararFonte` rasteriza a 200 dpi, recorta o molde e devolve a máscara para a detecção de faces.
// Nada sai do computador.
import { prepararDeRaster, PX_POR_MM_DETECCAO, type MoldePreparado } from './preparar'
import { abrirPdf, desenharPagina, tamanhoPaginaMm, vetoresDaPagina, type PaginaPdf } from './pdf'
import { lerDpi, larguraPeloDpi, tamanhoSvgMm, unidadeDoDxf } from './unidades'

import type { TipoArquivo } from './padroes'
export type { TipoArquivo }
type Ctx2D = OffscreenCanvasRenderingContext2D

export const ACEITOS = '.pdf,.svg,.dxf,.png,.jpg,.jpeg'

export function tipoDoArquivo(nome: string, cab: Uint8Array): TipoArquivo | null {
  const ext = nome.toLowerCase().split('.').pop() || ''
  const ini = String.fromCharCode(...cab.slice(0, 64))
  if (ini.startsWith('%PDF') || ext === 'pdf') return 'pdf'
  if (cab[0] === 0x89 && cab[1] === 0x50) return 'png'
  if (cab[0] === 0xff && cab[1] === 0xd8) return 'jpg'
  if (ext === 'svg' || /<svg[\s>]/i.test(new TextDecoder().decode(cab.slice(0, 2048)))) return 'svg'
  if (ext === 'dxf') return 'dxf'
  return null
}

export interface FonteMolde {
  arquivo: File
  nome: string
  tipo: TipoArquivo
  pagina?: number
  /** Tamanho da página/arquivo inteiro em mm (imagem: depende da calibração). */
  larguraMm: number
  alturaMm: number
  /** O que a usuária ainda precisa confirmar antes de importar. */
  pendente: 'largura' | 'unidade' | null
  /** Imagem: tamanho em px e DPI gravado (se houver). */
  larguraPx?: number
  alturaPx?: number
  dpi?: number | null
  /** SVG: o tamanho veio com unidade física? (senão, vale conferir) */
  tamanhoConfiavel?: boolean
  /** DXF: mm por unidade (null = o arquivo não diz). */
  mmPorUnidade?: number | null
  /** Desenha a página inteira em ctx na escala pxPorMm. 'linhas' = traço contínuo; 'dobras' = só o tracejado. */
  desenhar: (ctx: Ctx2D, pxPorMm: number, modo: 'linhas' | 'dobras') => Promise<boolean>
  /** PDF: linhas tracejadas (mm de página). */
  dobrasMm?: () => Promise<[number, number][][]>
  /** Imagem (prévia para medir com 2 cliques). */
  bitmap?: ImageBitmap
}

// ── PDF ──────────────────────────────────────────────────────────────────────────────────────────
type PdfJsMod = typeof import('pdfjs-dist')
let pdfjsCache: Promise<PdfJsMod> | null = null
async function pdfjs(): Promise<PdfJsMod> {
  if (!pdfjsCache) pdfjsCache = import('pdfjs-dist').then(m => { m.GlobalWorkerOptions.workerSrc = '/estudio/pdf.worker.min.mjs'; return m })
  return pdfjsCache
}

/** Rasteriza uma página de PDF (marca de registro: achar onde tem tinta). Fundo branco. */
export async function rasterizarPaginaPdf(bytes: Uint8Array, pagina: number, pxPorMm: number): Promise<{ rgba: Uint8ClampedArray; w: number; h: number; larguraMm: number; alturaMm: number; paginas: number }> {
  const pj = await pdfjs()
  const pdf = await abrirPdf(pj as never, bytes.slice())
  const pg = await pdf.pagina(pagina)
  const t = tamanhoPaginaMm(pg)
  const c = new OffscreenCanvas(Math.ceil(t.larguraMm * pxPorMm), Math.ceil(t.alturaMm * pxPorMm))
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height)
  await desenharPagina(pg, g as never, pxPorMm)
  return { rgba: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, larguraMm: t.larguraMm, alturaMm: t.alturaMm, paginas: pdf.paginas }
}

async function fontesPdf(arquivo: File): Promise<FonteMolde[]> {
  const pj = await pdfjs()
  const pdf = await abrirPdf(pj as never, new Uint8Array(await arquivo.arrayBuffer()))
  const out: FonteMolde[] = []
  for (let n = 1; n <= pdf.paginas; n++) {
    const pg: PaginaPdf = await pdf.pagina(n)
    const t = tamanhoPaginaMm(pg)
    const base = arquivo.name.replace(/\.[^.]+$/, '')
    out.push({
      arquivo, tipo: 'pdf', pagina: n, nome: pdf.paginas > 1 ? `${base} (pág. ${n})` : base,
      larguraMm: t.larguraMm, alturaMm: t.alturaMm, pendente: null,
      desenhar: async (ctx, k, modo) => {
        if (modo === 'dobras') return false
        await desenharPagina(pg, ctx as never, k)
        return true
      },
      dobrasMm: async () => (await vetoresDaPagina(pg, pj.OPS as unknown as Record<string, number>)).dobras,
    })
  }
  return out
}

// ── SVG (e DXF, que vira SVG pelo conversor do SOA Design) ───────────────────────────────────────
interface SvgPreparado { linhas: string; dobras: string | null; larguraMm: number; alturaMm: number; confiavel: boolean }

/**
 * Prepara duas versões do SVG: "linhas" (todo traço contínuo, preto, 1,6 px; preenchimento vira
 * contorno) e "dobras" (só os traços com stroke-dasharray). O estilo é lido com getComputedStyle, então
 * vale tracejado vindo de atributo, de style, de classe CSS ou herdado de grupo.
 */
export function prepararSvg(texto: string): SvgPreparado {
  const doc = new DOMParser().parseFromString(texto, 'image/svg+xml')
  const raiz = doc.documentElement
  if (!raiz || raiz.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) throw new Error('Este SVG não pôde ser lido (arquivo corrompido ou não é SVG).')
  const tam = tamanhoSvgMm({ width: raiz.getAttribute('width'), height: raiz.getAttribute('height'), viewBox: raiz.getAttribute('viewBox') })
  if (!tam) throw new Error('O SVG não informa o tamanho (sem width/height nem viewBox).')
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:-100000px;top:0;width:10px;height:10px;overflow:hidden;visibility:hidden'
  const vivo = document.importNode(raiz, true) as unknown as SVGSVGElement
  host.appendChild(vivo); document.body.appendChild(host)
  let temDobra = false
  try {
    for (const el of Array.from(vivo.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse,text,use'))) {
      const cs = getComputedStyle(el)
      const tracejado = !!cs.strokeDasharray && cs.strokeDasharray !== 'none' && cs.stroke !== 'none'
      const algum = cs.stroke !== 'none' || cs.fill !== 'none'
      el.setAttribute('data-mae', tracejado ? 'd' : algum ? 'l' : 'x')
      if (tracejado) temDobra = true
    }
  } finally { host.remove() }
  if (!vivo.getAttribute('viewBox')) vivo.setAttribute('viewBox', `0 0 ${(tam.larguraMm / 25.4) * 96} ${(tam.alturaMm / 25.4) * 96}`)
  vivo.setAttribute('preserveAspectRatio', 'none')
  const base = '*{fill:none!important;stroke:#000!important;stroke-width:1.6px!important;stroke-dasharray:none!important;vector-effect:non-scaling-stroke!important;opacity:1!important}[data-mae=x]{stroke:none!important}'
  const comEstilo = (css: string) => {
    const c = vivo.cloneNode(true) as SVGSVGElement
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    st.textContent = css
    c.insertBefore(st, c.firstChild)
    return new XMLSerializer().serializeToString(c)
  }
  return {
    linhas: comEstilo(base),
    dobras: temDobra ? comEstilo(base + '[data-mae]:not([data-mae=d]){stroke:none!important}') : null,
    larguraMm: tam.larguraMm, alturaMm: tam.alturaMm, confiavel: tam.confiavel,
  }
}

async function desenharSvgTexto(ctx: Ctx2D, svg: string, w: number, h: number): Promise<void> {
  const s = svg.replace(/<svg\b([^>]*?)\swidth="[^"]*"/, '<svg$1').replace(/<svg\b([^>]*?)\sheight="[^"]*"/, '<svg$1').replace(/<svg\b/, `<svg width="${w}px" height="${h}px"`)
  const url = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    ctx.drawImage(img, 0, 0, w, h)
  } finally { URL.revokeObjectURL(url) }
}

function fonteDeSvg(arquivo: File, nome: string, tipo: 'svg' | 'dxf', sv: SvgPreparado, extra: Partial<FonteMolde>): FonteMolde {
  const f: FonteMolde = {
    arquivo, nome, tipo, larguraMm: sv.larguraMm, alturaMm: sv.alturaMm, pendente: null, tamanhoConfiavel: sv.confiavel, ...extra,
    desenhar: async (ctx, k, modo) => {
      const w = Math.ceil(f.larguraMm * k), h = Math.ceil(f.alturaMm * k)
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
      const svg = modo === 'linhas' ? sv.linhas : sv.dobras
      if (!svg) return false
      await desenharSvgTexto(ctx, svg, w, h)
      return true
    },
  }
  return f
}

async function fontesSvg(arquivo: File): Promise<FonteMolde[]> {
  const sv = prepararSvg(await arquivo.text())
  return [fonteDeSvg(arquivo, arquivo.name.replace(/\.[^.]+$/, ''), 'svg', sv, {})]
}

async function fontesDxf(arquivo: File): Promise<FonteMolde[]> {
  const texto = await arquivo.text()
  const un = unidadeDoDxf(texto)
  const { dxfParaSvg } = await import('@/lib/estudio/formatosCorte')
  const { svg } = await dxfParaSvg(texto)
  const sv = prepararSvg(svg)
  // sem $INSUNITS o conversor assume mm; a usuária confirma a unidade (mm/cm/pol) e o tamanho é refeito
  return [fonteDeSvg(arquivo, arquivo.name.replace(/\.[^.]+$/, ''), 'dxf', sv, { mmPorUnidade: un?.mmPorUnidade ?? null, pendente: un ? null : 'unidade', tamanhoConfiavel: !!un })]
}

// ── Imagem ───────────────────────────────────────────────────────────────────────────────────────
async function fontesImagem(arquivo: File, tipo: 'png' | 'jpg'): Promise<FonteMolde[]> {
  const bytes = new Uint8Array(await arquivo.slice(0, 256 * 1024).arrayBuffer())
  const dpi = lerDpi(bytes)
  const bitmap = await createImageBitmap(arquivo)
  const larguraMm = dpi ? larguraPeloDpi(bitmap.width, dpi) : 0
  const f: FonteMolde = {
    arquivo, tipo, nome: arquivo.name.replace(/\.[^.]+$/, ''), bitmap, dpi,
    larguraPx: bitmap.width, alturaPx: bitmap.height,
    larguraMm, alturaMm: larguraMm ? (larguraMm * bitmap.height) / bitmap.width : 0,
    pendente: 'largura',   // spec: SEMPRE pedir confirmação da largura real
    desenhar: async (ctx, k, modo) => {
      if (modo === 'dobras') return false
      const w = Math.ceil(f.larguraMm * k), h = Math.ceil(f.alturaMm * k)
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bitmap, 0, 0, w, h)
      return true
    },
  }
  return [f]
}

/**
 * Muda o tamanho real de uma fonte (largura confirmada, unidade do DXF escolhida, SVG conferido).
 * A fonte é um objeto "vivo" (as funções de desenho leem o tamanho dela), por isso muda no lugar.
 */
export function redimensionarFonte(f: FonteMolde, larguraMm: number, alturaMm: number, mmPorUnidade?: number): void {
  f.larguraMm = larguraMm
  f.alturaMm = alturaMm
  if (mmPorUnidade !== undefined) f.mmPorUnidade = mmPorUnidade
}

/** Lê um arquivo e devolve as fontes (uma por página). Erro com mensagem amigável se não der. */
export async function analisarArquivo(arquivo: File): Promise<FonteMolde[]> {
  const tipo = tipoDoArquivo(arquivo.name, new Uint8Array(await arquivo.slice(0, 2048).arrayBuffer()))
  if (!tipo) throw new Error(`${arquivo.name}: formato não aceito. Use PDF, SVG, DXF, PNG ou JPG.`)
  if (tipo === 'pdf') return fontesPdf(arquivo)
  if (tipo === 'svg') return fontesSvg(arquivo)
  if (tipo === 'dxf') return fontesDxf(arquivo)
  return fontesImagem(arquivo, tipo)
}

export { limiarPadrao, fecharPadraoMm } from './padroes'
import { limiarPadrao } from './padroes'

export interface FontePreparada extends MoldePreparado {
  /** Prévia das linhas (fundo transparente), do tamanho do recorte, a 200 dpi. */
  previa: ImageBitmap
}

/** Rasteriza a fonte a 200 dpi, recorta o molde e prepara as máscaras (linhas e dobras). */
export async function prepararFonte(f: FonteMolde, limiar = limiarPadrao(f.tipo)): Promise<FontePreparada> {
  const k = PX_POR_MM_DETECCAO
  const w = Math.ceil(f.larguraMm * k), h = Math.ceil(f.alturaMm * k)
  if (!(w > 0 && h > 0)) throw new Error(`${f.nome}: confirme o tamanho real antes de importar.`)
  if (w * h > 60e6) throw new Error(`${f.nome}: muito grande (${Math.round(f.larguraMm)} × ${Math.round(f.alturaMm)} mm). Divida o arquivo ou confira a unidade.`)
  const cv = new OffscreenCanvas(w, h)
  const g = cv.getContext('2d', { willReadFrequently: true })!
  await f.desenhar(g, k, 'linhas')
  const rgba = g.getImageData(0, 0, w, h).data
  let dobrasRgba: Uint8ClampedArray | null = null
  const cvD = new OffscreenCanvas(w, h)
  const gD = cvD.getContext('2d', { willReadFrequently: true })!
  if (await f.desenhar(gD, k, 'dobras')) dobrasRgba = gD.getImageData(0, 0, w, h).data
  const dobrasMm = f.dobrasMm ? await f.dobrasMm() : undefined
  const prep = prepararDeRaster(rgba, w, h, k, { limiar, dobrasMm, dobrasRgba })
  if (!prep) throw new Error(`${f.nome}: não achei linhas no arquivo (página em branco?).`)
  // prévia: o recorte com o branco transparente (as linhas mantêm a cor do arquivo)
  const x = Math.round(prep.recorte.xMm * k), y = Math.round(prep.recorte.yMm * k)
  const img = g.getImageData(x, y, prep.linhas.w, prep.linhas.h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) d[i + 3] = Math.min(d[i + 3], 255 - Math.min(d[i], d[i + 1], d[i + 2]))
  const cp = new OffscreenCanvas(prep.linhas.w, prep.linhas.h)
  cp.getContext('2d')!.putImageData(img, 0, 0)
  return { ...prep, previa: cp.transferToImageBitmap() }
}
