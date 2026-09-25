// SOA Edition — tipos da FASE 3 (mockup com produto real, cena, kit de listagem).
// A "área de aplicação" é a MESMA peça do "Replicar em moldes" (lib/estudio/areaMolde).
import type { AreaAplicacao, RecorteArea } from './areaMolde'

/** Como a arte "gruda" no produto: a luz/sombra da própria foto passa por cima da arte. */
export interface LuzSombra {
  /** 0…100 — quanto das SOMBRAS da foto (dobras, curvatura) escurece a arte. */
  sombra: number
  /** 0…100 — quanto dos BRILHOS da foto (reflexo da caneca, verniz) clareia a arte. */
  luz: number
  /** Direção da luz da cena em graus (0 = vem da direita, 90 = de cima) — usada na sombra projetada. */
  direcao: number
}

/** Trocar a cor do produto (ex.: caixa branca → rosa) só na área do produto recortado. */
export interface CorProduto { cor: string; intensidade: number }

export interface ConfigMockup {
  area: AreaAplicacao
  recorte: RecorteArea | null
  ls: LuzSombra
  cor: CorProduto | null
  /** 0…100 — opacidade da arte. */
  opacidade: number
}

export const LS_PADRAO: LuzSombra = { sombra: 70, luz: 45, direcao: 60 }

// ── CENA (deixar a foto "de estúdio") ────────────────────────────────────────────────────────────
export type FundoCena =
  | { tipo: 'cor'; cor: string }
  | { tipo: 'gradiente'; de: string; para: string; angulo: number }
  | { tipo: 'textura'; textura: string; cor: string }        // texturas autorais geradas por código
  | { tipo: 'foto'; url: string; assetId?: string | null }  // foto de cena (Blob)
  | { tipo: 'preset'; id: string }                           // fundo pronto do acervo autoral (procedural)

export interface PropCena { id: string; elemento: string; x: number; y: number; escala: number; rot: number; cor?: string | null }

export interface ConfigCena {
  fundo: FundoCena
  /** Produto na cena: centro normalizado + altura relativa à cena. */
  produto: { cx: number; cy: number; altura: number }
  /** Sombra de contato (elipse sob o produto) e projetada (silhueta deslocada pela direção da luz). */
  sombra: { contato: number; projetada: number; suavidade: number }
  /** Reflexo no piso (0 = sem). */
  reflexo: number
  /** Iluminação geral: direção (graus) e intensidade (vinheta/gradiente de luz). */
  luz: { direcao: number; intensidade: number }
  props: PropCena[]
}

export const CENA_PADRAO: ConfigCena = {
  fundo: { tipo: 'gradiente', de: '#fdf2f8', para: '#e0f2fe', angulo: 90 },
  produto: { cx: 0.5, cy: 0.52, altura: 0.72 },
  sombra: { contato: 55, projetada: 25, suavidade: 60 },
  reflexo: 0,
  luz: { direcao: 60, intensidade: 25 },
  props: [],
}

// ── KIT DE LISTAGEM (o conjunto de fotos que o marketplace pede) ─────────────────────────────────
export type Tomada = 'frente' | 'angulo' | 'detalhe' | 'medidas' | 'em-uso'

export const TOMADAS: { id: Tomada; nome: string; dica: string }[] = [
  { id: 'frente', nome: 'Frente', dica: 'foto principal, fundo limpo' },
  { id: 'angulo', nome: 'Ângulo', dica: 'perspectiva 3/4' },
  { id: 'detalhe', nome: 'Detalhe', dica: 'zoom na arte' },
  { id: 'medidas', nome: 'Medidas', dica: 'régua com as cotas' },
  { id: 'em-uso', nome: 'Em uso', dica: 'produto na cena da festa' },
]

export interface ConfigKitListagem {
  tomadas: Tomada[]
  /** Ids de TAMANHOS_CANAIS (lib/estudio/tamanhos). */
  tamanhos: string[]
  /** Medidas reais do produto (cm) para a tomada "medidas". */
  medidas: { largura: number; altura: number; profundidade: number | null }
  /** Texto/preço opcional sobreposto (badge). */
  badge: { ativo: boolean; texto: string; preco: string; cor: string } | null
  /** Cena usada no "em uso" (id de EstudioCena) — sem cena, usa a padrão de festa. */
  cenaId: string | null
}

// ── Produto do ACERVO (Fluxo B) — gerado por código (100% autoral) ──────────────────────────────
export interface ProdutoGerado {
  /** Produto sobre fundo TRANSPARENTE. */
  foto: HTMLCanvasElement
  area: AreaAplicacao
  recorte: RecorteArea | null
  ls: LuzSombra
  /** Medidas reais sugeridas (cm) — alimentam a tomada "medidas". */
  medidas: { largura: number; altura: number; profundidade: number | null }
}

export interface ProdutoAcervo {
  id: string
  nome: string
  categoria: 'caneca' | 'lata' | 'tag' | 'topo' | 'camiseta' | 'caixa' | 'sacola' | 'outro'
  /** Gera o produto liso (branco) com `lado` px no maior lado. Síncrono, só navegador (canvas). */
  gerar: (lado: number) => ProdutoGerado
}
