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
   * Lote 4 (item 51): o papel dentro do texto ("Preencher com papel") junto com os efeitos — vai para a nuvem
   * (mae_effect_presets.textura) e vale em qualquer computador da conta (o arquivo vem da Biblioteca).
   */
  textura: z.object({ path: z.string().min(1).max(400), sha256: z.string().optional(), aspect: z.number().positive().optional(), scale: z.number().optional(), dx: z.number().optional(), dy: z.number().optional() }).optional(),
  /** Lote 10 (item 154): preset de MOLDURINHA (parâmetros + "em cada face"; os efeitos vão em `effects`). Os presets
   *  de moldura não aparecem na lista de estilos de texto — só em "Molduras salvas". */
  moldura: z.object({ params: z.record(z.string(), z.unknown()), porFace: z.boolean().optional() }).optional(),
  /** Lote 10 (item 157): preset de CONJUNTO DE APLIQUE (as peças; o nome é a usuária quem dá). */
  conjunto: z.object({ aspect: z.number().positive().default(1), pecas: z.array(z.record(z.string(), z.unknown())).min(1).max(12) }).optional(),
  /** Lote 5 (item 74): o FUNDO do texto (faixa/logo) vai junto no preset. */
  fundo: z.record(z.string(), z.unknown()).optional(),
  /** Lote 5 (item 75): as regras de TROCAR LETRA da fonte vão junto no preset. */
  trocas: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
  /** Lote 6 (item 110): altura do texto (mm) em que o preset foi feito — ao aplicar, os efeitos acompanham o tamanho. */
  refAlturaMm: z.number().positive().max(1000).optional(),
})
export type Preset = z.infer<typeof Preset>

/** Preset novo a partir dos efeitos de uma camada (qualquer outra coisa é descartada). */
export function presetDeEfeitos(name: string, efeitos: unknown, id = `ep_${Math.random().toString(36).slice(2, 10)}`): Preset {
  return Preset.parse({ id, name: name.trim().slice(0, 80) || 'Meu estilo', effects: limparEfeitos(efeitos), owner: 'me', free: true })
}

/** Aplicar um preset = copiar os efeitos (cópia profunda, para editar sem mexer no preset). */
export const efeitosDoPreset = (p: Preset) => limparEfeitos(JSON.parse(JSON.stringify(p.effects)))

/** Lote 6 (item 110): altura de texto para a qual os presets sem referência foram desenhados (nome de caixa grande). */
export const REF_ALTURA_PADRAO_MM = 15
const MAX_MM: Record<string, number> = { stroke: 20, bevel: 20 }
const r2 = (v: number) => Math.round(v * 100) / 100
/**
 * Lote 6 (item 110): ESCALAR EFEITOS (como o "Escalar efeitos" do Photoshop) — traçado, sombra, brilho e chanfro
 * multiplicados por `k` (ângulos, cores e opacidade não mudam). Respeita os limites do schema.
 */
export function escalarEfeitos(efs: unknown, k: number): ReturnType<typeof limparEfeitos> {
  const lista = limparEfeitos(efs)
  if (!(k > 0) || Math.abs(k - 1) < 1e-6) return lista
  return limparEfeitos(lista.map(e => {
    const n = { ...e } as Record<string, unknown>
    const max = MAX_MM[e.type] ?? 50
    for (const c of ['sizeMm', 'distanceMm']) if (typeof n[c] === 'number') n[c] = Math.min(max, r2((n[c] as number) * k))
    return n
  }))
}
/**
 * Lote 8 (item 130): altura de UMA LINHA do texto na arte (mm) — a base da escala dos presets. Acha a linha pelo texto
 * selecionado (ou o 1º desta variável): no bloco Nome + idade a linha principal sai como NOME e a idade/frase como
 * `<slot>:idade` / `<slot>:frase` (antes não achava e o preset entrava a 100%); nome em 2 linhas mede o dobro → ÷ linhas.
 */
export function alturaDeUmaLinha(infos: { slotId: string; variavel: string; linhas?: string[]; cantosMm?: [number, number][] }[], variavel: string, slotIds: string[], slotSel?: string | null): number | null {
  const suf = variavel === 'FRASE' ? ':frase' : variavel === 'NOME_IDADE:IDADE' ? ':idade' : ''
  const ids = slotSel && slotIds.includes(slotSel) ? [slotSel, ...slotIds.filter(x => x !== slotSel)] : slotIds
  const ok = (i: (typeof infos)[number]) => i.cantosMm?.length === 4
  const info = ids.map(id => infos.find(i => i.slotId === `${id}${suf}` && ok(i))).find(Boolean) ?? infos.find(i => i.variavel === variavel && ok(i))
  if (!info) return null
  const c = info.cantosMm!
  const h = Math.hypot(c[3][0] - c[0][0], c[3][1] - c[0][1]) / Math.max(1, info.linhas?.length ?? 1)
  return h > 0 ? h : null
}
/** Fator para o preset no texto atual (altura em mm): proporcional à altura em que ele foi feito. */
export function fatorDoPreset(p: Pick<Preset, 'refAlturaMm'>, alturaTextoMm: number | null | undefined): number {
  if (!alturaTextoMm || !(alturaTextoMm > 0)) return 1
  return Math.max(0.15, Math.min(4, alturaTextoMm / (p.refAlturaMm ?? REF_ALTURA_PADRAO_MM)))
}

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
