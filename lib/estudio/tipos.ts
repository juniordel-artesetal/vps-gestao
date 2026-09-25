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
  /** Giro da caixa em graus, em torno do centro (ex.: −90 = texto subindo). */
  rotacao?: number
  /**
   * COBERTURA: tapa o texto antigo queimado no molde antes de escrever o novo. O ideal é subir o molde
   * LIMPO; isto é o plano B. 'entorno' preenche com as cores da borda (fica bom em fundo liso/degradê),
   * 'cor' usa uma cor sólida, 'remendo' copia um pedaço do próprio molde deslocado (dx, dy em px).
   */
  cobertura?: Cobertura | null
}

export interface Cobertura { modo: 'entorno' | 'cor' | 'remendo'; cor: string; dx: number; dy: number; folga: number }

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

/** Filtros de variável: {nome|minusculas|semespaco} → "mariaeduarda" (ex.: hashtag "#{nome|minusculas|semespaco}faz{idade}"). */
const FILTROS_VAR: Record<string, (v: string) => string> = {
  minusculas: v => v.toLocaleLowerCase('pt-BR'),
  maiusculas: v => v.toLocaleUpperCase('pt-BR'),
  semespaco: v => v.replace(/\s+/g, ''),
  semacento: v => v.normalize('NFD').replace(/[̀-ͯ]/g, ''),
  primeiro: v => v.trim().split(/\s+/)[0] || '',
}
export const NOMES_FILTROS = Object.keys(FILTROS_VAR)

/** Extrai as variáveis ({nome}, {idade}…) usadas nas caixas, sem repetir, na ordem em que aparecem (sem os filtros). */
export function variaveisDo(caixas: Caixa[]): string[] {
  const vistos = new Set<string>()
  for (const c of caixas) for (const m of c.texto.matchAll(/\{([^{}]+)\}/g)) vistos.add(m[1].split('|')[0].trim())
  return [...vistos]
}

/** Troca {variável} (com filtros opcionais) pelo valor da linha. Sem valor vira vazio (não imprime "{nome}"). */
export function aplicar(texto: string, linha: Linha): string {
  return texto.replace(/\{([^{}]+)\}/g, (_, k) => {
    const [nome, ...filtros] = String(k).split('|').map(x => x.trim())
    let v = linha[nome] ?? ''
    for (const f of filtros) v = FILTROS_VAR[f]?.(v) ?? v
    return v
  })
}

export const novaCaixa = (x: number, y: number, w: number, h: number, texto = '{nome}'): Caixa => ({
  id: Math.random().toString(36).slice(2, 10),
  tipo: texto.trim() === '{foto}' ? 'imagem' : 'texto',
  texto, x, y, w, h,
  fonte: 'fredoka', tamanho: Math.max(12, Math.round(h * 0.6)), cor: '#1f2937',
  alinhamento: 'center', negrito: false, italico: false, maiusculas: false,
  contorno: null, sombra: null, curvatura: 0, autoAjuste: true,
})
