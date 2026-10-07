// mae-efeitos — PRESETS DE EFEITO (Sprint 8). Um preset guarda SÓ os efeitos — nunca a fonte: ao aplicar,
// a usuária usa a fonte que quiser e pode editar qualquer efeito depois. Biblioteca privada (da conta) e
// Loja da Naty (grátis ou pagos; a compra é a Sprint 12).
import { z } from 'zod'
import { Efeito, limparEfeitos } from '../schema/efeitos'

export const Preset = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(80),
  effects: z.array(Efeito),
  /** 'me' = biblioteca privada da conta; 'naty' = Loja da Naty. */
  owner: z.enum(['me', 'naty']).default('me'),
  free: z.boolean().default(true),
  priceCents: z.number().int().nonnegative().optional(),
  /** Sugestão de cor/fonte só para a PRÉVIA da loja (não vai para o texto da usuária). */
  previewNote: z.string().max(120).optional(),
  /**
   * Lote 4 (item 51): o papel dentro do texto ("Preencher com papel") junto com os efeitos. Fica no preset
   * deste computador; a cópia na nuvem guarda só os efeitos.
   */
  textura: z.object({ path: z.string().min(1).max(400), sha256: z.string().optional(), aspect: z.number().positive().optional(), scale: z.number().optional(), dx: z.number().optional(), dy: z.number().optional() }).optional(),
})
export type Preset = z.infer<typeof Preset>

/** Preset novo a partir dos efeitos de uma camada (qualquer outra coisa é descartada). */
export function presetDeEfeitos(name: string, efeitos: unknown, id = `ep_${Math.random().toString(36).slice(2, 10)}`): Preset {
  return Preset.parse({ id, name: name.trim().slice(0, 80) || 'Meu estilo', effects: limparEfeitos(efeitos), owner: 'me', free: true })
}

/** Aplicar um preset = copiar os efeitos (cópia profunda, para editar sem mexer no preset). */
export const efeitosDoPreset = (p: Preset) => limparEfeitos(JSON.parse(JSON.stringify(p.effects)))

const tr = (sizeMm: number, color: string) => ({ type: 'stroke' as const, sizeMm, color, position: 'outside' as const, enabled: true, opacity: 1 })
const sombra = (distanceMm = 0.7, sizeMm = 0.8, opacity = 0.45) => ({ type: 'dropShadow' as const, color: '#000000', opacity, angleDeg: 120, distanceMm, sizeMm, spread: 0, blendMode: 'multiply' as const, enabled: true })
const deg = (stops: [number, string][], angleDeg = 90) => ({ type: 'gradientOverlay' as const, stops: stops.map(([pos, color]) => ({ pos, color })), angleDeg, style: 'linear' as const, opacity: 1, blendMode: 'normal' as const, enabled: true })

/**
 * Os 5 ESTILOS DE NOME para a Naty aprovar (temas reais de festa). Ficam na "Loja da Naty" como grátis
 * até ela aprovar/ajustar; a lista de traçados vai do mais de baixo (o maior) para o de cima.
 */
export const PRESETS_NATY: Preset[] = [
  {
    id: 'naty_ursinha_rosa', name: 'Ursinha Princesa Rosa', owner: 'naty', free: true, previewNote: 'tema ursinha/coroa, papéis rosa',
    effects: limparEfeitos([sombra(), tr(1.6, '#9d174d'), tr(1.0, '#ffffff'), deg([[0, '#fbcfe8'], [1, '#db2777']]), { type: 'innerShadow', color: '#831843', opacity: 0.35, angleDeg: 120, distanceMm: 0.3, sizeMm: 0.4 }]),
  },
  {
    id: 'naty_stitch_havai', name: 'Stitch Azul Havaí', owner: 'naty', free: true, previewNote: 'tema Stitch/Havaí',
    effects: limparEfeitos([sombra(0.8, 0.9), tr(1.7, '#1e3a8a'), tr(1.0, '#ffffff'), deg([[0, '#bae6fd'], [0.55, '#38bdf8'], [1, '#1d4ed8']]), { type: 'innerGlow', color: '#ffffff', opacity: 0.55, sizeMm: 0.6 }]),
  },
  {
    id: 'naty_safari', name: 'Safari Selva', owner: 'naty', free: true, previewNote: 'tema safari/selva',
    effects: limparEfeitos([sombra(0.8, 0.8, 0.5), tr(1.6, '#422006'), tr(0.9, '#fef3c7'), deg([[0, '#fde68a'], [1, '#b45309']]), { type: 'bevel', sizeMm: 0.6, depth: 1.2, highlightOpacity: 0.6, shadowOpacity: 0.45 }]),
  },
  {
    id: 'naty_fundo_mar', name: 'Fundo do Mar', owner: 'naty', free: true, previewNote: 'tema fundo do mar/sereia',
    effects: limparEfeitos([{ type: 'outerGlow', color: '#a5f3fc', opacity: 0.9, sizeMm: 1.8, spread: 0.2 }, tr(1.0, '#ffffff'), deg([[0, '#67e8f9'], [1, '#0e7490']]), { type: 'innerShadow', color: '#164e63', opacity: 0.4, angleDeg: 120, distanceMm: 0.35, sizeMm: 0.5 }]),
  },
  {
    id: 'naty_princesa_dourada', name: 'Princesa Dourada', owner: 'naty', free: true, previewNote: 'tema princesa/realeza',
    effects: limparEfeitos([sombra(0.9, 1, 0.5), tr(1.8, '#78350f'), tr(1.2, '#ffffff'), deg([[0, '#fef3c7'], [0.5, '#fbbf24'], [1, '#b45309']]), { type: 'bevel', sizeMm: 0.7, depth: 1, highlightOpacity: 0.7, shadowOpacity: 0.4 }]),
  },
]
