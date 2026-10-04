// mae-schema — FERRAMENTAS DE EDIÇÃO (Sprint 10): máscara de camada (pintada + degradê), ajustes não
// destrutivos e deformação (distorcer/perspectiva/malha). Valem para camadas do tema e da arte única.
// Coordenadas da máscara e da malha: o QUADRADO UNITÁRIO da própria camada (0..1) — assim, no tema, o que
// se pinta numa caixa vale para todas as faces da parte (a máscara anda com a camada).
import { z } from 'zod'
import { RefArquivo } from './comum'

const Fracao = z.number().min(0).max(1)
const Cor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

/** Degradê de máscara: transição suave entre duas camadas (ex.: dois papéis). Vetorial = nítido no PDF. */
export const DegradeMascara = z.object({
  type: z.enum(['linear', 'radial', 'angular', 'reflected']).default('linear'),
  /** Pontos no quadrado da camada (0..1). */
  x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number(),
  /** Paradas: posição (0..1) → opacidade da camada (0 = some, 1 = aparece). */
  stops: z.array(z.object({ pos: Fracao, alpha: Fracao })).min(2),
})

export const MascaraCamada = z.object({
  enabled: z.boolean().default(true),
  invert: z.boolean().default(false),
  /** Suavizar a borda (mm). */
  featherMm: z.number().min(0).max(30).default(0),
  gradient: DegradeMascara.optional(),
  /** Máscara pintada: PNG cujo ALPHA é a máscara (no quadrado da camada). Fica na Biblioteca. */
  raster: RefArquivo.optional(),
})
export type MascaraCamada = z.infer<typeof MascaraCamada>

const comumAj = { enabled: z.boolean().default(true), opacity: Fracao.default(1) }
export const Ajuste = z.discriminatedUnion('type', [
  z.object({ ...comumAj, type: z.literal('brightnessContrast'), brightness: z.number().min(-150).max(150).default(0), contrast: z.number().min(-100).max(100).default(0) }),
  z.object({ ...comumAj, type: z.literal('hueSaturation'), hue: z.number().min(-180).max(180).default(0), saturation: z.number().min(-100).max(100).default(0), lightness: z.number().min(-100).max(100).default(0), colorize: z.boolean().default(false) }),
  z.object({ ...comumAj, type: z.literal('levels'), inBlack: z.number().min(0).max(253).default(0), inWhite: z.number().min(2).max(255).default(255), gamma: z.number().min(0.1).max(9.99).default(1), outBlack: z.number().min(0).max(255).default(0), outWhite: z.number().min(0).max(255).default(255) }),
  z.object({ ...comumAj, type: z.literal('curves'), points: z.array(z.tuple([z.number().min(0).max(255), z.number().min(0).max(255)])).min(2).default([[0, 0], [255, 255]]) }),
  z.object({ ...comumAj, type: z.literal('colorBalance'), shadows: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]), midtones: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]), highlights: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]) }),
  z.object({ ...comumAj, type: z.literal('vibrance'), vibrance: z.number().min(-100).max(100).default(0), saturation: z.number().min(-100).max(100).default(0) }),
  z.object({ ...comumAj, type: z.literal('blackWhite'), reds: z.number().min(-200).max(300).default(40), yellows: z.number().min(-200).max(300).default(60), greens: z.number().min(-200).max(300).default(40), cyans: z.number().min(-200).max(300).default(60), blues: z.number().min(-200).max(300).default(20), magentas: z.number().min(-200).max(300).default(80), tint: Cor.optional() }),
  z.object({ ...comumAj, type: z.literal('gradientMap'), stops: z.array(z.object({ pos: Fracao, color: Cor })).min(2).default([{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }]) }),
])
export type Ajuste = z.infer<typeof Ajuste>
export type TipoAjuste = Ajuste['type']
export const NOMES_AJUSTE: Record<TipoAjuste, string> = {
  brightnessContrast: 'Brilho/contraste', hueSaturation: 'Matiz/saturação', levels: 'Níveis', curves: 'Curvas',
  colorBalance: 'Equilíbrio de cores', vibrance: 'Vibração', blackWhite: 'Preto e branco', gradientMap: 'Mapa de degradê',
}
export const ajustePadrao = (t: TipoAjuste): Ajuste => Ajuste.parse({ type: t })

/**
 * Deformação da imagem: grade (cols+1) × (rows+1) de pontos, cada um a posição (no quadrado da camada) para
 * onde vai o ponto correspondente da grade regular. 2×2 = distorcer/perspectiva; 3×3 ou mais = malha.
 */
export const Deformacao = z.object({
  cols: z.number().int().min(1).max(8),
  rows: z.number().int().min(1).max(8),
  pts: z.array(z.tuple([z.number(), z.number()])),
}).refine(d => d.pts.length === (d.cols + 1) * (d.rows + 1), 'malha com número de pontos errado')
export type Deformacao = z.infer<typeof Deformacao>
export const deformacaoNeutra = (cols: number, rows: number): Deformacao => ({ cols, rows, pts: Array.from({ length: (cols + 1) * (rows + 1) }, (_, i) => [(i % (cols + 1)) / cols, Math.floor(i / (cols + 1)) / rows] as [number, number]) })

/** Contorno de uma forma (Sprint 10: formas com preenchimento e traçado). */
export const TracoForma = z.object({ color: Cor, widthMm: z.number().min(0.01).max(20) })

/** Formas prontas, desenhadas no quadrado da camada. */
export const TipoForma = z.enum(['rect', 'ellipse', 'polygon', 'star', 'heart', 'line', 'path'])
export const ParamsForma = z.object({
  radius: Fracao.default(0), sides: z.number().int().min(3).max(24).default(6), inner: z.number().min(0.1).max(0.95).default(0.5),
  /** Caneta Bézier: caminho SVG no quadrado da camada (0..1). */
  d: z.string().max(200_000).optional(),
})
