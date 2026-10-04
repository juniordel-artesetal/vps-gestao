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

type Doc = DocTrabalho
type CamadaTema = DocTema['partContent'][string][number]
export type CamadaImagemTema = Extract<CamadaTema, { type: 'image' }>
export interface Transf { x: number; y: number; scale: number; rotationDeg: number }
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
export function matrizDaCamada(c: CamadaImagemTema, q: Quadro, A: number): M {
  const t = { ...T_PADRAO, ...(c.transform ?? {}) }
  const asp = c.aspect && c.aspect > 0 ? c.aspect : 1
  if ((c.anchor ?? 'face') === 'paper') {
    const w = Math.max(A, asp) * t.scale, h = w / asp
    return compor(q.papel, transladar(t.x * A, t.y), girar(t.rotationDeg), escalar(w, h), transladar(-0.5, -0.5))
  }
  const [cx, cy] = aplicar(q.face, t.x, t.y)
  const w = t.scale * q.w, h = w / asp
  return compor(transladar(cx, cy), girar(q.rot + t.rotationDeg), escalar(w, h), transladar(-0.5, -0.5))
}

/** Anéis da face: contorno + os furos que estão dentro dela. */
function aneis(face: Pt[], furos: Pt[][]): Pt[][] {
  return [face, ...furos.filter(h => dentro(centroide(h), face) && area(h) < area(face))]
}

const mm = (m: M, o: [number, number]): M => compor(transladar(o[0], o[1]), m)
const r4 = (v: number) => Math.round(v * 1e4) / 1e4

function noImagem(id: string, c: CamadaImagemTema, matriz: M): NoImagem {
  const efs = limparEfeitos(c.effects)
  return {
    ...(efs.length ? { effects: efs } : {}),
    id, name: c.name ?? 'Imagem', visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal', clip: true,
    type: 'image', src: { path: c.path, sha256: c.sha256 ?? c.path },
    xMm: 0, yMm: 0, wMm: 1, hMm: 1, rotationDeg: 0, matrix: matriz.map(r4) as M,
  }
}

/** Árvore de camadas de UMA prancheta (mm da prancheta). */
export function resolverPrancheta(d: Doc, artboardId: string, o: OpcoesResolver = {}): NoCamada[] {
  const out: NoCamada[] = []
  const tema = o.tema ?? null
  const abas = tema?.overflowFill ?? d.smartArt?.flapFill ?? null
  for (const m of d.molds) {
    if (m.artboardId !== artboardId) continue
    const origem: [number, number] = [m.transform.xMm, m.transform.yMm]
    const furos = m.faces.filter(f => f.hole).map(f => f.polygonMm as Pt[])
    for (const f of m.faces) {
      if (f.hole) continue
      const poly = f.polygonMm as Pt[]
      const parte = d.parts.find(p => p.instances.some(i => i.faceId === f.id)) ?? null
      const filhos: NoImagem[] = []
      if (parte) {
        const inst = parte.instances.find(i => i.faceId === f.id)!
        const A = parte.referenceAspect ?? 1
        const q = quadroDaFace(poly, inst.fit, A)
        const lista: CamadaTema[] = tema ? (tema.partContent[parte.id] ?? []) : []
        const aj = ajustesDaFace(tema, f.id)
        if (!tema && o.gradeDaParte) {
          const g = o.gradeDaParte(parte.id, A)
          if (g) filhos.push(noImagem(`${f.id}:grade`, { id: 'grade', type: 'image', anchor: 'paper', path: g.path, sha256: g.sha256, aspect: g.aspect }, mm(matrizDaCamada({ id: 'grade', type: 'image', anchor: 'paper', path: g.path, aspect: g.aspect }, q, A), origem)))
        }
        for (const c0 of lista) {
          const c = efetiva(c0, aj[c0.id])
          if (c.type !== 'image' || c.visible === false) continue
          filhos.push(noImagem(`${f.id}:${c.id}`, c, mm(matrizDaCamada(c, q, A), origem)))
        }
        for (const c of tema?.faceContent?.[f.id] ?? []) {
          if (c.type !== 'image' || c.visible === false) continue
          filhos.push(noImagem(`${f.id}:x:${c.id}`, c, mm(matrizDaCamada(c, q, A), origem)))
        }
      }
      if (!filhos.length && abas && (tema || !parte)) {
        // aba, face sem parte ou parte sem conteúdo no tema: o papel das abas cobre a face (preencher)
        const A = 1
        const q = quadroDaFace(poly, { mode: 'cover' }, A)
        const c: CamadaImagemTema = { id: 'abas', type: 'image', anchor: 'paper', path: abas.path, sha256: abas.sha256, aspect: abas.aspect ?? 1 }
        filhos.push(noImagem(`${f.id}:abas`, c, mm(matrizDaCamada(c, q, A), origem)))
      }
      if (!filhos.length) continue
      out.push({
        id: `${f.id}:forma`, name: f.id, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false,
        type: 'shape', color: o.corFace ?? '#ffffff', rings: aneis(poly, furos).map(r => r.map(([x, y]) => [r4(x + origem[0]), r4(y + origem[1])] as [number, number])),
      })
      out.push(...filhos)
    }
  }
  // textos por cima de tudo (não recortados pela face): um caminho por posição
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
      const r = noDoTexto({ slotId: slot.id, variavel: slot.variable, valor, estilo, fontes: o.texto.fontes, quadro: compor(transladar(m.transform.xMm, m.transform.yMm), q.face), w: q.w, h: q.h, caixa: slot.box, cfg: slot })
      if (!r) continue
      out.push(r.no)
      o.texto.aoDiagramar?.(r.info)
    }
  }
  return out
}

/** Todos os arquivos (sha → caminho) que a resolução usa — para o motor carregar da Biblioteca. */
export function arquivosDaResolucao(nos: NoCamada[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const n of nos) if (n.type === 'image') m.set(n.src.sha256, n.src.path)
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
  for (const c of tema.partContent[partId] ?? []) if (c.type === 'image' && c.visible !== false) layers.push(noImagem(`mini:${c.id}`, c, matrizDaCamada(c, q, A)))
  return { id: `mini_${partId}`, widthMm: w, heightMm: h, layers }
}
