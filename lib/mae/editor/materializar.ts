// mae-editor — MATERIALIZAR (Sprint 13): o TEXTO livre e a FORMA livre do editor de imagem viram CAMINHO
// em mm da folha antes de ir para o motor (o motor só desenha caminhos; a fonte vive no navegador).
// A tela, a prévia e a exportação passam por aqui — o mesmo caminho em todo lugar. Puro.
import type { NoCamada, NoCaminho, NoTexto, NoFormaLivre } from '../schema'
import type { RegistroFontes } from '../texto/noTexto'
import type { Cmd } from '../texto/fonte'
import { diagramarLivre } from '../texto/livre'
import { formaEmCmds } from '../edicao/formas'

const r3 = (v: number) => Math.round(v * 1000) / 1000

/** Comandos locais da caixa (mm, origem no canto) → caminho SVG na folha, girado em volta do centro. */
function naFolha(cmds: Cmd[], no: { xMm: number; yMm: number; wMm: number; hMm: number; rotationDeg: number }, escala: [number, number] = [1, 1]) {
  const a = ((no.rotationDeg || 0) * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a)
  const cx = no.xMm + no.wMm / 2, cy = no.yMm + no.hMm / 2
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const tx = (x: number, y: number) => {
    const lx = x * escala[0] - no.wMm / 2, ly = y * escala[1] - no.hMm / 2
    const X = cx + lx * cs - ly * sn, Y = cy + lx * sn + ly * cs
    if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y
    return `${r3(X)} ${r3(Y)}`
  }
  let d = ''
  for (const c of cmds) {
    if (c[0] === 'Z') { d += 'Z'; continue }
    const v = c.slice(1) as number[], pts: string[] = []
    for (let i = 0; i < v.length; i += 2) pts.push(tx(v[i], v[i + 1]))
    d += c[0] + pts.join(' ')
  }
  if (!isFinite(x0)) { x0 = no.xMm; y0 = no.yMm; x1 = no.xMm + no.wMm; y1 = no.yMm + no.hMm }
  return { d, bbox: [r3(x0), r3(y0), r3(x1 - x0), r3(y1 - y0)] as [number, number, number, number] }
}

const comum = (n: NoCamada) => ({ id: n.id, name: n.name, visible: n.visible, locked: n.locked, opacity: n.opacity, fill: n.fill, blendMode: n.blendMode, clip: n.clip,
  ...(n.effects ? { effects: n.effects } : {}), ...(n.adjustments ? { adjustments: n.adjustments } : {}), ...(n.mask ? { mask: n.mask } : {}) })

export function textoEmCaminho(t: NoTexto, fontes: RegistroFontes): { no: NoCaminho; substituta: boolean; hMm: number } | null {
  const pedida = fontes.obter(t.font.postscriptName)
  const f = pedida ?? fontes.substituta
  if (!f || !t.valor.trim()) return null
  const r = diagramarLivre(f, t.valor, { tamanhoPt: t.tamanhoPt, align: t.align, tracking: t.tracking, lineHeight: t.lineHeight, caixa: t.caixa, features: t.features }, t.wMm)
  // o bloco fica centrado na altura da caixa (como no SOA Design)
  const dy = (t.hMm - r.hMm) / 2
  const cmds = r.cmds.map(c => (c[0] === 'Z' ? c : ([c[0], ...(c.slice(1) as number[]).map((v, i) => (i % 2 ? v + dy : v))] as Cmd)))
  const { d, bbox } = naFolha(cmds, t)
  const sw = t.stroke?.widthMm ?? 0
  return { no: { ...comum(t), type: 'path', d, color: t.color, bboxMm: [bbox[0] - sw, bbox[1] - sw, bbox[2] + 2 * sw, bbox[3] + 2 * sw].map(r3) as NoCaminho['bboxMm'], ...(t.stroke ? { stroke: t.stroke } : {}) }, substituta: !pedida, hMm: r.hMm }
}

export function formaEmCaminho(s: NoFormaLivre): NoCaminho | null {
  const cmds = formaEmCmds(s.kind, s.params)
  if (!cmds.length) return null
  const { d, bbox } = naFolha(cmds, s, [s.wMm, s.hMm])
  const linha = s.kind === 'line'
  const sw = s.stroke ? s.stroke.widthMm : linha ? 0.5 : 0
  return { ...comum(s), type: 'path', d, color: s.color ?? '#000000', ...(s.color === null || linha ? { fillNone: true } : {}),
    ...(s.stroke ? { stroke: s.stroke } : linha ? { stroke: { color: s.color ?? '#000000', widthMm: 0.5 } } : {}),
    bboxMm: [bbox[0] - sw, bbox[1] - sw, bbox[2] + 2 * sw, bbox[3] + 2 * sw].map(r3) as NoCaminho['bboxMm'] }
}

/**
 * Imagem de CAIXA (editor de imagem) com espelho, deformação ou máscara: vira matriz (quadrado da imagem →
 * mm, girada em volta do centro). A máscara e a deformação ficam no quadrado da imagem — mover ou
 * redimensionar a caixa leva a máscara junto.
 */
function imagemComMatriz(n: Extract<NoCamada, { type: 'image' }>): NoCamada {
  if (n.matrix || !(n.flipX || n.flipY || n.warp || n.mask)) return n
  const a = ((n.rotationDeg || 0) * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a)
  const w = n.wMm * (n.flipX ? -1 : 1), h = n.hMm * (n.flipY ? -1 : 1)
  const cx = n.xMm + n.wMm / 2, cy = n.yMm + n.hMm / 2
  // M = T(c) · R · S(w, h) · T(−½, −½)
  const M: [number, number, number, number, number, number] = [cs * w, sn * w, -sn * h, cs * h, 0, 0]
  M[4] = cx - (M[0] + M[2]) / 2; M[5] = cy - (M[1] + M[3]) / 2
  const m = n.mask
  return { ...n, matrix: M.map(r3) as typeof M, ...(m ? { mask: { ...m, ...(m.gradient ? { gradient: { ...m.gradient, matrix: M } } : {}), ...(m.raster ? { raster: { ...m.raster, matrix: M } } : {}) } } : {}) }
}

/** A árvore pronta para o motor: textos e formas livres viram caminho (recursivo nos grupos). */
export function materializar(lista: NoCamada[], fontes: RegistroFontes, aoTexto?: (id: string, substituta: boolean) => void): NoCamada[] {
  return lista.flatMap((n): NoCamada[] => {
    if (n.type === 'group') return [{ ...n, children: materializar(n.children, fontes, aoTexto) }]
    if (n.type === 'text') { const r = textoEmCaminho(n, fontes); if (r) aoTexto?.(n.id, r.substituta); return r ? [r.no] : [] }
    if (n.type === 'vshape') { const r = formaEmCaminho(n); return r ? [r] : [] }
    if (n.type === 'image') return [imagemComMatriz(n)]
    return [n]
  })
}

/** Fontes usadas pelos textos livres (para carregar antes de desenhar). */
export function fontesDosTextos(lista: NoCamada[], out = new Set<string>()): Set<string> {
  for (const n of lista) { if (n.type === 'text') out.add(n.font.postscriptName); else if (n.type === 'group') fontesDosTextos(n.children, out) }
  return out
}
