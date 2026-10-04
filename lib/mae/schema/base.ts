// mae-schema — BASE: o kit montado uma vez (pranchetas, moldes, faces, partes, posições de texto).
// Fiel ao exemplo de base da spec. Campos que só ganham regra em sprints futuras ficam opcionais
// e a validação deles aperta quando a sprint chegar (importação = 3, faces = 4, assistente = 5).
import { z } from 'zod'
import { CaminhoRelativo, Id, Mm, MmPositivo, SCHEMA_VERSION, Sha256 } from './comum'
import { Prancheta } from './prancheta'

/** Ponto [x, y] em mm. */
export const PontoMm = z.tuple([Mm, Mm])

export const Aresta = z.object({
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  /** corte = borda com o fundo; dobra = borda com outra face. */
  kind: z.enum(['cut', 'fold']),
})

export const Face = z.object({
  id: Id,
  partId: Id.optional(),
  /** Polígono em mm, no sistema do molde (origem no canto superior esquerdo do recorte do molde). */
  polygonMm: z.array(PontoMm).min(3),
  edges: z.array(Aresta).optional(),
  /** Furo (janela da alça, fenda): não recebe arte; a usuária troca furo ↔ face (Sprint 4). */
  hole: z.boolean().optional(),
  /** Criada ou alterada à mão (laço, dividir, unir) — "Detectar de novo" pergunta antes de apagar. */
  manual: z.boolean().optional(),
})

/** Formatos aceitos na importação (Sprint 3). */
export const TipoArquivoMolde = z.enum(['pdf', 'svg', 'dxf', 'png', 'jpg'])

/** Como a escala do molde foi definida (a receita guarda; o arquivo fica na Biblioteca). */
export const Calibracao = z.object({
  /** vetor = PDF/SVG/DXF com unidade; dpi/largura/medida = imagem (sempre confirmada pela usuária). */
  method: z.enum(['vector', 'dpi', 'width', 'measure']),
  /** Imagem: pixels do ARQUIVO por mm. */
  pxPerMm: z.number().positive().optional(),
  /** DXF: mm por unidade do desenho ($INSUNITS ou escolhido pela usuária). */
  mmPerUnit: z.number().positive().optional(),
  /** SVG/DXF: fator aplicado sobre o tamanho declarado (1 = como veio). */
  scale: z.number().positive().optional(),
})

const PosicaoIdentidade = z.object({ xMm: Mm, yMm: Mm, wMm: MmPositivo })

export const Molde = z.object({
  id: Id,
  name: z.string().min(1).max(120),
  artboardId: Id,
  source: z.object({
    path: CaminhoRelativo, sha256: Sha256,
    /** Largura do molde (o recorte) em mm. */
    widthMm: MmPositivo,
    heightMm: MmPositivo.optional(),
    kind: TipoArquivoMolde.optional(),
    /** PDF: página (1, 2, …). */
    page: z.number().int().positive().optional(),
    /** Recorte do molde dentro da página/arquivo, em mm (o resto da página fica de fora). */
    crop: z.object({ xMm: Mm, yMm: Mm, wMm: MmPositivo, hMm: MmPositivo }).optional(),
    calibration: Calibracao.optional(),
  }),
  /** Parâmetros da detecção de faces usados neste molde. */
  detection: z.object({ closeMm: MmPositivo, threshold: z.number().min(1).max(255) }).optional(),
  transform: z.object({ xMm: Mm, yMm: Mm, rotationDeg: z.number().default(0) }),
  faces: z.array(Face).default([]),
  identity: z.object({ logo: PosicaoIdentidade.optional(), qr: PosicaoIdentidade.optional() }).optional(),
})

export const Enquadramento = z.object({
  /** preencher (cover), caber (contain), esticar (stretch) ou manual. */
  mode: z.enum(['cover', 'contain', 'stretch', 'manual']),
  scale: z.number().positive().default(1),
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
  rotationDeg: z.number().default(0),
  mirror: z.boolean().optional(),
})

export const Parte = z.object({
  id: Id,
  name: z.string().min(1).max(60),
  referenceAspect: z.number().positive().optional(),
  instances: z.array(z.object({ faceId: Id, fit: Enquadramento })).default([]),
})

const ConfigLinhas = z.object({ lines: z.union([z.literal(1), z.literal(2)]), sizePt: z.number().positive(), lineHeight: z.number().positive().optional() })

export const PosicaoTexto = z.object({
  id: Id,
  variable: z.string().min(1).max(40),
  faceId: Id,
  /** Caixa em coordenadas normalizadas (0 a 1) da face. */
  box: z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() }),
  single: ConfigLinhas.optional(),
  compound: ConfigLinhas.optional(),
  autoFit: z.object({ minScale: z.number().min(0.1).max(1) }).optional(),
})

export const DocBase = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  type: z.literal('base'),
  id: Id,
  version: z.number().int().positive(),
  name: z.string().min(1).max(120),
  units: z.literal('mm'),
  smartArt: z.object({ overflowMm: MmPositivo.default(10) }).optional(),
  artboards: z.array(Prancheta).min(1),
  molds: z.array(Molde).default([]),
  parts: z.array(Parte).default([]),
  textSlots: z.array(PosicaoTexto).default([]),
})
export type DocBase = z.infer<typeof DocBase>
