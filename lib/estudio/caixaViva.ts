// SOA Design — CAIXA VIVA (Fase 3 da spec): FACA (BoxTemplate) com regiões semânticas em polígono normalizado →
// BOX INSTANCE = arte planificada + faces + apliques + saídas, tudo por REFERÊNCIA (nada achatado). Renderizar é sempre
// a partir do estado atual da instância: mudou a arte/aplique/posição → toda saída que a usa sai atualizada.
// Pipeline: ARTE PLANIFICADA → EXTRAÇÃO DA FACE (polígono, em pé) → WARP na superfície do mockup (Milk.frente →
// MockupMilk.frente, por identidade) → realismo → APLIQUES (na perspectiva da face, SEM recorte) → OCLUSÃO.
import { comporAreas, aplicarOclusao, uvParaFoto, proporcaoDaArea, type Pt, type SmartArea, type TransformArte, type MockupAreas } from './mockupFoto'
import { casarArte } from './vinculo'
import { distorcer } from './transform'
import type { FaceMolde, FaceRole } from './caixasTipos'

export type TipoFace = 'frente' | 'verso' | 'lateral_esquerda' | 'lateral_direita' | 'tampa' | 'fundo' | 'alca' | 'aba' | 'outro'
export const TIPOS_FACE: { id: TipoFace; nome: string; papel?: FaceRole }[] = [
  { id: 'frente', nome: 'Frente', papel: 'frente' }, { id: 'verso', nome: 'Verso', papel: 'tras' },
  { id: 'lateral_esquerda', nome: 'Lateral esquerda', papel: 'lateral_esquerda' }, { id: 'lateral_direita', nome: 'Lateral direita', papel: 'lateral_direita' },
  { id: 'tampa', nome: 'Tampa', papel: 'cima' }, { id: 'fundo', nome: 'Fundo', papel: 'fundo' },
  { id: 'alca', nome: 'Alça' }, { id: 'aba', nome: 'Aba de colagem' }, { id: 'outro', nome: 'Outra' },
]
export const nomeFace = (t: TipoFace) => TIPOS_FACE.find(x => x.id === t)?.nome || t

export interface RegiaoFaca {
  id: string; templateId?: string; name: string; faceType: TipoFace
  /** polígono na faca, normalizado (0…1) */
  polygonPoints: Pt[]
  /** giro (°) para a face ficar EM PÉ */
  rotation: 0 | 90 | 180 | 270
  /** false = faz parte da faca, mas não aparece no mockup (aba de colagem) */
  renderable: boolean
  enabled: boolean
  /** 'ia_sugerido' até a pessoa confirmar (aí vira determinístico) */
  origem?: 'ia_sugerido' | 'confirmado' | 'manual'
  confianca?: number
}
export interface BoxTemplate { id: string; nome: string; versao?: number; modelo?: string | null; facaUrl?: string | null; largura: number; altura: number; regioes: RegiaoFaca[]; config: { medidas?: { l: number; p: number; a: number }; mockupId?: string | null } }
export interface ApliqueNaCaixa { id: string; apliqueId: string; anchorFace: string | null; u: number; v: number; escala: number; rot: number; z: number }
export interface SaidaCaixa { id: string; nome: string; cenaId: string; canal: string; formato: 'jpg' | 'png' }
export interface BoxInstancia {
  id: string; nome: string; boxTemplateId: string; mockupId: string | null; artworkUrl: string | null
  /** por região: ajuste da arte na face e se aparece */
  faces: Record<string, { transform?: TransformArte; oculta?: boolean; area?: string | null }>
  apliques: ApliqueNaCaixa[]
  saidas: SaidaCaixa[]
  config: Record<string, unknown>
}

/** Recorta a região da arte planificada (polígono) e deixa a face EM PÉ (rotation). */
export function extrairFace(plan: HTMLCanvasElement, r: RegiaoFaca): HTMLCanvasElement {
  const W = plan.width, H = plan.height, P = r.polygonPoints.map(p => ({ x: p.x * W, y: p.y * H }))
  const x0 = Math.floor(Math.min(...P.map(p => p.x))), y0 = Math.floor(Math.min(...P.map(p => p.y)))
  const x1 = Math.ceil(Math.max(...P.map(p => p.x))), y1 = Math.ceil(Math.max(...P.map(p => p.y)))
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')!
  g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p.x - x0, p.y - y0) : g.moveTo(p.x - x0, p.y - y0))); g.closePath(); g.clip()
  g.drawImage(plan, -x0, -y0)
  if (!r.rotation) return c
  const q = r.rotation % 180 === 90, o = document.createElement('canvas'); o.width = q ? h : w; o.height = q ? w : h
  const go = o.getContext('2d')!
  go.translate(o.width / 2, o.height / 2); go.rotate((r.rotation * Math.PI) / 180); go.drawImage(c, -w / 2, -h / 2)
  return o
}

/** Nome "falado" da região (para casar com a face do mockup): nome dado ou o tipo. */
const rotuloRegiao = (r: RegiaoFaca) => `${r.name || ''} ${nomeFace(r.faceType)}`.trim()
/**
 * Vinculação semântica: para cada face (área) do mockup, qual região da faca a alimenta. Casa pela IDENTIDADE
 * (nome/tipo: "frente" ↔ "Frente", "lateral direita" ↔ lateral_direita), nunca pela posição. Escolha manual vence.
 */
export function vincularFaces(areas: SmartArea[], regioes: RegiaoFaca[], manual: Record<string, string | null> = {}): Record<string, string | null> {
  const vis = regioes.filter(r => r.enabled && r.renderable)
  const out: Record<string, string | null> = {}
  for (const a of areas) {
    if (a.oclusao) continue
    if (a.id in manual) { out[a.id] = manual[a.id]; continue }
    const c = casarArte(a.nome, vis.map(r => ({ id: r.id, nome: rotuloRegiao(r) })))
    out[a.id] = c.areaId && c.confianca >= 0.7 ? c.areaId : null
  }
  return out
}

/** Regiões → faces (papéis) do Kit de caixas: para montar a caixa 3D lisa da faca. */
export function facesDoTemplate(t: Pick<BoxTemplate, 'regioes'>): FaceMolde[] {
  const out: FaceMolde[] = []
  for (const r of t.regioes) {
    const papel = TIPOS_FACE.find(x => x.id === r.faceType)?.papel
    if (!papel || !r.enabled || !r.renderable || out.some(f => f.role === papel)) continue
    const xs = r.polygonPoints.map(p => p.x), ys = r.polygonPoints.map(p => p.y)
    out.push({ id: r.id, role: papel, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), rot: r.rotation, forma: 'retangulo' })
  }
  return out
}

/** Onde o aplique cai na foto: 4 cantos (na perspectiva da face — pode passar da borda da face). */
export function quadroDoAplique(area: SmartArea['area'], W: number, H: number, ap: ApliqueNaCaixa, aspecto: number): Pt[] {
  const prop = proporcaoDaArea(area, W, H)            // largura/altura da face
  const hw = ap.escala / 2, hh = (ap.escala * aspecto * prop) / 2
  const r = (ap.rot * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r)
  // gira no espaço "quadrado" da face (u em larguras, v em alturas × prop)
  const canto = (x: number, y: number) => { const yy = y / prop, rx = x * co - yy * si, ry = (x * si + yy * co) * prop; const p = uvParaFoto(area, ap.u + rx, ap.v + ry); return { x: p.x * W, y: p.y * H } }
  return [canto(-hw, -hh), canto(hw, -hh), canto(hw, hh), canto(-hw, hh)]
}

export interface ApliquePronto { composto: HTMLCanvasElement }
/**
 * Renderiza a instância no mockup: faces (arte extraída da planificada, esticada na superfície) → apliques (na
 * perspectiva da face âncora, por z) → oclusão. `base` opcional = imagem-base reduzida (prévia rápida).
 */
export function renderInstancia(p: {
  inst: BoxInstancia; tpl: BoxTemplate; plan: HTMLCanvasElement | null; mockup: { foto: HTMLCanvasElement; cfg: MockupAreas }
  apliques: Map<string, ApliquePronto>; base?: HTMLCanvasElement; faceCache?: Map<string, HTMLCanvasElement>
}): HTMLCanvasElement {
  const { inst, tpl, plan, mockup } = p
  const base = p.base || mockup.foto
  const manual: Record<string, string | null> = {}
  for (const [rid, f] of Object.entries(inst.faces || {})) if (f.area) manual[f.area] = rid
  const vinc = vincularFaces(mockup.cfg.areas, tpl.regioes, manual)
  const cache = p.faceCache || new Map<string, HTMLCanvasElement>()
  const faceDe = (rid: string) => { let c = cache.get(rid); if (!c && plan) { const r = tpl.regioes.find(x => x.id === rid); if (r) { c = extrairFace(plan, r); cache.set(rid, c) } } return c || null }
  const real = { ...mockup.cfg.real, ajuste: 'esticar' as const }   // a face da planificada É a superfície
  let out = comporAreas(base, { ...mockup.cfg, real }, a => { const rid = vinc[a.id]; return rid && !inst.faces?.[rid]?.oculta ? faceDe(rid) : null }, a => { const rid = vinc[a.id]; return rid ? inst.faces?.[rid]?.transform : undefined }, { adiarOclusao: true })
  // apliques: objeto à parte, por cima da caixa, SEM recorte na face
  const W = out.width, H = out.height
  const g = out.getContext('2d')!
  for (const ap of [...(inst.apliques || [])].sort((a, b) => a.z - b.z)) {
    const pr = p.apliques.get(ap.apliqueId)
    if (!pr) continue
    const area = mockup.cfg.areas.find(a => a.nome === ap.anchorFace && !a.oclusao) || mockup.cfg.areas.find(a => !a.oclusao)
    if (!area) continue
    const [tl, tr, br, bl] = quadroDoAplique(area.area, W, H, ap, pr.composto.height / pr.composto.width)
    const r = distorcer(pr.composto, pr.composto.width, pr.composto.height, { tipo: 'perspectiva', cols: 2, rows: 2, pontos: [tl, tr, bl, br] })
    g.drawImage(r.canvas, r.minX, r.minY, r.canvas.width / r.escala, r.canvas.height / r.escala)
  }
  out = aplicarOclusao(out, base, mockup.cfg.areas)
  return out
}
