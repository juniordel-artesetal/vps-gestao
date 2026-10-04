// Apoio dos testes: abre os moldes REAIS (docs/mae-exemplos/moldes) no Node — pdf.js "legacy" +
// @napi-rs/canvas (Skia) — rasteriza a 200 dpi, prepara, detecta e mede contra o VETOR do próprio PDF.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { abrirPdf, desenharPagina, tamanhoPaginaMm, vetoresDaPagina } from '@/lib/mae/importacao/pdf'
import { prepararDeRaster, PX_POR_MM_DETECCAO, type MoldePreparado } from '@/lib/mae/importacao/preparar'
import { detectarFaces, type ResultadoDeteccao } from '@/lib/mae/faces/detectar'
import { distSeg, type Pt } from '@/lib/mae/faces/geometria'

export const DIR_MOLDES = join(process.cwd(), 'docs/mae-exemplos/moldes')
export const MOLDES = readdirSync(DIR_MOLDES).filter(f => f.endsWith('.pdf')).sort()

let pdfjs: { getDocument: unknown; OPS: Record<string, number> } | null = null
export async function pdfjsNode() {
  if (!pdfjs) {
    const origWarn = console.warn
    console.warn = () => {}
    try { pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as never } finally { console.warn = origWarn }
  }
  return pdfjs!
}

export interface MoldeTestado {
  nome: string
  prep: MoldePreparado
  det: ResultadoDeteccao
  /** Linhas do vetor, em mm do MOLDE (já descontado o recorte). */
  vetor: Pt[][]
  paginaMm: { larguraMm: number; alturaMm: number }
  rgba: Uint8ClampedArray; w: number; h: number
}

export async function abrirMoldeReal(nome: string, fecharMm = 0.25, limiar = 240): Promise<MoldeTestado> {
  const pj = await pdfjsNode()
  const pdf = await abrirPdf(pj as never, new Uint8Array(readFileSync(join(DIR_MOLDES, nome))))
  const pg = await pdf.pagina(1)
  const k = PX_POR_MM_DETECCAO
  const v = pg.getViewport({ scale: (k * 25.4) / 72 })
  const c = createCanvas(Math.ceil(v.width), Math.ceil(v.height))
  await desenharPagina(pg, c.getContext('2d') as never, k)
  const vet = await vetoresDaPagina(pg, pj.OPS)
  const img = c.getContext('2d').getImageData(0, 0, c.width, c.height)
  const prep = prepararDeRaster(img.data, c.width, c.height, k, { limiar, dobrasMm: vet.dobras })!
  const det = detectarFaces(prep.linhas, { pxPorMm: k, fecharMm })
  const vetor = vet.linhas.map(l => l.map(([x, y]) => [x - prep.recorte.xMm, y - prep.recorte.yMm] as Pt))
  return { nome, prep, det, vetor, paginaMm: tamanhoPaginaMm(pg), rgba: img.data, w: c.width, h: c.height }
}

/** Maior e média das distâncias dos vértices das faces até a linha do vetor (mm). */
export function erroContraVetor(faces: { poligono: Pt[] }[], vetor: Pt[][]): { max: number; medio: number } {
  let max = 0, soma = 0, n = 0
  for (const f of faces) for (const p of f.poligono) {
    let d = Infinity
    for (const l of vetor) for (let i = 0; i + 1 < l.length; i++) d = Math.min(d, distSeg(p, l[i], l[i + 1]))
    max = Math.max(max, d); soma += d; n++
  }
  return { max, medio: soma / Math.max(n, 1) }
}

export function caixaPts(pts: Pt[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
}
