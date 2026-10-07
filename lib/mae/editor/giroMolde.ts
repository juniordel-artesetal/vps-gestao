// Lote 4 (item 41): GIRO DO MOLDE na folha, em passos de 90°. O molde guarda as faces no próprio sistema
// (mm, 0..largura × 0..altura do arquivo); `transform.xMm/yMm` é o canto de cima/esquerda da CAIXA do molde
// na prancheta (já girada) e `transform.rotationDeg` o giro (horário, como na tela). Tudo que desenha ou mede
// o molde na folha (tela, arte, linhas, recortes, apliques) passa por aqui. Puro.
import type { DocTrabalho } from '../schema'
import { aplicar, compor, girar, inversa, transladar, type M } from '../vinculo/matriz'

type Molde = DocTrabalho['molds'][number]
type P = [number, number]

/** Giro em 0, 90, 180 ou 270 (o mais perto). */
export const giroDo = (m: Pick<Molde, 'transform'>): 0 | 90 | 180 | 270 =>
  ((((Math.round((m.transform.rotationDeg ?? 0) / 90) * 90) % 360) + 360) % 360) as 0 | 90 | 180 | 270

/** Tamanho do molde no próprio sistema (sem giro). */
export const tamanhoLocal = (m: Pick<Molde, 'source'>) => ({ w: m.source.widthMm, h: m.source.heightMm ?? m.source.widthMm })

/** Caixa do molde NA FOLHA (já com o giro): x/y = transform; 90°/270° trocam largura e altura. */
export function caixaNaFolha(m: Pick<Molde, 'transform' | 'source'>): { x: number; y: number; w: number; h: number } {
  const { w, h } = tamanhoLocal(m), r = giroDo(m)
  return { x: m.transform.xMm, y: m.transform.yMm, w: r % 180 ? h : w, h: r % 180 ? w : h }
}

/** Deslocamento do ponto (0,0) do molde dentro da caixa girada (= onde o "grupo" do molde fica na tela). */
export function cantoDoGiro(m: Pick<Molde, 'transform' | 'source'>): P {
  const { w, h } = tamanhoLocal(m), r = giroDo(m)
  return r === 90 ? [h, 0] : r === 180 ? [w, h] : r === 270 ? [0, w] : [0, 0]
}

/** Matriz molde → folha (mm da prancheta). */
export function matrizDoMolde(m: Pick<Molde, 'transform' | 'source'>): M {
  const [ox, oy] = cantoDoGiro(m)
  return compor(transladar(m.transform.xMm + ox, m.transform.yMm + oy), girar(giroDo(m)))
}
export const paraFolha = (m: Pick<Molde, 'transform' | 'source'>, p: P): P => aplicar(matrizDoMolde(m), p[0], p[1])
export const daFolha = (m: Pick<Molde, 'transform' | 'source'>, p: P): P => aplicar(inversa(matrizDoMolde(m)), p[0], p[1])

/**
 * Moldes de uma prancheta que GIROU 90° (horário, ou anti-horário com `sentido = -1`): cada molde gira 90° e
 * muda de lugar como se a folha inteira tivesse girado; depois o conjunto é recentralizado na folha nova.
 * `W`/`H` = tamanho da prancheta ANTES de girar.
 */
export function girarMoldesDaPrancheta(d: DocTrabalho, abId: string, W: number, H: number, sentido: 1 | -1 = 1): void {
  const ms = d.molds.filter(m => m.artboardId === abId)
  if (!ms.length) return
  for (const m of ms) {
    const c = caixaNaFolha(m)
    // horário: (x, y) → (H − y, x); anti-horário: (x, y) → (y, W − x)
    const nx = sentido === 1 ? H - (c.y + c.h) : c.y
    const ny = sentido === 1 ? c.x : W - (c.x + c.w)
    m.transform = { ...m.transform, xMm: r2(nx), yMm: r2(ny), rotationDeg: (giroDo(m) + (sentido === 1 ? 90 : 270)) % 360 }
  }
  const cs = ms.map(caixaNaFolha)
  const x0 = Math.min(...cs.map(c => c.x)), y0 = Math.min(...cs.map(c => c.y))
  const x1 = Math.max(...cs.map(c => c.x + c.w)), y1 = Math.max(...cs.map(c => c.y + c.h))
  // folha nova: H × W
  const dx = (H - (x1 - x0)) / 2 - x0, dy = (W - (y1 - y0)) / 2 - y0
  for (const m of ms) m.transform = { ...m.transform, xMm: r2(m.transform.xMm + dx), yMm: r2(m.transform.yMm + dy) }
}
const r2 = (v: number) => Math.round(v * 100) / 100
