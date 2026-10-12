// MAE — GRUPOS NO TEMA (Lote 9, item 142). Puro.
// A Naty resolveu a "logo atrás do nome" pondo a logo como ELEMENTO e o NOME/IDADE por cima — e precisa mover, girar
// e redimensionar tudo junto. Um grupo junta CAMADAS da parte (pelo id) e TEXTOS (pela variável: NOME_IDADE, NOME…).
// Como os textos entram pela variável, o MESMO grupo vale em toda caixa da parte: em cada caixa ele é a logo + o texto
// daquela caixa. Mexer no grupo numa caixa vale SÓ NELA (ajuste local das camadas + ajuste do texto da caixa) — a
// mesma regra do arrastar na arte (item 126: o que se mexe na arte é a caixa clicada).
import type { DocTema, DocTrabalho } from '../schema'
import type { Pt } from '../faces/geometria'
import { aplicar, inversa, type M } from './matriz'
import { quadroDaFace, type Quadro } from './enquadramento'
import { arteDaFace } from './cenario'
import { efetiva, ajustesDaFace, matrizDaCamada, posicaoEfetiva, type AjusteLocal } from './resolver'
import { acharCamadaTema } from './tema'

type Doc = DocTrabalho
type Molde = Doc['molds'][number]
export interface GrupoTema { id: string; nome: string; parte: string; camadas: string[]; textos: string[]; visible?: boolean; locked?: boolean }

const gid = () => `g_${Math.random().toString(36).slice(2, 10)}`
export const gruposDo = (t: Pick<DocTema, 'grupos'> | null | undefined): GrupoTema[] => ((t as { grupos?: GrupoTema[] } | null | undefined)?.grupos ?? [])

/** Cria o grupo (as camadas saem de outros grupos — uma camada fica em um grupo só). Devolve o id. */
export function criarGrupoTema(t: DocTema, o: { parte: string; camadas: string[]; textos: string[]; nome?: string }): string {
  const gs = ((t as { grupos?: GrupoTema[] }).grupos ??= [])
  for (const g of gs) {
    if (g.parte !== o.parte) continue
    g.camadas = g.camadas.filter(c => !o.camadas.includes(c))
    g.textos = g.textos.filter(v => !o.textos.includes(v))
  }
  ;(t as { grupos?: GrupoTema[] }).grupos = gs.filter(g => g.camadas.length + g.textos.length > 0)
  const id = gid()
  ;(t as { grupos: GrupoTema[] }).grupos.push({ id, nome: o.nome?.trim() || `Grupo ${gs.length + 1}`, parte: o.parte, camadas: [...new Set(o.camadas)], textos: [...new Set(o.textos)] })
  return id
}
/** Desagrupa (os itens continuam onde estão). */
export function desagruparTema(t: DocTema, id: string): void {
  const x = t as { grupos?: GrupoTema[] }
  x.grupos = (x.grupos ?? []).filter(g => g.id !== id)
  if (!x.grupos.length) delete x.grupos
}
/** O grupo de uma camada ou de um texto (variável) da parte. */
export function grupoDe(t: Pick<DocTema, 'grupos'> | null | undefined, item: { camada?: string | null; variavel?: string | null; parte?: string | null }): GrupoTema | null {
  for (const g of gruposDo(t)) {
    if (item.camada && g.camadas.includes(item.camada)) return g
    if (item.variavel && (!item.parte || g.parte === item.parte) && g.textos.includes(item.variavel)) return g
  }
  return null
}

/** O quadro do TEXTO numa face (o enquadramento da instância da parte, como na tela). */
function quadroDoTexto(d: Doc, m: Molde, faceId: string): Quadro | null {
  const f = m.faces.find(x => x.id === faceId); if (!f) return null
  const parte = d.parts.find(p => p.instances.some(i => i.faceId === faceId))
  const inst = parte?.instances.find(i => i.faceId === faceId)
  return quadroDaFace(f.polygonMm as Pt[], inst?.fit, parte?.referenceAspect ?? 1)
}

export interface MembroNaFace { tipo: 'camada' | 'texto'; id: string; centro: Pt; cantos: Pt[] }
/** Os membros do grupo NESTA caixa, com o centro e os cantos (mm do molde) — para o contorno e as contas. */
export function membrosNaFace(d: Doc, t: DocTema, g: GrupoTema, m: Molde, faceId: string, valores: Record<string, string> = {}): MembroNaFace[] {
  const out: MembroNaFace[] = []
  const arte = arteDaFace(d, t, m, faceId)
  if (arte) {
    const aj = ajustesDaFace(t, arte.faceArte)
    for (const id of g.camadas) {
      const a = acharCamadaTema(t, id); if (!a) continue
      if (a.partId && a.partId !== arte.parteArte) continue
      if (a.faceId && a.faceId !== arte.faceArte) continue
      const c = a.faceId ? a.c : efetiva(a.c, aj[id])
      if ((c as { anchor?: string }).anchor === 'paper') continue
      const Mc = matrizDaCamada(c as never, arte.quadro, arte.A)
      out.push({ tipo: 'camada', id, centro: aplicar(Mc, 0.5, 0.5) as Pt, cantos: [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => aplicar(Mc, u, v) as Pt) })
    }
  }
  const qt = quadroDoTexto(d, m, faceId)
  if (qt) for (const s of d.textSlots) {
    if (s.faceId !== faceId || !g.textos.includes(s.variable)) continue
    const b = posicaoEfetiva(s, t, valores).caixa
    const cantos = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([u, v]) => aplicar(qt.face, u, v) as Pt)
    out.push({ tipo: 'texto', id: s.id, centro: aplicar(qt.face, b.x + b.w / 2, b.y + b.h / 2) as Pt, cantos })
  }
  return out
}

/** Centro do grupo (meio da caixa de todos os cantos). */
export function centroDoGrupo(ms: MembroNaFace[]): Pt {
  const xs = ms.flatMap(m => m.cantos.map(c => c[0])), ys = ms.flatMap(m => m.cantos.map(c => c[1]))
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}

export interface OperacaoGrupo { dx?: number; dy?: number; escala?: number; giroDeg?: number }
const r3 = (v: number) => Math.round(v * 1000) / 1000
/**
 * Move / redimensiona / gira o grupo NESTA caixa (em volta do centro do grupo): cada camada vira um ajuste "só nesta
 * caixa" (posição, escala, giro) e cada texto, o ajuste do texto desta caixa. Um passo só no Ctrl+Z (quem chama).
 */
export function transformarGrupoNaFace(d: Doc, t: DocTema, g: GrupoTema, m: Molde, faceId: string, op: OperacaoGrupo, valores: Record<string, string> = {}): void {
  const ms = membrosNaFace(d, t, g, m, faceId, valores)
  if (!ms.length) return
  const [cx, cy] = centroDoGrupo(ms)
  const s = op.escala ?? 1, th = ((op.giroDeg ?? 0) * Math.PI) / 180, co = Math.cos(th), si = Math.sin(th)
  const novo = ([x, y]: Pt): Pt => { const vx = (x - cx) * s, vy = (y - cy) * s; return [cx + vx * co - vy * si + (op.dx ?? 0), cy + vx * si + vy * co + (op.dy ?? 0)] }
  const arte = arteDaFace(d, t, m, faceId)
  const qt = quadroDoTexto(d, m, faceId)
  for (const mb of ms) {
    const [nx, ny] = novo(mb.centro)
    if (mb.tipo === 'camada' && arte) {
      const a = acharCamadaTema(t, mb.id); if (!a) continue
      const [u, v] = aplicar(inversa(arte.quadro.face as M), nx, ny)
      if (a.faceId) {
        const tr = (a.c as { transform?: Record<string, number> }).transform ??= { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 }
        tr.x = r3(u); tr.y = r3(v); tr.scale = r3((tr.scale ?? 1) * s); tr.rotationDeg = r3((tr.rotationDeg ?? 0) + (op.giroDeg ?? 0))
      } else {
        const porFace = ((t.localOverrides ??= {})[arte.faceArte] ??= {}) as Record<string, AjusteLocal>
        const aj = (porFace[mb.id] ??= {})
        const ef = efetiva(a.c, aj)
        const tr0 = (ef as { transform?: { scale?: number; rotationDeg?: number } }).transform ?? {}
        aj.transform = { ...(aj.transform ?? {}), x: r3(u), y: r3(v), scale: r3((tr0.scale ?? 1) * s), rotationDeg: r3((tr0.rotationDeg ?? 0) + (op.giroDeg ?? 0)) }
      }
    } else if (mb.tipo === 'texto' && qt) {
      const inv = inversa(qt.face as M)
      const [u0, v0] = aplicar(inv, mb.centro[0], mb.centro[1]), [u1, v1] = aplicar(inv, nx, ny)
      const aj = ((t.textSlotAdjust ??= {})[mb.id] ??= {}) as { dx?: number; dy?: number; scale?: number; rotationDeg?: number }
      const lim = (x: number) => Math.max(-1, Math.min(1, x))
      aj.dx = r3(lim((aj.dx ?? 0) + u1 - u0)); aj.dy = r3(lim((aj.dy ?? 0) + v1 - v0))
      if (s !== 1) aj.scale = r3(Math.max(0.2, Math.min(4, (aj.scale ?? 1) * s)))
      if (op.giroDeg) aj.rotationDeg = r3((aj.rotationDeg ?? 0) + op.giroDeg)
    }
  }
}

/**
 * Converte o "Logo" do fundo do texto (opção que saiu do MAE) num ELEMENTO da parte, no mesmo lugar e tamanho em que
 * a logo era desenhada, + o texto, AGRUPADOS. `logo` = a matriz da logo (mm do molde) desenhada hoje nessa caixa.
 * Tira o fundo "logo" do estilo do texto. Devolve o id do grupo.
 */
export function converterLogoEmElemento(d: Doc, t: DocTema, o: { variavel: string; m: Molde; faceId: string; logo: M; imagem: { path: string; sha256?: string; aspect: number } }): string | null {
  const arte = arteDaFace(d, t, o.m, o.faceId)
  if (!arte?.parteArte) return null
  const centro = aplicar(o.logo, 0.5, 0.5) as Pt
  const [u, v] = aplicar(inversa(arte.quadro.face as M), centro[0], centro[1])
  const larg = Math.hypot(o.logo[0], o.logo[1])
  const giro = (Math.atan2(o.logo[1], o.logo[0]) * 180) / Math.PI - arte.quadro.rot
  const id = `l_${Math.random().toString(36).slice(2, 10)}`
  const lista = (t.partContent[arte.parteArte] ??= [])
  lista.push({ id, type: 'image', anchor: 'face', path: o.imagem.path, sha256: o.imagem.sha256 ?? o.imagem.path, aspect: o.imagem.aspect, name: 'Logo do nome',
    transform: { x: r3(u), y: r3(v), scale: r3(larg / arte.quadro.w), rotationDeg: r3(giro) } } as never)
  for (const st of Object.values(t.textStyles ?? {})) if ((st as { fundo?: { tipo?: string } }).fundo?.tipo === 'imagem') delete (st as { fundo?: unknown }).fundo
  return criarGrupoTema(t, { parte: arte.parteArte, camadas: [id], textos: [o.variavel], nome: 'Logo + nome' })
}
