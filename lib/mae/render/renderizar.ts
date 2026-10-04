// mae-render — O MOTOR: desenha a prancheta inteira (fundo + árvore de camadas) num canvas do tamanho
// final em pixels. É a MESMA função para a prévia da tela e para o arquivo final; roda no Web Worker
// (OffscreenCanvas) e, se não houver Worker, na própria página. Nunca criar outro caminho de desenho.
//
// Semântica (padrão do Photoshop):
// • Camada comum: conteúdo com alpha = opacidade × preenchimento, no modo de mesclagem dela
//   (globalCompositeOperation nativo do Canvas 2D).
// • MÁSCARA DE RECORTE: camadas com `clip` logo acima de uma camada de base formam um grupo de
//   recorte. O conteúdo recortado só aparece onde a base tem pixel e mescla com a base no modo dele;
//   a opacidade e o modo da BASE valem para o grupo inteiro. Base oculta → o grupo some.
//   (Limite conhecido: nas bordas semitransparentes da base, modos ≠ normal aproximam o alpha.)
// • GRUPO "atravessar" (padrão), 100% e normal: os filhos mesclam com o que está abaixo do grupo.
//   Qualquer outro caso: grupo ISOLADO — os filhos são desenhados num buffer à parte e o buffer entra
//   com a opacidade e o modo do grupo.
// • Determinismo: nada de relógio, aleatório ou ordem de Map; mesma receita + mesma escala = mesmos pixels.
import type { NoCamada, NoGrupo, NoImagem, Prancheta } from '../schema'
import { desenharPrancheta } from './desenhar'
import { CacheCamadas, chaveRaster } from './cache'
import { desenharComEfeitos } from './efeitos'

/** O mínimo de canvas que o motor usa (HTMLCanvas, OffscreenCanvas ou o canvas do Node nos testes). */
export interface CanvasLike { width: number; height: number; getContext(tipo: '2d', opcoes?: object): unknown }
export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
export type FabricaCanvas = (w: number, h: number) => CanvasLike
/** Bitmap de origem (papel/elemento), pelo sha256 do arquivo. */
export type ResolverBitmap = (sha256: string) => CanvasImageSource | undefined

export interface OpcoesRender {
  /** Pixels por mm do canvas de saída (prévia: ≈150 dpi no zoom; exportação: 300 dpi). */
  pxPorMm: number
  /** Cor do fundo da folha; `null` = transparente (PNG com alpha). */
  fundo?: string | null
  criarCanvas: FabricaCanvas
  bitmap: ResolverBitmap
  /** Cache de rasters por camada (opcional; o Worker mantém um entre renders). */
  cache?: CacheCamadas<CanvasLike>
  /** Fábrica de Path2D (no Node dos testes vem do @napi-rs/canvas; no navegador é a global). */
  criarCaminho?: (d: string) => Path2D
}

export interface ResultadoRender { faltando: string[] }

const ctx2d = (c: CanvasLike) => c.getContext('2d') as Ctx
const gco = (m: NoCamada['blendMode']): GlobalCompositeOperation => (m === 'normal' ? 'source-over' : m)

/** Tamanho em pixels inteiros da prancheta na escala dada. */
export function tamanhoDoCanvas(p: Pick<Prancheta, 'widthMm' | 'heightMm'>, pxPorMm: number) {
  return { w: Math.max(1, Math.round(p.widthMm * pxPorMm)), h: Math.max(1, Math.round(p.heightMm * pxPorMm)) }
}

/**
 * Desenha a prancheta no canvas de saída (que já deve ter o tamanho de `tamanhoDoCanvas`).
 * Devolve os arquivos (sha256) que não estavam disponíveis — a tela avisa "arquivo não encontrado".
 */
export function renderizarPrancheta(saida: CanvasLike, prancheta: Prancheta, o: OpcoesRender): ResultadoRender {
  const ctx = ctx2d(saida)
  const faltando = new Set<string>()
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, saida.width, saida.height)
  if (o.fundo !== null) {
    ctx.save(); ctx.scale(o.pxPorMm, o.pxPorMm)
    desenharPrancheta(ctx, prancheta, { pxPorMmDoDispositivo: o.pxPorMm, grade: false, borda: false, corFundo: o.fundo ?? '#ffffff' })
    ctx.restore()
  }
  desenharLista(ctx, prancheta.layers ?? [], { ...o, w: saida.width, h: saida.height, faltando })
  ctx.restore()
  return { faltando: [...faltando].sort() }
}

interface Estado extends OpcoesRender { w: number; h: number; faltando: Set<string> }

function novoBuffer(e: Estado): { c: CanvasLike; g: Ctx } {
  const c = e.criarCanvas(e.w, e.h)
  const g = ctx2d(c)
  g.imageSmoothingEnabled = true
  if ('imageSmoothingQuality' in g) g.imageSmoothingQuality = 'high'
  return { c, g }
}

/** Desenha uma lista (de baixo para cima), montando os grupos de recorte. */
function desenharLista(ctx: Ctx, nos: NoCamada[], e: Estado) {
  for (let i = 0; i < nos.length;) {
    const base = nos[i]
    let j = i + 1
    while (j < nos.length && nos[j].clip) j++
    const recortadas = nos.slice(i + 1, j)
    i = j
    if (!base.visible) continue                                   // base oculta → grupo de recorte some junto
    const visiveis = recortadas.filter(n => n.visible)
    if (!visiveis.length) { desenharNo(ctx, base, e); continue }

    // ── grupo de recorte: base (com preenchimento) + recortadas presas à forma da base
    const baseBuf = novoBuffer(e)
    desenharConteudo(baseBuf.g, base, base.type === 'group' ? 1 : base.fill, 'source-over', e)
    const grupo = novoBuffer(e)
    grupo.g.drawImage(baseBuf.c as CanvasImageSource, 0, 0)
    for (const r of visiveis) {
      const tmp = novoBuffer(e)
      desenharConteudo(tmp.g, r, r.opacity * (r.type === 'group' ? 1 : r.fill), 'source-over', e)
      if (r.blendMode !== 'normal') {                                // normal: o source-atop já recorta
        tmp.g.globalCompositeOperation = 'destination-in'           // só onde a base tem pixel
        tmp.g.drawImage(baseBuf.c as CanvasImageSource, 0, 0)
      }
      grupo.g.globalCompositeOperation = r.blendMode === 'normal' ? 'source-atop' : gco(r.blendMode)
      grupo.g.drawImage(tmp.c as CanvasImageSource, 0, 0)
    }
    ctx.save()
    ctx.globalAlpha = base.opacity
    ctx.globalCompositeOperation = gco(base.blendMode)
    ctx.drawImage(grupo.c as CanvasImageSource, 0, 0)
    ctx.restore()
  }
}

/** Uma camada fora de grupo de recorte. */
function desenharNo(ctx: Ctx, no: NoCamada, e: Estado) {
  if (no.type === 'group') return desenharGrupo(ctx, no, e)
  desenharConteudo(ctx, no, no.opacity * no.fill, gco(no.blendMode), e)
}

function desenharGrupo(ctx: Ctx, g: NoGrupo, e: Estado) {
  if (g.passThrough && g.opacity >= 1 && g.blendMode === 'normal') return desenharLista(ctx, g.children, e)
  const buf = novoBuffer(e)
  desenharLista(buf.g, g.children, e)
  ctx.save()
  ctx.globalAlpha = g.opacity
  ctx.globalCompositeOperation = gco(g.blendMode)
  ctx.drawImage(buf.c as CanvasImageSource, 0, 0)
  ctx.restore()
}

/**
 * O conteúdo de UMA camada com o alpha e o modo dados. Com estilos de camada (Sprint 8), o conteúdo vai
 * para um buffer do tamanho da camada e os efeitos são montados em volta (render/efeitos.ts).
 */
function desenharConteudo(ctx: Ctx, no: NoCamada, alpha: number, modo: GlobalCompositeOperation, e: Estado) {
  if (alpha <= 0 && !no.effects?.length) return
  if (no.effects?.some(x => x.enabled !== false)) {
    // alpha = opacidade × preenchimento (ou só o preenchimento, na base de um recorte)
    const preench = no.type === 'group' ? 1 : no.fill
    const opac = preench > 0 ? alpha / preench : no.opacity
    desenharComEfeitos(ctx, no, opac, preench, modo, { k: e.pxPorMm, criarCanvas: e.criarCanvas, bitmap: e.bitmap, caminho: caminhoDe(e), W: e.w, H: e.h }, g => desenharPuro(g, no, e))
    return
  }
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = modo
  desenharPuro(ctx, no, e)
  ctx.restore()
}

const cachePath = new Map<string, Path2D>()
function caminhoDe(e: Estado) {
  return (d: string): Path2D => {
    let p = cachePath.get(d)
    if (!p) {
      p = e.criarCaminho ? e.criarCaminho(d) : new Path2D(d)
      if (cachePath.size > 500) cachePath.clear()
      cachePath.set(d, p)
    }
    return p
  }
}

/** Desenha o conteúdo da camada (sem alpha/modo próprios) nas coordenadas da folha. */
function desenharPuro(ctx: Ctx, no: NoCamada, e: Estado) {
  const k = e.pxPorMm
  if (no.type === 'group') {
    const buf = novoBuffer(e)
    desenharLista(buf.g, no.children, e)
    ctx.drawImage(buf.c as CanvasImageSource, 0, 0)
    return
  }
  ctx.save()
  if (no.type === 'solid') {
    ctx.fillStyle = no.color
    ctx.fillRect(no.xMm * k, no.yMm * k, no.wMm * k, no.hMm * k)
  } else if (no.type === 'path') {
    ctx.scale(k, k)
    ctx.fillStyle = no.color
    ctx.fill(caminhoDe(e)(no.d))
  } else if (no.type === 'shape') {
    ctx.fillStyle = no.color
    ctx.beginPath()
    for (const anel of no.rings) {
      anel.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)))
      ctx.closePath()
    }
    ctx.fill('evenodd')
  } else if (no.matrix) {
    const r = rasterDaImagem(no, e)
    if (r) {
      const [a, b, c, d, ee, f] = no.matrix
      ctx.transform((a * k) / r.width, (b * k) / r.width, (c * k) / r.height, (d * k) / r.height, ee * k, f * k)
      ctx.drawImage(r as CanvasImageSource, 0, 0, r.width, r.height)
    }
  } else {
    const r = rasterDaImagem(no, e)
    if (r) {
      const cx = (no.xMm + no.wMm / 2) * k, cy = (no.yMm + no.hMm / 2) * k
      ctx.translate(cx, cy)
      if (no.rotationDeg) ctx.rotate((no.rotationDeg * Math.PI) / 180)
      ctx.drawImage(r as CanvasImageSource, -no.wMm * k / 2, -no.hMm * k / 2, no.wMm * k, no.hMm * k)
    }
  }
  ctx.restore()
}

/**
 * Imagem da camada já reamostrada para a escala atual. SEMPRE passa por esta reamostragem (com ou
 * sem cache), para que prévia e exportação façam exatamente as mesmas contas.
 */
function rasterDaImagem(no: NoImagem, e: Estado): CanvasLike | undefined {
  const fonte = e.bitmap(no.src.sha256)
  if (!fonte) { e.faltando.add(no.src.sha256); return undefined }
  // tamanho do raster: a caixa ou, com matriz, o comprimento dos dois lados do quadrado unitário
  const wMm = no.matrix ? Math.hypot(no.matrix[0], no.matrix[1]) : no.wMm
  const hMm = no.matrix ? Math.hypot(no.matrix[2], no.matrix[3]) : no.hMm
  const w = Math.max(1, Math.min(8192, Math.round(wMm * e.pxPorMm))), h = Math.max(1, Math.min(8192, Math.round(hMm * e.pxPorMm)))
  const chave = chaveRaster(no.src.sha256, wMm, hMm, 0, e.pxPorMm)
  let r = e.cache?.get(chave)
  if (!r) {
    r = e.criarCanvas(w, h)
    const g = ctx2d(r)
    g.imageSmoothingEnabled = true
    if ('imageSmoothingQuality' in g) g.imageSmoothingQuality = 'high'
    g.drawImage(fonte, 0, 0, w, h)
    e.cache?.set(chave, r, w * h * 4)
  }
  return r
}
