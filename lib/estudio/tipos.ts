// SOA Edition — tipos compartilhados entre editor, renderizador e API.
// Coordenadas e tamanhos das caixas são SEMPRE em pixels do molde original (não da tela),
// para o lote sair na resolução de impressão independentemente do zoom do editor.

export type Alinhamento = 'left' | 'center' | 'right'

export interface Caixa {
  id: string
  tipo: 'texto' | 'imagem'
  /** Texto com variáveis, ex.: "{nome}" ou "{nome}, {idade} anos". Em caixa de imagem: "{foto}". */
  texto: string
  x: number; y: number; w: number; h: number
  /** Id de fonte nativa ('fredoka', 'pacifico'…) ou "u:<assetId>" para fonte enviada pela artesã. */
  fonte: string
  tamanho: number
  cor: string
  alinhamento: Alinhamento
  negrito: boolean
  italico: boolean
  maiusculas: boolean
  contorno: { cor: string; largura: number } | null
  sombra: { cor: string; blur: number; dx: number; dy: number } | null
  /** Graus de arco (positivo = arco para cima, negativo = para baixo). 0 = texto reto. */
  curvatura: number
  /** Encolhe (e quebra linha) para caber na caixa quando o nome é longo. */
  autoAjuste: boolean
}

export interface FonteUsuario { id: string; familia: string; url: string }

export interface ConfigTemplate {
  versao: 1
  largura: number
  altura: number
  caixas: Caixa[]
  fontesUsuario: FonteUsuario[]
  /** Tamanho de página para PDF (pt). Vem do PDF original; em imagem assume 300 dpi. */
  pagina: { larguraPt: number; alturaPt: number }
}

export type Linha = Record<string, string>

/** Extrai as variáveis ({nome}, {idade}…) usadas nas caixas, sem repetir, na ordem em que aparecem. */
export function variaveisDo(caixas: Caixa[]): string[] {
  const vistos = new Set<string>()
  for (const c of caixas) for (const m of c.texto.matchAll(/\{([^{}]+)\}/g)) vistos.add(m[1].trim())
  return [...vistos]
}

/** Troca {variável} pelo valor da linha. Variável sem valor vira vazio (não imprime "{nome}"). */
export function aplicar(texto: string, linha: Linha): string {
  return texto.replace(/\{([^{}]+)\}/g, (_, k) => linha[String(k).trim()] ?? '')
}

export const novaCaixa = (x: number, y: number, w: number, h: number, texto = '{nome}'): Caixa => ({
  id: Math.random().toString(36).slice(2, 10),
  tipo: texto.trim() === '{foto}' ? 'imagem' : 'texto',
  texto, x, y, w, h,
  fonte: 'fredoka', tamanho: Math.max(12, Math.round(h * 0.6)), cor: '#1f2937',
  alinhamento: 'center', negrito: false, italico: false, maiusculas: false,
  contorno: null, sombra: null, curvatura: 0, autoAjuste: true,
})
