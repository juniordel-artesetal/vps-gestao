// Lote 6 (item 81): a PILHA de uma caixa no tema — o que está desenhado nela, de cima para baixo — e o que fica
// sob um ponto. Fonte única do clique na arte (seleciona o objeto de cima; Alt + clique desce na pilha) e do
// painel Camadas (lista TODAS as camadas da caixa: textos, apliques, elementos, formas, moldurinha, papéis).
// Ordem igual à do resolvedor: papéis da parte → papéis só desta caixa → demais da parte → demais só desta caixa,
// e os textos por cima de tudo.
import type { DocTema, DocTrabalho } from '../schema'
import type { Pt } from '../faces/geometria'
import type { Quadro } from './enquadramento'
import { aplicar, inversa } from './matriz'
import { efetiva, ajustesDaFace, ehCamadaDePapel, matrizDaCamada, posicaoEfetiva, ehAplique } from './resolver'
import { liderDoCenario } from './cenario'

type Camada = DocTema['partContent'][string][number]
export type ItemPilha =
  | { tipo: 'texto'; id: string; nome: string; variavel: string }
  | { tipo: 'camada'; id: string; nome: string; camada: Camada; caixa: boolean; papel: boolean; aplique: boolean }

const ROTULO_TIPO: Record<string, string> = { image: 'Imagem', solid: 'Cor sólida', frame: 'Moldurinha', shape: 'Forma', text: 'Texto' }
export const nomeDaCamada = (c: Camada): string => c.name || (c.type === 'image' ? c.path.split('/').pop()!.replace(/\.[^.]+$/, '') : ROTULO_TIPO[c.type] ?? c.type)

/** Camadas de UMA face na ordem de desenho (de baixo para cima), com o ajuste "só nesta caixa" aplicado. */
export function camadasDaFace(tema: DocTema, partId: string | null, faceId: string): { c: Camada; caixa: boolean }[] {
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
export function pilhaDaFace(doc: Pick<DocTrabalho, 'textSlots' | 'parts'> & Partial<Pick<DocTrabalho, 'molds'>>, tema: DocTema, faceId: string): ItemPilha[] {
  const lider = doc.molds ? liderDoCenario(doc as never, tema, faceId) : null
  const faceArte = lider?.faceId ?? faceId
  const parte = doc.parts.find(p => p.instances.some(i => i.faceId === faceArte)) ?? null
  const textos: ItemPilha[] = doc.textSlots.filter(s => s.faceId === faceId).map(s => ({ tipo: 'texto', id: s.id, nome: s.variable, variavel: s.variable }))
  const camadas: ItemPilha[] = camadasDaFace(tema, parte?.id ?? null, faceArte).reverse()
    .map(({ c, caixa }) => ({ tipo: 'camada', id: c.id, nome: nomeDaCamada(c), camada: c, caixa, papel: ehCamadaDePapel(c), aplique: ehAplique(tema, c) }))
  return [...textos, ...camadas]
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
}): ItemPilha[] {
  const { doc, tema, faceId, local, quadro: q } = o
  const qa = o.quadroArte ?? q, polArte = o.poligonoArte ?? o.poligono
  const lider = (doc as { molds?: unknown }).molds ? liderDoCenario(doc as never, tema, faceId) : null
  const faceArte = lider?.faceId ?? faceId
  const parte = doc.parts.find(p => p.instances.some(i => i.faceId === faceArte)) ?? null
  const A = parte?.referenceAspect ?? 1
  const textos: ItemPilha[] = []
  for (const s of doc.textSlots) {
    if (s.faceId !== faceId) continue
    // Lote 8 (item 123): texto oculto ou travado não se seleciona na arte (no painel Camadas, sim)
    if (tema.textSlotAdjust?.[s.id]?.hidden || tema.textSlotAdjust?.[s.id]?.locked) continue
    const ef = posicaoEfetiva(s, tema, o.valores ?? {})
    const b = ef.caixa
    // a caixa pode estar girada: desfaz o giro em volta do centro dela (em mm) antes de testar
    const [cx, cy] = aplicar(q.face, b.x + b.w / 2, b.y + b.h / 2)
    const g = (-ef.rotacaoDeg * Math.PI) / 180, dx = local[0] - cx, dy = local[1] - cy
    const [u, v] = aplicar(inversa(q.face), cx + dx * Math.cos(g) - dy * Math.sin(g), cy + dx * Math.sin(g) + dy * Math.cos(g))
    if (u >= b.x && u <= b.x + b.w && v >= b.y && v <= b.y + b.h) textos.push({ tipo: 'texto', id: s.id, nome: s.variable, variavel: s.variable })
  }
  const cima: ItemPilha[] = [], meio: ItemPilha[] = [], fundo: ItemPilha[] = []
  for (const { c, caixa } of camadasDaFace(tema, parte?.id ?? null, faceArte).reverse()) {
    // Lote 8 (item 132): travada (cadeado) também fica fora — o clique e o Alt + clique passam para a de baixo
    if (c.visible === false || c.type === 'text' || (c as { locked?: boolean }).locked) continue
    const item: ItemPilha = { tipo: 'camada', id: c.id, nome: nomeDaCamada(c), camada: c, caixa, papel: ehCamadaDePapel(c), aplique: ehAplique(tema, c) }
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
  return [...textos, ...cima, ...meio, ...fundo]
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
