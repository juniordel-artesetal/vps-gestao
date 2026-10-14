// mae-schema — BASE: o kit montado uma vez (pranchetas, moldes, faces, partes, posições de texto).
// Fiel ao exemplo de base da spec. Campos que só ganham regra em sprints futuras ficam opcionais
// e a validação deles aperta quando a sprint chegar (importação = 3, faces = 4, assistente = 5).
import { z } from 'zod'
import { CaminhoRelativo, Id, Mm, MmPositivo, SCHEMA_VERSION, Sha256, Nome, NomeObrigatorio } from './comum'
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
  /**
   * Lote 6 (item 91): TRANSIÇÃO SUAVE da estrutura — a face some em degradê (alfa 0 em x0,y0 → 1 em x1,y1, mm do
   * molde) sobre o pedaço vizinho, em vez de corte reto.
   */
  fade: z.object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() }).optional(),
})

/** Formatos aceitos na importação (Sprint 3). */
export const TipoArquivoMolde = z.enum(['pdf', 'svg', 'dxf', 'png', 'jpg', 'medida'])

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
  name: NomeObrigatorio(120),
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
  /**
   * Lote 6 (item 90): PEÇA POR MEDIDA (sem arquivo de molde): forma, medida e furo. As faces saem daqui (e da
   * estrutura da base); o contorno de corte é o da forma.
   */
  medida: z.object({
    forma: z.enum(['retangulo', 'arredondado', 'circulo']),
    larguraMm: MmPositivo, alturaMm: MmPositivo,
    raioMm: z.number().min(0).max(200).optional(),
    furo: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), diametroMm: z.number().min(0.5).max(100) }).nullable().optional(),
    catalogoId: z.string().max(60).optional(),
    /**
     * Lote 14 (item 189.5): o MIOLO da peça (a forma de dentro, onde vai a arte e o nome — a tag com fundo xadrez e
     * o círculo no meio). `mesma` = o formato da peça com `margemMm`; senão outra forma em fração da peça.
     */
    miolo: z.object({
      forma: z.enum(['mesma', 'retangulo', 'arredondado', 'circulo']),
      margemMm: z.number().min(0).max(100).optional(),
      x: z.number().min(0).max(1).optional(), y: z.number().min(0).max(1).optional(),
      w: z.number().min(0.02).max(1).optional(), h: z.number().min(0.02).max(1).optional(),
      raioMm: z.number().min(0).max(200).optional(),
    }).nullable().optional(),
  }).optional(),
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
  name: NomeObrigatorio(60),
  referenceAspect: z.number().positive().optional(),
  instances: z.array(z.object({ faceId: Id, fit: Enquadramento })).default([]),
  /** Lote 5 (item 66): CENÁRIO CONTÍNUO — as faces desta parte no mesmo molde viram um cenário só. */
  cenario: z.boolean().optional(),
  /** Lote 9 (item 146): faces da parte SEPARADAS do cenário contínuo (voltam a ter enquadramento próprio). */
  foraDoCenario: z.array(z.string()).optional(),
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
  bloco: z.object({ arranjo: z.enum(['empilhado', 'linha', 'faz']).default('empilhado'), idadePct: z.number().min(0.2).max(1.5).default(0.6), espaco: z.number().min(-2).max(1).default(0.05) }).optional(),
  /**
   * Lote 5 (item 77): FRASE presa ao nome ("A Pequena" em cima de "Laura", "Fazendinha do Davi"): acima/abaixo (linha
   * própria, com o estilo da FRASE e tamanho em % do nome) ou antes/depois na mesma linha. Anda junto com a caixa
   * do nome; frase vazia some e o nome recentraliza.
   */
  frase: z.object({ posicao: z.enum(['acima', 'abaixo', 'antes', 'depois']).default('acima'), tamanhoPct: z.number().min(0.2).max(1.5).default(0.5), espaco: z.number().min(-2).max(1).default(0.05) }).optional(),
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
  nome: NomeObrigatorio(80),
  /** Produto/variação da Precificação (a edição em massa acha o grupo pelo item do pedido). */
  produtoId: z.string().max(120).nullable().optional(),
  variacaoId: z.string().max(120).nullable().optional(),
  produtoNome: z.string().max(200).nullable().optional(),
  moldes: z.array(Id).default([]),
  /** Lote 5 (item 76): produto de peças pequenas → sai na FOLHA MONTADA (1 kit = 1 folha). */
  folhaId: Id.optional(),
  /**
   * Lote 6 (item 94): COMPOSIÇÃO POR UNIDADE — quantas de cada peça formam 1 unidade do produto (Nutella = 1 corpo
   * + 1 tampa; encadernação = 1 capa + 1 contracapa + 2 guardas). Ordem = ordem no PDF. Sem ela: 1 de cada molde.
   */
  composicao: z.array(z.object({ moldeId: Id, qtd: z.number().int().min(1).max(50) })).optional(),
  /** Lote 14 (item 189): as FOLHAS que formam 1 kit do produto, na ordem do PDF (Folha 1, Folha 2…). */
  folhas: z.array(Id).max(30).optional(),
  /** Lote 14 (item 189.3): como o pedido conta — 1 unidade = 1 kit (padrão) ou o pedido vem em peças (96 tags). */
  contagem: z.enum(['kit', 'pecas']).optional(),
})
export type GrupoProduto = z.infer<typeof GrupoProduto>

/** Lote 5 (item 76): FOLHA DE IMPRESSÃO MONTADA — onde vai cada peça (molde) na folha, com a marca de registro. */
export const FolhaMontada = z.object({
  id: Id,
  nome: NomeObrigatorio(80),
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
  /**
   * Lote 6 (item 95): GABARITO TRAVADO — com marca de registro a plotter corta com um arquivo FIXO; depois de salvo,
   * as vagas não mudam (o "Preencher folha" só cria o gabarito). `origem` = importado da plotter (Silhouette).
   */
  travada: z.boolean().optional(),
  origem: z.enum(['preencher', 'importado']).optional(),
  /** Lote 14 (item 189.3): quantas vezes esta folha sai em 1 kit (Folha 1 × 2). */
  impressoes: z.number().int().min(1).max(50).optional(),
  /** Lote 14 (item 189.3): orientação — automática (a que couber mais) ou fixa. */
  orientacao: z.enum(['auto', 'retrato', 'paisagem']).optional(),
  /** Lote 14 (item 189.3): as peças pedidas nesta folha (Livros 9×5 × 4 + Caderno 7×3 × 6) — o MAE distribui. */
  pedidas: z.array(z.object({ moldeId: Id, qtd: z.number().int().min(1).max(999) })).max(30).optional(),
  /** Lote 14 (item 189.3): o arquivo do gabarito/faca de corte enviado (na Biblioteca) — é o arquivo de corte. */
  faca: z.string().max(400).optional(),
})
export type FolhaMontada = z.infer<typeof FolhaMontada>

export const DocBase = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  type: z.literal('base'),
  id: Id,
  version: z.number().int().positive(),
  name: NomeObrigatorio(120),
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
  /** Lote 6 (item 90): tipo da base — caixas e moldes (padrão) ou PEÇAS POR MEDIDA (etiquetas, tags, rótulos). */
  tipo: z.enum(['caixas', 'medida']).optional(),
  /** Lote 6 (item 91): a ESTRUTURA das peças por medida (divisórias → pedaços → partes). */
  estrutura: z.object({
    id: z.string().max(60), nome: Nome(80),
    divisorias: z.array(z.object({
      id: z.string().max(40), eixo: z.enum(['h', 'v']), pos: z.number().min(0).max(1),
      inclinacaoDeg: z.number().min(-60).max(60).optional(), tipo: z.enum(['reto', 'suave']),
      suaveMm: z.number().min(0.5).max(80).optional(), faixaMm: z.number().min(0).max(80).optional(),
    })).max(12),
    nomes: z.array(z.string().max(40)).max(30).optional(),
  }).optional(),
})
export type DocBase = z.infer<typeof DocBase>
