// mae-vínculo — ENQUADRAMENTO: do espaço de referência da PARTE para cada FACE (spec: "o conteúdo da
// parte é desenhado num espaço de referência normalizado e o enquadramento de cada face converte").
//
// • Espaço de referência da parte: retângulo [0, A] × [0, 1] (A = proporção largura/altura da parte).
// • Quadro da face: o retângulo envolvente da face girado pela rotação do enquadramento (girar 180° =
//   fecho de ponta-cabeça). Nele vivem os elementos de âncora "face" (posição em % da face).
// • Papel: o espaço de referência é colocado no quadro conforme o modo — preencher (cover), caber
//   (contain), esticar (stretch) ou manual — e então escala/deslocamento/espelhar.
import { caixa, centroide, type Pt } from '../faces/geometria'
import { compor, escalar, girar, transladar, aplicar, type M } from './matriz'

export type ModoEnquadramento = 'cover' | 'contain' | 'stretch' | 'manual'
export interface Enquadramento { mode: ModoEnquadramento; scale?: number; offsetX?: number; offsetY?: number; rotationDeg?: number; mirror?: boolean }
export const ENQUADRAMENTO_PADRAO: Enquadramento = { mode: 'cover', scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 }

export interface Quadro {
  /** Centro, tamanho (mm) e rotação do quadro da face. */
  cx: number; cy: number; w: number; h: number; rot: number
  /** [0,1]² do quadro da face → mm do molde (âncora "face"; sem espelhar). */
  face: M
  /** Espaço de referência da parte ([0,A] × [0,1]) → mm do molde (âncora "papel"). */
  papel: M
}

/** Retângulo envolvente da face no sistema girado de `rot` graus (centro em mm do molde). */
export function retanguloGirado(poly: Pt[], rot: number): { cx: number; cy: number; w: number; h: number } {
  const c = centroide(poly)
  const desgira = girar(-rot)
  const loc = poly.map(([x, y]) => aplicar(desgira, x - c[0], y - c[1]))
  const b = caixa(loc)
  const [mx, my] = aplicar(girar(rot), (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)
  return { cx: c[0] + mx, cy: c[1] + my, w: b.w, h: b.h }
}

/** Fatores de escala do espaço de referência (A × 1) para caber no quadro w × h. */
export function fatores(modo: ModoEnquadramento, A: number, w: number, h: number): [number, number] {
  if (modo === 'stretch') return [w / A, h]
  const k = modo === 'contain' ? Math.min(w / A, h) : Math.max(w / A, h)   // cover e manual partem do cover
  return [k, k]
}

export function quadroDaFace(poly: Pt[], fit: Enquadramento | undefined, A: number): Quadro {
  const f = { ...ENQUADRAMENTO_PADRAO, ...(fit ?? {}) }
  const rot = f.rotationDeg ?? 0
  const r = retanguloGirado(poly, rot)
  const face = compor(transladar(r.cx, r.cy), girar(rot), escalar(r.w, r.h), transladar(-0.5, -0.5))
  const [kx, ky] = fatores(f.mode, A, r.w, r.h)
  const s = f.scale ?? 1
  const papel = compor(
    transladar(r.cx, r.cy), girar(rot),
    transladar((f.offsetX ?? 0) * r.w, (f.offsetY ?? 0) * r.h),
    escalar(kx * s * (f.mirror ? -1 : 1), ky * s),
    transladar(-A / 2, -0.5),
  )
  return { ...r, rot, face, papel }
}

/** Proporção (largura/altura) de uma face sem rotação — a 1ª face marcada define a da parte. */
export function proporcaoDaFace(poly: Pt[], rot = 0): number {
  const r = retanguloGirado(poly, rot)
  return r.h > 0 ? r.w / r.h : 1
}
