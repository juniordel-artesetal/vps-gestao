// SOA Edition — tipos do "Método Mãe" (kit de caixas por FACE) e da CAIXA MONTADA (3D).
// PEÇA ÚNICA: o mapa de faces de um molde (die-line) serve para (1) replicar papel/elemento por face
// em todas as caixas do kit, (2) montar a caixa em 3D no mockup e (3) o kit de listagem.
//
// Convenções:
// - Coordenadas de FACE no molde são NORMALIZADAS (0…1) sobre a imagem do molde → valem em qualquer
//   resolução (prévia leve ou impressão 300 dpi).
// - Cada face tem um "quadro em pé": `rot` = quantos graus girar o retângulo da face (no molde) para
//   que o TOPO da face fique para cima (0 | 90 | 180 | 270, sentido horário). Tudo que se coloca na face
//   (papel, elemento, nome) é posicionado nesse quadro em pé, em unidades normalizadas da face.

import type { EstiloTexto } from './tipos'
export type { EstiloTexto }

export type FaceRole = 'frente' | 'tras' | 'lateral_esquerda' | 'lateral_direita' | 'cima' | 'fundo'

export const FACE_ROLES: { id: FaceRole; nome: string }[] = [
  { id: 'frente', nome: 'Frente' },
  { id: 'lateral_esquerda', nome: 'Lateral esquerda' },
  { id: 'lateral_direita', nome: 'Lateral direita' },
  { id: 'tras', nome: 'Trás' },
  { id: 'cima', nome: 'Cima' },
  { id: 'fundo', nome: 'Fundo' },
]

export type FormaFace = 'retangulo' | 'triangulo' | 'coracao' | 'trapezio'

export interface FaceMolde {
  id: string
  role: FaceRole
  /** Retângulo da face no molde (normalizado 0…1, eixo do molde, ANTES do giro). */
  x: number; y: number; w: number; h: number
  /** Graus (horário) para deixar a face em pé. 90/270 trocam largura/altura no quadro em pé. */
  rot: 0 | 90 | 180 | 270
  /** Contorno dentro do retângulo, no quadro EM PÉ: triângulo = ponta no topo; trapézio = topo mais estreito. */
  forma: FormaFace
  /** Trapézio: largura do topo em fração da base (0…1). */
  topo?: number
}

/**
 * Montagem 3D: um polígono 3D por face visível da caixa montada. `cantos` são os cantos do quadro EM PÉ
 * da face na ordem [topo-esq, topo-dir, base-dir, base-esq] (retângulo/trapézio/coração) ou
 * [ponta, base-dir, base-esq] (triângulo). Unidades = cm do modelo (x → direita, y → PARA CIMA, z → para a câmera).
 */
export interface Face3D { faceId: string; cantos: [number, number, number][] }

export interface ExtraMontagem {
  /** Alça (maleta/sacola): curva de pontos 3D desenhada como fita/cordão. */
  alca?: { pontos: [number, number, number][]; espessura: number; cor: string }
  /** Onde o laço fica (ponto 3D + escala em cm). */
  laco?: { em: [number, number, number]; tamanho: number }
  /** Onde a pedra/strass fica. */
  pedra?: { em: [number, number, number]; tamanho: number }
}

export interface MoldeCaixaDef {
  /** Id estável do acervo (ex.: 'milk', 'cubo'). */
  id: string
  nome: string
  categoria: 'caixa' | 'sacola' | 'maleta'
  /** Tamanho real do molde aberto (mm) — define a página de impressão (300 dpi). */
  larguraMm: number
  alturaMm: number
  /** SVG do molde aberto: viewBox em mm (0 0 larguraMm alturaMm). Corte = linha contínua; vinco/dobra = tracejado. */
  svg: string
  faces: FaceMolde[]
  /** Montagem 3D (faces decoráveis visíveis de fora). */
  montagem: { faces: Face3D[]; extra?: ExtraMontagem; dims: { l: number; p: number; a: number } }
}

/** Um molde cadastrado (acervo ou próprio) — linha da tabela EstudioMoldeCaixa. */
export interface MoldeCaixa {
  id: string
  nome: string
  tipo: 'acervo' | 'proprio'
  /** Acervo: id do MoldeCaixaDef. Próprio: null. */
  acervoId: string | null
  dieLineAssetId: string | null
  dieLineUrl: string | null
  largura: number   // px da imagem do molde (próprio) ou de referência (acervo @300dpi)
  altura: number
  faces: FaceMolde[]
  montagem: MoldeCaixaDef['montagem'] | null
}

// ── Tema por face (config do EstudioTemplate com tipo 'kit-caixas') ─────────────────────────────

/** Posição de algo no quadro em pé da face (normalizado): centro (cx, cy), largura relativa, giro. */
export interface PosFace { cx: number; cy: number; escala: number; rot: number }

export interface ElementoFace {
  id: string
  tipo: 'papel' | 'imagem' | 'texto'
  /** papel/imagem: URL do Blob. */
  url?: string
  assetId?: string | null
  /** Em qual face-role ele vai. */
  role: FaceRole
  /** 'replicado' = mesma face em todas as caixas do kit; 'caixa' = só no molde `moldeId`. */
  escopo: 'replicado' | 'caixa'
  moldeId?: string | null
  /** papel: cobre a face inteira (pos ignorada, salvo ajuste). imagem: posicionada. */
  pos: PosFace
  /** Ajuste fino POR CAIXA sem quebrar as outras (tamanho/posição). */
  ajustes?: Record<string, Partial<PosFace>>
  /** Aplique 3D: NÃO imprime na caixa; vai para a folha de apliques (PNG transparente). */
  aplique?: boolean
  /** texto: campo de personalização ({nome}, {idade}, #{nome|minusculas|semespaco}faz{idade}…). */
  texto?: {
    modelo: string
    /** Retângulo-limite no quadro em pé (normalizado). */
    x: number; y: number; w: number; h: number
    fonte: string
    /** Tamanho MÁXIMO em fração da altura da face; o mínimo idem (o texto encolhe/quebra entre os dois). */
    tamanho: number
    tamanhoMin: number
    cor: string
    negrito: boolean
    contorno: { cor: string; largura: number } | null
    sombra: { cor: string; blur: number; dx: number; dy: number } | null
    curvatura: number
    estilo?: EstiloTexto | null
  }
}

export interface TemaCaixas {
  tipo: 'kit-caixas'
  versao: 1
  /** Moldes do kit (ids de EstudioMoldeCaixa, na ordem das páginas). */
  moldeIds: string[]
  elementos: ElementoFace[]
  /** Cor de fundo das faces sem papel. */
  fundo: string
  /** Desenhar as linhas de corte/vinco por cima na impressão. */
  linhas: boolean
  /** Regra do nome do arquivo: {tema}_{nome}_{idade}. */
  regraNome: string
  categoria: 'temas-novos' | 'temas-editados' | string
}
