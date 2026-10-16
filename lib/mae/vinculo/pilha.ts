// Lote 6 (item 81): a PILHA de uma caixa no tema — o que está desenhado nela, de cima para baixo — e o que fica
// sob um ponto. Fonte única do clique na arte (seleciona o objeto de cima; Alt + clique desce na pilha) e do
// painel Camadas (lista TODAS as camadas da caixa: textos, apliques, elementos, formas, moldurinha, papéis).
// Ordem igual à do resolvedor: papéis da parte → papéis só desta caixa → demais da parte → demais só desta caixa,
// e os textos por cima de tudo.
import { comTextosDoTema } from './textosDoTema'
import type { DocTema, DocTrabalho } from '../schema'
import type { Pt } from '../faces/geometria'
import type { Quadro } from './enquadramento'
import { aplicar, inversa } from './matriz'
import { efetiva, ajustesDaFace, ehCamadaDePapel, matrizDaCamada, posicaoEfetiva, ehAplique } from './resolver'
import { liderDoCenario } from './cenario'
import { ordemDaCaixa, idTexto, moverNaOrdem } from './ordem'

type Camada = DocTema['partContent'][string][number]
export type ItemPilha =
  | { tipo: 'texto'; id: string; nome: string; variavel: string; travado?: boolean }
  | { tipo: 'camada'; id: string; nome: string; camada: Camada; caixa: boolean; papel: boolean; aplique: boolean; travado?: boolean }

const ROTULO_TIPO: Record<string, string> = { image: 'Imagem', solid: 'Cor sólida', frame: 'Moldurinha', shape: 'Forma', text: 'Texto', conjunto: 'Conjunto de aplique' }
export const nomeDaCamada = (c: Camada): string => c.name || (c.type === 'image' ? c.path.split('/').pop()!.replace(/\.[^.]+$/, '') : ROTULO_TIPO[c.type] ?? c.type)

/** Camadas de UMA face na ordem de desenho (de baixo para cima), com o ajuste "só nesta caixa" aplicado. */
export function camadasDaFace(tema: DocTema, partId: string | null, faceId: string): { c: Camada; caixa: boolean }[] {
  const base = camadasDaFaceSemOrdem(tema, partId, faceId)
  const ord = (tema as { ordemFace?: Record<string, string[]> }).ordemFace?.[faceId]
  if (!ord) return base
  // Lote 10 (item 151): a ordem que a usuária deu nesta caixa (mesma regra do resolvedor)
  const ids = ordemDaCaixa(base.map(x => x.c.id), [], ord).camadas
  return ids.map(id => base.find(x => x.c.id === id)!)
}
function camadasDaFaceSemOrdem(tema: DocTema, partId: string | null, faceId: string): { c: Camada; caixa: boolean }[] {
  const lista = partId ? tema.partContent[partId] ?? [] : []
  const aj = ajustesDaFace(tema, faceId)
  const daCaixa = tema.faceContent?.[faceId] ?? []
  let fim = 0
  while (fim < lista.length && ehCamadaDePapel(efetiva(lista[fim], aj[lista[fim].id]))) fim++
  // a transição fica por cima de todos os papéis de fundo (igual ao resolvedor — Lote 6, itens 87/84)
  const comTr = (c: Camada) => !!(c as { transition?: unknown }).transition
  const papeisCaixa = daCaixa.filter(ehCamadaDePapel)
  return [
    ...lista.slice(0, fim).filter(c => !comTr(c)).map(c => ({ c: efetiva(c, aj[c.id]) as Camada, caixa: false })),
    ...papeisCaixa.filter(c => !comTr(c)).map(c => ({ c, caixa: true })),
    ...lista.slice(0, fim).filter(comTr).map(c => ({ c: efetiva(c, aj[c.id]) as Camada, caixa: false })),
    ...papeisCaixa.filter(comTr).map(c => ({ c, caixa: true })),
    ...lista.slice(fim).map(c => ({ c: efetiva(c, aj[c.id]) as Camada, caixa: false })),
    ...daCaixa.filter(c => !ehCamadaDePapel(c)).map(c => ({ c, caixa: true })),
  ]
}

/** A pilha da caixa, de CIMA para baixo: textos da face, depois as camadas (última desenhada primeiro). */
export function pilhaDaFace(doc0: Pick<DocTrabalho, 'textSlots' | 'parts'> & Partial<Pick<DocTrabalho, 'molds'>>, tema: DocTema, faceId: string): ItemPilha[] {
  const doc = comTextosDoTema(doc0, tema.id)   // Lote 18
  const lider = doc.molds ? liderDoCenario(doc as never, tema, faceId) : null
  const faceArte = lider?.faceId ?? faceId
  const parte = doc.parts.find(p => p.instances.some(i => i.faceId === faceArte)) ?? null
  const { textos, abaixo, acima } = ordemVisivel(doc, tema, faceId, faceArte, parte?.id ?? null)
  const item = ({ c, caixa }: { c: Camada; caixa: boolean }): ItemPilha => ({ tipo: 'camada', id: c.id, nome: nomeDaCamada(c), camada: c, caixa, papel: ehCamadaDePapel(c), aplique: ehAplique(tema, c) })
  return [...[...acima].reverse().map(item), ...[...textos].reverse().map(s => ({ tipo: 'texto' as const, id: s.id, nome: s.variable, variavel: s.variable })), ...[...abaixo].reverse().map(item)]
}

/** Lote 10 (item 151): a ordem da caixa como é desenhada (de baixo para cima): camadas abaixo dos textos, os textos,
 *  e as camadas postas acima dos textos. */
function ordemVisivel(doc: Pick<DocTrabalho, 'textSlots'>, tema: DocTema, faceId: string, faceArte: string, partId: string | null) {
  const cs = camadasDaFace(tema, partId, faceArte)
  const slots = doc.textSlots.filter(s => s.faceId === faceId)
  const od = ordemDaCaixa(cs.map(x => x.c.id), slots.map(s => s.id), (tema as { ordemFace?: Record<string, string[]> }).ordemFace?.[faceArte])
  const porId = new Map(slots.map(s => [s.id, s]))
  return { textos: od.textos.map(id => porId.get(id)!), abaixo: cs.filter(x => !od.acimaDosTextos.has(x.c.id)), acima: cs.filter(x => od.acimaDosTextos.has(x.c.id)) }
}

/** Lote 10 (item 151): a ordem visível da caixa em ids (camadas e `t:<slot>`), de baixo para cima. */
export function idsNaOrdem(doc0: Pick<DocTrabalho, 'textSlots' | 'parts'> & Partial<Pick<DocTrabalho, 'molds'>>, tema: DocTema, faceId: string): { faceArte: string; ids: string[] } {
  const doc = comTextosDoTema(doc0, tema.id)   // Lote 18
  const lider = doc.molds ? liderDoCenario(doc as never, tema, faceId) : null
  const faceArte = lider?.faceId ?? faceId
  const parte = doc.parts.find(p => p.instances.some(i => i.faceId === faceArte)) ?? null
  const { textos, abaixo, acima } = ordemVisivel(doc, tema, faceId, faceArte, parte?.id ?? null)
  return { faceArte, ids: [...abaixo.map(x => x.c.id), ...textos.map(s => idTexto(s.id)), ...acima.map(x => x.c.id)] }
}

/**
 * Lote 10 (item 151): muda a ORDEM na caixa (camada da parte, só desta caixa ou texto — entre listas). Grava em
 * `tema.ordemFace[face líder]`. Devolve false se não mudou (já está no topo/fundo).
 */
export function reordenarNaFace(doc: Pick<DocTrabalho, 'textSlots' | 'parts'> & Partial<Pick<DocTrabalho, 'molds'>>, t: DocTema, faceId: string, id: string, para: 'frente' | 'tras' | 'topo' | 'fundo' | number): boolean {
  const { faceArte, ids } = idsNaOrdem(doc, t, faceId)
  const nova = moverNaOrdem(ids, id, para)
  if (!nova) return false
  const x = t as { ordemFace?: Record<string, string[]> }
  ;(x.ordemFace ??= {})[faceArte] = nova
  return true
}

/** Distância do ponto ao contorno do polígono (mm). */
function distBorda(p: Pt, pol: Pt[]): number {
  let d = Infinity
  for (let i = 0; i < pol.length; i++) {
    const a = pol[i], b = pol[(i + 1) % pol.length], vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy
    const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L)) : 0
    d = Math.min(d, Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy))
  }
  return d
}

/**
 * O que está SOB o ponto (mm locais do molde), de cima para baixo. Prioridade da Naty: textos e apliques; depois
 * elementos, formas e moldurinha; por último os papéis/cor da caixa (que cobrem a face inteira). `valores` = do
 * pedido aberto (o texto do pedido pode estar em outro lugar).
 */
export function pilhaNoPonto(o: {
  doc: Pick<DocTrabalho, 'textSlots' | 'parts'> & Partial<Pick<DocTrabalho, 'molds'>>; tema: DocTema; faceId: string; poligono: Pt[]; local: Pt; quadro: Quadro; valores?: Record<string, string>
  /** Lote 9 (item 136): quadro e contorno da ARTE (cenário contínuo: os das faces juntas). Sem eles, os da face. */
  quadroArte?: Quadro; poligonoArte?: Pt[]
  /** Lote 21 (item 253): o botão direito ENXERGA o travado (para oferecer "Destravar"); o clique comum não. */
  comTravados?: boolean
}): ItemPilha[] {
  const { tema, faceId, local, quadro: q } = o
  const doc = comTextosDoTema(o.doc, tema.id)   // Lote 18
  const qa = o.quadroArte ?? q, polArte = o.poligonoArte ?? o.poligono
  const lider = (doc as { molds?: unknown }).molds ? liderDoCenario(doc as never, tema, faceId) : null
  const faceArte = lider?.faceId ?? faceId
  const parte = doc.parts.find(p => p.instances.some(i => i.faceId === faceArte)) ?? null
  const A = parte?.referenceAspect ?? 1
  // Lote 9 (item 142): grupo travado (cadeado da pasta) — os itens dele não se selecionam na arte
  const travados = ((tema as { grupos?: { parte: string; camadas: string[]; textos: string[]; locked?: boolean }[] }).grupos ?? []).filter(g => g.locked)
  const camadaTravadaNoGrupo = new Set(travados.flatMap(g => g.camadas))
  const parteDoTexto = doc.parts.find(p => p.instances.some(i => i.faceId === faceId))?.id
  const textoTravadoNoGrupo = new Set(travados.filter(g => g.parte === parteDoTexto).flatMap(g => g.textos))
  const textos: ItemPilha[] = []
  for (const s of doc.textSlots) {
    if (s.faceId !== faceId) continue
    // Lote 8 (item 123): texto oculto ou travado não se seleciona na arte (no painel Camadas, sim)
    if (tema.textSlotAdjust?.[s.id]?.hidden) continue
    const textoTravado = !!tema.textSlotAdjust?.[s.id]?.locked || textoTravadoNoGrupo.has(s.variable)
    if (textoTravado && !o.comTravados) continue
    const ef = posicaoEfetiva(s, tema, o.valores ?? {})
    const b = ef.caixa
    // a caixa pode estar girada: desfaz o giro em volta do centro dela (em mm) antes de testar
    const [cx, cy] = aplicar(q.face, b.x + b.w / 2, b.y + b.h / 2)
    const g = (-ef.rotacaoDeg * Math.PI) / 180, dx = local[0] - cx, dy = local[1] - cy
    const [u, v] = aplicar(inversa(q.face), cx + dx * Math.cos(g) - dy * Math.sin(g), cy + dx * Math.sin(g) + dy * Math.cos(g))
    if (u >= b.x && u <= b.x + b.w && v >= b.y && v <= b.y + b.h) textos.push({ tipo: 'texto', id: s.id, nome: s.variable, variavel: s.variable, ...(textoTravado ? { travado: true } : {}) })
  }
  const cima: ItemPilha[] = [], meio: ItemPilha[] = [], fundo: ItemPilha[] = []
  for (const { c, caixa } of camadasDaFace(tema, parte?.id ?? null, faceArte).reverse()) {
    // Lote 8 (item 132): travada (cadeado) também fica fora — o clique e o Alt + clique passam para a de baixo
    if (c.visible === false || c.type === 'text') continue
    const travada = !!(c as { locked?: boolean }).locked || camadaTravadaNoGrupo.has(c.id)
    if (travada && !o.comTravados) continue
    const item: ItemPilha = { tipo: 'camada', id: c.id, nome: nomeDaCamada(c), camada: c, caixa, papel: ehCamadaDePapel(c), aplique: ehAplique(tema, c), ...(travada ? { travado: true } : {}) }
    if (item.papel) { fundo.push(item); continue }
    if (c.type === 'frame') {
      const f = c as Camada & { offsetMm?: number; widthMm?: number }
      const d = distBorda(local, (f as { porFace?: boolean }).porFace ? o.poligono : polArte), alvo = f.offsetMm ?? 3, larg = (f.widthMm ?? 0.6) / 2 + 1.5
      if (Math.abs(d - alvo) <= larg) meio.push(item)
      continue
    }
    if (c.type === 'solid') { fundo.push(item); continue }
    const [u, v] = aplicar(inversa(matrizDaCamada(c as never, qa, A)), local[0], local[1])
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) (item.aplique ? cima : meio).push(item)
  }
  // Lote 10 (item 151): camada posta acima dos textos da caixa vem antes deles no clique
  const ordAcima = ordemDaCaixa(camadasDaFace(tema, parte?.id ?? null, faceArte).map(x => x.c.id), doc.textSlots.filter(s => s.faceId === faceId).map(s => s.id), (tema as { ordemFace?: Record<string, string[]> }).ordemFace?.[faceArte]).acimaDosTextos
  const sobe = (l: ItemPilha[]) => l.filter(x => ordAcima.has(x.id)), fica = (l: ItemPilha[]) => l.filter(x => !ordAcima.has(x.id))
  return [...sobe(cima), ...sobe(meio), ...textos, ...fica(cima), ...fica(meio), ...fundo]
}

/** Alt + clique: o próximo da pilha abaixo do atual (volta ao topo no fim). Sem Alt: o de cima. */
export function escolherNaPilha(pilha: ItemPilha[], atual: string | null, descer: boolean): ItemPilha | null {
  if (!pilha.length) return null
  if (!descer || !atual) return pilha[0]
  const i = pilha.findIndex(x => x.id === atual)
  return pilha[(i + 1) % pilha.length]
}

/** Reordena uma camada do tema na lista dela: 'frente' / 'tras' (1 passo) ou 'topo' / 'fundo'. */
export function reordenarCamada(t: DocTema, layerId: string, para: 'frente' | 'tras' | 'topo' | 'fundo' | number): boolean {
  const listas = [...Object.values(t.partContent), ...Object.values(t.faceContent ?? {})]
  for (const lista of listas) {
    const i = lista.findIndex(c => c.id === layerId)
    if (i < 0) continue
    const j = typeof para === 'number' ? Math.max(0, Math.min(lista.length - 1, para))
      : para === 'frente' ? Math.min(lista.length - 1, i + 1) : para === 'tras' ? Math.max(0, i - 1) : para === 'topo' ? lista.length - 1 : 0
    if (j === i) return false
    const [c] = lista.splice(i, 1)
    lista.splice(j, 0, c)
    return true
  }
  return false
}
