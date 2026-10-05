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
import type { NoCamada, NoGrupo, NoImagem, Prancheta, NoAjuste } from '../schema'
import { desenharPrancheta } from './desenhar'
import { CacheCamadas, chaveRaster } from './cache'
import { desenharComEfeitos, aplicarMascara } from './efeitos'
import { aplicarAjustes } from './ajustes'

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

/**
 * CAMADA DE AJUSTE (Sprint 13): os ajustes valem para o que já está desenhado abaixo dela (no mesmo nível),
 * com a opacidade e a máscara da camada. Fica no lugar dela: o que vem por cima não é afetado.
 */
function aplicarCamadaDeAjuste(ctx: Ctx, no: NoAjuste, e: Estado) {
  const ativos = (no.adjustments ?? []).filter(a => a.enabled !== false)
  if (!ativos.length || no.opacity <= 0) return
  const alvo = ctx.canvas as unknown as CanvasLike
  const buf = novoBuffer(e)
  buf.g.drawImage(alvo as CanvasImageSource, 0, 0)
  const id = buf.g.getImageData(0, 0, e.w, e.h)
  aplicarAjustes(id.data, ativos)
  buf.g.putImageData(id, 0, 0)
  if (no.mask && no.mask.enabled !== false) {
    const novo = () => { const b = novoBuffer(e); return { ...b, w: e.w, h: e.h } }
    aplicarMascara({ ...buf, w: e.w, h: e.h }, no.mask, 0, 0, e.pxPorMm, novo, { k: e.pxPorMm, criarCanvas: e.criarCanvas, bitmap: e.bitmap, caminho: caminhoDe(e), W: e.w, H: e.h })
  }
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = no.opacity
  ctx.globalCompositeOperation = 'source-atop'
  ctx.drawImage(buf.c as CanvasImageSource, 0, 0)
  ctx.restore()
}

/** Desenha uma lista (de baixo para cima), montando os grupos de recorte. */
function desenharLista(ctx: Ctx, nos: NoCamada[], e: Estado) {
  for (let i = 0; i < nos.length;) {
    const base = nos[i]
    if (base.type === 'adjust') { i++; if (base.visible) aplicarCamadaDeAjuste(ctx, base, e); continue }
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
      // ajuste recortado: vale só para a base do recorte (e o que já foi recortado nela)
      if (r.type === 'adjust') { aplicarCamadaDeAjuste(grupo.g, r, e); continue }
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
  if (no.effects?.some(x => x.enabled !== false) || no.adjustments?.some(x => x.enabled !== false) || (no.mask && no.mask.enabled !== false)) {
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

/**
 * Imagem DEFORMADA (Sprint 10: distorcer, perspectiva, malha): a grade de controle é interpolada
 * (bilinear) numa malha fina e cada triângulo é desenhado com a sua transformação afim, recortado pelo
 * próprio triângulo (um pouco aumentado, para não deixar fresta entre vizinhos). Determinístico.
 */
export function desenharDeformada(ctx: Ctx, r: CanvasLike, M: [number, number, number, number, number, number], wp: NonNullable<NoImagem['warp']>, k: number) {
  const W = r.width, H = r.height, SUB = 6
  const ponto = (u: number, v: number): [number, number] => {
    const cu = Math.min(wp.cols - 1, Math.floor(u * wp.cols)), cv = Math.min(wp.rows - 1, Math.floor(v * wp.rows))
    const fu = u * wp.cols - cu, fv = v * wp.rows - cv
    const P = (i: number, j: number) => wp.pts[j * (wp.cols + 1) + i]
    const a = P(cu, cv), b = P(cu + 1, cv), c = P(cu, cv + 1), d = P(cu + 1, cv + 1)
    const x = (a[0] * (1 - fu) + b[0] * fu) * (1 - fv) + (c[0] * (1 - fu) + d[0] * fu) * fv
    const y = (a[1] * (1 - fu) + b[1] * fu) * (1 - fv) + (c[1] * (1 - fu) + d[1] * fu) * fv
    return [(M[0] * x + M[2] * y + M[4]) * k, (M[1] * x + M[3] * y + M[5]) * k]
  }
  const nu = wp.cols * SUB, nv = wp.rows * SUB
  const tri = (s: [number, number][], dd: [number, number][]) => {
    const [[x0, y0], [x1, y1], [x2, y2]] = s, [[u0, v0], [u1, v1], [u2, v2]] = dd
    const den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    if (Math.abs(den) < 1e-9) return
    const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / den, c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / den
    const b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / den, d = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / den
    const e = u0 - a * x0 - c * y0, f = v0 - b * x0 - d * y0
    const cx = (u0 + u1 + u2) / 3, cy = (v0 + v1 + v2) / 3
    ctx.save(); ctx.beginPath()
    dd.forEach(([x, y], i) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1, xx = x + (dx / l) * 0.6, yy = y + (dy / l) * 0.6; if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy) })
    ctx.closePath(); ctx.clip()
    ctx.transform(a, b, c, d, e, f)
    ctx.drawImage(r as CanvasImageSource, 0, 0)
    ctx.restore()
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv
    const s00: [number, number] = [u0 * W, v0 * H], s10: [number, number] = [u1 * W, v0 * H], s01: [number, number] = [u0 * W, v1 * H], s11: [number, number] = [u1 * W, v1 * H]
    const d00 = ponto(u0, v0), d10 = ponto(u1, v0), d01 = ponto(u0, v1), d11 = ponto(u1, v1)
    tri([s00, s10, s11], [d00, d10, d11]); tri([s00, s11, s01], [d00, d11, d01])
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
  // texto e forma livres chegam já materializados como caminho; a camada de ajuste age na lista
  if (no.type === 'text' || no.type === 'vshape' || no.type === 'adjust') return
  ctx.save()
  if (no.type === 'solid') {
    ctx.fillStyle = no.color
    ctx.fillRect(no.xMm * k, no.yMm * k, no.wMm * k, no.hMm * k)
  } else if (no.type === 'path') {
    ctx.scale(k, k)
    const p = caminhoDe(e)(no.d)
    if (!no.fillNone) { ctx.fillStyle = no.color; ctx.fill(p) }
    if (no.stroke) {
      ctx.lineWidth = no.stroke.widthMm; ctx.strokeStyle = no.stroke.color; ctx.lineJoin = 'round'
      // pesponto (Lote 1): tracejado em mm; ponta reta para o traço ter o tamanho escolhido
      if (no.stroke.dashMm) { ctx.setLineDash(no.stroke.dashMm); ctx.lineCap = 'butt' } else ctx.lineCap = 'round'
      ctx.stroke(p)
    }
  } else if (no.type === 'shape') {
    ctx.fillStyle = no.color
    ctx.beginPath()
    for (const anel of no.rings) {
      anel.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)))
      ctx.closePath()
    }
    ctx.fill('evenodd')
  } else if (no.matrix && no.warp) {
    const r = rasterDaImagem(no, e)
    if (r) desenharDeformada(ctx, r, no.matrix, no.warp, k)
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
