// mae-schema — ESTILOS DE CAMADA (Sprint 8), para texto E qualquer camada, empilháveis como no
// Photoshop: traçado (vários), sombra projetada, sombra interna, brilho externo e interno, chanfro e
// entalhe (aproximação), sobreposição de cor, de degradê e de padrão. Medidas em mm.
// Um PRESET guarda só esta lista — nunca a fonte (spec, "Presets de efeito").
import { z } from 'zod'
import { RefArquivo } from './comum'
// (ModoMesclagem fica aqui para não criar ciclo com camadas.ts)
export const MODOS_EF = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'] as const
const ModoMesclagem = z.enum(MODOS_EF)

const Cor = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const Fracao = z.number().min(0).max(1)
const comum = { enabled: z.boolean().default(true), opacity: Fracao.default(1) }

export const EfeitoTraco = z.object({ ...comum, type: z.literal('stroke'), sizeMm: z.number().min(0).max(20), color: Cor, position: z.enum(['outside', 'center', 'inside']).default('outside') })
export const EfeitoSombra = z.object({
  ...comum, type: z.literal('dropShadow'), color: Cor, blendMode: ModoMesclagem.default('multiply'),
  /** Ângulo da LUZ (graus, como no Photoshop: 120° = sombra para baixo e para a direita). */
  angleDeg: z.number().default(120), distanceMm: z.number().min(0).max(50).default(1), sizeMm: z.number().min(0).max(50).default(1),
  /** Espalhar (0–1): a sombra cresce antes de desfocar. */
  spread: Fracao.default(0),
})
export const EfeitoSombraInterna = EfeitoSombra.extend({ type: z.literal('innerShadow') })
export const EfeitoBrilhoExterno = z.object({ ...comum, type: z.literal('outerGlow'), color: Cor, blendMode: ModoMesclagem.default('screen'), sizeMm: z.number().min(0).max(50).default(2), spread: Fracao.default(0) })
export const EfeitoBrilhoInterno = z.object({ ...comum, type: z.literal('innerGlow'), color: Cor, blendMode: ModoMesclagem.default('screen'), sizeMm: z.number().min(0).max(50).default(1.5), source: z.enum(['edge', 'center']).default('edge') })
export const EfeitoChanfro = z.object({
  ...comum, type: z.literal('bevel'), style: z.enum(['inner', 'emboss']).default('inner'),
  depth: z.number().min(0.1).max(3).default(1), sizeMm: z.number().min(0).max(20).default(1), angleDeg: z.number().default(120),
  highlightColor: Cor.default('#ffffff'), highlightOpacity: Fracao.default(0.75), shadowColor: Cor.default('#000000'), shadowOpacity: Fracao.default(0.5),
})
export const EfeitoCor = z.object({ ...comum, type: z.literal('colorOverlay'), color: Cor, blendMode: ModoMesclagem.default('normal') })
export const EfeitoDegrade = z.object({
  ...comum, type: z.literal('gradientOverlay'), blendMode: ModoMesclagem.default('normal'),
  stops: z.array(z.object({ pos: Fracao, color: Cor })).min(2), angleDeg: z.number().default(90), style: z.enum(['linear', 'radial']).default('linear'),
})
export const EfeitoPadrao = z.object({ ...comum, type: z.literal('patternOverlay'), src: RefArquivo, blendMode: ModoMesclagem.default('normal'), scale: z.number().positive().max(10).default(1) })

export const Efeito = z.discriminatedUnion('type', [EfeitoTraco, EfeitoSombra, EfeitoSombraInterna, EfeitoBrilhoExterno, EfeitoBrilhoInterno, EfeitoChanfro, EfeitoCor, EfeitoDegrade, EfeitoPadrao])
export type Efeito = z.infer<typeof Efeito>
export type TipoEfeito = Efeito['type']

export const NOMES_EFEITO: Record<TipoEfeito, string> = {
  stroke: 'Traçado', dropShadow: 'Sombra projetada', innerShadow: 'Sombra interna', outerGlow: 'Brilho externo', innerGlow: 'Brilho interno',
  bevel: 'Chanfro e entalhe', colorOverlay: 'Sobreposição de cor', gradientOverlay: 'Sobreposição de degradê', patternOverlay: 'Sobreposição de padrão',
}

/** Efeito novo com valores padrão (o que a usuária vê ao clicar em "+"). */
export function efeitoPadrao(tipo: TipoEfeito): Efeito {
  const base: Record<TipoEfeito, unknown> = {
    stroke: { type: 'stroke', sizeMm: 0.8, color: '#ffffff', position: 'outside' },
    dropShadow: { type: 'dropShadow', color: '#000000', opacity: 0.45, distanceMm: 0.8, sizeMm: 1 },
    innerShadow: { type: 'innerShadow', color: '#000000', opacity: 0.4, distanceMm: 0.5, sizeMm: 0.8 },
    outerGlow: { type: 'outerGlow', color: '#fff7ae', opacity: 0.8, sizeMm: 2 },
    innerGlow: { type: 'innerGlow', color: '#ffffff', opacity: 0.6, sizeMm: 1 },
    bevel: { type: 'bevel', sizeMm: 0.8 },
    colorOverlay: { type: 'colorOverlay', color: '#ec4899' },
    gradientOverlay: { type: 'gradientOverlay', stops: [{ pos: 0, color: '#fde68a' }, { pos: 1, color: '#f59e0b' }] },
    patternOverlay: { type: 'patternOverlay', src: { path: 'Papéis/padrao.png', sha256: 'padrao' } },
  }
  return Efeito.parse(base[tipo])
}

/** Lista de efeitos vinda de fora (preset, colar estilo): só o que é efeito válido, sem nada a mais. */
export function limparEfeitos(v: unknown): Efeito[] {
  if (!Array.isArray(v)) return []
  return v.map(x => Efeito.safeParse(x)).filter(r => r.success).map(r => r.data!)
}
