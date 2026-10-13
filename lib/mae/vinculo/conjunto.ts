// MAE — CONJUNTO DE APLIQUE (Lote 10, item 157). Puro. Um conjunto = peças empilhadas (de baixo para cima) dentro de
// um quadro; cada peça tem posição (centro) e largura relativas ao quadro do conjunto, e a sua proporção. Ex. da Naty:
// moldura escalopada SÓ RECORTE em papel dourado + círculo IMPRESSO com papel e moldurinha + personagem impresso.
import type { DocTema, PecaConjunto } from '../schema'
import type { M } from './matriz'

type Conjunto = Extract<DocTema['partContent'][string][number], { type: 'conjunto' }>

/** Proporção (largura ÷ altura) da peça: a do PNG, ou a da forma. */
export const aspectoDaPeca = (p: PecaConjunto): number => p.imagem?.aspect ?? p.aspect ?? 1

/** Matriz que leva o quadrado da PEÇA para o quadrado do CONJUNTO. */
export function matrizDaPeca(aspectoConjunto: number, p: PecaConjunto): M {
  const w = p.escala ?? 1
  const h = (w * aspectoConjunto) / aspectoDaPeca(p)
  return [w, 0, 0, h, (p.x ?? 0.5) - w / 2, (p.y ?? 0.5) - h / 2]
}

const gid = (pre: string) => `${pre}_${Math.random().toString(36).slice(2, 8)}`

/** O conjunto padrão (o frame da Naty): escalope dourado (só recorte) + círculo impresso branco com moldurinha. */
export function conjuntoPadrao(nome = 'Conjunto de aplique'): Conjunto {
  return {
    id: gid('l'), type: 'conjunto', name: nome, anchor: 'face', aspect: 1,
    transform: { x: 0.5, y: 0.5, scale: 0.45, rotationDeg: 0 },
    pecas: [
      { id: gid('pc'), nome: 'Moldura escalopada', tipo: 'recorte', material: 'Dourado', cor: '#d4af37', forma: { kind: 'scallop', params: { radius: 0, sides: 12, inner: 0.86 } }, aspect: 1, x: 0.5, y: 0.5, escala: 1 },
      { id: gid('pc'), nome: 'Círculo', tipo: 'impressa', cor: '#ffffff', forma: { kind: 'ellipse', params: { radius: 0, sides: 6, inner: 0.5 } }, aspect: 1, x: 0.5, y: 0.5, escala: 0.82,
        moldura: { offsetMm: 2, widthMm: 0.6, color: '#d4af37', dash: null }, trocar: true },
    ],
  } as unknown as Conjunto
}

/** "Transformar em conjunto": o aplique simples (PNG) vira o personagem por cima do frame padrão, no mesmo lugar. */
export function conjuntoDoAplique(c: { id: string; name?: string; path: string; sha256?: string; aspect?: number; transform?: { x: number; y: number; scale: number; rotationDeg: number } }): Conjunto {
  const cj = conjuntoPadrao(`${c.name ?? 'Aplique'} (conjunto)`)
  ;(cj as { transform?: unknown }).transform = { ...(c.transform ?? { x: 0.5, y: 0.5, scale: 0.4, rotationDeg: 0 }), scale: (c.transform?.scale ?? 0.4) * 1.35 }
  cj.pecas.push({ id: gid('pc'), nome: c.name ?? 'Personagem', tipo: 'impressa', cor: '#ffffff', imagem: { path: c.path, sha256: c.sha256, aspect: c.aspect }, aspect: c.aspect ?? 1, x: 0.5, y: 0.5, escala: 0.7, trocar: true } as PecaConjunto)
  return cj
}
