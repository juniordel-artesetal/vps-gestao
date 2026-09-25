// SOA Edition — PDF por OBJETOS (não por foto da página). Ordem de fidelidade:
//   1) PSD embutido ("Preservar recursos de edição do Photoshop") → camadas reais pelo ag-psd;
//   2) camadas OCG → uma camada por grupo (lerPdf em importarArte);
//   3) objetos do conteúdo: TEXTO (com a fonte embutida), cada IMAGEM, e os VETORES numa camada;
//   4) só se a página for uma imagem de verdade (ou ladrilhos de "impressão") → achatado, com aviso.
// A renderização da página inteira serve só de prévia/fundo — nunca substitui as camadas.
// Só navegador (pdf.js + canvas).

export interface FonteEmbutida {
  /** Nome no PDF (ex.: "ABCDEF+Pacifico-Regular"). */
  nomePdf: string
  /** Nome limpo (sem o prefixo de subconjunto). */
  nome: string
  /** Programa da fonte (OpenType convertido pelo pdf.js) — null se o PDF não trouxe. */
  dados: Uint8Array | null
  /** Subconjunto = só as letras usadas no arquivo (ex.: "Sophia") — nome novo pode faltar letra. */
  subconjunto: boolean
  /** Família registrada no documento pelo pdf.js (serve para desenhar nesta sessão). */
  familiaSessao: string
}

export interface TextoPdf {
  texto: string
  /** Caixa na orientação do texto (px da página renderizada), centro = x + w/2, y + h/2. */
  x: number; y: number; w: number; h: number
  rotacao: number
  tamanho: number
  fonte: FonteEmbutida | null
}

export interface ImagemPdf { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number; rotacao: number }

export interface PaginaPdf {
  W: number; H: number
  pagina: { larguraPt: number; alturaPt: number }
  original: HTMLCanvasElement
  textos: TextoPdf[]
  imagens: ImagemPdf[]
  /** Vetores (sem texto e sem imagens) — null se vazio. */
  vetores: HTMLCanvasElement | null
  /** Página composta só de ladrilhos de imagem (impressora virtual / "Microsoft Print to PDF"). */
  ladrilhos: boolean
  produtor: string | null
  totalPaginas: number
}

type PdfJs = typeof import('pdfjs-dist')
const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c }

export async function carregarPdfJs(): Promise<PdfJs> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = '/estudio/pdf.worker.min.mjs'
  return pdfjs
}

/** PSD embutido num PDF do Photoshop (stream que começa com "8BPS", normalmente comprimido). */
export async function psdEmbutido(buf: ArrayBuffer): Promise<Uint8Array | null> {
  const b = new Uint8Array(buf)
  const txt = new TextDecoder('latin1')
  let i = 0
  while (i < b.length) {
    // procura "stream" seguido de quebra de linha
    const k = indexOf(b, [0x73, 0x74, 0x72, 0x65, 0x61, 0x6d], i)
    if (k < 0) break
    let s = k + 6
    if (b[s] === 0x0d) s++
    if (b[s] === 0x0a) s++
    else if (b[s - 1] !== 0x0d) { i = k + 6; continue }
    const fim = indexOf(b, [0x65, 0x6e, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6d], s)
    if (fim < 0) break
    const tam = fim - s
    if (tam > 2048) {
      const dic = txt.decode(b.subarray(Math.max(0, k - 400), k))
      // a quebra de linha antes de "endstream" não faz parte dos dados (senão o zlib acusa lixo no fim)
      let f2 = fim
      while (f2 > s && (b[f2 - 1] === 0x0a || b[f2 - 1] === 0x0d)) f2--
      const bruto = b.subarray(s, f2)
      if (bruto[0] === 0x38 && bruto[1] === 0x42 && bruto[2] === 0x50 && bruto[3] === 0x53) return bruto.slice()
      if (/FlateDecode/.test(dic.slice(dic.lastIndexOf('<<')))) {
        const d = await inflar(bruto, 8)
        if (d && d[0] === 0x38 && d[1] === 0x42 && d[2] === 0x50 && d[3] === 0x53) return (await inflar(bruto)) || null
      }
    }
    i = fim + 9
  }
  return null
}
function indexOf(b: Uint8Array, p: number[], de: number): number {
  outer: for (let i = de; i <= b.length - p.length; i++) { for (let j = 0; j < p.length; j++) if (b[i + j] !== p[j]) continue outer; return i }
  return -1
}
/** Descomprime zlib (FlateDecode). `ate` = para depois de N bytes (espiar o início). */
async function inflar(dados: Uint8Array, ate?: number): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream('deflate')
    const w = ds.writable.getWriter(); w.write(dados as BufferSource).catch(() => {}); w.close().catch(() => {})
    const r = ds.readable.getReader()
    const partes: Uint8Array[] = []; let n = 0
    try {
      for (;;) {
        const { value, done } = await r.read()
        if (done) break
        partes.push(value); n += value.length
        if (ate && n >= ate) { r.cancel().catch(() => {}); break }
      }
    } catch { if (!n) return null /* lixo no fim do stream: fica com o que já saiu */ }
    const out = new Uint8Array(n); let o = 0
    for (const p of partes) { out.set(p, o); o += p.length }
    return out
  } catch { return null }
}

const mult = (m1: number[], m2: number[]) => [
  m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1], m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3], m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
]

/** Dados de imagem do pdf.js → canvas. */
function imagemParaCanvas(img: { width: number; height: number; data?: Uint8ClampedArray | Uint8Array; kind?: number; bitmap?: ImageBitmap }): HTMLCanvasElement | null {
  if (!img) return null
  const c = canvas(img.width, img.height), g = c.getContext('2d')!
  if (img.bitmap) { g.drawImage(img.bitmap, 0, 0); return c }
  if (!img.data) return null
  const id = g.createImageData(img.width, img.height), d = id.data, s = img.data, n = img.width * img.height
  if (img.kind === 3 || s.length >= n * 4) d.set(s.subarray(0, n * 4))
  else if (img.kind === 2 || s.length >= n * 3) for (let p = 0; p < n; p++) { d[p * 4] = s[p * 3]; d[p * 4 + 1] = s[p * 3 + 1]; d[p * 4 + 2] = s[p * 3 + 2]; d[p * 4 + 3] = 255 }
  else { // 1 bit por pixel (cinza)
    const lin = Math.ceil(img.width / 8)
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const v = (s[y * lin + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0; const p = (y * img.width + x) * 4; d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255 }
  }
  g.putImageData(id, 0, 0)
  return c
}

type Objs = { get: (id: string, cb?: (v: unknown) => void) => unknown; has?: (id: string) => boolean }
function pegar(objs: Objs, id: string): Promise<unknown> {
  return new Promise(res => {
    const t = setTimeout(() => res(null), 4000)
    try { objs.get(id, v => { clearTimeout(t); res(v) }) } catch { clearTimeout(t); res(null) }
  })
}

/**
 * Analisa UMA página do PDF por objetos. `escala` = px por pt da renderização (300 dpi por padrão,
 * limitado pelo teto de pixels).
 */
export async function analisarPaginaPdf(f: File | ArrayBuffer, numero = 1, maxPx = 16_000_000): Promise<PaginaPdf> {
  const pdfjs = await carregarPdfJs()
  const buf = f instanceof ArrayBuffer ? f : await f.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), fontExtraProperties: true }).promise
  const produtor = await doc.getMetadata().then(m => ((m.info as Record<string, unknown>)?.Producer as string) || null).catch(() => null)
  const pg = await doc.getPage(Math.min(Math.max(1, numero), doc.numPages))
  const base = pg.getViewport({ scale: 1 })
  const esc = Math.min(300 / 72, Math.sqrt(maxPx / (base.width * base.height)), 8000 / Math.max(base.width, base.height))
  const vp = pg.getViewport({ scale: esc })
  const W = Math.round(vp.width), H = Math.round(vp.height)
  const renderizar = async (semTexto: boolean, semImagem: boolean) => {
    const c = canvas(W, H), g = c.getContext('2d')!
    if (semTexto) { (g as unknown as { fillText: () => void }).fillText = () => {}; (g as unknown as { strokeText: () => void }).strokeText = () => {} }
    if (semImagem) { const orig = g.drawImage.bind(g); (g as unknown as { drawImage: (...a: unknown[]) => void }).drawImage = (...a: unknown[]) => { const s = a[0] as { width?: number }; if (s && (s as HTMLCanvasElement).width > 64) return; (orig as (...x: unknown[]) => void)(...a) } }
    await pg.render({ canvasContext: g, viewport: vp, canvas: c } as never).promise
    return c
  }
  const original = await renderizar(false, false)
  const ops = await pg.getOperatorList()
  const OPS = pdfjs.OPS as Record<string, number>
  // ── imagens com a posição (matriz corrente) ──
  const imagens: ImagemPdf[] = []
  let ctm = [1, 0, 0, 1, 0, 0]
  const pilha: number[][] = []
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], a = ops.argsArray[i] as unknown[]
    if (fn === OPS.save) pilha.push(ctm)
    else if (fn === OPS.restore) ctm = pilha.pop() || [1, 0, 0, 1, 0, 0]
    else if (fn === OPS.transform) ctm = mult(ctm, a as number[])
    else if (fn === OPS.paintFormXObjectBegin) { pilha.push(ctm); if (Array.isArray(a[0])) ctm = mult(ctm, a[0] as number[]) }
    else if (fn === OPS.paintFormXObjectEnd) ctm = pilha.pop() || [1, 0, 0, 1, 0, 0]
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const dado = fn === OPS.paintInlineImageXObject ? a[0] : await pegar((String(a[0]).startsWith('g_') ? pg.commonObjs : pg.objs) as unknown as Objs, String(a[0]))
      const cv = imagemParaCanvas(dado as never)
      if (!cv) continue
      const cantos = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => { const x = ctm[0] * u + ctm[2] * v + ctm[4], y = ctm[1] * u + ctm[3] * v + ctm[5]; return vp.convertToViewportPoint(x, y) })
      const xs = cantos.map(p => p[0]), ys = cantos.map(p => p[1])
      const rot = Math.round((Math.atan2(ctm[1], ctm[0]) * -180) / Math.PI)
      const x0 = Math.min(...xs), y0 = Math.min(...ys)
      // imagem espelhada no PDF (escala vertical negativa): desespelha
      const fl = canvas(cv.width, cv.height), gf = fl.getContext('2d')!
      if (ctm[3] < 0) { gf.translate(0, cv.height); gf.scale(1, -1) }
      gf.drawImage(cv, 0, 0)
      imagens.push({ canvas: fl, x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0, rotacao: rot })
    }
  }
  // ── texto (com a fonte embutida) ──
  const tc = await pg.getTextContent()
  const fontes = new Map<string, FonteEmbutida | null>()
  const fonteDe = async (loaded: string): Promise<FonteEmbutida | null> => {
    if (fontes.has(loaded)) return fontes.get(loaded)!
    const o = (await pegar(pg.commonObjs as unknown as Objs, loaded)) as { name?: string; data?: Uint8Array; loadedName?: string } | null
    const nomePdf = o?.name || loaded
    const fe: FonteEmbutida | null = o ? { nomePdf, nome: nomePdf.replace(/^[A-Z]{6}\+/, ''), dados: o.data ? new Uint8Array(o.data) : null, subconjunto: /^[A-Z]{6}\+/.test(nomePdf), familiaSessao: o.loadedName || loaded } : null
    fontes.set(loaded, fe)
    return fe
  }
  const textos: TextoPdf[] = []
  for (const it of tc.items as { str: string; transform: number[]; width: number; height: number; fontName: string }[]) {
    if (!it.str?.trim()) continue
    const [a, b, c2, d, e, fy] = it.transform
    const alt = Math.hypot(c2, d) || it.height || 10
    const dir = { x: a / (Math.hypot(a, b) || 1), y: b / (Math.hypot(a, b) || 1) }
    const cima = { x: -dir.y, y: dir.x }
    const p0 = { x: e, y: fy }, p1 = { x: e + dir.x * it.width, y: fy + dir.y * it.width }
    const meio = { x: (p0.x + p1.x) / 2 + cima.x * alt * 0.35, y: (p0.y + p1.y) / 2 + cima.y * alt * 0.35 }
    const [cx, cy] = vp.convertToViewportPoint(meio.x, meio.y)
    const w = it.width * esc, h = alt * 1.2 * esc
    textos.push({ texto: it.str.trim(), x: cx - w / 2, y: cy - h / 2, w, h, rotacao: -Math.round((Math.atan2(b, a) * 180) / Math.PI), tamanho: alt * esc, fonte: await fonteDe(it.fontName) })
  }
  // ── ladrilhos: várias imagens cobrindo a página inteira (impressão virtual) ──
  const areaImgs = imagens.reduce((s, i) => s + i.w * i.h, 0)
  const ladrilhos = imagens.length >= 4 && areaImgs >= W * H * 0.8 && areaImgs <= W * H * 1.25 && !textos.length
  const vetoresCv = imagens.length || textos.length ? await renderizar(true, true) : original
  const vazio = (() => { const d = vetoresCv.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data; for (let p = 3; p < d.length; p += 4 * 97) if (d[p] > 8) return false; return true })()
  return {
    W, H, pagina: { larguraPt: base.width, alturaPt: base.height }, original, textos, imagens: ladrilhos ? [] : imagens,
    vetores: vazio || ladrilhos ? null : vetoresCv, ladrilhos, produtor, totalPaginas: doc.numPages,
  }
}

/** Mensagem honesta para PDF achatado (com a dica de como exportar com camadas). */
export function avisoPdfAchatado(p: Pick<PaginaPdf, 'ladrilhos' | 'produtor'>): string {
  const impresso = /print to pdf|microsoft|cutepdf|pdfcreator|bullzip|quartz pdfcontext/i.test(p.produtor || '') || p.ladrilhos
  return impresso
    ? `Este PDF foi IMPRESSO${p.produtor ? ` (“${p.produtor}”)` : ''} — a impressora virtual transforma tudo em imagem e as camadas deixam de existir no arquivo. No Photoshop, use Arquivo → Salvar como → Photoshop PDF com “Preservar recursos de edição do Photoshop” marcado (ou envie o PSD).`
    : 'Este PDF veio achatado (uma imagem só, sem texto nem camadas). Para editar por camadas, exporte do Photoshop com “Preservar recursos de edição do Photoshop” marcado, ou salve como PSD.'
}
