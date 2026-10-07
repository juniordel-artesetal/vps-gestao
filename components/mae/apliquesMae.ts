'use client'
// APLIQUES 3D no navegador (Sprint 11): para cada elemento marcado como aplique, lê o alfa da imagem no
// tamanho da arte, calcula bordinha e silhueta (Clipper2), organiza na folha fora das marcas e gera os DOIS
// PNG transparentes a 300 dpi — impressos e silhuetas —, cada um com a sua marca de registro por cima.
import { acharApliques, montarFolhas, type PecaAplique } from '@/lib/mae/apliques/folhas'
import { contornoDoAlfa, deslocar, silhuetaDoContorno } from '@/lib/mae/apliques/silhueta'
import { soTinta, girarZonas, folhaNaOrientacao } from '@/lib/mae/exportar/marca'
import { comPhys } from '@/lib/mae/exportar/png'
import { gravar, ler } from '@/lib/mae/biblioteca/arquivos'
import { pxPorMm } from '@/lib/mae/render'
import type { DocTema, DocTrabalho, Prancheta } from '@/lib/mae/schema'
import { garantirArquivos, motorDaPagina } from './motorEditor'
import { carregarSubstituta } from './fontesTexto'
import { infoImagem } from './arquivosMae'
import type { MarcaRegistro } from './sincronia'

const PX_MM_SILHUETA = 12   // ~300 dpi do alfa para o contorno
const cache = new Map<string, { base: ReturnType<typeof contornoDoAlfa>; alfaKey: string }>()

/** Peças (contornos já calculados) dos apliques do tema. */
export async function pecasDoTema(raiz: FileSystemDirectoryHandle, doc: DocTrabalho, tema: DocTema): Promise<{ pecas: PecaAplique[]; avisos: string[] }> {
  const avisos: string[] = []
  const pecas: PecaAplique[] = []
  for (const a of acharApliques(doc, tema)) {
    const chave = `${a.src.sha256}|${a.wMm.toFixed(2)}|${a.hMm.toFixed(2)}`
    let base = cache.get(chave)?.base
    if (!base) {
      try {
        const info = await infoImagem(raiz, a.src.path)
        const bmp = info.bitmap!
        const k = Math.min(PX_MM_SILHUETA, 2400 / Math.max(a.wMm, a.hMm))
        const c = new OffscreenCanvas(Math.max(4, Math.round(a.wMm * k)), Math.max(4, Math.round(a.hMm * k)))
        const g = c.getContext('2d', { willReadFrequently: true })!
        g.drawImage(bmp, 0, 0, c.width, c.height)
        const rgba = g.getImageData(0, 0, c.width, c.height).data
        const alfa = new Uint8Array(c.width * c.height)
        for (let p = 0; p < alfa.length; p++) alfa[p] = rgba[p * 4 + 3]
        base = contornoDoAlfa(alfa, c.width, c.height, k)
        if (!base.length) { avisos.push(`"${a.moldeNome}": a imagem do aplique não tem fundo transparente — use um PNG sem fundo.`); continue }
        cache.set(chave, { base, alfaKey: chave })   // bordinha e silhueta partem do mesmo contorno
      } catch { avisos.push(`A imagem do aplique em "${a.moldeNome}" não está na Biblioteca.`); continue }
    }
    const sil = silhuetaDoContorno(base, a.cfg.silhouetteMm)
    pecas.push({ ...a, borda: a.cfg.borderMm > 0 ? deslocar(base, a.cfg.borderMm) : [], silhueta: sil })
  }
  return { pecas, avisos }
}

async function marcaRaster(raiz: FileSystemDirectoryHandle, m: MarcaRegistro, k: number): Promise<{ canvas: OffscreenCanvas; wMm: number; hMm: number; zonas: MarcaRegistro['zonas'] }> {
  const bytes = new Uint8Array(await (await ler(raiz, m.path)).arrayBuffer())
  const { rasterizarPaginaPdf } = await import('@/lib/mae/importacao/navegador')
  const r = await rasterizarPaginaPdf(bytes, m.pagina, k)
  soTinta(r.rgba)
  const c = new OffscreenCanvas(r.w, r.h)
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(r.rgba), r.w, r.h), 0, 0)
  return { canvas: c, wMm: r.larguraMm, hMm: r.alturaMm, zonas: m.zonas }
}

export interface SaidaApliques { arquivos: { nome: string; blob: Blob }[]; avisos: string[]; pecas: number }

/** Lote 4 (item 48): a marca (raster) girada 90° no sentido horário, para a folha na outra orientação. */
function girarCanvas(c: OffscreenCanvas): OffscreenCanvas {
  const o = new OffscreenCanvas(c.height, c.width)
  const g = o.getContext('2d')!
  g.translate(c.height, 0); g.rotate(Math.PI / 2); g.drawImage(c, 0, 0)
  return o
}

/**
 * As duas folhas (impressos e silhuetas) como PNG 300 dpi transparente, com a marca de cada uma. `pxMm` menor
 * = prévia rápida (Lote 4, item 46: "Ver folhas de aplique" antes de gerar).
 */
export async function gerarFolhasDeApliques(raiz: FileSystemDirectoryHandle, doc: DocTrabalho, tema: DocTema, marcas: MarcaRegistro[], nomeArquivo: (qual: string) => string, pxMm?: number): Promise<SaidaApliques> {
  const { pecas, avisos } = await pecasDoTema(raiz, doc, tema)
  if (!pecas.length) return { arquivos: [], avisos: avisos.length ? avisos : ['Nenhum elemento marcado como aplique neste tema.'], pecas: 0 }
  const k = pxMm ?? pxPorMm(300)
  const mImp = marcas.find(m => m.id === tema.appliques?.printMarkId) ?? null
  const mCut = marcas.find(m => m.id === tema.appliques?.cutMarkId) ?? mImp
  type Raster = Awaited<ReturnType<typeof marcaRaster>>
  let rasterImp: Raster | null = null, rasterCut: Raster | null = null
  try { if (mImp) rasterImp = await marcaRaster(raiz, mImp, k) } catch { avisos.push(`A marca "${mImp?.nome}" não está na Biblioteca — folha de impressos sem marca.`) }
  try { if (mCut) rasterCut = mCut === mImp ? rasterImp : await marcaRaster(raiz, mCut, k) } catch { avisos.push(`A marca "${mCut?.nome}" não está na Biblioteca — folha de silhuetas sem marca.`) }
  const folha0 = { wMm: rasterImp?.wMm ?? rasterCut?.wMm ?? 210, hMm: rasterImp?.hMm ?? rasterCut?.hMm ?? 297 }
  if (rasterImp && rasterCut && (Math.abs(rasterImp.wMm - rasterCut.wMm) > 0.6 || Math.abs(rasterImp.hMm - rasterCut.hMm) > 0.6)) avisos.push('As marcas da folha de impressos e da de silhuetas têm tamanhos diferentes — use marcas da mesma folha.')
  // Lote 4 (item 48): retrato ou paisagem — a folha troca de lado e a marca (e as áreas dela) giram junto
  const ori = folhaNaOrientacao(folha0, (tema.appliques as { orientacao?: 'retrato' | 'paisagem' } | undefined)?.orientacao)
  const folha = { wMm: ori.wMm, hMm: ori.hMm }
  if (ori.girada) {
    if (rasterImp) rasterImp = { ...rasterImp, canvas: girarCanvas(rasterImp.canvas), wMm: rasterImp.hMm, hMm: rasterImp.wMm }
    if (rasterCut) rasterCut = mCut === mImp ? rasterImp : { ...rasterCut, canvas: girarCanvas(rasterCut.canvas), wMm: rasterCut.hMm, hMm: rasterCut.wMm }
  }
  const zonasDe = (m: MarcaRegistro | null) => (m ? (ori.girada ? girarZonas(m.zonas, folha0.hMm) : m.zonas) : [])
  const obstaculos = [...zonasDe(mImp), ...(mCut && mCut !== mImp ? zonasDe(mCut) : [])]
  const fonte = await carregarSubstituta().catch(() => null)
  const f = montarFolhas(pecas, folha, { obstaculos, fonte })
  if (f.sobraram.length) avisos.push(`${f.sobraram.length} aplique(s) não couberam na folha — diminua o tamanho na arte ou o deslocamento.`)
  const arquivos: SaidaApliques['arquivos'] = []
  for (const [qual, layers, marca] of [['apliques-impressos', f.impressos, rasterImp], ['apliques-silhuetas', f.silhuetas, rasterCut]] as const) {
    const p: Prancheta = { id: qual, widthMm: folha.wMm, heightMm: folha.hMm, layers }
    await garantirArquivos(p, raiz)
    const r = await motorDaPagina().render(p, k, null, 'png')
    if (!r.png) throw new Error('O motor não devolveu a imagem dos apliques.')
    const bmp = await createImageBitmap(r.png)
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const g = c.getContext('2d')!
    g.drawImage(bmp, 0, 0); bmp.close()
    if (marca) g.drawImage(marca.canvas, 0, 0, c.width, c.height)
    const u = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer())
    arquivos.push({ nome: nomeArquivo(qual), blob: new Blob([comPhys(u, 300) as BlobPart], { type: 'image/png' }) })
  }
  return { arquivos, avisos, pecas: pecas.length }
}

/**
 * Lote 4 (item 46): miniatura AO VIVO de um aplique — a silhueta (cinza), a bordinha (cor) e a imagem por cima,
 * com os valores atuais (bordinha e deslocamento só deste ou os do tema).
 */
export async function desenharMiniaturaAplique(raiz: FileSystemDirectoryHandle, doc: DocTrabalho, tema: DocTema, layerId: string, canvas: HTMLCanvasElement): Promise<boolean> {
  const { pecas } = await pecasDoTema(raiz, doc, tema)
  const p = pecas.find(x => x.layerId === layerId)
  if (!p) return false
  const todos = [...p.silhueta, ...p.borda].flat()
  const x0 = Math.min(0, ...todos.map(q => q[0])), y0 = Math.min(0, ...todos.map(q => q[1]))
  const x1 = Math.max(p.wMm, ...todos.map(q => q[0])), y1 = Math.max(p.hMm, ...todos.map(q => q[1]))
  const k = Math.min(160 / (x1 - x0), 120 / (y1 - y0))
  canvas.width = Math.ceil((x1 - x0) * k); canvas.height = Math.ceil((y1 - y0) * k)
  const g = canvas.getContext('2d')!
  g.clearRect(0, 0, canvas.width, canvas.height)
  const caminho = (aneis: [number, number][][]) => { g.beginPath(); for (const a of aneis) a.forEach(([x, y], i) => { const px = (x - x0) * k, py = (y - y0) * k; if (i) g.lineTo(px, py); else g.moveTo(px, py) }); g.closePath() }
  g.fillStyle = 'rgba(30,41,59,0.85)'; caminho(p.silhueta as never); g.fill('evenodd')
  if (p.borda.length) { g.fillStyle = p.cfg.borderColor; caminho(p.borda as never); g.fill('evenodd') }
  const bmp = (await infoImagem(raiz, p.src.path)).bitmap
  if (bmp) g.drawImage(bmp, (0 - x0) * k, (0 - y0) * k, p.wMm * k, p.hMm * k)
  return true
}

/** Grava as duas folhas na pasta. */
export async function gravarFolhasDeApliques(raiz: FileSystemDirectoryHandle, pasta: string, s: SaidaApliques): Promise<string[]> {
  const out: string[] = []
  for (const a of s.arquivos) { const c = `${pasta}/${a.nome}`; await gravar(raiz, c, a.blob); out.push(c) }
  return out
}
