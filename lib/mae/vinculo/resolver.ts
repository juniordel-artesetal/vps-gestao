// mae-vínculo — RESOLUÇÃO DO VÍNCULO (Sprint 6, o coração do MAE). Transforma base + tema na ÁRVORE DE
// CAMADAS que o motor da Sprint 2 desenha (o motor não muda), uma por prancheta:
//   para cada face com parte: [forma da face (com os furos)] + [camadas da parte com os ajustes "Só
//   nesta caixa" desta face, recortadas pela forma] + [camadas exclusivas da face];
//   faces sem parte (abas): o papel das abas.
// Ordem da spec: camadas da parte → ajustes locais → enquadramento (referência → face) → recorte pelo
// polígono → camadas exclusivas da face. (Texto, efeitos e sobra entram nas Sprints 7, 8 e 9.)
import type { DocTema, DocTrabalho, NoCamada, NoImagem } from '../schema'
import { matrizDoMolde } from '../editor/giroMolde'
import { area, centroide, dentro, distBorda, type Pt } from '../faces/geometria'
import { quadroDaFace, type Quadro } from './enquadramento'
import { compor, escalar, girar, transladar, aplicar, type M } from './matriz'
import { noDoTexto, valorDaVariavel, ESTILO_PADRAO, type InfoTexto, type RegistroFontes } from '../texto/noTexto'
import { limparEfeitos } from '../schema/efeitos'
import { formaEmCmds } from '../edicao/formas'
import { regioesDeImpressao, fatorParaCobrir } from '../exportar/sobra'
import type { NoCaminho } from '../schema'
import { noMoldura } from './moldura'

type Doc = DocTrabalho
type CamadaTema = DocTema['partContent'][string][number]
export type CamadaImagemTema = Extract<CamadaTema, { type: 'image' }>
export type CamadaFormaTema = Extract<CamadaTema, { type: 'shape' }>
export interface Transf { x: number; y: number; scale: number; rotationDeg: number; scaleY?: number; skewXDeg?: number; flipX?: boolean; flipY?: boolean }
/** Ajuste "Só nesta caixa" de UMA camada numa face: só as propriedades sobrescritas. */
export interface AjusteLocal { transform?: Partial<Transf>; visible?: boolean; path?: string; sha256?: string; aspect?: number }

export interface Imagem { path: string; sha256: string; aspect: number }
export interface OpcoesResolver {
  tema?: DocTema | null
  /** Modo base: papel quadriculado de teste por parte (Sprint 5). */
  gradeDaParte?: (partId: string, aspect: number) => Imagem | null
  /** Cor da face por baixo do conteúdo. */
  corFace?: string
  /** Sprint 7: textos nas posições da base (NOME, IDADE, HASHTAG…) com o estilo do tema. */
  texto?: { fontes: RegistroFontes; valores: Record<string, string>; aoDiagramar?: (i: InfoTexto) => void }
  /**
   * Sprint 9: 'tela' e 'aprovacao' recortam exatamente pela face; 'impressao' recorta pelo polígono
   * EXPANDIDO pela sobra (menos as faces vizinhas) e põe o papel de fundo ampliado por baixo, para a
   * sobra ficar coberta sem mudar nada dentro da face.
   */
  modo?: 'tela' | 'aprovacao' | 'impressao'
  sobraMm?: number
  /**
   * Lote 4 (item 47): o APLIQUE 3D não sai impresso na caixa — só nas folhas de aplique. A exportação da caixa
   * liga isto; a tela e as folhas de aplique (que acham os apliques por aqui) não.
   */
  semApliques?: boolean
  /**
   * Lote 4 (item 21): nós que entram DEPOIS das faces e ANTES dos elementos que vazam e dos textos — a
   * exportação põe aqui as linhas de corte/dobra e a identidade, para o elemento "pode vazar" ficar por cima
   * da linha do molde.
   */
  depoisDasFaces?: NoCamada[]
}

const T_PADRAO: Transf = { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 }

/** Camada efetiva numa face: a da parte + o ajuste local (só o que foi sobrescrito). */
export function efetiva<T extends CamadaTema>(c: T, aj?: AjusteLocal): T {
  if (!aj) return c
  const out = { ...c, transform: { ...T_PADRAO, ...(c.transform ?? {}), ...(aj.transform ?? {}) } } as T
  if (aj.visible !== undefined) out.visible = aj.visible
  if (c.type === 'image') {
    const o = out as CamadaImagemTema
    if (aj.path) { o.path = aj.path; o.sha256 = aj.sha256; if (aj.aspect) o.aspect = aj.aspect }
  }
  return out
}

/** Ajustes locais de uma face (do tema). */
export function ajustesDaFace(tema: DocTema | null | undefined, faceId: string): Record<string, AjusteLocal> {
  return ((tema?.localOverrides ?? {})[faceId] ?? {}) as Record<string, AjusteLocal>
}

/**
 * Matriz do quadrado unitário da imagem → mm do molde.
 * Âncora "papel": centro em (x·A, y) no espaço da parte; o tamanho padrão COBRE o retângulo A × 1.
 * Âncora "face": centro em (x, y) do quadro da face; largura = scale × largura da face.
 */
export function matrizDaCamada(c: { anchor?: 'face' | 'paper'; aspect?: number; transform?: Partial<Transf> }, q: Quadro, A: number): M {
  const t = { ...T_PADRAO, ...(c.transform ?? {}) }
  const asp = c.aspect && c.aspect > 0 ? c.aspect : 1
  // Sprint 10: altura independente (scaleY), inclinar e espelhar — no espaço já girado da camada
  const forma = (w: number, h: number): M => compor(
    t.skewXDeg ? [1, 0, Math.tan((t.skewXDeg * Math.PI) / 180), 1, 0, 0] : [1, 0, 0, 1, 0, 0],
    escalar(w * (t.flipX ? -1 : 1), h * (t.scaleY ?? 1) * (t.flipY ? -1 : 1)), transladar(-0.5, -0.5))
  if ((c.anchor ?? 'face') === 'paper') {
    const w = Math.max(A, asp) * t.scale, h = w / asp
    return compor(q.papel, transladar(t.x * A, t.y), girar(t.rotationDeg), forma(w, h))
  }
  const [cx, cy] = aplicar(q.face, t.x, t.y)
  const w = t.scale * q.w, h = w / asp
  return compor(transladar(cx, cy), girar(q.rot + t.rotationDeg), forma(w, h))
}

/** Anéis da face: contorno + os furos que estão dentro dela. */
function aneis(face: Pt[], furos: Pt[][]): Pt[][] {
  return [face, ...furos.filter(h => dentro(centroide(h), face) && area(h) < area(face))]
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4

/** Papel (âncora papel) de imagem ou cor sólida — fica no "fundo" da face, abaixo dos elementos. */
export function ehCamadaDePapel(c: { type: string; anchor?: string }): boolean {
  return (c.type === 'image' || c.type === 'solid') && (c.anchor ?? 'face') === 'paper'
}

/** Máscara, ajustes (Sprint 10) do tema → nó do motor; a máscara anda com a matriz da camada. */
function extrasEdicao(c: CamadaTema, matriz: M): Pick<NoImagem, 'mask' | 'adjustments'> {
  const out: Pick<NoImagem, 'mask' | 'adjustments'> = {}
  const aj = (c.adjustments ?? []).filter(a => a.enabled !== false)
  if (aj.length) out.adjustments = aj
  const m = c.mask
  if (m && m.enabled !== false && (m.gradient || m.raster)) {
    const mt = matriz.map(r4) as M
    out.mask = {
      enabled: true, invert: !!m.invert, featherMm: m.featherMm ?? 0,
      ...(m.gradient ? { gradient: { ...m.gradient, matrix: mt } } : {}),
      ...(m.raster ? { raster: { src: { path: m.raster.path, sha256: m.raster.sha256 }, matrix: mt } } : {}),
    }
  }
  return out
}

function noImagem(id: string, c: CamadaImagemTema, matriz: M): NoImagem {
  const efs = limparEfeitos(c.effects)
  return {
    ...(efs.length ? { effects: efs } : {}),
    ...extrasEdicao(c, matriz),
    ...(c.warp ? { warp: c.warp } : {}),
    id, name: c.name ?? 'Imagem', visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal', clip: true,
    type: 'image', src: { path: c.path, sha256: c.sha256 ?? c.path },
    xMm: 0, yMm: 0, wMm: 1, hMm: 1, rotationDeg: 0, matrix: matriz.map(r4) as M,
  }
}

/** Forma vetorial (Sprint 10) → caminho em mm da folha (o mesmo caminho na tela e no arquivo). */
export function noForma(id: string, c: CamadaFormaTema, matriz: M): NoCaminho | null {
  const cmds = formaEmCmds(c.kind, c.params)
  if (!cmds.length) return null
  const xs: number[] = [], ys: number[] = []
  const p = (x: number, y: number) => { const [a, b] = aplicar(matriz, x, y); xs.push(a); ys.push(b); return `${r4(a)} ${r4(b)}` }
  const d = cmds.map(k => k[0] === 'Z' ? 'Z' : k[0] === 'C' ? `C${p(k[1], k[2])} ${p(k[3], k[4])} ${p(k[5], k[6])}` : k[0] === 'Q' ? `Q${p(k[1], k[2])} ${p(k[3], k[4])}` : `${k[0]}${p(k[1], k[2])}`).join('')
  const efs = limparEfeitos(c.effects)
  const sw = c.stroke ? c.stroke.widthMm / 2 : 0
  const linha = c.kind === 'line'
  return {
    ...(efs.length ? { effects: efs } : {}),
    ...extrasEdicao(c, matriz),
    id, name: c.name ?? 'Forma', visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal', clip: true,
    type: 'path', d, color: c.fill ?? '#000000',
    ...(c.fill === null || linha ? { fillNone: true } : {}),
    ...(c.stroke ? { stroke: c.stroke } : linha ? { stroke: { color: c.fill ?? '#000000', widthMm: 0.5 } } : {}),
    // caixa = [x0, y0, x1, y1] (Lote 3, item 32: antes ia largura/altura e os Estilos da camada cortavam a forma)
    bboxMm: [Math.min(...xs) - sw, Math.min(...ys) - sw, Math.max(...xs) + sw, Math.max(...ys) + sw].map(r4) as [number, number, number, number],
  }
}

/** Camada do tema → nó do motor (imagem, forma, cor, moldura); texto entra pelas posições da base. */
function noDaCamada(id: string, c: CamadaTema, matriz: M, face?: { poly: Pt[]; origem: [number, number] }): NoCamada | null {
  const no = noDaCamadaSemOpacidade(id, c, matriz, face)
  // Lote 3: opacidade da camada do tema
  const op = (c as { opacity?: number }).opacity
  return no && op !== undefined && op < 1 ? { ...no, opacity: Math.max(0, op) } : no
}

/**
 * Lote 3 (item 29): papel em PADRÃO REPETIDO — azulejos de `sizeMm` (mm da folha) cobrindo a face com folga
 * (a sobra da impressão também fica coberta); espelhados alternadamente se `mirror`. O recorte na face é o
 * do grupo da face, como qualquer papel. Volta um grupo com as imagens (efeitos/máscara ficam no grupo).
 */
export function azulejos(c: CamadaImagemTema & { repeat: NonNullable<CamadaImagemTema['repeat']> }, poly: Pt[], origem: [number, number], folgaMm = 40): { matrix: M; flipX: boolean; flipY: boolean }[] {
  const w = c.repeat.sizeMm, h = w / (c.aspect ?? 1)
  const xs = poly.map(p => p[0] + origem[0]), ys = poly.map(p => p[1] + origem[1])
  const x0 = Math.min(...xs) - folgaMm, x1 = Math.max(...xs) + folgaMm, y0 = Math.min(...ys) - folgaMm, y1 = Math.max(...ys) + folgaMm
  // o padrão começa no canto da face (+ deslocamento), igual em todas as faces da parte
  const ox = Math.min(...xs) + (c.repeat.offsetXMm ?? 0), oy = Math.min(...ys) + (c.repeat.offsetYMm ?? 0)
  const i0 = Math.floor((x0 - ox) / w), i1 = Math.ceil((x1 - ox) / w), j0 = Math.floor((y0 - oy) / h), j1 = Math.ceil((y1 - oy) / h)
  const out: { matrix: M; flipX: boolean; flipY: boolean }[] = []
  if ((i1 - i0) * (j1 - j0) > 4000) return out   // azulejo pequeno demais para a face: não desenha um mosaico gigante
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
    const fx = !!c.repeat.mirror && Math.abs(i) % 2 === 1, fy = !!c.repeat.mirror && Math.abs(j) % 2 === 1
    const x = ox + i * w, y = oy + j * h
    out.push({ matrix: [fx ? -w : w, 0, 0, fy ? -h : h, fx ? x + w : x, fy ? y + h : y].map(r4) as M, flipX: fx, flipY: fy })
  }
  return out
}

function noDaCamadaSemOpacidade(id: string, c: CamadaTema, matriz: M, face?: { poly: Pt[]; origem: [number, number] }): NoCamada | null {
  if (c.type === 'image' && c.repeat && face) {
    const base = noImagem(id, c, matriz)
    const { effects, mask, adjustments, ...semExtras } = base
    void mask
    const tiles = azulejos(c as never, face.poly, face.origem).map((t, k) => ({ ...semExtras, clip: false, id: `${id}:az${k}`, name: `${base.name} (padrão)`, matrix: t.matrix }))
    return {
      id, name: `${base.name} (padrão)`, visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal', clip: true,
      type: 'group', passThrough: false, children: tiles,
      ...(effects?.length ? { effects } : {}), ...(adjustments?.length ? { adjustments } : {}),
    } as NoCamada
  }
  if (c.type === 'image') return noImagem(id, c, matriz)
  if (c.type === 'shape') return noForma(id, c, matriz)
  if (c.type === 'solid') {
    // cor sólida = um papel liso: retângulo no quadrado da camada, que (âncora papel) cobre a face toda
    const no = noForma(id, { id: c.id, type: 'shape', kind: 'rect', params: { radius: 0, sides: 4, inner: 0.5 }, fill: c.color, stroke: null, aspect: 1, anchor: c.anchor, effects: c.effects, mask: c.mask, adjustments: c.adjustments, name: c.name ?? 'Cor' }, matriz)
    return no
  }
  if (c.type === 'frame') {
    if (!face) return null
    const no = noMoldura(id, c.name ?? 'Moldura', face.poly, face.origem, { offsetMm: c.offsetMm, widthMm: c.widthMm, dash: c.dash, cornerMm: c.cornerMm, color: c.color })
    if (!no) return null
    const efs = limparEfeitos(c.effects)
    return { ...no, ...(efs.length ? { effects: efs } : {}) }
  }
  return null
}

/** Amplia uma matriz em volta de um ponto (mm) — o "papel por baixo" da sobra na impressão. */
const ampliar = (m: M, cx: number, cy: number, f: number): M => compor(transladar(cx, cy), escalar(f), transladar(-cx, -cy), m)

/** Lote 4 (item 51): junta a camada recortada à de baixo — um grupo (base + recortadas) no lugar da base. */
function comRecorte(base: NoCamada, recortada: NoCamada): NoCamada & { type: 'group' } {
  if (base.type === 'group' && base.id.endsWith(':recortes')) return { ...base, children: [...base.children, { ...recortada, clip: true }] }
  return { id: `${base.id}:recortes`, name: base.name, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: base.clip,
    type: 'group', passThrough: true, children: [{ ...base, clip: false }, { ...recortada, clip: true }] } as NoCamada & { type: 'group' }
}

/** Lote 4 (item 51): texto com a textura ("Preencher com papel") cobrindo a caixa do texto, recortada nele. */
export function comTextura(no: NoCamada, estilo: { textura?: { path: string; sha256?: string; aspect?: number; scale?: number; dx?: number; dy?: number } }, slotId: string): NoCamada {
  const tx = estilo.textura
  if (!tx || no.type !== 'path') return no
  const [x0, y0, x1, y1] = no.bboxMm
  const w = Math.max(0.1, x1 - x0), h = Math.max(0.1, y1 - y0), s = tx.scale ?? 1, A = tx.aspect || 1
  let tw = w * s, th = tw / A
  if (th < h * s) { th = h * s; tw = th * A }
  const cx = (x0 + x1) / 2 + (tx.dx ?? 0) * w, cy = (y0 + y1) / 2 + (tx.dy ?? 0) * h
  const img: NoImagem = { id: `${slotId}:textura`, name: 'Textura', visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal', clip: true,
    type: 'image', src: { path: tx.path, sha256: tx.sha256 ?? tx.path }, xMm: 0, yMm: 0, wMm: 1, hMm: 1, rotationDeg: 0, matrix: [r4(tw), 0, 0, r4(th), r4(cx - tw / 2), r4(cy - th / 2)] }
  return { id: `${slotId}:com-textura`, name: no.name, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: no.clip,
    type: 'group', passThrough: true, children: [{ ...no, clip: false }, img] } as NoCamada
}

/** Lote 4 (item 21): o nó sai do grupo de recorte da face (inteiro, por cima da linha do molde). */
function semRecorte(no: NoCamada): NoCamada {
  const tira = (n: NoCamada): NoCamada => (n.type === 'group' ? { ...n, clip: false, children: n.children.map(tira) } : { ...n, clip: false })
  return { ...tira(no), id: `${no.id}:vaza` }
}

/** Lote 4 (item 47): camada marcada "É aplique 3D" num tema com apliques ligados (vai só para as folhas de aplique). */
export const ehAplique = (tema: DocTema | null | undefined, c: CamadaTema) =>
  !!(tema as { appliques?: { enabled?: boolean } } | null | undefined)?.appliques?.enabled && c.type === 'image' && !!(c as { applique?: { enabled?: boolean } }).applique?.enabled

const naFolhaDe = (T: M) => ([x, y]: Pt): [number, number] => { const [a, b] = aplicar(T, x, y); return [r4(a), r4(b)] }

/**
 * Lote 5 (item 68): cópia do papel de fundo (imagem ou COR sólida), ampliada em volta do centro do papel até
 * cobrir a região de impressão da face — fica por baixo do papel, então dentro da face nada muda. O id termina
 * em ":sobra" (ou é o id dado, com `idExato`) para vazar até a sobra.
 */
function copiaParaSobra(id: string, c: CamadaTema, matriz: M, pontos: Pt[], idExato = false): NoCamada | null {
  if (c.type !== 'image' && c.type !== 'solid') return null
  if (c.type === 'image' && c.repeat) return null   // padrão repetido já cobre a sobra (azulejos com folga)
  const fator = pontos.length ? fatorParaCobrir(matriz as never, pontos) : 1
  const [cx, cy] = aplicar(matriz, 0.5, 0.5)
  const semMascara = { ...c, mask: undefined } as CamadaTema
  return noDaCamada(idExato ? id : `${id}:sobra`, semMascara, fator > 1 ? ampliar(matriz, cx, cy, fator) : matriz)
}

/** A face vizinha (com papel) que mais encosta na face `e` — pela borda em comum; senão a mais próxima. */
function vizinhaComPapel<E extends { poly: Pt[] }>(e: E, cands: E[]): E | null {
  if (!cands.length) return null
  const p = e.poly
  let melhor: E | null = null, maior = 0
  for (const c of cands) {
    let comum = 0
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length]
      const meio: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      if (distBorda(meio, c.poly) < 0.6) comum += Math.hypot(b[0] - a[0], b[1] - a[1])
    }
    if (comum > maior) { maior = comum; melhor = c }
  }
  if (melhor) return melhor
  const [x, y] = centroide(p)
  return cands.reduce((a, c) => { const [u, v] = centroide(c.poly), [s, t] = centroide(a.poly); return Math.hypot(u - x, v - y) < Math.hypot(s - x, t - y) ? c : a })
}

/** Árvore de camadas de UMA prancheta (mm da prancheta). */
export function resolverPrancheta(d: Doc, artboardId: string, o: OpcoesResolver = {}): NoCamada[] {
  const out: NoCamada[] = []
  // Lote 4 (item 21): elementos com "Pode vazar da face" — inteiros, sem recorte, por cima de todas as faces
  const vazados: NoCamada[] = []
  const tema = o.tema ?? null
  const abas = tema?.overflowFill ?? d.smartArt?.flapFill ?? null
  const sobra = o.modo === 'impressao' ? Math.max(0, o.sobraMm ?? 10) : 0
  // Lote 5 (item 68): regiões de impressão de TODAS as faces da prancheta (contorno único + faixa dividida
  // entre as faces, sem sobreposição) — em mm da folha.
  const regioes = sobra ? regioesDeImpressao(d.molds.filter(m => m.artboardId === artboardId).flatMap(m => {
    const T = matrizDoMolde(m)
    return m.faces.map(f => ({ id: f.id, hole: f.hole, poly: (f.polygonMm as Pt[]).map(([x, y]) => aplicar(T, x, y) as Pt) }))
  }), sobra) : null
  interface Entrada { m: Doc['molds'][number]; f: Doc['molds'][number]['faces'][number]; poly: Pt[]; parte: Doc['parts'][number] | null; filhos: NoCamada[]; vazaDaFace: Set<string>; vazouAqui: number; fundo?: { c: CamadaTema; matriz: M } }
  const entradas: Entrada[] = []
  for (const m of d.molds) {
    if (m.artboardId !== artboardId) continue
    // Lote 4 (item 41): molde → folha com posição E giro (90° em 90°)
    const T = matrizDoMolde(m)
    const mmT = (mt: M): M => compor(T, mt)
    for (const f of m.faces) {
      if (f.hole) continue
      const poly = f.polygonMm as Pt[]
      const parte = d.parts.find(p => p.instances.some(i => i.faceId === f.id)) ?? null
      const e: Entrada = { m, f, poly, parte, filhos: [], vazaDaFace: new Set<string>(), vazouAqui: 0 }
      entradas.push(e)
      const { filhos, vazaDaFace } = e
      let ultimo = -1   // Lote 4 (item 51): a camada de baixo (para a máscara de corte)
      if (parte) {
        const inst = parte.instances.find(i => i.faceId === f.id)!
        const A = parte.referenceAspect ?? 1
        const q = quadroDaFace(poly, inst.fit, A)
        const lista: CamadaTema[] = tema ? (tema.partContent[parte.id] ?? []) : []
        const aj = ajustesDaFace(tema, f.id)
        if (!tema && o.gradeDaParte) {
          const g = o.gradeDaParte(parte.id, A)
          if (g) filhos.push(noImagem(`${f.id}:grade`, { id: 'grade', type: 'image', anchor: 'paper', path: g.path, sha256: g.sha256, aspect: g.aspect }, mmT(matrizDaCamada({ anchor: 'paper', aspect: g.aspect }, q, A))))
        }
        // ordem na face: papéis da parte → papéis só desta caixa (transição/cor local) → elementos da parte
        // → elementos só desta caixa. Antes os papéis da caixa iam por cima de TUDO da parte.
        const daCaixa = tema?.faceContent?.[f.id] ?? []
        let fimPapeis = 0
        while (fimPapeis < lista.length && ehCamadaDePapel(efetiva(lista[fimPapeis], aj[lista[fimPapeis].id]))) fimPapeis++
        const ordem: { c0: CamadaTema; caixa: boolean }[] = [
          ...lista.slice(0, fimPapeis).map(c0 => ({ c0, caixa: false })),
          ...daCaixa.filter(ehCamadaDePapel).map(c0 => ({ c0, caixa: true })),
          ...lista.slice(fimPapeis).map(c0 => ({ c0, caixa: false })),
          ...daCaixa.filter(c => !ehCamadaDePapel(c)).map(c0 => ({ c0, caixa: true })),
        ]
        let primeira = true
        for (const { c0, caixa } of ordem) {
          const c = caixa ? c0 : efetiva(c0, aj[c0.id])
          if (c.type === 'text' || c.visible === false) continue
          if (o.semApliques && ehAplique(tema, c)) continue
          const matriz = mmT(matrizDaCamada(c, q, A))
          const id = caixa ? `${f.id}:x:${c.id}` : `${f.id}:${c.id}`
          const no = noDaCamada(id, c, matriz, { poly: poly.map(naFolhaDe(T)), origem: [0, 0] })
          if (primeira && ehCamadaDePapel(c)) {
            e.fundo = { c, matriz }
            // impressão: o papel de fundo (imagem ou COR) ganha uma cópia ampliada por baixo, até cobrir a região
            const sob = sobra ? copiaParaSobra(id, c, matriz, regioes?.get(f.id)?.flat() ?? []) : null
            if (sob) filhos.push(sob)
          }
          primeira = false
          if (!no) continue
          if (!ehCamadaDePapel(c) && (c as { bleed?: boolean }).bleed) { vazados.push(semRecorte(no)); e.vazouAqui++; continue }
          // Lote 4 (item 51): máscara de corte — a camada só aparece dentro da de baixo (grupo: base + recortadas)
          if ((c as { recortada?: boolean }).recortada && ultimo >= 0) {
            const g = comRecorte(filhos[ultimo], no)
            if (vazaDaFace.has(filhos[ultimo].id)) vazaDaFace.add(g.id)
            filhos[ultimo] = g
            continue
          }
          filhos.push(no)
          ultimo = filhos.length - 1
          if (ehCamadaDePapel(c)) vazaDaFace.add(no.id)
        }
      }
      if (!filhos.length && !e.vazouAqui && abas && (tema || !parte)) {
        // aba, face sem parte ou parte sem conteúdo no tema: o papel das abas cobre a face (preencher)
        const A = 1
        const q = quadroDaFace(poly, { mode: 'cover' }, A)
        const c: CamadaImagemTema = { id: 'abas', type: 'image', anchor: 'paper', path: abas.path, sha256: abas.sha256, aspect: abas.aspect ?? 1 }
        const matriz = mmT(matrizDaCamada(c, q, A))
        const sob = sobra ? copiaParaSobra(`${f.id}:abas`, c, matriz, regioes?.get(f.id)?.flat() ?? []) : null
        if (sob) filhos.push(sob)
        filhos.push(noImagem(`${f.id}:abas`, c, matriz))
      }
    }
  }
  // Lote 5 (itens 68 e 63): aba SEM papel das abas no tema → continua o papel da face VIZINHA (a que mais
  // encosta nela) — nada fica branco dentro da linha de corte. A aba entra na região da vizinha: o papel é
  // desenhado UMA vez, cobrindo a face e as abas dela (e não uma cópia ampliada por aba).
  const abasDe = new Map<Entrada, Entrada[]>()
  if (tema && !abas) {
    for (const e of entradas) {
      if (e.filhos.length || e.vazouAqui || e.parte) continue
      const viz = vizinhaComPapel(e, entradas.filter(x => x.m === e.m && x !== e && x.fundo))
      if (!viz?.fundo) continue
      abasDe.set(viz, [...(abasDe.get(viz) ?? []), e])
    }
  }
  for (const e of entradas) {
    const { m, f, poly, filhos, vazaDaFace } = e
    if (!filhos.length) continue
    const naFolha = naFolhaDe(matrizDoMolde(m))
    const furos = m.faces.filter(x => x.hole).map(x => x.polygonMm as Pt[])
    // anéis: na tela/aprovação, a face exata; na impressão, a REGIÃO da face (face + a sua parte da faixa)
    const aneisDe = (x: Entrada): Pt[][] => sobra ? (regioes?.get(x.f.id) ?? []) : aneis(x.poly, furos).map(r => r.map(naFolhaDe(matrizDoMolde(x.m))))
    const minhasAbas = abasDe.get(e) ?? []
    const aneisFolha: Pt[][] = [...aneisDe(e), ...minhasAbas.flatMap(aneisDe)]
    if (minhasAbas.length && e.fundo) {
      // a cópia do papel de fundo passa a cobrir também as abas (troca a da sobra, se houver)
      const k = filhos.findIndex(n => n.id.endsWith(':sobra'))
      const idFundo = filhos.find(n => vazaDaFace.has(n.id))?.id ?? `${f.id}:fundo`
      const copia = copiaParaSobra(idFundo, e.fundo.c, e.fundo.matriz, aneisFolha.flat())
      if (copia) { if (k >= 0) filhos[k] = copia; else filhos.unshift(copia) }
    }
    out.push({
      id: `${f.id}:forma`, name: f.id, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false,
      type: 'shape', color: o.corFace ?? '#ffffff', rings: aneisFolha.filter(r => r.length >= 3).map(r => r.map(([x, y]) => [r4(x), r4(y)] as [number, number])),
    })
    if (!sobra && !minhasAbas.length) { out.push(...filhos); continue }
    // impressão (Lote 2, item 21) — e face com abas: só papéis/cores vazam; o resto fica no contorno EXATO da face
    const vaza = (n: NoCamada) => n.id.endsWith(':sobra') || n.id.endsWith(':abas') || n.id.endsWith(':grade') || vazaDaFace.has(n.id)
    out.push(...filhos.filter(vaza))
    const dentroDaFace = filhos.filter(n => !vaza(n))
    if (dentroDaFace.length) {
      out.push({
        id: `${f.id}:recorte`, name: `${f.id} (recorte)`, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false, clipOnly: true,
        type: 'shape', color: '#000000', rings: aneis(poly, furos).filter(r => r.length >= 3).map(r => r.map(naFolha)),
      }, ...dentroDaFace)
    }
  }
  if (o.depoisDasFaces?.length) out.push(...o.depoisDasFaces)
  out.push(...vazados)
  // textos por cima de tudo: um caminho por posição (na impressão, recortados no contorno da face)
  if (tema && o.texto) {
    for (const slot of d.textSlots) {
      const m = d.molds.find(mm => mm.artboardId === artboardId && mm.faces.some(f => f.id === slot.faceId))
      if (!m) continue
      const f = m.faces.find(x => x.id === slot.faceId)!
      const parte = d.parts.find(p => p.instances.some(i => i.faceId === f.id)) ?? null
      const inst = parte?.instances.find(i => i.faceId === f.id)
      const q = quadroDaFace(f.polygonMm as Pt[], inst?.fit, parte?.referenceAspect ?? 1)
      const estilo0 = tema.textStyles?.[slot.variable] ?? ESTILO_PADRAO
      const valor = valorDaVariavel(slot.variable, { ...(tema.sample ?? {}), ...o.texto.valores }, tema.hashtag?.middle ?? 'faz')
      // Lote 4 (item 50): nome composto com os SEUS efeitos (quando a usuária configurou)
      const efC = (estilo0 as { efeitosComposto?: unknown[] }).efeitosComposto
      const estilo = efC && valor.trim().split(/\s+/).filter(Boolean).length >= 2 ? { ...estilo0, effects: efC } as typeof estilo0 : estilo0
      const ef = posicaoEfetiva(slot, tema, o.texto.valores)
      const Tm = matrizDoMolde(m)
      const poly = (f.polygonMm as Pt[]).map(([x, y]) => aplicar(Tm, x, y) as Pt)
      const r = noDoTexto({ slotId: slot.id, variavel: slot.variable, valor, estilo, fontes: o.texto.fontes, quadro: compor(Tm, q.face), w: q.w, h: q.h, caixa: ef.caixa, cfg: ef.cfg, rotacaoDeg: ef.rotacaoDeg, face: { poly, nome: m.name } })
      if (!r) continue
      // Lote 4 (item 51): "Preencher com papel" — a textura recortada dentro do texto
      const noTexto = comTextura(r.no, estilo, slot.id)
      if (sobra) {
        // impressão (Lote 2, item 21): o texto fica recortado no contorno da face (não vaza com a sobra)
        const furosM = m.faces.filter(x => x.hole).map(x => x.polygonMm as Pt[]).filter(h => dentro(centroide(h), f.polygonMm as Pt[]))
        out.push({
          id: `${slot.id}:recorte`, name: `${slot.variable} (recorte)`, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false, clipOnly: true,
          type: 'shape', color: '#000000', rings: aneis(f.polygonMm as Pt[], furosM).filter(x => x.length >= 3).map(x => x.map(([px, py]) => { const [a, b] = aplicar(Tm, px, py); return [r4(a), r4(b)] as [number, number] })),
        }, { ...noTexto, clip: true })
      } else out.push(noTexto)
      o.texto.aoDiagramar?.({ ...r.info, artboardId })
    }
  }
  return out
}

type Slot = Doc['textSlots'][number]
/**
 * Posição de texto EFETIVA: tamanho = tema (todas as caixas) × "Só nesta caixa" × pedido (`_ESCALA_<VAR>`
 * nos valores); a caixa cresce em volta do centro junto com o tamanho da fonte (o nome fica maior de
 * verdade, em vez do auto-ajuste encolher de volta); deslocamento e giro da caixa.
 */
export function posicaoEfetiva(slot: Slot, tema: DocTema | null, valores: Record<string, string> = {}) {
  const aj = tema?.textSlotAdjust?.[slot.id] ?? {}
  const doPedido = Number(valores[`_ESCALA_${slot.variable}`])
  const s = (tema?.textStyles?.[slot.variable]?.sizeScale ?? 1) * (aj.scale ?? 1) * (Number.isFinite(doPedido) && doPedido > 0 ? doPedido : 1)
  // Lote 4 (item 50): nome simples × composto — cada modo com a sua posição; o pedido pode forçar 1 ou 2 linhas
  const valor = String(valores[slot.variable] ?? tema?.sample?.[slot.variable] ?? '')
  const forca = valores[`_LINHAS_${slot.variable}`]
  const composto = valor.trim().split(/\s+/).filter(Boolean).length >= 2
  const modo = composto ? slot.compound ?? slot.single : slot.single ?? slot.compound
  const b = slot.box
  const caixa = { x: b.x + b.w / 2 - (b.w * s) / 2 + (aj.dx ?? 0) + (modo?.dx ?? 0), y: b.y + b.h / 2 - (b.h * s) / 2 + (aj.dy ?? 0) + (modo?.dy ?? 0), w: b.w * s, h: b.h * s }
  const esc = <T extends { sizePt: number } | undefined>(c: T): T => (c ? { ...c, sizePt: c.sizePt * s } : c) as T
  let compound = esc(slot.compound)
  if (compound && (forca === '1' || forca === '2')) compound = { ...compound, lines: Number(forca) as 1 | 2 }
  return { escala: s, caixa, cfg: { ...slot, single: esc(slot.single), compound }, rotacaoDeg: (slot.rotationDeg ?? 0) + (tema?.textStyles?.[slot.variable]?.rotationDeg ?? 0) + (aj.rotationDeg ?? 0) }
}

/** Todos os arquivos (sha → caminho) que a resolução usa — para o motor carregar da Biblioteca. */
export function arquivosDaResolucao(nos: NoCamada[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const n of nos) {
    if (n.type === 'image') m.set(n.src.sha256, n.src.path)
    if (n.mask?.raster) m.set(n.mask.raster.src.sha256, n.mask.raster.src.path)
  }
  return m
}

/**
 * Miniatura da PARTE (painel de Partes): o espaço de referência da parte (A × 1) desenhado numa
 * "face" retangular de `alturaMm`, com o conteúdo vinculado (sem ajustes locais).
 */
export function miniaturaDaParte(tema: DocTema, partId: string, A: number, alturaMm = 30): { id: string; widthMm: number; heightMm: number; layers: NoCamada[] } {
  const w = Math.max(4, A * alturaMm), h = alturaMm
  const poly: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]]
  const q = quadroDaFace(poly, { mode: 'stretch' }, A)
  const layers: NoCamada[] = [{ id: 'forma', name: 'forma', visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false, type: 'shape', color: '#ffffff', rings: [poly] }]
  for (const c of tema.partContent[partId] ?? []) {
    if (c.type === 'text' || c.visible === false) continue
    const no = noDaCamada(`mini:${c.id}`, c, matrizDaCamada(c, q, A), { poly, origem: [0, 0] })
    if (no) layers.push(no)
  }
  return { id: `mini_${partId}`, widthMm: w, heightMm: h, layers }
}
