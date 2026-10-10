// mae-apliques — as DUAS PRANCHETAS dos apliques 3D (Sprint 11):
//   • IMPRESSOS: cada aplique no tamanho da arte, com a BORDINHA (offset, na cor escolhida) por baixo e
//     o NOME DO MOLDE em cima (só nesta prancheta);
//   • SILHUETAS: a silhueta (deslocamento externo, canto redondo) preenchida em PRETO, na MESMA posição
//     da peça impressa — a plotter corta exatamente em volta.
// Achar os apliques no tema, organizar na folha e montar as camadas do motor. Puro.
import type { DocTema, DocTrabalho, NoCamada, NoCaminho, NoImagem } from '../schema'
import type { Pt } from '../faces/geometria'
import type { FonteHB } from '../texto/fonte'
import { moldar } from '../texto/fonte'
import { paraSvg } from '../texto/diagramar'
import { resolverPrancheta } from '../vinculo/resolver'
import { organizar, type Ret } from './empacotar'
import { caixaDosAneis, caminhoDosAneis } from './silhueta'
import { aplicar, compor, inversa, type M } from '../vinculo/matriz'

export interface ConfigAplique { borderMm: number; borderColor: string; silhouetteMm: number }
export const APLIQUE_PADRAO: ConfigAplique = { borderMm: 1, borderColor: '#ffffff', silhouetteMm: 3 }

/** Um aplique = uma camada marcada × uma face (ligado ao molde de origem). */
export interface ApliqueAchado {
  id: string; layerId: string; faceId: string; moldeId: string; moldeNome: string
  src: { path: string; sha256: string }
  /** Tamanho em que está na arte (mm). */
  wMm: number; hMm: number
  cfg: ConfigAplique
  /**
   * Lote 6 (item 86): textos (NOME…) que estão POR CIMA do aplique na arte — saem impressos nele. `naImagem` leva
   * do mm da folha da arte para o quadrado da imagem [0,1]².
   */
  textos?: { nos: NoCamada[]; naImagem: M }
}

/** Lote 6 (item 86): aplica uma afim num caminho SVG de comandos absolutos (M/L/Q/C/Z, como os do texto). */
export function transformarCaminho(d: string, m: M): string {
  return d.replace(/([MLQCZ])([^MLQCZ]*)/g, (_, cmd: string, nums: string) => {
    if (cmd === 'Z') return 'Z'
    const v = nums.trim().split(/[\s,]+/).filter(Boolean).map(Number), out: string[] = []
    for (let i = 0; i + 1 < v.length; i += 2) { const [x, y] = aplicar(m, v[i], v[i + 1]); out.push(String(Math.round(x * 1e4) / 1e4), String(Math.round(y * 1e4) / 1e4)) }
    return cmd + out.join(' ')
  })
}
/** Leva um nó (caminho, imagem ou grupo) para outro lugar pela afim `m`. */
export function transformarNo(no: NoCamada, m: M, sufixo: string): NoCamada {
  const id = `${no.id}${sufixo}`
  if (no.type === 'path') {
    // bboxMm de caminho = [x0, y0, x1, y1] (cantos), como o do texto
    const [x0, y0, x1, y1] = no.bboxMm
    const cs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([a, b]) => aplicar(m, a, b))
    const xs = cs.map(c => c[0]), ys = cs.map(c => c[1])
    return { ...no, id, d: transformarCaminho(no.d, m), bboxMm: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] } as NoCamada
  }
  if (no.type === 'group') return { ...no, id, children: no.children.map((c, i) => transformarNo(c, m, `${sufixo}:${i}`)) } as NoCamada
  if ((no as { matrix?: M }).matrix) return { ...no, id, matrix: compor(m, (no as { matrix: M }).matrix) } as NoCamada
  return { ...no, id }
}

/**
 * Os apliques do tema: camadas de imagem com `applique.enabled`, uma por face onde aparecem. Lote 6 (item 86): com
 * `texto` (fontes e valores do pedido), junta os textos que estão em cima de cada aplique para saírem impressos nele.
 */
export function acharApliques(d: DocTrabalho, tema: DocTema, texto?: NonNullable<Parameters<typeof resolverPrancheta>[2]>['texto']): ApliqueAchado[] {
  if (!(tema as { appliques?: { enabled?: boolean } }).appliques?.enabled) return []
  const geral = { ...APLIQUE_PADRAO, ...((tema as { appliques?: Partial<ConfigAplique> }).appliques ?? {}) }
  const marcadas = new Map<string, ConfigAplique>()
  const todas = [...Object.values(tema.partContent).flat(), ...Object.values(tema.faceContent ?? {}).flat()]
  for (const c of todas) if (c.type === 'image' && c.applique?.enabled) marcadas.set(c.id, { borderMm: c.applique.borderMm ?? geral.borderMm, borderColor: c.applique.borderColor ?? geral.borderColor, silhouetteMm: c.applique.silhouetteMm ?? geral.silhouetteMm })
  if (!marcadas.size) return []
  const out: ApliqueAchado[] = []
  for (const ab of d.artboards) {
    const nos = resolverPrancheta(d, ab.id, { tema, ...(texto ? { texto } : {}) })
    // os nós de TEXTO da prancheta (id começa no id da posição de texto)
    const slotDe = (id: string) => d.textSlots.find(s => id === s.id || id.startsWith(`${s.id}:`))
    const textosAb = texto ? nos.filter(n => !!slotDe(n.id)) : []
    for (const no of nos) {
      if (no.type !== 'image' || !no.matrix) continue
      const [faceId, ...resto] = no.id.split(':')
      const layerId = resto[0] === 'x' ? resto[1] : resto[0]
      const cfg = marcadas.get(layerId)
      if (!cfg || no.id.endsWith(':sobra')) continue
      const m = d.molds.find(mm => mm.faces.some(f => f.id === faceId))
      if (!m) continue
      const [a, b, c, dd] = no.matrix
      // textos desta face com o centro dentro do aplique (no quadrado da imagem)
      const N = inversa(no.matrix as M)
      const sobre = textosAb.filter(t => {
        if (slotDe(t.id)?.faceId !== faceId) return false
        const bb = (t as { bboxMm?: [number, number, number, number] }).bboxMm
        if (!bb) return false
        const [u, v] = aplicar(N, (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2)   // [x0, y0, x1, y1]
        return u >= 0 && u <= 1 && v >= 0 && v <= 1
      })
      out.push({ id: `${faceId}:${layerId}`, layerId, faceId, moldeId: m.id, moldeNome: m.name, src: no.src, wMm: Math.hypot(a, b), hMm: Math.hypot(c, dd), cfg,
        ...(sobre.length ? { textos: { nos: sobre, naImagem: N } } : {}) })
    }
  }
  return out
}

/** Peça pronta para a folha: contornos (mm, origem no canto da imagem) já calculados. */
export interface PecaAplique extends ApliqueAchado { borda: Pt[][]; silhueta: Pt[][] }

export interface Folhas {
  wMm: number; hMm: number
  impressos: NoCamada[]; silhuetas: NoCamada[]
  colocadas: { id: string; x: number; y: number }[]
  sobraram: string[]
}

const ROTULO_MM = 3.2, ESPACO_ROTULO = 1

/** Texto (rótulo do molde) como caminho vetorial em mm, com a linha de base em (x, y). */
export function rotuloEmCaminho(f: FonteHB, texto: string, x: number, y: number, alturaMm: number): { d: string; largura: number } {
  const s = alturaMm / ((f.ascender - f.descender) || f.upem)
  let cx = 0, d = ''
  for (const g of moldar(f, texto)) {
    const ox = cx + g.xOff, oy = g.yOff
    d += paraSvg(f.contorno(g.gid), (gx, gy) => [x + (ox + gx) * s, y - (oy + gy) * s])
    cx += g.xAdv
  }
  return { d, largura: cx * s }
}

/**
 * Organiza as peças e monta as camadas das duas folhas. `obstaculos` = zonas da marca de registro (mm
 * da folha). Peças iguais nas duas folhas (mesmo x, y): o corte cai certinho em volta da impressão.
 */
export function montarFolhas(pecas: PecaAplique[], folha: { wMm: number; hMm: number }, o: { obstaculos?: Ret[]; fonte?: FonteHB | null; espacoMm?: number; margemMm?: number } = {}): Folhas {
  const caixas = new Map<string, { x0: number; y0: number; x1: number; y1: number; topo: number }>()
  for (const p of pecas) {
    const cs = [caixaDosAneis(p.silhueta.length ? p.silhueta : [[[0, 0], [p.wMm, p.hMm]]]), caixaDosAneis(p.borda.length ? p.borda : [[[0, 0], [p.wMm, p.hMm]]])]
    const x0 = Math.min(0, ...cs.map(c => c.x0)), y0 = Math.min(0, ...cs.map(c => c.y0))
    const x1 = Math.max(p.wMm, ...cs.map(c => c.x1)), y1 = Math.max(p.hMm, ...cs.map(c => c.y1))
    const rot = o.fonte ? ROTULO_MM + ESPACO_ROTULO : 0
    caixas.set(p.id, { x0, y0: y0 - rot, x1, y1, topo: y0 })
  }
  const r = organizar(pecas.map(p => { const c = caixas.get(p.id)!; return { id: p.id, w: c.x1 - c.x0, h: c.y1 - c.y0 } }), folha.wMm, folha.hMm, { espacoMm: o.espacoMm ?? 2, margemMm: o.margemMm ?? 5, obstaculos: o.obstaculos })
  const base = { visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal' as const, clip: false }
  const impressos: NoCamada[] = [], silhuetas: NoCamada[] = [], colocadas: Folhas['colocadas'] = []
  const r3 = (v: number) => Math.round(v * 1000) / 1000
  for (const c of r.colocadas) {
    const p = pecas.find(x => x.id === c.id)!, cx = caixas.get(c.id)!
    // canto superior esquerdo da IMAGEM na folha
    const ix = r3(c.x - cx.x0), iy = r3(c.y - cx.y0)
    colocadas.push({ id: p.id, x: ix, y: iy })
    if (o.fonte) {
      const t = rotuloEmCaminho(o.fonte, p.moldeNome, 0, 0, ROTULO_MM)
      const tx = ix + (cx.x0 + cx.x1) / 2 - t.largura / 2, ty = iy + cx.topo - ESPACO_ROTULO
      const lab = rotuloEmCaminho(o.fonte, p.moldeNome, tx, ty - ROTULO_MM * 0.22, ROTULO_MM)
      impressos.push({ ...base, id: `apl:${p.id}:rotulo`, name: p.moldeNome, type: 'path', d: lab.d, color: '#1f2937', bboxMm: [r3(tx), r3(ty - ROTULO_MM), r3(t.largura), ROTULO_MM * 1.3] } as NoCaminho)
    }
    if (p.cfg.borderMm > 0 && p.borda.length) {
      const b = caixaDosAneis(p.borda)
      impressos.push({ ...base, id: `apl:${p.id}:borda`, name: 'Bordinha', type: 'path', d: caminhoDosAneis(p.borda, ix, iy), color: p.cfg.borderColor, bboxMm: [r3(b.x0 + ix), r3(b.y0 + iy), r3(b.x1 - b.x0), r3(b.y1 - b.y0)] } as NoCaminho)
    }
    impressos.push({ ...base, id: `apl:${p.id}:img`, name: p.moldeNome, type: 'image', src: p.src, xMm: 0, yMm: 0, wMm: 1, hMm: 1, rotationDeg: 0, matrix: [r3(p.wMm), 0, 0, r3(p.hMm), ix, iy] } as NoImagem)
    // Lote 6 (item 86): o NOME (e outros textos) que fica em cima do aplique sai impresso nele
    if (p.textos) {
      const L = compor([p.wMm, 0, 0, p.hMm, ix, iy], p.textos.naImagem)
      p.textos.nos.forEach((t, i) => impressos.push(transformarNo({ ...t, clip: false } as NoCamada, L, `:apl:${p.id}:${i}`)))
    }
    if (p.silhueta.length) {
      const s = caixaDosAneis(p.silhueta)
      silhuetas.push({ ...base, id: `apl:${p.id}:sil`, name: `Silhueta ${p.moldeNome}`, type: 'path', d: caminhoDosAneis(p.silhueta, ix, iy), color: '#000000', bboxMm: [r3(s.x0 + ix), r3(s.y0 + iy), r3(s.x1 - s.x0), r3(s.y1 - s.y0)] } as NoCaminho)
    }
  }
  return { wMm: folha.wMm, hMm: folha.hMm, impressos, silhuetas, colocadas, sobraram: r.sobraram }
}
