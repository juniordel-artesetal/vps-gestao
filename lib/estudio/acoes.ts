// SOA Edition — AÇÕES EM LOTE (mesmo ajuste/recorte/redimensionamento/marca d'água em N imagens).
// Funções puras sobre canvas: rodam no Web Worker (OffscreenCanvas) e, sem ele, na página.
// Um PRESET é só a lista de operações — guardado em EstudioPreset e reaplicável.
import { type Ajustes, type Canvas2D, type CriarCanvas, aplicarAjustes, ctx2d, criarCanvasPadrao } from './ajustes'

export type Posicao = 'sup-esq' | 'sup-dir' | 'inf-esq' | 'inf-dir' | 'centro'

export type Operacao =
  | { op: 'recortar'; proporcao: string; alinhar: 'centro' | 'topo' | 'base' }
  | { op: 'redimensionar'; largura: number; altura: number; modo: 'encaixar' | 'preencher' | 'esticar'; fundo: string | null }
  | { op: 'ajustes'; ajustes: Ajustes }
  | { op: 'marcaDagua'; tipo: 'imagem' | 'texto'; assetUrl?: string; texto?: string; cor?: string; posicao: Posicao; tamanho: number; opacidade: number; margem: number }

export interface Saida { formato: 'jpg' | 'png' | 'webp'; qualidade: number }

export const OPERACOES_ROTULO: Record<Operacao['op'], string> = {
  recortar: 'Recortar', redimensionar: 'Redimensionar', ajustes: 'Ajustes', marcaDagua: "Marca d'água",
}

type Fonte = CanvasImageSource & { width: number; height: number }

function recortar(src: Fonte, o: Extract<Operacao, { op: 'recortar' }>, criar: CriarCanvas): Canvas2D {
  const [a, b] = o.proporcao.split(':').map(Number)
  const alvo = a > 0 && b > 0 ? a / b : 1
  const w = src.width, h = src.height
  let cw = w, ch = h
  if (w / h > alvo) cw = Math.round(h * alvo); else ch = Math.round(w / alvo)
  const x = Math.round((w - cw) / 2)
  const y = o.alinhar === 'topo' ? 0 : o.alinhar === 'base' ? h - ch : Math.round((h - ch) / 2)
  const out = criar(cw, ch)
  ctx2d(out).drawImage(src, x, y, cw, ch, 0, 0, cw, ch)
  return out
}

function redimensionar(src: Fonte, o: Extract<Operacao, { op: 'redimensionar' }>, criar: CriarCanvas): Canvas2D {
  const W = Math.max(1, Math.round(o.largura)), H = Math.max(1, Math.round(o.altura))
  const out = criar(W, H)
  const g = ctx2d(out)
  g.imageSmoothingQuality = 'high'
  if (o.fundo) { g.fillStyle = o.fundo; g.fillRect(0, 0, W, H) }
  if (o.modo === 'esticar') { g.drawImage(src, 0, 0, W, H); return out }
  const k = o.modo === 'preencher' ? Math.max(W / src.width, H / src.height) : Math.min(W / src.width, H / src.height)
  const w = src.width * k, h = src.height * k
  g.drawImage(src, (W - w) / 2, (H - h) / 2, w, h)
  return out
}

function marcaDagua(alvo: Canvas2D, o: Extract<Operacao, { op: 'marcaDagua' }>, marca: Fonte | null) {
  const g = ctx2d(alvo)
  const W = alvo.width, H = alvo.height
  const m = (o.margem / 100) * W
  g.save()
  g.globalAlpha = Math.max(0, Math.min(1, o.opacidade / 100))
  let w: number, h: number
  if (o.tipo === 'imagem') {
    if (!marca) { g.restore(); return }
    w = (o.tamanho / 100) * W; h = (marca.height / marca.width) * w
  } else {
    const px = Math.max(8, (o.tamanho / 100) * W * 0.18)
    g.font = `700 ${px}px sans-serif`
    w = g.measureText(o.texto || '').width; h = px
  }
  const x = o.posicao === 'sup-esq' || o.posicao === 'inf-esq' ? m : o.posicao === 'centro' ? (W - w) / 2 : W - w - m
  const y = o.posicao === 'sup-esq' || o.posicao === 'sup-dir' ? m : o.posicao === 'centro' ? (H - h) / 2 : H - h - m
  if (o.tipo === 'imagem') g.drawImage(marca!, x, y, w, h)
  else {
    g.textBaseline = 'top'
    g.lineWidth = Math.max(1, h * 0.08); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.strokeText(o.texto || '', x, y)
    g.fillStyle = o.cor || '#ffffff'; g.fillText(o.texto || '', x, y)
  }
  g.restore()
}

/** Aplica as operações em ordem. `marca` = imagem da marca d'água já carregada (se houver). */
export function processarImagem(src: Fonte, ops: Operacao[], marca: Fonte | null, criar: CriarCanvas = criarCanvasPadrao): Canvas2D {
  let atual: Canvas2D = criar(src.width, src.height)
  ctx2d(atual).drawImage(src, 0, 0)
  for (const o of ops) {
    if (o.op === 'recortar') atual = recortar(atual, o, criar)
    else if (o.op === 'redimensionar') atual = redimensionar(atual, o, criar)
    else if (o.op === 'ajustes') atual = aplicarAjustes(atual, atual.width, atual.height, o.ajustes, criar)
    else if (o.op === 'marcaDagua') marcaDagua(atual, o, marca)
  }
  return atual
}

export const MIME_SAIDA: Record<Saida['formato'], string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

/** Codifica o canvas (JPG ganha fundo branco — não tem transparência). */
export async function codificar(c: Canvas2D, s: Saida, criar: CriarCanvas = criarCanvasPadrao): Promise<Blob> {
  let alvo = c
  if (s.formato === 'jpg') {
    alvo = criar(c.width, c.height)
    const g = ctx2d(alvo); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(c, 0, 0)
  }
  const tipo = MIME_SAIDA[s.formato], q = Math.max(0.5, Math.min(1, s.qualidade / 100))
  if ('convertToBlob' in alvo) return alvo.convertToBlob({ type: tipo, quality: q })
  return new Promise((res, rej) => (alvo as HTMLCanvasElement).toBlob(b => (b ? res(b) : rej(new Error('Falha ao gerar a imagem'))), tipo, q))
}
