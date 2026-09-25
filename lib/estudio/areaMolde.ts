// SOA Edition — ÁREA DE APLICAÇÃO DO MOLDE: onde a arte "cai" num molde/foto. PEÇA COMPARTILHADA:
// usada no "Replicar em todos os moldes" (editor) e no Mockup (Fase 3: arte na foto do produto).
//
// A área é um quadrilátero (perspectiva, 4 pontos) ou uma malha 3×3 (superfície curva), com pontos
// NORMALIZADOS (0…1) sobre o molde — então vale em qualquer resolução (prévia leve ou exportação
// em alta). Opcional: um RECORTE (área selecionada) que limita onde a arte aparece.
import { distorcer, gradeNeutra, type Ponto } from './transform'

export interface AreaAplicacao { tipo: 'perspectiva' | 'malha'; cols: number; rows: number; pontos: Ponto[] }
export interface RecorteArea { forma: 'retangulo' | 'elipse'; x: number; y: number; w: number; h: number }
export interface OpcoesArea {
  area: AreaAplicacao
  recorte: RecorteArea | null
  /** 'multiplicar' deixa a textura/sombra do molde aparecer por cima da arte (mais realista em produto). */
  mistura: 'normal' | 'multiplicar'
  opacidade: number
}

/** Molde importado para replicar a arte (fica salvo no design). */
export interface MoldeReplica extends OpcoesArea {
  id: string
  assetId: string | null
  url: string
  proxyUrl: string | null
  nome: string
  largura: number
  altura: number
}

/** Área padrão: retângulo central ocupando 60% do molde. */
export function areaPadrao(tipo: 'perspectiva' | 'malha' = 'perspectiva'): AreaAplicacao {
  const n = tipo === 'perspectiva' ? 2 : 3
  return { tipo, cols: n, rows: n, pontos: gradeNeutra(0.6, 0.6, n, n).map(p => ({ x: p.x + 0.2, y: p.y + 0.2 })) }
}

/** Troca perspectiva ↔ malha mantendo a mesma posição (a malha nasce dos 4 cantos). */
export function converterArea(a: AreaAplicacao, tipo: 'perspectiva' | 'malha'): AreaAplicacao {
  if (a.tipo === tipo) return a
  const c = a.pontos, tl = c[0], tr = c[a.cols - 1], bl = c[(a.rows - 1) * a.cols], br = c[a.rows * a.cols - 1]
  if (tipo === 'perspectiva') return { tipo, cols: 2, rows: 2, pontos: [tl, tr, bl, br] }
  const pts: Ponto[] = []
  for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) {
    const u = q / 2, v = r / 2
    const top = { x: tl.x + (tr.x - tl.x) * u, y: tl.y + (tr.y - tl.y) * u }, bot = { x: bl.x + (br.x - bl.x) * u, y: bl.y + (br.y - bl.y) * u }
    pts.push({ x: top.x + (bot.x - top.x) * v, y: top.y + (bot.y - top.y) * v })
  }
  return { tipo, cols: 3, rows: 3, pontos: pts }
}

const dim = (s: CanvasImageSource) => {
  const o = s as { naturalWidth?: number; naturalHeight?: number; width: number; height: number }
  return { w: o.naturalWidth || o.width, h: o.naturalHeight || o.height }
}

/**
 * Aplica a arte na área do molde e devolve a imagem final (tamanho `W`×`H`, normalmente o do molde).
 * Molde por baixo; arte distorcida para os pontos da área; recorte (se houver) limita a arte.
 */
export function aplicarNaArea(molde: CanvasImageSource, arte: CanvasImageSource, op: OpcoesArea, W?: number, H?: number): HTMLCanvasElement {
  const dm = dim(molde), da = dim(arte)
  W = W || dm.w; H = H || dm.h
  const out = document.createElement('canvas'); out.width = W; out.height = H
  const g = out.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(molde, 0, 0, W, H)
  const pontos = op.area.pontos.map(p => ({ x: p.x * W!, y: p.y * H! }))
  const r = distorcer(arte, da.w, da.h, { tipo: op.area.tipo, cols: op.area.cols, rows: op.area.rows, pontos })
  g.save()
  if (op.recorte) {
    const q = op.recorte
    g.beginPath()
    if (q.forma === 'elipse') g.ellipse((q.x + q.w / 2) * W, (q.y + q.h / 2) * H, (q.w / 2) * W, (q.h / 2) * H, 0, 0, Math.PI * 2)
    else g.rect(q.x * W, q.y * H, q.w * W, q.h * H)
    g.clip()
  }
  g.globalAlpha = Math.max(0, Math.min(1, op.opacidade / 100))
  if (op.mistura === 'multiplicar') g.globalCompositeOperation = 'multiply'
  g.drawImage(r.canvas, r.minX, r.minY, r.canvas.width / r.escala, r.canvas.height / r.escala)
  g.restore()
  return out
}
