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

const PosicaoIdentidade = z.object({ xMm: Mm, yMm: Mm, wMm: MmPositivo, /** Lote 1: giro em volta do centro. */ rotationDeg: z.number().min(-360).max(360).optional() })

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
  /** Lote 5 (item 66): CENÁRIO CONTÍNUO — as faces desta parte no mesmo molde viram um cenário só. */
  cenario: z.boolean().optional(),
})

const ConfigLinhas = z.object({
  lines: z.union([z.literal(1), z.literal(2)]), sizePt: z.number().positive(), lineHeight: z.number().positive().optional(),
  /** Lote 4 (item 50): posição própria do modo (simples × composto), deslocamento em fração da face. */
  dx: z.number().min(-1).max(1).optional(), dy: z.number().min(-1).max(1).optional(),
})

export const PosicaoTexto = z.object({
  id: Id,
  variable: z.string().min(1).max(40),
  faceId: Id,
  /** Caixa em coordenadas normalizadas (0 a 1) da face. */
  box: z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() }),
  single: ConfigLinhas.optional(),
  compound: ConfigLinhas.optional(),
  /**
   * Lote 5 (item 73): bloco "NOME + IDADE" (variável NOME_IDADE): nome em cima e idade embaixo, na mesma linha,
   * ou "Nome faz 5". `idadePct` = tamanho da idade em % do nome; `espaco` = entre as linhas (fração do nome).
   */
  bloco: z.object({ arranjo: z.enum(['empilhado', 'linha', 'faz']).default('empilhado'), idadePct: z.number().min(0.2).max(1.5).default(0.6), espaco: z.number().min(-0.5).max(1).default(0.05) }).optional(),
  /**
   * Lote 5 (item 77): FRASE presa ao nome ("A Pequena" em cima de "Laura", "Fazendinha do Davi"): acima/abaixo (linha
   * própria, com o estilo da FRASE e tamanho em % do nome) ou antes/depois na mesma linha. Anda junto com a caixa
   * do nome; frase vazia some e o nome recentraliza.
   */
  frase: z.object({ posicao: z.enum(['acima', 'abaixo', 'antes', 'depois']).default('acima'), tamanhoPct: z.number().min(0.2).max(1.5).default(0.5), espaco: z.number().min(-0.5).max(1).default(0.05) }).optional(),
  autoFit: z.object({ minScale: z.number().min(0.1).max(1) }).optional(),
  /** Lote 1: giro do texto em volta do centro da caixa (graus, sentido horário). */
  rotationDeg: z.number().min(-360).max(360).optional(),
})

/**
 * Lote 5 (item 72): GRUPO DE PRODUTO da base de portfólio — uma pastinha de moldes ligada a um produto do SOA
 * (Precificação). O mesmo molde pode estar em mais de um grupo (mesma arte). As partes valem para a base toda.
 * Sem grupos, a base funciona como antes (um produto só).
 */
export const GrupoProduto = z.object({
  id: Id,
  nome: z.string().min(1).max(80),
  /** Produto/variação da Precificação (a edição em massa acha o grupo pelo item do pedido). */
  produtoId: z.string().max(120).nullable().optional(),
  variacaoId: z.string().max(120).nullable().optional(),
  produtoNome: z.string().max(200).nullable().optional(),
  moldes: z.array(Id).default([]),
  /** Lote 5 (item 76): produto de peças pequenas → sai na FOLHA MONTADA (1 kit = 1 folha). */
  folhaId: Id.optional(),
})
export type GrupoProduto = z.infer<typeof GrupoProduto>

/** Lote 5 (item 76): FOLHA DE IMPRESSÃO MONTADA — onde vai cada peça (molde) na folha, com a marca de registro. */
export const FolhaMontada = z.object({
  id: Id,
  nome: z.string().min(1).max(80),
  widthMm: MmPositivo,
  heightMm: MmPositivo,
  registrationPresetId: Id.optional(),
  registrationPresetSha: z.string().optional(),
  espacoMm: z.number().min(0).max(50).default(2),
  margemMm: z.number().min(0).max(50).default(5),
  pecas: z.array(z.object({ moldeId: Id, xMm: Mm, yMm: Mm, rot: z.union([z.literal(0), z.literal(90)]).default(0) })).default([]),
  /**
   * Lote 5 (item 76): KIT = as peças do pedido nunca se dividem entre folhas (abre folha nova); AVULSO = peças soltas
   * que preenchem os buracos e continuam na próxima folha (peças ÷ capacidade → N folhas). Padrão: kit.
   */
  tipo: z.enum(['kit', 'avulso']).optional(),
  /** Avulso: a última folha é completada com cópias extras (senão fica com os lugares vazios). */
  completarUltima: z.boolean().optional(),
})
export type FolhaMontada = z.infer<typeof FolhaMontada>

export const DocBase = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  type: z.literal('base'),
  id: Id,
  version: z.number().int().positive(),
  name: z.string().min(1).max(120),
  units: z.literal('mm'),
  smartArt: z.object({
    overflowMm: MmPositivo.default(10),
    /** Papel padrão das abas e faces sem parte (o tema pode trocar com `overflowFill`). */
    flapFill: z.object({ path: CaminhoRelativo, sha256: Sha256, aspect: z.number().positive().optional() }).optional(),
  }).optional(),
  artboards: z.array(Prancheta).min(1),
  molds: z.array(Molde).default([]),
  parts: z.array(Parte).default([]),
  textSlots: z.array(PosicaoTexto).default([]),
  /** Lote 2 (item 26): TEMA PRONTO — base montada a partir de uma arte pronta (PDF/PNG em Temas/): uma
   *  prancheta por página. Exporta sem sobra e sem linhas de corte (a arte já vem fechada). */
  pronto: z.object({ path: CaminhoRelativo, sha256: Sha256 }).optional(),
  /** Lote 5 (item 72): grupos de produto (base de portfólio). */
  grupos: z.array(GrupoProduto).optional(),
  /** Lote 5 (item 76): folhas de impressão montadas (peças pequenas). */
  folhas: z.array(FolhaMontada).optional(),
})
export type DocBase = z.infer<typeof DocBase>
