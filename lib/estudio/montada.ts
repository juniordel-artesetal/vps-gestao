// SOA Edition — CAIXA MONTADA (3D): pega a ARTE DE IMPRESSÃO (o molde aberto preenchido), fatia por face
// usando o mapa de faces e projeta cada face na caixa montada, com perspectiva e luz por face.
// Mesmo mapa de faces do Método Mãe (caixasTipos). Só navegador (canvas + transform.distorcer).
import { distorcer } from './transform'
import type { Face3D, FaceMolde, MoldeCaixaDef } from './caixasTipos'
import { desenharLaco, desenharPedra } from './cenasAcervo'

type V3 = [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V3): V3 => { const n = Math.hypot(...a) || 1; return [a[0] / n, a[1] / n, a[2] / n] }

export type Vista = 'frente34' | 'frente' | 'lateral' | 'cima' | 'tras34'
export const VISTAS: { id: Vista; nome: string; az: number; el: number }[] = [
  { id: 'frente34', nome: 'Frente 3/4', az: 35, el: 22 },
  { id: 'frente', nome: 'Frente', az: 0, el: 12 },
  { id: 'lateral', nome: 'Lateral', az: 72, el: 16 },
  { id: 'cima', nome: 'De cima', az: 28, el: 58 },
  { id: 'tras34', nome: 'Trás 3/4', az: 215, el: 22 },
]

export interface OpcoesMontada {
  vista: Vista
  /** Maior lado do resultado (px). */
  lado: number
  /** Cor das faces sem arte (caixa lisa). */
  corBase?: string
  laco?: { cor: string } | null
  pedra?: { cor: string } | null
  corAlca?: string | null
  /** Se passado, recebe onde cada face visível caiu na imagem ([TL, TR, BL, BR] normalizados) — vira área de mockup. */
  saidaQuadros?: Record<string, { x: number; y: number }[]>
}

/** Montagem de CUBOIDE para molde próprio: gera as faces 3D a partir dos papéis mapeados. */
export function montagemCuboide(faces: FaceMolde[], dims: { l: number; p: number; a: number }): MoldeCaixaDef['montagem'] {
  const { l, p, a } = dims, x = l / 2, z = p / 2
  const cantos: Partial<Record<FaceMolde['role'], V3[]>> = {
    frente: [[-x, a, z], [x, a, z], [x, 0, z], [-x, 0, z]],
    tras: [[x, a, -z], [-x, a, -z], [-x, 0, -z], [x, 0, -z]],
    lateral_direita: [[x, a, z], [x, a, -z], [x, 0, -z], [x, 0, z]],
    lateral_esquerda: [[-x, a, -z], [-x, a, z], [-x, 0, z], [-x, 0, -z]],
    cima: [[-x, a, -z], [x, a, -z], [x, a, z], [-x, a, z]],
  }
  const usados = new Set<string>()
  const out: Face3D[] = []
  for (const f of faces) {
    const c = cantos[f.role]
    if (!c || usados.has(f.role)) continue
    usados.add(f.role); out.push({ faceId: f.id, cantos: c })
  }
  return { faces: out, dims, extra: { laco: { em: [0, a * 0.82, z + 0.05], tamanho: Math.min(l, a) * 0.32 }, pedra: { em: [0, a * 0.6, z + 0.05], tamanho: Math.min(l, a) * 0.07 } } }
}

/** Recorta a face do molde e deixa EM PÉ (gira `rot`), aplicando a forma (triângulo/coração/trapézio). */
export function faceEmPe(arte: CanvasImageSource | null, AW: number, AH: number, f: FaceMolde, maxLado = 1400, corBase = '#ffffff'): HTMLCanvasElement {
  const sw = f.w * AW, sh = f.h * AH
  const k = Math.min(1, maxLado / Math.max(sw, sh))
  const w = Math.max(2, Math.round(sw * k)), h = Math.max(2, Math.round(sh * k))
  const deitada = f.rot === 90 || f.rot === 270
  const c = document.createElement('canvas'); c.width = deitada ? h : w; c.height = deitada ? w : h
  const g = c.getContext('2d')!
  g.save()
  g.translate(c.width / 2, c.height / 2); g.rotate((f.rot * Math.PI) / 180)
  if (arte) g.drawImage(arte, f.x * AW, f.y * AH, sw, sh, -w / 2, -h / 2, w, h)
  else { g.fillStyle = corBase; g.fillRect(-w / 2, -h / 2, w, h) }
  g.restore()
  if (f.forma !== 'retangulo') {
    g.globalCompositeOperation = 'destination-in'
    g.beginPath(); caminhoForma(g, f, c.width, c.height); g.fillStyle = '#000'; g.fill()
    g.globalCompositeOperation = 'source-over'
  }
  return c
}

/** Contorno da face no quadro em pé (0,0)-(W,H). */
export function caminhoForma(g: CanvasRenderingContext2D, f: Pick<FaceMolde, 'forma' | 'topo'>, W: number, H: number) {
  if (f.forma === 'triangulo') { g.moveTo(W / 2, 0); g.lineTo(W, H); g.lineTo(0, H); g.closePath() }
  else if (f.forma === 'trapezio') { const t = (1 - (f.topo ?? 0.7)) / 2 * W; g.moveTo(t, 0); g.lineTo(W - t, 0); g.lineTo(W, H); g.lineTo(0, H); g.closePath() }
  else if (f.forma === 'coracao') {
    g.moveTo(W / 2, H * 0.28)
    g.bezierCurveTo(W / 2, H * 0.02, W * 0.02, H * 0.0, W * 0.02, H * 0.34)
    g.bezierCurveTo(W * 0.02, H * 0.62, W * 0.34, H * 0.78, W / 2, H)
    g.bezierCurveTo(W * 0.66, H * 0.78, W * 0.98, H * 0.62, W * 0.98, H * 0.34)
    g.bezierCurveTo(W * 0.98, H * 0.0, W / 2, H * 0.02, W / 2, H * 0.28)
    g.closePath()
  } else g.rect(0, 0, W, H)
}

/**
 * Desenha a caixa montada. `arte` = arte de impressão (molde aberto preenchido) do tamanho AW×AH;
 * null = caixa lisa (Fluxo B: mockup do acervo sem arte). Fundo transparente.
 */
export function renderMontada(
  montagem: MoldeCaixaDef['montagem'], faces: FaceMolde[], arte: CanvasImageSource | null, AW: number, AH: number, op: OpcoesMontada,
): HTMLCanvasElement {
  const v = VISTAS.find(x => x.id === op.vista) || VISTAS[0]
  const { l, p, a } = montagem.dims
  const centro: V3 = [0, a / 2, 0]
  const D = 4.2 * Math.max(l, p, a)
  const az = (v.az * Math.PI) / 180, el = (v.el * Math.PI) / 180
  const cam: V3 = add(centro, [D * Math.sin(az) * Math.cos(el), D * Math.sin(el), D * Math.cos(az) * Math.cos(el)])
  const fw = norm(sub(centro, cam)), dir = norm(cross(fw, [0, 1, 0])), cimaV = cross(dir, fw)
  const proj = (P: V3) => { const q = sub(P, cam); const z = dot(q, fw); return { x: dot(q, dir) / z, y: -dot(q, cimaV) / z, z } }
  const luz = norm([-0.45, 0.85, 0.55])
  const porId = new Map(faces.map(f => [f.id, f]))

  type Item = { f: FaceMolde | null; quad: V3[]; tri: boolean; n: V3; prof: number }
  const itens: Item[] = []
  for (const f3 of montagem.faces) {
    const f = porId.get(f3.faceId) || null
    const c = f3.cantos as V3[]
    const tri = c.length === 3
    const n = norm(tri ? cross(sub(c[2], c[0]), sub(c[1], c[0])) : cross(sub(c[3], c[0]), sub(c[1], c[0])))
    const meio = mul(c.reduce((s, x) => add(s, x), [0, 0, 0] as V3), 1 / c.length)
    if (dot(n, sub(cam, meio)) <= 0) continue          // de costas para a câmera
    // triângulo → quadro retangular que o contém (ponta no meio do topo)
    const quad = tri ? [sub(c[0], mul(sub(c[1], c[2]), 0.5)), add(c[0], mul(sub(c[1], c[2]), 0.5)), c[1], c[2]] : c
    itens.push({ f, quad, tri, n, prof: proj(meio).z })
  }
  itens.sort((x, y) => y.prof - x.prof)                  // pinta do mais longe para o mais perto

  // enquadramento: todos os pontos projetados (+ alça) cabem com margem
  const todos = itens.flatMap(i => i.quad.map(proj))
  const alca = montagem.extra?.alca
  if (alca) todos.push(...alca.pontos.map(pp => proj(pp as V3)))
  if (!todos.length) todos.push(proj(centro))
  const minX = Math.min(...todos.map(q => q.x)), maxX = Math.max(...todos.map(q => q.x)), minY = Math.min(...todos.map(q => q.y)), maxY = Math.max(...todos.map(q => q.y))
  const margem = 0.08
  const esc = (op.lado * (1 - 2 * margem)) / Math.max(maxX - minX, maxY - minY, 1e-6)
  const W = Math.round((maxX - minX) * esc + op.lado * 2 * margem), H = Math.round((maxY - minY) * esc + op.lado * 2 * margem)
  const tela = (P: V3) => { const q = proj(P); return { x: (q.x - minX) * esc + op.lado * margem, y: (q.y - minY) * esc + op.lado * margem } }
  const out = document.createElement('canvas'); out.width = W; out.height = H
  const g = out.getContext('2d')!

  for (const it of itens) {
    const img = it.f ? faceEmPe(arte, AW, AH, it.f, 1400, op.corBase || '#ffffff') : corLisa(op.corBase || '#ffffff', it.tri)
    // luz por face (lambert) + leve degradê de cima para baixo
    const b = 0.74 + 0.26 * Math.max(0, dot(it.n, luz))
    const gi = img.getContext('2d')!
    gi.globalCompositeOperation = 'source-atop'
    gi.fillStyle = `rgba(0,0,0,${(1 - b).toFixed(3)})`; gi.fillRect(0, 0, img.width, img.height)
    const gr = gi.createLinearGradient(0, 0, 0, img.height); gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0.07)')
    gi.fillStyle = gr; gi.fillRect(0, 0, img.width, img.height)
    const [tl, tr, br, bl] = it.quad.map(tela)
    if (op.saidaQuadros && it.f) op.saidaQuadros[it.f.id] = [tl, tr, bl, br].map(q => ({ x: q.x / W, y: q.y / H }))
    const r = distorcer(img, img.width, img.height, { tipo: 'perspectiva', cols: 2, rows: 2, pontos: [tl, tr, bl, br] })
    g.drawImage(r.canvas, r.minX, r.minY, r.canvas.width / r.escala, r.canvas.height / r.escala)
    // aresta sutil (só em faces retas)
    if (!it.f || it.f.forma === 'retangulo' || it.f.forma === 'trapezio') {
      g.save(); g.strokeStyle = 'rgba(0,0,0,0.14)'; g.lineWidth = Math.max(1, op.lado / 900)
      g.beginPath(); g.moveTo(tl.x, tl.y); g.lineTo(tr.x, tr.y); g.lineTo(br.x, br.y); g.lineTo(bl.x, bl.y); g.closePath(); g.stroke(); g.restore()
    }
  }
  // alça (cordão/fita)
  if (alca && alca.pontos.length > 1) {
    const pts = alca.pontos.map(pp => tela(pp as V3))
    const z = proj(alca.pontos[Math.floor(alca.pontos.length / 2)] as V3).z
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'
    g.strokeStyle = op.corAlca || alca.cor; g.lineWidth = Math.max(2, (alca.espessura / z) * esc)
    g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke()
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = Math.max(1, g.lineWidth * 0.3); g.stroke()
    g.restore()
  }
  const ex = montagem.extra
  // laço e pedra ficam na frente da caixa: somem na vista de trás
  if (op.pedra && ex?.pedra && v.id !== 'tras34') {
    const q = tela(ex.pedra.em as V3), z = proj(ex.pedra.em as V3).z
    desenharPedra(g, q.x, q.y, (ex.pedra.tamanho / z) * esc, op.pedra.cor)
  }
  if (op.laco && ex?.laco && v.id !== 'tras34') {
    const q = tela(ex.laco.em as V3), z = proj(ex.laco.em as V3).z
    desenharLaco(g, q.x, q.y, (ex.laco.tamanho / z) * esc, op.laco.cor)
  }
  return out
}

function corLisa(cor: string, tri: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = cor
  if (tri) { g.beginPath(); g.moveTo(128, 0); g.lineTo(256, 256); g.lineTo(0, 256); g.closePath(); g.fill() } else g.fillRect(0, 0, 256, 256)
  return c
}
