// mae-schema — PRANCHETA: a folha física, em mm (A4, A5, A6 ou personalizada).
import { z } from 'zod'
import { Id, MmPositivo } from './comum'
import { NoCamadaZ } from './camadas'

export const FuncaoPrancheta = z.enum(['arte', 'appliques_print', 'appliques_silhouette'])

export const Prancheta = z.object({
  id: Id,
  widthMm: MmPositivo.refine(v => v > 0, 'Largura precisa ser maior que zero'),
  heightMm: MmPositivo.refine(v => v > 0, 'Altura precisa ser maior que zero'),
  /** Para que serve a folha; sem `role` = folha de arte comum. */
  role: FuncaoPrancheta.optional(),
  /** Preset de marca de registro aplicado nesta folha (Sprint 9). */
  registrationPresetId: Id.optional(),
  /** Nome amigável ("Caixas", "Etiquetas"…). */
  name: z.string().max(80).optional(),
  /** Lote 1: posição na área de trabalho (mm); sem ela, as pranchetas ficam lado a lado (fila antiga). */
  xMm: z.number().min(-100000).max(100000).optional(),
  yMm: z.number().min(-100000).max(100000).optional(),
  /** Camadas da arte desta folha (Sprint 2 — "Editor de imagem"), de baixo para cima. */
  layers: z.array(NoCamadaZ).optional(),
})
export type Prancheta = z.infer<typeof Prancheta>

/** Tamanhos de folha prontos, em mm, na orientação RETRATO. */
export const FOLHAS = {
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  A6: { widthMm: 105, heightMm: 148 },
} as const
export type Folha = keyof typeof FOLHAS
export type Orientacao = 'retrato' | 'paisagem'

/** Medidas de uma folha pronta na orientação pedida. */
export function medidasFolha(folha: Folha, orientacao: Orientacao = 'retrato'): { widthMm: number; heightMm: number } {
  const f = FOLHAS[folha]
  return orientacao === 'paisagem' ? { widthMm: f.heightMm, heightMm: f.widthMm } : { widthMm: f.widthMm, heightMm: f.heightMm }
}
