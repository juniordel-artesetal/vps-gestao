// mae-schema — TEMA: papéis, elementos, fontes e estilos aplicados sobre uma versão da base.
// Fiel ao exemplo de tema da spec. Efeitos e ajustes locais ganham regra própria nas Sprints 6 a 8.
import { z } from 'zod'
import { CaminhoRelativo, Id, MmPositivo, SCHEMA_VERSION, Sha256 } from './comum'

export const Transformacao = z.object({
  x: z.number(), y: z.number(),
  scale: z.number().positive().default(1),
  rotationDeg: z.number().default(0),
})

export const Aplique = z.object({
  enabled: z.boolean(),
  borderMm: MmPositivo.max(5).default(0),
  borderColor: z.string().max(30).optional(),
  silhouetteMm: MmPositivo.max(15).default(3),
})

const CamadaComum = {
  id: Id,
  /** "face" = posição em % da face (padrão de elementos); "paper" = acompanha o papel (padrão de fundos). */
  anchor: z.enum(['face', 'paper']).optional(),
  transform: Transformacao.optional(),
  /** Estilos de camada (Sprint 8): por enquanto qualquer objeto com `type`. */
  effects: z.array(z.object({ type: z.string() }).passthrough()).optional(),
  applique: Aplique.optional(),
  visible: z.boolean().optional(),
}

export const CamadaImagem = z.object({
  ...CamadaComum, type: z.literal('image'), path: CaminhoRelativo, sha256: Sha256.optional(),
  /** Proporção largura/altura da imagem (para o tamanho sair certo sem abrir o arquivo). */
  aspect: z.number().positive().optional(),
  name: z.string().max(80).optional(),
})

export const CamadaTexto = z.object({
  ...CamadaComum,
  type: z.literal('text'),
  slot: z.string().min(1).max(40),
  font: z.object({ postscriptName: z.string().min(1), features: z.record(z.string(), z.number()).optional() }).optional(),
  effectPresetId: Id.optional(),
})

export const Camada = z.discriminatedUnion('type', [CamadaImagem, CamadaTexto])
export type Camada = z.infer<typeof Camada>

export const DocTema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  type: z.literal('theme'),
  id: Id,
  version: z.number().int().positive(),
  name: z.string().min(1).max(120).optional(),
  baseId: Id,
  baseVersion: z.number().int().positive(),
  overflowFill: z.object({ path: CaminhoRelativo, sha256: Sha256.optional(), aspect: z.number().positive().optional() }).optional(),
  /** Conteúdo vinculado por PARTE (aparece em todas as faces da parte). */
  partContent: z.record(Id, z.array(Camada)).default({}),
  /** Ajustes "Só nesta caixa": face → camada → propriedades sobrescritas. */
  localOverrides: z.record(Id, z.record(Id, z.record(z.string(), z.unknown()))).default({}),
  /** Camadas exclusivas de UMA face (Desvincular, ou arrastar com Alt): face → camadas. */
  faceContent: z.record(Id, z.array(Camada)).default({}),
  hashtag: z.object({ middle: z.string().max(40).default('faz') }).optional(),
})
export type DocTema = z.infer<typeof DocTema>
