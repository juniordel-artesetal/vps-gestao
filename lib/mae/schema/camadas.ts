// mae-schema — CAMADAS (Sprint 2): a árvore que o motor de render desenha.
// Na Sprint 2 ela mora na prancheta (o "Editor de imagem = arte única"). Na Sprint 6 o conteúdo das
// partes do tema é convertido nesta MESMA árvore, por face — o motor não muda.
// Ordem: o array vai de BAIXO para CIMA (índice 0 = camada do fundo), como o motor desenha.
// O painel mostra invertido (de cima para baixo), igual ao Photoshop.
import { z } from 'zod'
import { Id, Mm, RefArquivo } from './comum'

/** Os 16 modos nativos do Canvas 2D (globalCompositeOperation), nos nomes da spec. */
export const MODOS_MESCLAGEM = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
] as const
export const ModoMesclagem = z.enum(MODOS_MESCLAGEM)
export type ModoMesclagem = z.infer<typeof ModoMesclagem>

/** Nomes como na spec e no Photoshop em português. */
export const NOMES_MESCLAGEM: Record<ModoMesclagem, string> = {
  normal: 'Normal', multiply: 'Multiplicação', screen: 'Tela', overlay: 'Sobreposição',
  darken: 'Escurecer', lighten: 'Clarear', 'color-dodge': 'Subexposição de cor', 'color-burn': 'Superexposição de cor',
  'hard-light': 'Luz dura', 'soft-light': 'Luz suave', difference: 'Diferença', exclusion: 'Exclusão',
  hue: 'Matiz', saturation: 'Saturação', color: 'Cor', luminosity: 'Luminosidade',
}

const Fracao = z.number().min(0).max(1)

interface ComumCamada {
  id: string
  name: string
  visible: boolean
  locked: boolean
  /** Opacidade da camada (0–1): vale para o conteúdo E para os efeitos (Sprint 8). */
  opacity: number
  /** Preenchimento (0–1): vale só para o conteúdo, não para os efeitos. */
  fill: number
  blendMode: ModoMesclagem
  /** Máscara de recorte: aparece só onde a camada de base (a não recortada logo abaixo) tem pixel. */
  clip: boolean
}
export interface NoImagem extends ComumCamada {
  type: 'image'; src: z.infer<typeof RefArquivo>
  xMm: number; yMm: number; wMm: number; hMm: number; rotationDeg: number
}
export interface NoSolida extends ComumCamada {
  type: 'solid'; color: string
  xMm: number; yMm: number; wMm: number; hMm: number
}
export interface NoGrupo extends ComumCamada {
  type: 'group'
  /** "Atravessar" (padrão do Photoshop): as camadas do grupo mesclam com o que está abaixo do grupo. */
  passThrough: boolean
  children: NoCamada[]
}
export type NoCamada = NoImagem | NoSolida | NoGrupo

const comum = {
  id: Id,
  name: z.string().max(80).default('Camada'),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  opacity: Fracao.default(1),
  fill: Fracao.default(1),
  blendMode: ModoMesclagem.default('normal'),
  clip: z.boolean().default(false),
}
const caixa = { xMm: Mm, yMm: Mm, wMm: z.number().positive(), hMm: z.number().positive() }

export const NoImagemZ = z.object({ ...comum, type: z.literal('image'), src: RefArquivo, ...caixa, rotationDeg: z.number().default(0) })
export const NoSolidaZ = z.object({ ...comum, type: z.literal('solid'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), ...caixa })
export const NoGrupoZ = z.object({
  ...comum, type: z.literal('group'), passThrough: z.boolean().default(true),
  get children() { return z.array(NoCamadaZ) },
})
export const NoCamadaZ: z.ZodType<NoCamada, unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [NoImagemZ, NoSolidaZ, NoGrupoZ])) as unknown as z.ZodType<NoCamada, unknown>
