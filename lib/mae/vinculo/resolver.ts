// mae-vínculo — RESOLUÇÃO DO VÍNCULO (Sprint 6, o coração do MAE). Transforma base + tema na ÁRVORE DE
// CAMADAS que o motor da Sprint 2 desenha (o motor não muda), uma por prancheta:
//   para cada face com parte: [forma da face (com os furos)] + [camadas da parte com os ajustes "Só
//   nesta caixa" desta face, recortadas pela forma] + [camadas exclusivas da face];
//   faces sem parte (abas): o papel das abas.
// Ordem da spec: camadas da parte → ajustes locais → enquadramento (referência → face) → recorte pelo
// polígono → camadas exclusivas da face. (Texto, efeitos e sobra entram nas Sprints 7, 8 e 9.)
import { alinharCampos } from '../pedidos/camposDaBase'
import type { DocTema, DocTrabalho, NoCamada, NoImagem } from '../schema'
import { matrizDoMolde } from '../editor/giroMolde'
import { area, centroide, dentro, distBorda, type Pt } from '../faces/geometria'
import { quadroDaFace, type Quadro } from './enquadramento'
import { compor, escalar, girar, transladar, aplicar, type M } from './matriz'
import { noDoTexto, valorDaVariavel, estiloDaVariavel, fundoDoBloco, type InfoTexto, type RegistroFontes } from '../texto/noTexto'
import { idadeNumero, textoDoBloco, comNomeDividido } from '../texto/variaveis'
import { limparEfeitos } from '../schema/efeitos'
import { formaEmCmds } from '../edicao/formas'
import { regioesDeImpressao, fatorParaCobrir } from '../exportar/sobra'
import type { NoCaminho } from '../schema'
import { noMoldura } from './moldura'
import { arteDaFace, liderDoCenario } from './cenario'
import { ordemDaCaixa } from './ordem'
import { matrizDaPeca, aspectoDaPeca } from './conjunto'
import { contornoDaForma } from '../edicao/formas'

type Doc = DocTrabalho
type CamadaTema = DocTema['partContent'][string][number]
export type CamadaImagemTema = Extract<CamadaTema, { type: 'image' }>
export type CamadaFormaTema = Extract<CamadaTema, { type: 'shape' }>
export interface Transf { x: number; y: number; scale: number; rotationDeg: number; scaleY?: number; skewXDeg?: number; flipX?: boolean; flipY?: boolean }
/** Ajuste "Só nesta caixa" de UMA camada numa face: só as propriedades sobrescritas. */
/** Lote 5 (item 70): Preencher/Repetir (null = preencher só nesta caixa) e opacidade também por caixa. */
export interface RepeticaoLocal { sizeMm: number; mirror?: boolean; offsetXMm?: number; offsetYMm?: number }
export interface AjusteLocal {
  transform?: Partial<Transf>; visible?: boolean; path?: string; sha256?: string; aspect?: number; repeat?: RepeticaoLocal | null; opacity?: number
  /** Lote 9 (item 141): os estilos (efeitos) SÓ NESTA CAIXA — substituem os da camada nesta caixa. */
  effects?: unknown[]
}

export interface Imagem { path: string; sha256: string; aspect: number }
export interface OpcoesResolver {
  tema?: DocTema | null
  /** Modo base: papel quadriculado de teste por parte (Sprint 5). */
  gradeDaParte?: (partId: string, aspect: number) => Imagem | null
  /** Cor da face por baixo do conteúdo. */
  corFace?: string
  /** Sprint 7: textos nas posições da base (NOME, IDADE, HASHTAG…) com o estilo do tema. */
  texto?: { fontes: RegistroFontes; valores: Record<string, string>; aoDiagramar?: (i: InfoTexto) => void
    /** Lote 5 (item 76): valores de UMA posição de texto (folha que junta pedidos: cada peça com o nome do seu pedido). */
    valoresPorSlot?: Record<string, Record<string, string>> }
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
  /** Lote 9 (item 135): camadas do tema que NÃO entram (a que está sendo arrastada: a foto dela segue o mouse). */
  ocultarCamadas?: ReadonlySet<string>
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
  if (aj.opacity !== undefined) (out as { opacity?: number }).opacity = aj.opacity
  if (aj.effects !== undefined) (out as { effects?: unknown[] }).effects = aj.effects
  if (c.type === 'image') {
    const o = out as CamadaImagemTema
    if (aj.path) { o.path = aj.path; o.sha256 = aj.sha256; if (aj.aspect) o.aspect = aj.aspect }
    if (aj.repeat === null) delete o.repeat
    else if (aj.repeat) o.repeat = { ...(c.repeat ?? {}), ...aj.repeat }
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
export function matrizDaCamada(c: { anchor?: 'face' | 'paper'; aspect?: number; transform?: Partial<Transf>; presa?: { h: 'esq' | 'centro' | 'dir'; v: string; refW: number; refH: number } }, q: Quadro, A: number): M {
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
  // Lote 6 (item 92): camada PRESA (peças por medida) — tamanho pela ALTURA da peça e a distância medida a partir
  // do lado em que está presa: a arte é recomposta entre 9×5, 7×3 e 5×2,6 em vez de esticar
  if (c.presa && q.w > 0 && q.h > 0) {
    const k = q.h / c.presa.refH, W0 = c.presa.refW
    const u = c.presa.h === 'esq' ? (t.x * W0 * k) / q.w : c.presa.h === 'dir' ? 1 - ((1 - t.x) * W0 * k) / q.w : 0.5 + ((t.x - 0.5) * W0 * k) / q.w
    const [cx, cy] = aplicar(q.face, u, t.y)
    const w = t.scale * W0 * k, h = w / asp
    return compor(transladar(cx, cy), girar(q.rot + t.rotationDeg), forma(w, h))
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
  if (m && m.enabled !== false && (m.gradient || m.raster || m.forma)) {
    const mt = matriz.map(r4) as M
    out.mask = {
      enabled: true, invert: !!m.invert, featherMm: m.featherMm ?? 0,
      ...(m.gradient ? { gradient: { ...m.gradient, matrix: mt } } : {}),
      ...(m.raster ? { raster: { src: { path: m.raster.path, sha256: m.raster.sha256 }, matrix: mt } } : {}),
      ...(m.forma ? { forma: { aneis: m.forma.aneis, matrix: mt } } : {}),
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

/**
 * Lote 10 (itens 157/158): o CONJUNTO DE APLIQUE na arte — as peças empilhadas num grupo (move/gira como uma só).
 * Peça só recorte aparece na cor do material; peça impressa com papel dentro e/ou moldurinha afastada da borda.
 */
function noConjunto(id: string, c: Extract<CamadaTema, { type: 'conjunto' }>, matriz: M): NoCamada | null {
  const comum = { visible: true, opacity: 1, fill: 1, blendMode: 'normal' as const }
  const filhos: NoCamada[] = []
  for (const p of c.pecas) {
    const Mp = compor(matriz, matrizDaPeca(c.aspect ?? 1, p))
    const pid = `${id}:${p.id}`
    const partes: NoCamada[] = []
    if (p.imagem) {
      const img = noImagem(pid, { id: p.id, type: 'image', anchor: 'face', path: p.imagem.path, sha256: p.imagem.sha256, aspect: p.imagem.aspect } as CamadaImagemTema, Mp)
      partes.push(p.tipo === 'recorte' ? { ...img, effects: [{ type: 'colorOverlay', color: p.cor, opacity: 1, blendMode: 'normal', enabled: true }] } as NoCamada : img)
    } else if (p.forma) {
      const f = noForma(pid, { id: p.id, type: 'shape', kind: p.forma.kind, params: p.forma.params, fill: p.cor, stroke: null, aspect: aspectoDaPeca(p) } as CamadaFormaTema, Mp)
      if (f) partes.push(f)
    }
    if (!partes.length) continue
    if (p.papel && p.tipo === 'impressa') {
      // papel dentro da peça, cobrindo (sem deformar) e recortado nela
      const pa = p.papel.aspect ?? 1, ar = aspectoDaPeca(p)
      const sx = pa >= ar ? pa / ar : 1, sy = pa >= ar ? 1 : ar / pa
      partes.push({ ...noImagem(`${pid}:papel`, { id: `${p.id}_papel`, type: 'image', anchor: 'face', path: p.papel.path, sha256: p.papel.sha256, aspect: pa } as CamadaImagemTema, compor(Mp, [sx, 0, 0, sy, (1 - sx) / 2, (1 - sy) / 2])), clip: true } as NoCamada)
    }
    if (p.moldura && p.forma) {
      // Lote 10 (item 158): moldurinha DENTRO da peça, afastada da borda, acompanhando o formato
      const anel = contornoDaForma(p.forma.kind, p.forma.params)[0]
      if (anel) {
        const poly = anel.map(([u, v]) => { const [x, y] = aplicar(Mp, u, v); return [r4(x), r4(y)] as Pt })
        const no = noMoldura(`${pid}:moldura`, 'Moldurinha', poly, [0, 0], { offsetMm: p.moldura.offsetMm, widthMm: p.moldura.widthMm, dash: p.moldura.dash, cornerMm: 0, color: p.moldura.color })
        if (no) partes.push({ ...no, clip: true } as NoCamada)
      }
    }
    const base = { ...partes[0], clip: false } as NoCamada
    filhos.push(partes.length === 1 ? base : { ...comum, id: `${pid}:peca`, name: p.nome, locked: true, clip: false, type: 'group', passThrough: true, children: [base, ...partes.slice(1)] } as NoCamada)
  }
  if (!filhos.length) return null
  return { ...comum, id, name: c.name ?? 'Conjunto de aplique', locked: false, clip: true, type: 'group', passThrough: true, children: filhos } as NoCamada
}

/** Camada do tema → nó do motor (imagem, forma, cor, moldura); texto entra pelas posições da base. */
function noDaCamada(id: string, c: CamadaTema, matriz: M, face?: { poly: Pt[]; origem: [number, number] }): NoCamada | null {
  const no0 = noDaCamadaSemOpacidade(id, c, matriz, face)
  // Lote 6 (item 112): modo de mesclagem da camada do tema
  const bm = (c as { blendMode?: NoCamada['blendMode'] }).blendMode
  const no = no0 && bm && bm !== 'normal' ? { ...no0, blendMode: bm } as NoCamada : no0
  // Lote 3: opacidade da camada do tema
  const op = (c as { opacity?: number }).opacity
  // Lote 8 (item 131): opacidade do preenchimento — só o conteúdo (a opacidade da camada age no grupo inteiro, papel
  // dentro da forma incluído)
  const fo = (c as { fillOpacity?: number }).fillOpacity
  const comFill = no && fo !== undefined && fo < 1 && no.type !== 'group' ? { ...no, fill: Math.max(0, fo) } as NoCamada : no
  return comFill && op !== undefined && op < 1 ? { ...comFill, opacity: Math.max(0, op) } : comFill
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
  if (c.type === 'conjunto') return noConjunto(id, c, matriz)
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
  // Lote 10 (item 156): forma também pode ser aplique 3D
  !!(tema as { appliques?: { enabled?: boolean } } | null | undefined)?.appliques?.enabled && (c.type === 'conjunto' || ((c.type === 'image' || c.type === 'shape') && !!(c as { applique?: { enabled?: boolean } }).applique?.enabled))

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
  // Lote 9 (item 142): grupos ocultos (olho da pasta no Camadas) — as camadas e os textos deles não entram
  const gruposOcultos = (((o as { tema?: { grupos?: { parte: string; camadas: string[]; textos: string[]; visible?: boolean }[] } | null }).tema?.grupos) ?? []).filter(g => g.visible === false)
  const ocultasPorGrupo = new Set(gruposOcultos.flatMap(g => g.camadas))
  const textosOcultosPorGrupo = new Set(gruposOcultos.flatMap(g => g.textos.map(v => `${g.parte}|${v}`)))
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
  interface Entrada { m: Doc['molds'][number]; f: Doc['molds'][number]['faces'][number]; poly: Pt[]; parte: Doc['parts'][number] | null; filhos: NoCamada[]; vazaDaFace: Set<string>; vazouAqui: number; fundo?: { c: CamadaTema; matriz: M }
    /** Lote 10 (item 151): camadas que a usuária pôs ACIMA dos textos desta caixa (desenhadas depois deles). */
    sobreTextos: NoCamada[] }
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
      const e: Entrada = { m, f, poly, parte, filhos: [], vazaDaFace: new Set<string>(), vazouAqui: 0, sobreTextos: [] }
      entradas.push(e)
      const { filhos, vazaDaFace } = e
      let ultimo = -1   // Lote 4 (item 51): a camada de baixo (para a máscara de corte)
      if (parte) {
        // Lote 5 (item 66): cenário contínuo — a arte se enquadra no contorno das faces JUNTAS (cada face continua
        // recortada no seu contorno, então a arte atravessa a dobra sem emenda)
        // Lote 9 (item 136): fonte única com a interação (arteDaFace) — cenário: contorno das faces juntas, enquadramento,
        // parte e ajustes da face LÍDER
        const arte = arteDaFace(d, tema, m, f.id)!
        const A = arte.A
        const polyArte = arte.poligono
        const q = arte.quadro
        const parteArte = arte.parteArte ? d.parts.find(p => p.id === arte.parteArte) ?? parte : parte
        const faceArte = arte.faceArte
        const lista: CamadaTema[] = tema ? (tema.partContent[parteArte.id] ?? []) : []
        const aj = ajustesDaFace(tema, faceArte)
        if (!tema && o.gradeDaParte) {
          const g = o.gradeDaParte(parte.id, A)
          if (g) filhos.push(noImagem(`${f.id}:grade`, { id: 'grade', type: 'image', anchor: 'paper', path: g.path, sha256: g.sha256, aspect: g.aspect }, mmT(matrizDaCamada({ anchor: 'paper', aspect: g.aspect }, q, A))))
        }
        // ordem na face: papéis da parte → papéis só desta caixa (transição/cor local) → elementos da parte
        // → elementos só desta caixa. Antes os papéis da caixa iam por cima de TUDO da parte.
        const daCaixa = tema?.faceContent?.[faceArte] ?? []
        let fimPapeis = 0
        while (fimPapeis < lista.length && ehCamadaDePapel(efetiva(lista[fimPapeis], aj[lista[fimPapeis].id]))) fimPapeis++
        // Lote 6 (itens 87/84): a TRANSIÇÃO (2º papel com degradê) fica por cima de TODOS os papéis de fundo — da
        // parte e da caixa. Antes a transição da parte ficava debaixo do papel "só desta caixa" e não aparecia.
        const comTr = (c: CamadaTema) => !!(c as { transition?: unknown }).transition
        const papeisCaixa = daCaixa.filter(ehCamadaDePapel)
        const ordem: { c0: CamadaTema; caixa: boolean }[] = [
          ...lista.slice(0, fimPapeis).filter(c => !comTr(c)).map(c0 => ({ c0, caixa: false })),
          ...papeisCaixa.filter(c => !comTr(c)).map(c0 => ({ c0, caixa: true })),
          ...lista.slice(0, fimPapeis).filter(comTr).map(c0 => ({ c0, caixa: false })),
          ...papeisCaixa.filter(comTr).map(c0 => ({ c0, caixa: true })),
          ...lista.slice(fimPapeis).map(c0 => ({ c0, caixa: false })),
          ...daCaixa.filter(c => !ehCamadaDePapel(c)).map(c0 => ({ c0, caixa: true })),
        ]
        // Lote 10 (item 151): a ordem que a usuária deu nesta caixa (entre listas e em relação aos textos)
        const ordFace = tema?.ordemFace?.[faceArte]
        const od = ordemDaCaixa(ordem.map(x => x.c0.id), d.textSlots.filter(s => s.faceId === f.id).map(s => s.id), ordFace)
        const ordenada = ordFace ? od.camadas.map(id => ordem.find(x => x.c0.id === id)!).filter(Boolean) : ordem
        let primeira = true
        for (const { c0, caixa } of ordenada) {
          const c = caixa ? c0 : efetiva(c0, aj[c0.id])
          if (c.type === 'text' || c.visible === false || o.ocultarCamadas?.has(c.id) || ocultasPorGrupo.has(c.id)) continue
          if (o.semApliques && ehAplique(tema, c)) continue
          const matriz = mmT(matrizDaCamada(c, q, A))
          const id = caixa ? `${f.id}:x:${c.id}` : `${f.id}:${c.id}`
          // moldurinha: em volta do cenário inteiro (ou de cada face, se a camada pedir)
          let polyMoldura = c.type === 'frame' && (c as { porFace?: boolean }).porFace ? poly : polyArte
          // Lote 10 (item 158): moldurinha numa FORMA (alvo) — contorna a forma, afastada da borda, em vez da face
          const alvoId = c.type === 'frame' ? (c as { alvo?: string }).alvo : undefined
          if (alvoId) {
            const a0 = [...lista, ...daCaixa].find(x => x.id === alvoId)
            const alvoC = a0 ? (daCaixa.includes(a0) ? a0 : efetiva(a0, aj[a0.id])) : null
            if (alvoC?.type === 'shape') {
              const Ma = matrizDaCamada(alvoC, q, A)
              const anel = contornoDaForma(alvoC.kind, alvoC.params)[0]
              if (anel) polyMoldura = anel.map(([u, v]) => aplicar(Ma, u, v) as Pt)
            } else continue
          }
          const no = noDaCamada(id, c, matriz, { poly: polyMoldura.map(naFolhaDe(T)), origem: [0, 0] })
          if (primeira && ehCamadaDePapel(c)) {
            e.fundo = { c, matriz }
            // impressão: o papel de fundo (imagem ou COR) ganha uma cópia ampliada por baixo, até cobrir a região
            const sob = sobra ? copiaParaSobra(id, c, matriz, regioes?.get(f.id)?.flat() ?? []) : null
            if (sob) filhos.push(sob)
          }
          primeira = false
          if (!no) continue
          if (!ehCamadaDePapel(c) && (c as { bleed?: boolean }).bleed) { vazados.push(semRecorte(no)); e.vazouAqui++; continue }
          if (od.acimaDosTextos.has(c0.id)) { e.sobreTextos.push(no); continue }
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
      // Lote 5 (item 63): abas numa cor sólida do tema
      if (!filhos.length && !e.vazouAqui && tema?.abasCor && !tema.overflowFill && !parte) {
        const A = 1
        const q = quadroDaFace(poly, { mode: 'cover' }, A)
        const c = { id: 'abas', type: 'solid', anchor: 'paper', color: tema.abasCor } as CamadaTema
        const matriz = mmT(matrizDaCamada(c, q, A))
        const sob = sobra ? copiaParaSobra(`${f.id}:abas`, c, matriz, regioes?.get(f.id)?.flat() ?? []) : null
        if (sob) filhos.push(sob)
        const no = noDaCamada(`${f.id}:abas`, c, matriz)
        if (no) filhos.push(no)
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
  if (tema && !abas && !tema.abasCor) {
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
    // Lote 6 (item 91): face com TRANSIÇÃO SUAVE (estrutura das peças por medida) → no fim, os nós dela vão para um
    // grupo com máscara em degradê (some sobre o pedaço vizinho)
    const inicioDaFace = out.length
    const fd = (f as { fade?: { x0: number; y0: number; x1: number; y1: number } }).fade
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
    if (!sobra && !minhasAbas.length) { out.push(...filhos); if (fd) emDegrade(out, inicioDaFace, f.id, fd, naFolha); continue }
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
    if (fd) emDegrade(out, inicioDaFace, f.id, fd, naFolha)
  }
  if (o.depoisDasFaces?.length) out.push(...o.depoisDasFaces)
  out.push(...vazados)
  // textos por cima de tudo: um caminho por posição (na impressão, recortados no contorno da face)
  if (tema && o.texto) {
    const recentrar = recentralizar(d, artboardId, tema, o.texto.valores, o.texto.valoresPorSlot)
    // Lote 6 (item 93): a arte tem SOBRENOME → o NOME completo do pedido se divide
    const temSobrenome = d.textSlots.some(x => x.variable === 'SOBRENOME')
    const nomesDaArte = [...new Set(d.textSlots.map(x => x.variable)), 'FRASE']
    // Lote 10 (item 151): os textos de cada caixa na ordem que a usuária deu (entre eles)
    const textosNaOrdem = (() => {
      if (!tema.ordemFace) return d.textSlots
      const porFace = new Map<string, string[]>()
      for (const s of d.textSlots) porFace.set(s.faceId, [...(porFace.get(s.faceId) ?? []), s.id])
      const fila = new Map<string, string[]>()
      for (const [fid, ids] of porFace) fila.set(fid, ordemDaCaixa([], ids, tema.ordemFace?.[liderDoCenario(d, tema, fid)?.faceId ?? fid]).textos)
      const porId = new Map(d.textSlots.map(s => [s.id, s]))
      return d.textSlots.map(s => porId.get(fila.get(s.faceId)!.shift()!)!)
    })()
    for (const slot of textosNaOrdem) {
      // Lote 8 (item 123): texto oculto (olho) não sai — nem na tela, nem no arquivo
      if (tema.textSlotAdjust?.[slot.id]?.hidden) continue
      // Lote 9 (item 142): grupo oculto (olho da pasta) esconde os textos dele nas caixas da parte
      if (textosOcultosPorGrupo.has(`${d.parts.find(p => p.instances.some(i => i.faceId === slot.faceId))?.id}|${slot.variable}`)) continue
      const m = d.molds.find(mm => mm.artboardId === artboardId && mm.faces.some(f => f.id === slot.faceId))
      if (!m) continue
      const f = m.faces.find(x => x.id === slot.faceId)!
      const parte = d.parts.find(p => p.instances.some(i => i.faceId === f.id)) ?? null
      const inst = parte?.instances.find(i => i.faceId === f.id)
      const q = quadroDaFace(f.polygonMm as Pt[], inst?.fit, parte?.referenceAspect ?? 1)
      // Lote 8 (item 128): "Série" do pedido vale como SÉRIE da arte (campos compartilhados por nome, sem acento/caixa)
      const doPedido = alinharCampos({ ...o.texto.valores, ...(o.texto.valoresPorSlot?.[slot.id] ?? {}) }, nomesDaArte)
      const vals = comNomeDividido({ ...(tema.sample ?? {}), ...doPedido }, temSobrenome, doPedido)
      // Lote 5 (item 62): o SUFIXO segue o estilo da IDADE até ganhar o seu; NOME_IDADE segue o do NOME
      // Lote 6 (item 82): a herança de estilo é uma regra só (estiloDaVariavel)
      let estilo0 = estiloDaVariavel(tema.textStyles, slot.variable)
      // Lote 5 (item 75): letra trocada só NESTE pedido (botão Ajustar) soma às regras do tema
      const trocasPedido = lerJson<NonNullable<typeof estilo0.trocas>>(vals[`_TROCAS_${slot.variable}`])
      if (trocasPedido?.length) estilo0 = { ...estilo0, trocas: [...trocasPedido, ...(estilo0.trocas ?? [])] }
      const valor = valorDaVariavel(slot.variable, vals, tema.hashtag?.middle ?? 'faz', tema.idade)
      // Lote 4 (item 50): nome composto com os SEUS efeitos (quando a usuária configurou)
      const efC = (estilo0 as { efeitosComposto?: unknown[] }).efeitosComposto
      const estilo = efC && valor.trim().split(/\s+/).filter(Boolean).length >= 2 ? { ...estilo0, effects: efC } as typeof estilo0 : estilo0
      const ef0 = posicaoEfetiva(slot, tema, vals)
      // Lote 5 (item 77): campo vazio na mesma face → os outros textos dela recentralizam
      const dyR = recentrar.get(slot.id) ?? 0
      const ef = dyR ? { ...ef0, caixa: { ...ef0.caixa, y: ef0.caixa.y + dyR } } : ef0
      const Tm = matrizDoMolde(m)
      const poly = (f.polygonMm as Pt[]).map(([x, y]) => aplicar(Tm, x, y) as Pt)
      const comum = { estilo, fontes: o.texto.fontes, quadro: compor(Tm, q.face), w: q.w, h: q.h, face: { poly, nome: m.name } }
      // Lote 5 (itens 73/77): LINHAS EMPILHADAS na mesma caixa (giram juntas): NOME + IDADE, e a FRASE presa ao
      // nome (acima/abaixo). Antes/depois = na mesma linha. O que estiver vazio sai e o resto ocupa a caixa.
      const nPal = (t: string) => t.trim().split(/\s+/).filter(Boolean).length
      const cfgDe = (t: string) => (ef.cfg.compound && nPal(t) >= 2 ? ef.cfg.compound : ef.cfg.single ?? ef.cfg.compound)
      const linhasDe = (t: string) => (cfgDe(t)?.lines === 2 && nPal(t) >= 2 ? 2 : 1)
      const cfgLinha = (sizePt: number) => ({ ...ef.cfg, single: { lines: 1 as const, sizePt }, compound: { lines: 1 as const, sizePt } })
      type Linha = { id: string; variavel: string; valor: string; peso: number; cfg: typeof ef.cfg; estilo?: typeof estilo; gap: number }
      const itens: Linha[] = []
      const frase = slot.frase ? String(vals.FRASE ?? '').trim() : ''
      const posF = slot.frase?.posicao ?? 'acima'
      const comFrase = (t: string) => (!frase || !t.trim() ? t : posF === 'antes' ? `${frase} ${t}` : posF === 'depois' ? `${t} ${frase}` : t)
      const espB = slot.bloco?.espaco ?? 0.05, espF = slot.frase?.espaco ?? 0.05
      // Lote 8 (item 126): "Tamanho do texto" no estilo próprio da frase/idade do bloco = relativo ao do texto principal
      const escalaPropria = (v: string) => { const own = tema.textStyles?.[v]?.sizeScale; return own === undefined ? 1 : own / Math.max(0.05, estilo.sizeScale ?? 1) }
      if (slot.variable === 'NOME_IDADE' && (slot.bloco?.arranjo ?? 'empilhado') === 'empilhado') {
        const nome = comFrase((vals.NOME ?? '').trim()), idadeTxt = [idadeNumero(vals.IDADE ?? ''), valorDaVariavel('SUFIXO', vals, 'faz', tema.idade).toLocaleLowerCase('pt-BR')].filter(Boolean).join(' ')
        const pct = slot.bloco?.idadePct ?? 0.6
        if (nome.trim()) itens.push({ id: slot.id, variavel: 'NOME', valor: nome, peso: linhasDe(nome), cfg: ef.cfg, gap: espB })
        if (idadeTxt) itens.push({ id: `${slot.id}:idade`, variavel: 'IDADE', valor: idadeTxt, peso: pct, cfg: cfgLinha((cfgDe(nome)?.sizePt ?? 24) * pct * escalaPropria('NOME_IDADE:IDADE')), estilo: tema.textStyles?.['NOME_IDADE:IDADE'] as typeof estilo | undefined, gap: espB })
      } else {
        const arranjo = slot.bloco?.arranjo
        const v = slot.variable === 'NOME_IDADE' && arranjo && arranjo !== 'empilhado'
          ? textoDoBloco(arranjo, vals.NOME ?? '', vals.IDADE ?? '', valorDaVariavel('SUFIXO', vals, 'faz', tema.idade)) : valor
        const principal = comFrase(v)
        itens.push({ id: slot.id, variavel: slot.variable, valor: principal, peso: linhasDe(principal), cfg: ef.cfg, gap: espF })
      }
      if (frase && (posF === 'acima' || posF === 'abaixo') && itens.length) {
        const pctF = slot.frase?.tamanhoPct ?? 0.5
        const it: Linha = { id: `${slot.id}:frase`, variavel: 'FRASE', valor: frase, peso: pctF, cfg: cfgLinha((cfgDe(itens[0].valor)?.sizePt ?? 24) * pctF * escalaPropria('FRASE')), estilo: tema.textStyles?.FRASE as typeof estilo | undefined, gap: espF }
        if (posF === 'acima') itens.unshift(it); else itens.push(it)
      }
      const partes: { id: string; variavel: string; valor: string; caixa: typeof ef.caixa; cfg: typeof ef.cfg; rot: number; estilo?: typeof estilo }[] = []
      if (itens.length <= 1) { for (const it of itens) partes.push({ id: it.id, variavel: it.variavel, valor: it.valor, caixa: ef.caixa, cfg: it.cfg, rot: ef.rotacaoDeg, estilo: it.estilo }) }
      else {
        const gaps = itens.slice(1).map((it, k) => Math.max(it.gap, itens[k].gap))
        // Lote 6 (item 102): espaço negativo (encostar e sobrepor) nunca zera a altura total
        const somaPesos = itens.reduce((s2, it) => s2 + it.peso, 0)
        const total = Math.max(somaPesos * 0.3, somaPesos + gaps.reduce((s2, g2) => s2 + g2, 0))
        // centro de cada linha girado em volta do centro do BLOCO (em mm, depois volta para fração da face)
        const cxB = ef.caixa.x + ef.caixa.w / 2, cyB = ef.caixa.y + ef.caixa.h / 2, g = (ef.rotacaoDeg * Math.PI) / 180
        const sub = (y0: number, h: number) => {
          const dyMm = (y0 + h / 2 - cyB) * q.h
          const cx = cxB + (-dyMm * Math.sin(g)) / q.w, cy = cyB + (dyMm * Math.cos(g)) / q.h
          return { x: cx - ef.caixa.w / 2, y: cy - h / 2, w: ef.caixa.w, h }
        }
        let y = ef.caixa.y
        itens.forEach((it, k) => {
          const h = ef.caixa.h * (it.peso / total)
          partes.push({ id: it.id, variavel: it.variavel, valor: it.valor, caixa: sub(y, h), cfg: it.cfg, rot: ef.rotacaoDeg, estilo: it.estilo })
          y += h + (k < gaps.length ? ef.caixa.h * (gaps[k] / total) : 0)
        })
      }
      // Lote 8 (item 124): com VÁRIAS linhas (Nome + idade, frase em cima/embaixo) o fundo (logo/faixa) é UM SÓ, do
      // bloco inteiro — as linhas saem sem fundo próprio (antes cada uma desenhava o seu: 2 ou 3 logos). Só vale o
      // fundo do estilo do TEXTO (o da idade/frase copiado de antes é ignorado).
      const variasLinhas = partes.length > 1
      const semFundo = (e: typeof estilo): typeof estilo => (e.fundo ? { ...e, fundo: undefined } as typeof estilo : e)
      const recorte = (id: string): NoCamada | null => {
        if (!sobra) return null
        // impressão (Lote 2, item 21): o texto fica recortado no contorno da face (não vaza com a sobra)
        const furosM = m.faces.filter(x => x.hole).map(x => x.polygonMm as Pt[]).filter(h => dentro(centroide(h), f.polygonMm as Pt[]))
        return {
          id: `${id}:recorte`, name: `${slot.variable} (recorte)`, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false, clipOnly: true,
          type: 'shape', color: '#000000', rings: aneis(f.polygonMm as Pt[], furosM).filter(x => x.length >= 3).map(x => x.map(([px, py]) => { const [a, b] = aplicar(Tm, px, py); return [r4(a), r4(b)] as [number, number] })),
        } as NoCamada
      }
      const textosBloco: NoCamada[] = [], cantosBloco: Pt[][] = []
      for (const pt of partes) {
      const estPt = variasLinhas ? semFundo(pt.estilo ?? estilo) : pt.estilo
      const r = noDoTexto({ ...comum, ...(estPt ? { estilo: estPt } : {}), slotId: pt.id, variavel: pt.variavel, valor: pt.valor, caixa: pt.caixa, cfg: pt.cfg, rotacaoDeg: pt.rot })
      // Lote 9 (item 143): a idade do bloco não pode sumir em silêncio
      if (!r) {
        if (pt.variavel === 'IDADE' && pt.valor.trim()) o.texto.aoDiagramar?.({ slotId: pt.id, variavel: 'IDADE', aviso: 'a idade não apareceu (sem fonte para ela) — escolha a fonte da idade', revisar: true, substituta: false, escala: 0, linhas: [], artboardId })
        continue
      }
      if (pt.variavel === 'IDADE' && r.info.escala < 0.6 && !r.info.aviso) r.info.aviso = `a idade não coube — ficou com ${Math.round(r.info.escala * 100)}% do tamanho (aumente o espaço da idade ou diminua o nome)`
      // Lote 4 (item 51): "Preencher com papel" — a textura recortada dentro do texto
      const noTexto = comTextura(r.no, pt.estilo ?? estilo, pt.id)
      if (variasLinhas) { textosBloco.push(noTexto); if (r.info.cantosMm) cantosBloco.push(r.info.cantosMm); o.texto.aoDiagramar?.({ ...r.info, artboardId }); continue }
      // Lote 5 (item 74): o fundo (faixa ou logo) vai por baixo do texto, com papel dentro se tiver
      const fundo = r.fundo ? ((pt.estilo ?? estilo).fundo?.textura ? comTextura(r.fundo, { textura: (pt.estilo ?? estilo).fundo!.textura }, `${pt.id}:fundo`) : r.fundo) : null
      const rc = recorte(pt.id)
      if (rc) out.push(rc, ...(fundo ? [{ ...fundo, clip: true }] : []), { ...noTexto, clip: true })
      else { if (fundo) out.push(fundo); out.push(noTexto) }
      o.texto.aoDiagramar?.({ ...r.info, artboardId })
      }
      if (variasLinhas && textosBloco.length) {
        const fb0 = fundoDoBloco(slot.id, estilo, cantosBloco)
        const fb = fb0 && estilo.fundo?.textura ? comTextura(fb0, { textura: estilo.fundo.textura }, `${slot.id}:fundo`) : fb0
        const rc = recorte(slot.id)
        if (rc) out.push(rc, ...(fb ? [{ ...fb, clip: true }] : []), ...textosBloco.map(n => ({ ...n, clip: true })))
        else out.push(...(fb ? [fb] : []), ...textosBloco)
      }
    }
  }
  // Lote 10 (item 151): camadas postas ACIMA dos textos da caixa — depois deles, recortadas no contorno da face
  for (const e of entradas) {
    if (!e.sobreTextos.length) continue
    const furos = e.m.faces.filter(x => x.hole).map(x => x.polygonMm as Pt[])
    const naFolha = naFolhaDe(matrizDoMolde(e.m))
    out.push({
      id: `${e.f.id}:sobreTextos`, name: `${e.f.id} (acima dos textos)`, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false, clipOnly: true,
      type: 'shape', color: '#000000', rings: aneis(e.poly, furos).filter(r => r.length >= 3).map(r => r.map(naFolha)),
    }, ...e.sobreTextos.map(n => ({ ...n, clip: true })))
  }
  return out
}

const lerJson = <T,>(s: string | undefined): T | null => { if (!s) return null; try { return JSON.parse(s) as T } catch { return null } }

/** Lote 6 (item 91): junta os nós da face (de `ini` até o fim) num grupo com máscara linear (alfa 0 → 1). */
function emDegrade(out: NoCamada[], ini: number, faceId: string, fd: { x0: number; y0: number; x1: number; y1: number }, naFolha: (p: Pt) => Pt): void {
  const nos = out.splice(ini)
  if (!nos.length) return
  const [x0, y0] = naFolha([fd.x0, fd.y0]), [x1, y1] = naFolha([fd.x1, fd.y1])
  out.push({ id: `${faceId}:degrade`, name: `${faceId} (transição suave)`, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false,
    type: 'group', passThrough: false, children: nos,
    mask: { enabled: true, invert: false, featherMm: 0, gradient: { type: 'linear', x0: r4(x0), y0: r4(y0), x1: r4(x1), y1: r4(y1), stops: [{ pos: 0, alpha: 0 }, { pos: 1, alpha: 1 }] } } } as NoCamada)
}

/**
 * Lote 5 (item 77): no arquivo do pedido, campo VAZIO some — e os outros textos da mesma face recentralizam na
 * vertical (etiqueta escolar sem a professora: nome e turma descem para o meio). Devolve o deslocamento (fração da
 * face) de cada posição que fica.
 */
export function recentralizar(d: Doc, artboardId: string, tema: DocTema, valores: Record<string, string>, porSlot?: Record<string, Record<string, string>>): Map<string, number> {
  const out = new Map<string, number>()
  if (valores._PEDIDO !== '1') return out
  const porFace = new Map<string, { id: string; y0: number; y1: number; vazio: boolean }[]>()
  for (const s of d.textSlots) {
    if (!d.molds.some(m => m.artboardId === artboardId && m.faces.some(f => f.id === s.faceId))) continue
    const doPedido = alinharCampos({ ...valores, ...(porSlot?.[s.id] ?? {}) }, d.textSlots.map(x => x.variable))
    const v = comNomeDividido({ ...(tema.sample ?? {}), ...doPedido }, d.textSlots.some(x => x.variable === 'SOBRENOME'), doPedido)
    const txt = s.variable === 'NOME_IDADE' ? `${v.NOME ?? ''}${v.IDADE ?? ''}` : valorDaVariavel(s.variable, v, tema.hashtag?.middle ?? 'faz', tema.idade)
    const c = posicaoEfetiva(s, tema, v).caixa
    porFace.set(s.faceId, [...(porFace.get(s.faceId) ?? []), { id: s.id, y0: c.y, y1: c.y + c.h, vazio: !String(txt).trim() }])
  }
  for (const l of porFace.values()) {
    const cheios = l.filter(x => !x.vazio)
    if (l.length < 2 || !cheios.length || cheios.length === l.length) continue
    const meio = (a: typeof l) => (Math.min(...a.map(x => x.y0)) + Math.max(...a.map(x => x.y1))) / 2
    const dy = meio(l) - meio(cheios)
    for (const x of cheios) out.set(x.id, dy)
  }
  return out
}

type Slot = Doc['textSlots'][number]
/**
 * Posição de texto EFETIVA: tamanho = tema (todas as caixas) × "Só nesta caixa" × pedido (`_ESCALA_<VAR>`
 * nos valores); a caixa cresce em volta do centro junto com o tamanho da fonte (o nome fica maior de
 * verdade, em vez do auto-ajuste encolher de volta); deslocamento e giro da caixa.
 */
/** Lote 10 (item 164): até onde o nome encolhe para caber na área do nome. */
export const MIN_ESCALA_AREA = 0.1
/** A caixa (fração da face) passa da face? (o aviso "A área do nome passa da face"). */
export const areaPassaDaFace = (c: { x: number; y: number; w: number; h: number }) => c.x < -0.005 || c.y < -0.005 || c.x + c.w > 1.005 || c.y + c.h > 1.005

export function posicaoEfetiva(slot: Slot, tema: DocTema | null, valores: Record<string, string> = {}) {
  const aj0 = tema?.textSlotAdjust?.[slot.id] ?? {}
  // Lote 5 (item 59): ajuste SÓ DESTE PEDIDO (botão Ajustar) soma ao do tema
  const ap = lerJson<{ dx?: number; dy?: number; scale?: number; rotationDeg?: number; lines?: 1 | 2 }>(valores[`_POS_${slot.id}`]) ?? {}
  const aj = { dx: (aj0.dx ?? 0) + (ap.dx ?? 0), dy: (aj0.dy ?? 0) + (ap.dy ?? 0), scale: (aj0.scale ?? 1) * (ap.scale ?? 1), rotationDeg: (aj0.rotationDeg ?? 0) + (ap.rotationDeg ?? 0) }
  const doPedido = Number(valores[`_ESCALA_${slot.variable}`])
  // Lote 8 (item 126): o tamanho/giro do CONJUNTO segue a herança de estilo (antes lia só o estilo da própria variável)
  const est = tema ? estiloDaVariavel(tema.textStyles, slot.variable) : null
  const s = (est?.sizeScale ?? 1) * (aj.scale ?? 1) * (Number.isFinite(doPedido) && doPedido > 0 ? doPedido : 1)
  // Lote 4 (item 50): nome simples × composto — cada modo com a sua posição; o pedido pode forçar 1 ou 2 linhas
  // Lote 9 (item 143): no bloco Nome + idade, simples × composto é decidido pelo NOME (antes lia NOME_IDADE, sempre vazio:
  // "José Sérgio" caía no modo simples e quebrava sozinho)
  const varValor = slot.variable === 'NOME_IDADE' ? 'NOME' : slot.variable
  const valor = String(valores[varValor] ?? tema?.sample?.[varValor] ?? '')
  const forca = ap.lines ? String(ap.lines) : valores[`_LINHAS_${slot.variable}`]
  const composto = valor.trim().split(/\s+/).filter(Boolean).length >= 2
  const modo = composto ? slot.compound ?? slot.single : slot.single ?? slot.compound
  const b = slot.box
  // Lote 10 (item 164): com a ÁREA DO NOME definida, a caixa é a área (não cresce com o tamanho da letra)
  const area = (aj0 as { area?: { w: number; h: number } }).area
  const w = area ? area.w : b.w * s, h = area ? area.h : b.h * s
  const caixa = { x: b.x + b.w / 2 - w / 2 + (aj.dx ?? 0) + (modo?.dx ?? 0), y: b.y + b.h / 2 - h / 2 + (aj.dy ?? 0) + (modo?.dy ?? 0), w, h }
  const esc = <T extends { sizePt: number } | undefined>(c: T): T => (c ? { ...c, sizePt: c.sizePt * s } : c) as T
  let compound = esc(slot.compound)
  if (compound && (forca === '1' || forca === '2')) compound = { ...compound, lines: Number(forca) as 1 | 2 }
  // com área: o nome fica no tamanho pedido e, se não couber, encolhe até caber (antes parava em 70% e passava da área)
  const autoFit = area ? { minScale: Math.min(slot.autoFit?.minScale ?? 0.7, MIN_ESCALA_AREA) } : slot.autoFit
  return { escala: s, caixa, cfg: { ...slot, single: esc(slot.single), compound, ...(autoFit ? { autoFit } : {}) }, rotacaoDeg: (slot.rotationDeg ?? 0) + (est?.rotationDeg ?? 0) + (aj.rotationDeg ?? 0), area: !!area }
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
