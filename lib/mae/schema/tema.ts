// mae-schema — TEMA: papéis, elementos, fontes e estilos aplicados sobre uma versão da base.
// Fiel ao exemplo de tema da spec. Efeitos e ajustes locais ganham regra própria nas Sprints 6 a 8.
import { z } from 'zod'
import { CaminhoRelativo, Id, SCHEMA_VERSION, Sha256 } from './comum'
import { Ajuste, Deformacao, MascaraCamada, TipoForma, ParamsForma, TracoForma } from './edicao'

export const Transformacao = z.object({
  x: z.number(), y: z.number(),
  scale: z.number().positive().default(1),
  rotationDeg: z.number().default(0),
  /** Sprint 10: escala vertical extra (largura × altura independentes), inclinar e espelhar. */
  scaleY: z.number().positive().optional(),
  skewXDeg: z.number().min(-80).max(80).optional(),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
})

/** Aplique 3D numa camada (Sprint 11). Sem valor = vale o padrão do tema (`appliques`). */
export const Aplique = z.object({
  enabled: z.boolean(),
  borderMm: z.number().min(0).max(5).optional(),
  borderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  silhouetteMm: z.number().min(0).max(15).optional(),
})

/** Apliques 3D do tema (Sprint 11): ligados por tema; padrões da bordinha e da silhueta; marca de cada folha. */
export const ApliquesTema = z.object({
  enabled: z.boolean().default(false),
  borderMm: z.number().min(0).max(5).default(1),
  borderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
  silhouetteMm: z.number().min(0).max(15).default(3),
  /** Marca de registro da folha de impressos e da de silhuetas (preset da conta). */
  printMarkId: Id.optional(),
  cutMarkId: Id.optional(),
  /** Lote 4 (item 48): orientação das folhas de aplique (a distribuição se ajusta; a marca gira junto). */
  orientacao: z.enum(['retrato', 'paisagem']).optional(),
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
  /** Sprint 10: máscara (no quadrado da camada), ajustes não destrutivos e nome. */
  mask: MascaraCamada.optional(),
  adjustments: z.array(Ajuste).optional(),
  name: z.string().max(80).optional(),
  /** Lote 4 (item 51): MÁSCARA DE CORTE — a camada aparece só dentro da camada de baixo (Alt + clique). */
  recortada: z.boolean().optional(),
  /** Lote 2 (item 21): o elemento PODE vazar da face junto com o papel (desligado = recortado no contorno). */
  bleed: z.boolean().optional(),
  /** Lote 3 (itens 27/34): opacidade da camada (0–1; sem = 100%). */
  opacity: z.number().min(0).max(1).optional(),
  /** Lote 1: transição de papéis — a máscara em degradê é gerada destes 3 controles (vinculo/transicao). */
  transition: z.object({
    dir: z.enum(['baixo', 'cima', 'direita', 'esquerda', 'centro']),
    pos: z.number().min(0).max(1),
    soft: z.number().min(0.02).max(1),
  }).optional(),
}

export const CamadaImagem = z.object({
  ...CamadaComum, type: z.literal('image'), path: CaminhoRelativo, sha256: Sha256.optional(),
  /** Proporção largura/altura da imagem (para o tamanho sair certo sem abrir o arquivo). */
  aspect: z.number().positive().optional(),
  /** Sprint 10: distorcer/perspectiva/malha. */
  warp: Deformacao.optional(),
  /**
   * Lote 3 (item 29): papel em PADRÃO REPETIDO (azulejo) em vez de esticado. `sizeMm` = largura de um azulejo
   * (a mesma em todas as faces da parte: a estampa tem a mesma escala em todas as caixas do kit); `mirror`
   * espelha os vizinhos para disfarçar a emenda; `offsetX/Y` (mm) move o padrão dentro da face.
   */
  repeat: z.object({ sizeMm: z.number().min(2).max(500), mirror: z.boolean().optional(), offsetXMm: z.number().optional(), offsetYMm: z.number().optional() }).optional(),
})

/** Sprint 10: forma vetorial (retângulo, elipse, polígono, estrela, coração, linha, caneta). */
export const CamadaForma = z.object({
  ...CamadaComum, type: z.literal('shape'), kind: TipoForma, params: ParamsForma.default({ radius: 0, sides: 6, inner: 0.5 }),
  fill: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().default('#f472b6'),
  stroke: TracoForma.nullable().default(null),
  aspect: z.number().positive().default(1),
})

/** Lote 1 (item 7): COR SÓLIDA como preenchimento — funciona como um papel (âncora papel). */
export const CamadaSolida = z.object({
  ...CamadaComum, type: z.literal('solid'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

/** Lote 1 (item 6): MOLDURINHA — a borda da face recuada para dentro, contínua ou pesponto. */
export const CamadaMoldura = z.object({
  ...CamadaComum, type: z.literal('frame'),
  offsetMm: z.number().min(0).max(60).default(3),
  widthMm: z.number().min(0.05).max(15).default(0.6),
  dash: z.object({ onMm: z.number().min(0.1).max(30), offMm: z.number().min(0.1).max(30) }).nullable().default(null),
  cornerMm: z.number().min(0).max(40).default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
})

export const CamadaTexto = z.object({
  ...CamadaComum,
  type: z.literal('text'),
  slot: z.string().min(1).max(40),
  font: z.object({ postscriptName: z.string().min(1), features: z.record(z.string(), z.number()).optional() }).optional(),
  effectPresetId: Id.optional(),
})

export const Camada = z.discriminatedUnion('type', [CamadaImagem, CamadaTexto, CamadaForma, CamadaSolida, CamadaMoldura])
export type Camada = z.infer<typeof Camada>

/** Fonte do texto: o tema guarda só o nome técnico (+ a origem, para achar/baixar de novo). */
export const FonteTexto = z.object({
  postscriptName: z.string().min(1).max(120),
  family: z.string().max(120).optional(),
  /** local = instalada no computador (Local Font Access); google = Google Fonts (baixada para a Biblioteca). */
  source: z.enum(['local', 'google']).default('local'),
  url: z.string().url().optional(),
})

/** Escolha de glifo numa letra (painel de glifos): por recurso OpenType ou por um glifo do Unicode privado. */
export const EscolhaGlifo = z.union([
  z.object({ index: z.number().int().nonnegative(), char: z.string().max(4), kind: z.literal('feature'), tag: z.string().length(4), value: z.number().int().min(0).max(99) }),
  z.object({ index: z.number().int().nonnegative(), char: z.string().max(4), kind: z.literal('unicode'), cp: z.number().int().positive() }),
  /** Glifo sem código Unicode (fontes sem GSUB guardam alternativos assim). */
  z.object({ index: z.number().int().nonnegative(), char: z.string().max(4), kind: z.literal('glyph'), gid: z.number().int().positive() }),
])

/** Estilo de um texto (Sprint 7) — vale para todas as posições daquela variável. */
export const EstiloTexto = z.object({
  font: FonteTexto,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1f2937'),
  caixa: z.enum(['normal', 'alta', 'baixa']).default('normal'),
  align: z.enum(['left', 'center', 'right']).default('center'),
  /** Tracking em milésimos do em (como no Photoshop). */
  tracking: z.number().min(-300).max(1000).default(0),
  kerning: z.boolean().default(true),
  /** Entrelinha (multiplica o tamanho). */
  lineHeight: z.number().min(0.5).max(3).default(1),
  scaleX: z.number().min(0.3).max(3).default(1),
  scaleY: z.number().min(0.3).max(3).default(1),
  baselineMm: z.number().min(-50).max(50).default(0),
  /** Texto em curva: raio em mm (positivo = arco para cima, negativo = para baixo, 0 = reto). */
  curveRadiusMm: z.number().min(-2000).max(2000).default(0),
  /** Recursos OpenType ligados no texto todo (ex.: 'swsh', 'ss01', 'salt'); 'liga' e 'calt' vêm ligados. */
  features: z.array(z.string().length(4)).default([]),
  glyphChoices: z.array(EscolhaGlifo).default([]),
  effects: z.array(z.object({ type: z.string() }).passthrough()).default([]),
  effectPresetId: Id.optional(),
  /** Lote 4 (item 50): efeitos PRÓPRIOS do nome composto (2 palavras ou mais); sem eles, valem os `effects`. */
  efeitosComposto: z.array(z.object({ type: z.string() }).passthrough()).optional(),
  /**
   * Lote 4 (item 51): "Preencher com papel" — textura recortada DENTRO do texto (glitter no NOME), com os estilos
   * (traçado, sombra, chanfro) por cima. `scale` e `dx/dy` (fração do texto) movem e redimensionam a textura.
   */
  textura: z.object({ path: CaminhoRelativo, sha256: Sha256.optional(), aspect: z.number().positive().optional(), scale: z.number().min(0.2).max(10).optional(), dx: z.number().min(-2).max(2).optional(), dy: z.number().min(-2).max(2).optional() }).optional(),
  /** Lote 1: tamanho do texto em TODAS as caixas (multiplica o tamanho da posição da base). */
  sizeScale: z.number().min(0.2).max(4).optional(),
  /** Lote 3 (item 9): giro do texto em TODAS as caixas (soma com o da posição e o "só nesta caixa"). */
  rotationDeg: z.number().min(-360).max(360).optional(),
  /**
   * Lote 5 (item 75): TROCAR UMA LETRA — a letra (ex.: "J") sai noutra fonte (mais legível) ou noutro glifo da
   * mesma fonte, em todos os pedidos. `so`: só na inicial de cada palavra, ou em todas. Ajuste fino da troca.
   */
  trocas: z.array(z.object({
    letra: z.string().min(1).max(2),
    so: z.enum(['inicial', 'todas']).default('todas'),
    fonte: FonteTexto.optional(),
    gid: z.number().int().positive().optional(),
    escala: z.number().min(0.3).max(3).optional(),
    baselineMm: z.number().min(-20).max(20).optional(),
    espacoMm: z.number().min(-10).max(10).optional(),
  })).optional(),
  /**
   * Lote 5 (item 74): FUNDO AUTOMÁTICO atrás do texto (a faixa da hashtag): retângulo que acompanha o tamanho
   * do texto, ou a LOGO do tema com a área do nome marcada (a logo nunca deforma; o nome cabe na área).
   */
  fundo: z.object({
    tipo: z.enum(['retangulo', 'imagem']),
    cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#dc2626'),
    raioMm: z.number().min(0).max(50).default(0),
    /** Sobra nas laterais (mm), além da largura do texto. */
    sobraMm: z.number().min(0).max(50).default(3),
    /** Altura da faixa em % da altura do texto. */
    alturaPct: z.number().min(0.5).max(4).default(1.5),
    /** Texto um pouco ACIMA do centro da faixa (fração da altura da faixa; + = texto mais para cima). */
    textoAcima: z.number().min(-0.5).max(0.5).default(0.05),
    effects: z.array(z.object({ type: z.string() }).passthrough()).default([]),
    textura: z.object({ path: CaminhoRelativo, sha256: Sha256.optional(), aspect: z.number().positive().optional() }).optional(),
    imagem: z.object({ path: CaminhoRelativo, sha256: Sha256.optional(), aspect: z.number().positive(),
      /** Área do nome dentro da logo (fração da imagem). */
      area: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0.02).max(1), h: z.number().min(0.02).max(1) }),
      /** Faixa lisa: pode esticar SÓ na largura até X (1.3 = 30%). */
      esticarAte: z.number().min(1).max(2).optional() }).optional(),
  }).optional(),
})
export type EstiloTexto = z.infer<typeof EstiloTexto>

export const DocTema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  type: z.literal('theme'),
  id: Id,
  version: z.number().int().positive(),
  name: z.string().min(1).max(120).optional(),
  /** Lote 4 (item 44): a qual PRODUTO o tema pertence ("Kit Festa", "Sacola P"). A arte = produto + tema. */
  produto: z.string().max(80).optional(),
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
  /** Estilo por VARIÁVEL (NOME, IDADE, HASHTAG…): "estilizar o nome uma vez, vale para todas as posições". */
  textStyles: z.record(z.string().min(1).max(40), EstiloTexto).default({}),
  appliques: ApliquesTema.optional(),
  /** Lote 1: ajuste "Só nesta caixa" de UMA posição de texto (tamanho, deslocamento em % da face, giro). */
  textSlotAdjust: z.record(Id, z.object({
    scale: z.number().min(0.2).max(4).optional(), dx: z.number().min(-1).max(1).optional(), dy: z.number().min(-1).max(1).optional(),
    rotationDeg: z.number().min(-360).max(360).optional(),
  })).optional(),
  /** Lote 1 (item 7): cores usadas no tema, para reaplicar com um clique. */
  palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(24).default([]),
  /** Lote 5 (item 62): formato da idade no SUFIXO (anos/aninhos/só o número) e maiúsculas/minúsculas. */
  idade: z.object({ formato: z.enum(['anos', 'aninhos', 'numero']).default('anos'), caixa: z.enum(['maiusculas', 'minusculas', 'primeira']).default('maiusculas') }).optional(),
  /** Lote 5 (item 72): grupos da base que este tema NÃO tem (ex.: tema sem rótulo). Os outros geram "Tema · Grupo". */
  gruposDesligados: z.array(Id).optional(),
  /** Valores de prévia enquanto não há pedido (NOME, IDADE…). */
  sample: z.record(z.string().min(1).max(40), z.string().max(120)).default({ NOME: 'Maria Júlia', IDADE: '1' }),
})
export type DocTema = z.infer<typeof DocTema>
