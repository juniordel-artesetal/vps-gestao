// mae-vínculo — RESOLUÇÃO DO VÍNCULO (Sprint 6, o coração do MAE). Transforma base + tema na ÁRVORE DE
// CAMADAS que o motor da Sprint 2 desenha (o motor não muda), uma por prancheta:
//   para cada face com parte: [forma da face (com os furos)] + [camadas da parte com os ajustes "Só
//   nesta caixa" desta face, recortadas pela forma] + [camadas exclusivas da face];
//   faces sem parte (abas): o papel das abas.
// Ordem da spec: camadas da parte → ajustes locais → enquadramento (referência → face) → recorte pelo
// polígono → camadas exclusivas da face. (Texto, efeitos e sobra entram nas Sprints 7, 8 e 9.)
import type { DocTema, DocTrabalho, NoCamada, NoImagem } from '../schema'
import { area, centroide, dentro, type Pt } from '../faces/geometria'
import { quadroDaFace, type Quadro } from './enquadramento'
import { compor, escalar, girar, transladar, aplicar, type M } from './matriz'
import { noDoTexto, valorDaVariavel, ESTILO_PADRAO, type InfoTexto, type RegistroFontes } from '../texto/noTexto'
import { limparEfeitos } from '../schema/efeitos'
import { formaEmCmds } from '../edicao/formas'
import { regiaoDeImpressao, expandir, fatorDeSobra } from '../exportar/sobra'
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

const mm = (m: M, o: [number, number]): M => compor(transladar(o[0], o[1]), m)
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

/** Lote 4 (item 47): camada marcada "É aplique 3D" num tema com apliques ligados (vai só para as folhas de aplique). */
export const ehAplique = (tema: DocTema | null | undefined, c: CamadaTema) =>
  !!(tema as { appliques?: { enabled?: boolean } } | null | undefined)?.appliques?.enabled && c.type === 'image' && !!(c as { applique?: { enabled?: boolean } }).applique?.enabled

/** Árvore de camadas de UMA prancheta (mm da prancheta). */
export function resolverPrancheta(d: Doc, artboardId: string, o: OpcoesResolver = {}): NoCamada[] {
  const out: NoCamada[] = []
  const tema = o.tema ?? null
  const abas = tema?.overflowFill ?? d.smartArt?.flapFill ?? null
  const sobra = o.modo === 'impressao' ? Math.max(0, o.sobraMm ?? 10) : 0
  for (const m of d.molds) {
    if (m.artboardId !== artboardId) continue
    const origem: [number, number] = [m.transform.xMm, m.transform.yMm]
    const furos = m.faces.filter(f => f.hole).map(f => f.polygonMm as Pt[])
    const solidas = m.faces.filter(f => !f.hole).map(f => f.polygonMm as Pt[])
    for (const f of m.faces) {
      if (f.hole) continue
      const poly = f.polygonMm as Pt[]
      const parte = d.parts.find(p => p.instances.some(i => i.faceId === f.id)) ?? null
      const filhos: NoCamada[] = []
      const vazaDaFace = new Set<string>()
      // impressão: o papel de fundo (camada de baixo, âncora papel) ganha uma cópia ampliada por baixo
      const porBaixo = (no: NoCamada | null, q: Quadro, eFundo: boolean) => {
        if (!no || !sobra || !eFundo || no.type !== 'image' || !no.matrix) return
        const [cx, cy] = [q.cx + origem[0], q.cy + origem[1]]
        const { mask: _m, ...semMascara } = no
        void _m
        filhos.push({ ...semMascara, id: `${no.id}:sobra`, matrix: ampliar(no.matrix, cx, cy, fatorDeSobra(q.w, q.h, sobra)).map(r4) as M })
      }
      if (parte) {
        const inst = parte.instances.find(i => i.faceId === f.id)!
        const A = parte.referenceAspect ?? 1
        const q = quadroDaFace(poly, inst.fit, A)
        const lista: CamadaTema[] = tema ? (tema.partContent[parte.id] ?? []) : []
        const aj = ajustesDaFace(tema, f.id)
        if (!tema && o.gradeDaParte) {
          const g = o.gradeDaParte(parte.id, A)
          if (g) filhos.push(noImagem(`${f.id}:grade`, { id: 'grade', type: 'image', anchor: 'paper', path: g.path, sha256: g.sha256, aspect: g.aspect }, mm(matrizDaCamada({ anchor: 'paper', aspect: g.aspect }, q, A), origem)))
        }
        // ordem na face: papéis da parte → papéis só desta caixa (transição/cor local) → elementos da parte
        // → elementos só desta caixa. Antes os papéis da caixa iam por cima de TUDO da parte.
        const daCaixa = tema?.faceContent?.[f.id] ?? []
        const papelDaParte = (c: CamadaTema) => ehCamadaDePapel(c)
        let fimPapeis = 0
        while (fimPapeis < lista.length && papelDaParte(efetiva(lista[fimPapeis], aj[lista[fimPapeis].id]))) fimPapeis++
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
          const no = noDaCamada(caixa ? `${f.id}:x:${c.id}` : `${f.id}:${c.id}`, c, mm(matrizDaCamada(c, q, A), origem), { poly, origem })
          porBaixo(no, q, primeira && c.type === 'image' && (c.anchor ?? 'face') === 'paper')
          primeira = false
          if (no) { filhos.push(no); if (ehCamadaDePapel(c) || (c as { bleed?: boolean }).bleed) vazaDaFace.add(no.id) }
        }
      }
      if (!filhos.length && abas && (tema || !parte)) {
        // aba, face sem parte ou parte sem conteúdo no tema: o papel das abas cobre a face (preencher)
        const A = 1
        const q = quadroDaFace(poly, { mode: 'cover' }, A)
        const c: CamadaImagemTema = { id: 'abas', type: 'image', anchor: 'paper', path: abas.path, sha256: abas.sha256, aspect: abas.aspect ?? 1 }
        const no = noImagem(`${f.id}:abas`, c, mm(matrizDaCamada(c, q, A), origem))
        porBaixo(no, q, true)
        filhos.push(no)
      }
      if (!filhos.length) continue
      // anéis: na tela/aprovação, a face exata; na impressão, a face + sobra (sem invadir as vizinhas),
      // com os furos encolhidos só 1 mm (folga do corte; furo pequeno não pode sumir)
      const meus = furos.filter(h => dentro(centroide(h), poly) && area(h) < area(poly))
      const aneisMm: Pt[][] = sobra
        ? [...regiaoDeImpressao(poly, solidas.filter(s => s !== poly), sobra), ...meus.flatMap(h => { const e = expandir(h, -Math.min(1, sobra)); return e.length ? e : [h] })]
        : aneis(poly, furos)
      out.push({
        id: `${f.id}:forma`, name: f.id, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false,
        type: 'shape', color: o.corFace ?? '#ffffff', rings: aneisMm.filter(r => r.length >= 3).map(r => r.map(([x, y]) => [r4(x + origem[0]), r4(y + origem[1])] as [number, number])),
      })
      if (!sobra) { out.push(...filhos); continue }
      // impressão (Lote 2, item 21): só papéis/cores vazam até a sobra; o resto fica no contorno EXATO da face
      const vaza = (n: NoCamada) => n.id.endsWith(':sobra') || n.id.endsWith(':abas') || n.id.endsWith(':grade') || vazaDaFace.has(n.id)
      out.push(...filhos.filter(vaza))
      const dentroDaFace = filhos.filter(n => !vaza(n))
      if (dentroDaFace.length) {
        out.push({
          id: `${f.id}:recorte`, name: `${f.id} (recorte)`, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false, clipOnly: true,
          type: 'shape', color: '#000000', rings: aneis(poly, furos).filter(r => r.length >= 3).map(r => r.map(([x, y]) => [r4(x + origem[0]), r4(y + origem[1])] as [number, number])),
        }, ...dentroDaFace)
      }
    }
  }
  // textos por cima de tudo: um caminho por posição (na impressão, recortados no contorno da face)
  if (tema && o.texto) {
    for (const slot of d.textSlots) {
      const m = d.molds.find(mm => mm.artboardId === artboardId && mm.faces.some(f => f.id === slot.faceId))
      if (!m) continue
      const f = m.faces.find(x => x.id === slot.faceId)!
      const parte = d.parts.find(p => p.instances.some(i => i.faceId === f.id)) ?? null
      const inst = parte?.instances.find(i => i.faceId === f.id)
      const q = quadroDaFace(f.polygonMm as Pt[], inst?.fit, parte?.referenceAspect ?? 1)
      const estilo = tema.textStyles?.[slot.variable] ?? ESTILO_PADRAO
      const valor = valorDaVariavel(slot.variable, { ...(tema.sample ?? {}), ...o.texto.valores }, tema.hashtag?.middle ?? 'faz')
      const ef = posicaoEfetiva(slot, tema, o.texto.valores)
      const poly = (f.polygonMm as Pt[]).map(([x, y]) => [x + m.transform.xMm, y + m.transform.yMm] as Pt)
      const r = noDoTexto({ slotId: slot.id, variavel: slot.variable, valor, estilo, fontes: o.texto.fontes, quadro: compor(transladar(m.transform.xMm, m.transform.yMm), q.face), w: q.w, h: q.h, caixa: ef.caixa, cfg: ef.cfg, rotacaoDeg: ef.rotacaoDeg, face: { poly, nome: m.name } })
      if (!r) continue
      if (sobra) {
        // impressão (Lote 2, item 21): o texto fica recortado no contorno da face (não vaza com a sobra)
        const furosM = m.faces.filter(x => x.hole).map(x => x.polygonMm as Pt[]).filter(h => dentro(centroide(h), f.polygonMm as Pt[]))
        out.push({
          id: `${slot.id}:recorte`, name: `${slot.variable} (recorte)`, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false, clipOnly: true,
          type: 'shape', color: '#000000', rings: aneis(f.polygonMm as Pt[], furosM).filter(x => x.length >= 3).map(x => x.map(([px, py]) => [r4(px + m.transform.xMm), r4(py + m.transform.yMm)] as [number, number])),
        }, { ...r.no, clip: true })
      } else out.push(r.no)
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
  const b = slot.box
  const caixa = { x: b.x + b.w / 2 - (b.w * s) / 2 + (aj.dx ?? 0), y: b.y + b.h / 2 - (b.h * s) / 2 + (aj.dy ?? 0), w: b.w * s, h: b.h * s }
  const esc = <T extends { sizePt: number } | undefined>(c: T): T => (c ? { ...c, sizePt: c.sizePt * s } : c) as T
  return { escala: s, caixa, cfg: { ...slot, single: esc(slot.single), compound: esc(slot.compound) }, rotacaoDeg: (slot.rotationDeg ?? 0) + (tema?.textStyles?.[slot.variable]?.rotationDeg ?? 0) + (aj.rotationDeg ?? 0) }
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
