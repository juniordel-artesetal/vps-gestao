// mae-schema — CAMADAS (Sprint 2): a árvore que o motor de render desenha.
// Na Sprint 2 ela mora na prancheta (o "Editor de imagem = arte única"). Na Sprint 6 o conteúdo das
// partes do tema é convertido nesta MESMA árvore, por face — o motor não muda.
// Ordem: o array vai de BAIXO para CIMA (índice 0 = camada do fundo), como o motor desenha.
// O painel mostra invertido (de cima para baixo), igual ao Photoshop.
import { z } from 'zod'
import { Id, Mm, RefArquivo } from './comum'
import { Efeito } from './efeitos'
import { Ajuste, Deformacao, TracoForma, TipoForma, ParamsForma, type MascaraCamada as MascaraEd } from './edicao'

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
  /** Estilos de camada (Sprint 8), de baixo para cima na lista do painel. */
  effects?: Efeito[]
  /** Sprint 10: ajustes não destrutivos (antes da máscara e dos efeitos). */
  adjustments?: Ajuste[]
  /** Sprint 10: máscara de camada, já em mm da folha (o resolvedor converte do quadrado da camada). */
  mask?: MascaraNo
}
/** Máscara no motor: degradê em mm da folha + raster com a matriz do quadrado da camada. */
export interface MascaraNo {
  enabled: boolean; invert: boolean; featherMm: number
  /** Pontos do degradê no quadrado da camada quando há `matrix` (quadrado → mm); senão, em mm da folha. */
  gradient?: { type: 'linear' | 'radial' | 'angular' | 'reflected'; x0: number; y0: number; x1: number; y1: number; stops: { pos: number; alpha: number }[]; matrix?: [number, number, number, number, number, number] }
  raster?: { src: { path: string; sha256: string }; matrix: [number, number, number, number, number, number] }
}
export type { MascaraEd }
export interface NoImagem extends ComumCamada {
  type: 'image'; src: z.infer<typeof RefArquivo>
  xMm: number; yMm: number; wMm: number; hMm: number; rotationDeg: number
  /**
   * Matriz afim [a, b, c, d, e, f] que leva o quadrado unitário da imagem para mm da folha
   * (x' = a·s + c·t + e; y' = b·s + d·t + f). Quando existe, vale no lugar da caixa — é como o
   * vínculo MAE (Sprint 6) estica, espelha e gira o papel em cada face.
   */
  matrix?: [number, number, number, number, number, number]
  /** Sprint 10: deformação (distorcer, perspectiva, malha) no quadrado da imagem. */
  warp?: Deformacao
  /** Sprint 13: espelhar (imagem de caixa). */
  flipX?: boolean
  flipY?: boolean
}
export interface NoSolida extends ComumCamada {
  type: 'solid'; color: string
  xMm: number; yMm: number; wMm: number; hMm: number
}
/**
 * Caminho vetorial (mm da folha) em sintaxe SVG — é como o TEXTO chega ao motor (Sprint 7): os glifos já
 * moldados pelo HarfBuzz viram um caminho só; tela e arquivo desenham o mesmo caminho.
 */
export interface NoCaminho extends ComumCamada {
  type: 'path'; d: string; color: string
  /** Formas (Sprint 10): traçado do contorno; `fillNone` = só o contorno. */
  stroke?: { color: string; widthMm: number }
  fillNone?: boolean
  /** Caixa do caminho em mm (para os efeitos trabalharem num buffer pequeno). */
  bboxMm: [number, number, number, number]
}
/** Forma poligonal (mm da folha). Vários anéis com regra par-ímpar: o 1º é o contorno, os outros são furos. */
export interface NoForma extends ComumCamada {
  type: 'shape'; color: string
  rings: [number, number][][]
}
export interface NoGrupo extends ComumCamada {
  type: 'group'
  /** "Atravessar" (padrão do Photoshop): as camadas do grupo mesclam com o que está abaixo do grupo. */
  passThrough: boolean
  children: NoCamada[]
}
/** Caixa posicionável do editor de imagem (mm da folha, girada em volta do centro). */
interface CaixaGirada { xMm: number; yMm: number; wMm: number; hMm: number; rotationDeg: number }
/**
 * Sprint 13 (editor de imagem unificado): TEXTO livre. Guarda o texto e o estilo; na hora de desenhar vira
 * um caminho (`materializar`), com a fonte carregada no navegador — tela = arquivo.
 */
export interface NoTexto extends ComumCamada, CaixaGirada {
  type: 'text'; valor: string; color: string
  font: { postscriptName: string; family?: string; source?: 'local' | 'google' }
  tamanhoPt: number; align: 'left' | 'center' | 'right'; tracking: number; lineHeight: number
  caixa: 'normal' | 'alta' | 'baixa' | 'titulo'; features: string[]
  stroke?: { color: string; widthMm: number }
}
/** Sprint 13: FORMA livre (retângulo, elipse, polígono, estrela, coração, linha, seta) na caixa. */
export interface NoFormaLivre extends ComumCamada, CaixaGirada {
  type: 'vshape'; kind: 'rect' | 'ellipse' | 'polygon' | 'star' | 'heart' | 'line' | 'path' | 'arrow'
  params: { radius: number; sides: number; inner: number; d?: string }
  color: string | null; stroke?: { color: string; widthMm: number } | null
}
/** Sprint 13: CAMADA DE AJUSTE — os ajustes (e a máscara) valem para TUDO o que está abaixo dela. */
export interface NoAjuste extends ComumCamada { type: 'adjust' }
export type NoCamada = NoImagem | NoSolida | NoForma | NoCaminho | NoGrupo | NoTexto | NoFormaLivre | NoAjuste

const comum = {
  id: Id,
  name: z.string().max(80).default('Camada'),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  opacity: Fracao.default(1),
  fill: Fracao.default(1),
  blendMode: ModoMesclagem.default('normal'),
  clip: z.boolean().default(false),
  effects: z.array(Efeito).optional(),
  adjustments: z.array(Ajuste).optional(),
  mask: z.object({
    enabled: z.boolean(), invert: z.boolean(), featherMm: z.number(),
    gradient: z.object({ type: z.enum(['linear', 'radial', 'angular', 'reflected']), x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number(), stops: z.array(z.object({ pos: z.number(), alpha: z.number() })), matrix: z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()]).optional() }).optional(),
    raster: z.object({ src: RefArquivo, matrix: z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()]) }).optional(),
  }).optional(),
}
const caixa = { xMm: Mm, yMm: Mm, wMm: z.number().positive(), hMm: z.number().positive() }

export const NoImagemZ = z.object({
  ...comum, type: z.literal('image'), src: RefArquivo, ...caixa, rotationDeg: z.number().default(0),
  matrix: z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()]).optional(),
  warp: Deformacao.optional(),
  flipX: z.boolean().optional(), flipY: z.boolean().optional(),
})
export const NoCaminhoZ = z.object({ ...comum, type: z.literal('path'), d: z.string().max(2_000_000), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), bboxMm: z.tuple([Mm, Mm, Mm, Mm]), stroke: TracoForma.optional(), fillNone: z.boolean().optional() })
export const NoFormaZ = z.object({ ...comum, type: z.literal('shape'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), rings: z.array(z.array(z.tuple([Mm, Mm])).min(3)).min(1) })
export const NoSolidaZ = z.object({ ...comum, type: z.literal('solid'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), ...caixa })
const caixaGirada = { ...caixa, rotationDeg: z.number().default(0) }
const Cor = z.string().regex(/^#[0-9a-fA-F]{6}$/)
export const NoTextoZ = z.object({
  ...comum, ...caixaGirada, type: z.literal('text'), valor: z.string().max(5000), color: Cor,
  font: z.object({ postscriptName: z.string().min(1).max(120), family: z.string().max(120).optional(), source: z.enum(['local', 'google']).optional() }),
  tamanhoPt: z.number().min(1).max(1000), align: z.enum(['left', 'center', 'right']).default('center'), tracking: z.number().min(-300).max(1000).default(0),
  lineHeight: z.number().min(0.5).max(3).default(1.15), caixa: z.enum(['normal', 'alta', 'baixa', 'titulo']).default('normal'),
  features: z.array(z.string().length(4)).default([]), stroke: TracoForma.optional(),
})
export const NoFormaLivreZ = z.object({
  ...comum, ...caixaGirada, type: z.literal('vshape'), kind: z.union([TipoForma, z.literal('arrow')]), params: ParamsForma.default({ radius: 0, sides: 6, inner: 0.5 }),
  color: Cor.nullable(), stroke: TracoForma.nullable().optional(),
})
export const NoAjusteZ = z.object({ ...comum, type: z.literal('adjust') })
export const NoGrupoZ = z.object({
  ...comum, type: z.literal('group'), passThrough: z.boolean().default(true),
  get children() { return z.array(NoCamadaZ) },
})
export const NoCamadaZ: z.ZodType<NoCamada, unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [NoImagemZ, NoSolidaZ, NoFormaZ, NoCaminhoZ, NoGrupoZ, NoTextoZ, NoFormaLivreZ, NoAjusteZ])) as unknown as z.ZodType<NoCamada, unknown>
