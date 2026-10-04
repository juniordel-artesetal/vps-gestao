// mae-vínculo — MATRIZES AFINS 2D [a, b, c, d, e, f] (mesma convenção do Canvas: x' = a·x + c·y + e;
// y' = b·x + d·y + f). Puras.
export type M = [number, number, number, number, number, number]
export const ID: M = [1, 0, 0, 1, 0, 0]

/** m1 ∘ m2 (aplica m2 primeiro). */
export function mult(m1: M, m2: M): M {
  return [
    m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}
export const compor = (...ms: M[]): M => ms.reduce((a, b) => mult(a, b), ID)
export const transladar = (x: number, y: number): M => [1, 0, 0, 1, x, y]
export const escalar = (sx: number, sy = sx): M => [sx, 0, 0, sy, 0, 0]
export function girar(graus: number): M {
  const r = (graus * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r)
  return [c, s, -s, c, 0, 0]
}
export const aplicar = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

export function inversa(m: M): M {
  const det = m[0] * m[3] - m[1] * m[2]
  if (Math.abs(det) < 1e-12) return ID
  const [a, b, c, d, e, f] = m
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}
