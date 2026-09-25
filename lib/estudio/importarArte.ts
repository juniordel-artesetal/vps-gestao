// SOA Edition — ROTEADOR DE ARTE (só navegador). A artesã sobe o arquivo e o sistema decide o caminho:
//   • CAMADAS (PSD com camada de texto, SVG com <text>, PDF com texto real ou camadas OCG de texto):
//     lê as camadas, TIRA o texto do fundo (o que está embaixo aparece limpo — sem "desqueimar" nada)
//     e transforma cada texto num campo já posicionado → caminho 2.
//   • ACHATADO (JPEG/PNG, PDF só com imagem, PSD sem camada de texto): o fundo é a própria arte; os
//     campos vêm do OCR assistente e, onde havia texto queimado, entram com COBERTURA → caminhos 1+3.
// Decisão de arquitetura: nunca tentar apagar/reconstruir texto queimado automaticamente.
import { novaCaixa, type Caixa } from './tipos'
import { analisarPaginaPdf, avisoPdfAchatado, carregarPdfJs, psdEmbutido, type FonteEmbutida } from './pdfObjetos'
import { ORIENTACAO_STUDIO, PASSOS_EXPORT_STUDIO, decodificarDxf, dxfParaSvg, ehDxf, ehStudio, extrairMiniaturaStudio } from './formatosCorte'

export type PapelCampo = 'nome' | 'idade' | 'nome_idade' | 'outro'
export interface CampoDetectado {
  id: string
  origem: 'camada' | 'ocr'
  textoOriginal: string
  papel: PapelCampo
  nome: string | null
  idade: string | null
  /** Caixa na ORIENTAÇÃO DO TEXTO, em px do molde (centro = x + w/2, y + h/2). */
  x: number; y: number; w: number; h: number
  rotacao: number
  tamanho: number
  cor: string
  estilo: string | null
  fonteArquivo: string | null
  alinhamento: 'left' | 'center' | 'right'
  negrito: boolean
  camada: string | null
  incluir: boolean
  contorno?: string | null
  sombra?: boolean
  /** Texto do campo editado pela artesã na confirmação (senão vem de modeloDoTexto). */
  modelo?: string
  /** Camada do arquivo que este campo substitui (some do fundo quando o campo é criado). */
  camadaId?: string | null
  /** Fonte JÁ resolvida para o editor (id nativo ou "u:<assetId>") — a MESMA do arquivo. */
  fonteId?: string | null
  /** Fonte embutida no PDF (vira fonte do ateliê ao confirmar). */
  fonteEmbutida?: FonteEmbutida | null
  /** Efeitos do arquivo (PSD): viram o "estilo de camada" do campo — o nome novo sai igual. */
  efeitos?: {
    contornoLargura?: number
    gradiente?: { de: string; para: string; angulo: number } | null
    chanfro?: { tamanho: number; luz: string; sombra: string; intensidade: number } | null
    brilho?: { cor: string; blur: number } | null
    sombra?: { cor: string; blur: number; dx: number; dy: number } | null
  }
  /** Curvatura do texto no arquivo (graus, PSD "arco"). */
  curvatura?: number
}

/** Uma camada lida do arquivo (PSD/SVG/PDF), com a caixa onde está (px da arte). */
export interface CamadaLida {
  id: string
  nome: string
  tipo: 'texto' | 'imagem' | 'grupo' | 'ocg' | 'vetor'
  bbox: { x: number; y: number; w: number; h: number } | null
  texto?: string
  /** Cores medidas (camada de imagem/vetor) — viram a cor/contorno do campo. */
  cor?: string
  contorno?: string | null
  /** Campo ligado a esta camada. */
  campoId?: string | null
  /** Nome sugere que é personalizável ("nome", "idade", "#…"). */
  sugerida?: boolean
}
export interface ArteImportada {
  formato: 'psd' | 'svg' | 'pdf' | 'ai' | 'dxf' | 'imagem'
  caminho: 'camadas' | 'achatado'
  /** Molde a usar: SEM o texto quando veio de camadas; a própria arte quando achatada. */
  fundo: HTMLCanvasElement
  /** A arte como veio (com o texto) — para a prévia de comparação e para o OCR. */
  original: HTMLCanvasElement
  pagina: { larguraPt: number; alturaPt: number }
  camadas: { total: number; texto: number; nomes: string[] }
  campos: CampoDetectado[]
  avisos: string[]
  /** TODAS as camadas lidas (texto, imagem, grupo, OCG) — a artesã pode marcar qualquer uma como campo. */
  lista: CamadaLida[]
  /** Refaz o fundo escondendo as camadas `ocultar` (ids de CamadaLida). Ausente = arte achatada. */
  recompor?: (ocultar: Set<string>) => Promise<HTMLCanvasElement>
  /** PDF: o texto só some "tudo ou nada" — textos fixos voltam como campo literal. */
  textoTudoOuNada?: boolean
  /** PDF com várias páginas. */
  totalPaginas?: number
}

const MAX_AREA = 16_000_000
const gid = () => Math.random().toString(36).slice(2, 10)
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c }

// ── papel do texto (nome / idade) por NOME DA CAMADA e CONTEÚDO ─────────────────
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
export function papelDoTexto(texto: string, nomeCamada: string | null): { papel: PapelCampo; nome: string | null; idade: string | null } {
  const camada = semAcento(nomeCamada || '').toLowerCase()
  const t = texto.trim()
  const idade = (t.match(/(?:faz|fez|anos?|aninhos?|#)\D*?(\d{1,2})|(\d{1,2})\s*(?:anos?|aninhos?)|^(\d{1,2})$/i) || []).slice(1).find(Boolean) || null
  if (/\bnome\b|\bname\b/.test(camada)) return { papel: 'nome', nome: t, idade: null }
  if (/idade|\bage\b|\banos\b/.test(camada)) return { papel: 'idade', nome: null, idade: idade || t.replace(/\D/g, '') || null }
  const hashtag = t.match(/^#([a-zà-ú]+?)(?:faz|fez|\d)/i)
  if (hashtag && idade) return { papel: 'nome_idade', nome: hashtag[1][0].toUpperCase() + hashtag[1].slice(1).toLowerCase(), idade }
  if (idade && /^\D{0,12}\d{1,2}\D{0,12}$/.test(t)) return { papel: 'idade', nome: null, idade }
  if (/^[A-ZÀ-Ú][a-zà-ú]+(\s+[A-ZÀ-Ú][a-zà-ú]+){0,2}$/.test(t) || /^[A-ZÀ-Ú]{3,}(\s+[A-ZÀ-Ú]{2,})?$/.test(t)) return { papel: 'nome', nome: t, idade: null }
  return { papel: 'outro', nome: null, idade: null }
}

/**
 * Texto do campo com {variáveis}: "Sophia" → "{nome}"; "6" → "{idade}"; "faz 4" → "faz {idade}";
 * "#SOPHIAFAZ6" → "#{nome|maiusculas|semespaco}FAZ{idade}" (mantém o jeito que a arte escreve).
 */
export function modeloDoTexto(c: Pick<CampoDetectado, 'textoOriginal' | 'papel' | 'nome' | 'idade'>): string {
  const t = c.textoOriginal.trim()
  if (c.papel === 'nome') return '{nome}'
  let out = t
  if ((c.papel === 'nome_idade') && c.nome) {
    const alvo = semAcento(c.nome).toLowerCase().replace(/\s+/g, '')
    const base = semAcento(t).toLowerCase()
    const i = base.replace(/\s+/g, '').indexOf(alvo)
    if (i >= 0) {
      // acha o trecho equivalente no texto original (ignorando espaços)
      let achou = -1, fim = -1, n = 0
      for (let k = 0; k < t.length && fim < 0; k++) {
        if (/\s/.test(t[k])) continue
        if (n === i) achou = k
        if (n === i + alvo.length - 1) fim = k + 1
        n++
      }
      if (achou >= 0 && fim > achou) {
        const trecho = t.slice(achou, fim)
        const filtros = [trecho === trecho.toUpperCase() ? 'maiusculas' : trecho === trecho.toLowerCase() ? 'minusculas' : null, /\s/.test(trecho) ? null : 'semespaco', t.startsWith('#') ? 'semacento' : null].filter(Boolean)
        out = t.slice(0, achou) + `{nome${filtros.length ? '|' + filtros.join('|') : ''}}` + t.slice(fim)
      }
    }
  }
  if ((c.papel === 'idade' || c.papel === 'nome_idade') && c.idade) out = out.replace(new RegExp(`(?<!\\d)${c.idade}(?!\\d)`), '{idade}')
  return c.papel === 'idade' && !out.includes('{idade}') ? '{idade}' : out
}

const FONTE_POR_ESTILO: Record<string, string> = { cursiva: 'pacifico', arredondada: 'fredoka', serifada: 'lobster', sem_serifa: 'poppins', decorativa: 'baloo' }
/** Nome de fonte normalizado para comparar ("Pacifico-Regular" ~ "Pacifico Regular.ttf" ~ "pacifico"). */
export const normalizarFonte = (s: string) => s.toLowerCase().replace(/\.(ttf|otf|woff2?)$/, '').replace(/^[a-z]{6}\+/, '')
  .replace(/(mt|ps|std|pro|regular|roman|book|normal)$/g, '').replace(/[^a-z0-9]/g, '').replace(/(regular|roman|book|normal)$/g, '')
/** Acha a MESMA fonte entre as disponíveis (nativas + as do ateliê). null = não tem → pedir o arquivo. */
export function acharFonte(nomeArquivo: string | null, opcoes: { id: string; nome: string }[]): string | null {
  if (!nomeArquivo) return null
  const alvo = normalizarFonte(nomeArquivo)
  const semPeso = (x: string) => x.replace(/(bold|black|heavy|semibold|extrabold|medium|light|thin|italic|oblique)+$/g, '')
  return opcoes.find(o => normalizarFonte(o.nome) === alvo)?.id
    || opcoes.find(o => semPeso(normalizarFonte(o.nome)) === semPeso(alvo) && semPeso(alvo).length >= 4)?.id || null
}
export function fontePorNome(nome: string | null, estilo: string | null): string {
  const n = (nome || '').toLowerCase()
  if (/script|brush|hand|cursiv|pacifico|dancing|vibes|lobster|signature|calligr/.test(n)) return /vibes|signature|calligr/.test(n) ? 'greatvibes' : 'pacifico'
  if (/fredoka|baloo|round|bubble|comic/.test(n)) return 'fredoka'
  if (/amatic/.test(n)) return 'amatic'
  return FONTE_POR_ESTILO[estilo || ''] || 'poppins'
}

/** Campos confirmados → caixas do editor (fonte, cor, giro, auto-ajuste e cobertura quando achatado). */
/** `cobrir` = campo sobre texto queimado ganha cobertura (campo de CAMADA nunca: a camada some do fundo). */
export function caixasDosCampos(campos: CampoDetectado[], cobrir: boolean): Caixa[] {
  return campos.filter(c => c.incluir).map(c => {
    const cx = novaCaixa(Math.round(c.x), Math.round(c.y), Math.max(10, Math.round(c.w)), Math.max(10, Math.round(c.h)), c.modelo?.trim() || modeloDoTexto(c))
    const upper = c.textoOriginal === c.textoOriginal.toUpperCase() && /[A-Z]/.test(c.textoOriginal) && c.papel === 'nome'
    return {
      ...cx, tipo: 'texto' as const,
      fonte: c.fonteId || fontePorNome(c.fonteArquivo, c.estilo), tamanho: Math.max(8, Math.round(c.tamanho)), cor: c.cor,
      // nome mais longo encolhe DENTRO da caixa do original, sem estourar (mínimo 45% do tamanho original)
      tamanhoMin: Math.max(6, Math.round(c.tamanho * 0.45)),
      alinhamento: c.alinhamento, negrito: c.negrito, maiusculas: upper, autoAjuste: true, rotacao: c.rotacao, curvatura: c.curvatura || 0,
      contorno: c.contorno ? { cor: c.contorno, largura: Math.max(1, Math.round(c.efeitos?.contornoLargura ?? c.tamanho * 0.05)) } : null,
      sombra: c.efeitos?.sombra ?? (c.sombra ? { cor: 'rgba(0,0,0,0.35)', blur: Math.max(4, Math.round(c.tamanho * 0.06)), dx: Math.round(c.tamanho * 0.02), dy: Math.round(c.tamanho * 0.03) } : null),
      estilo: c.efeitos && (c.efeitos.gradiente || c.efeitos.chanfro || c.efeitos.brilho) ? { gradiente: c.efeitos.gradiente || null, chanfro: c.efeitos.chanfro || null, brilho: c.efeitos.brilho || null } : null,
      cobertura: cobrir && !c.camadaId ? { modo: 'entorno' as const, cor: '#ffffff', dx: 0, dy: 0, folga: 10 } : null,
    }
  })
}

// ── leitores ─────────────────────────────────────────────────────────────────────
async function imagemDe(src: Blob | string): Promise<HTMLImageElement> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src)
  try {
    return await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('Não consegui abrir a imagem.')); i.src = url })
  } finally { if (typeof src !== 'string') setTimeout(() => URL.revokeObjectURL(url), 5000) }
}
const paraCanvas = (el: CanvasImageSource, w: number, h: number) => { const c = canvas(w, h); c.getContext('2d')!.drawImage(el, 0, 0, c.width, c.height); return c }
const escalaMax = (w: number, h: number, alvo = 1) => Math.min(alvo, Math.sqrt(MAX_AREA / (w * h)), 8000 / Math.max(w, h))

// ── CAMADAS (modelo único para PSD, SVG e PDF) ──────────────────────────────────
// Toda camada lida vira uma entrada da lista, com a caixa onde ela está. Camada de TEXTO já vem com
// campo; camada de imagem/grupo chamada "nome", "idade", "#…" é SUGERIDA; qualquer outra pode ser
// marcada pela artesã. Esconder a camada que virou campo = fundo limpo (sem inpainting).
const CANDIDATA = /\b(nome|name|idade|age|anos|hashtag|texto|text|titulo|personaliz)\b|^#|nome|idade/i
const MISTURA: Record<string, GlobalCompositeOperation> = { multiply: 'multiply', screen: 'screen', overlay: 'overlay', darken: 'darken', lighten: 'lighten', 'color dodge': 'color-dodge', 'color burn': 'color-burn', 'soft light': 'soft-light', 'hard light': 'hard-light', difference: 'difference', exclusion: 'exclusion' }
type Pixels = CanvasImageSource & { width: number; height: number }
type Caixa2 = { x: number; y: number; w: number; h: number }

/**
 * Cores de uma camada de letra: PREENCHIMENTO = cor mais comum no MIOLO (longe da borda) e CONTORNO = cor
 * mais comum no anel da borda, quando é bem diferente (ex.: nome rosa com bordinha branca).
 */
function coresDaCamada(src: Pixels | null | undefined): { cor: string; contorno: string | null } | null {
  if (!src) return null
  const k = Math.min(1, 200 / Math.max(src.width, src.height, 1))
  const W = Math.max(1, Math.round(src.width * k)), H = Math.max(1, Math.round(src.height * k))
  const c = canvas(W, H), g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(src, 0, 0, W, H)
  const d = g.getImageData(0, 0, W, H).data
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] >= 200
  const r = Math.max(1, Math.round(Math.min(W, H) * 0.035))
  const miolo = new Map<number, number[]>(), anel = new Map<number, number[]>()
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!op(x, y)) continue
    let dentro = true
    for (let dy = -r; dy <= r && dentro; dy += r) for (let dx = -r; dx <= r && dentro; dx += r) if (!op(x + dx, y + dy)) dentro = false
    const i = (y * W + x) * 4, q = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4)
    const m = dentro ? miolo : anel
    const e = m.get(q) || [0, 0, 0, 0]; e[0]++; e[1] += d[i]; e[2] += d[i + 1]; e[3] += d[i + 2]; m.set(q, e)
  }
  const top = (m: Map<number, number[]>) => { let b: number[] | null = null; for (const e of m.values()) if (!b || e[0] > b[0]) b = e; return b }
  const a = top(miolo) || top(anel)
  if (!a) return null
  const cor = [a[1] / a[0], a[2] / a[0], a[3] / a[0]]
  const b = top(anel), totalAnel = [...anel.values()].reduce((s2, e) => s2 + e[0], 0)
  let contorno: string | null = null
  if (b && miolo.size && b[0] > totalAnel * 0.35) {
    const cb = [b[1] / b[0], b[2] / b[0], b[3] / b[0]]
    if (Math.hypot(cb[0] - cor[0], cb[1] - cor[1], cb[2] - cor[2]) > 90) contorno = hex(cb[0], cb[1], cb[2])
  }
  return { cor: hex(cor[0], cor[1], cor[2]), contorno }
}
const corPredominante = (src: Pixels | null | undefined) => coresDaCamada(src)?.cor || null

/** Papel sugerido pelo NOME da camada (camada de imagem não tem texto para ler). */
function papelDaCamada(nome: string): PapelCampo {
  const n = semAcento(nome).toLowerCase()
  if (/hashtag|^#/.test(n)) return 'nome_idade'
  if (/idade|\bage\b|\banos\b/.test(n)) return 'idade'
  if (/\bnome\b|\bname\b|nome/.test(n)) return 'nome'
  return 'outro'
}

/**
 * Transforma uma camada (de imagem/grupo/OCG) num campo — é o "esta camada é o nome". O estilo que dá
 * para saber sem texto editável: posição, altura (→ tamanho) e a cor predominante da camada.
 */
export function campoDaCamada(arte: ArteImportada, camadaId: string, papel?: PapelCampo): CampoDetectado | null {
  const c = arte.lista.find(x => x.id === camadaId)
  if (!c?.bbox) return null
  const p = papel || papelDaCamada(c.nome)
  return {
    id: gid(), origem: 'camada', camadaId: c.id, textoOriginal: c.texto || c.nome, papel: p, nome: null, idade: null,
    x: c.bbox.x, y: c.bbox.y, w: c.bbox.w, h: c.bbox.h, rotacao: 0, tamanho: c.bbox.h * 0.78,
    cor: c.cor || '#1f2937', contorno: c.contorno || null, estilo: null, fonteArquivo: null, alinhamento: 'center', negrito: true, camada: c.nome, incluir: p !== 'outro',
    modelo: p === 'nome' ? '{nome}' : p === 'idade' ? '{idade}' : p === 'nome_idade' ? '#{nome|minusculas|semespaco|semacento}faz{idade}' : undefined,
  }
}

/** Camadas a esconder no fundo: as ligadas a campos que vão virar campo editável. */
export const camadasDosCampos = (campos: CampoDetectado[]) => new Set(campos.filter(c => c.incluir && c.camadaId).map(c => c.camadaId!))

function uniao(cs: (Caixa2 | null)[]): Caixa2 | null {
  const v = cs.filter((c): c is Caixa2 => !!c && c.w > 0 && c.h > 0)
  if (!v.length) return null
  const x0 = Math.min(...v.map(c => c.x)), y0 = Math.min(...v.map(c => c.y)), x1 = Math.max(...v.map(c => c.x + c.w)), y1 = Math.max(...v.map(c => c.y + c.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

// ── PSD / PSB (ag-psd num Web Worker; se o worker falhar, lê aqui mesmo) ─────────
type TextoPsd = { text: string; transform?: number[]; style?: { font?: { name?: string }; fontSize?: number; fillColor?: { r: number; g: number; b: number }; fauxBold?: boolean; strokeFlag?: boolean; strokeColor?: { r: number; g: number; b: number } }; paragraphStyle?: { justification?: string } }
type Rgb = { r: number; g: number; b: number }
type EfeitosPsd = {
  stroke?: { enabled?: boolean; size?: { value: number }; color?: Rgb }[]
  dropShadow?: { enabled?: boolean; color?: Rgb; opacity?: number; distance?: { value: number }; angle?: number; size?: { value: number } }[]
  gradientOverlay?: { enabled?: boolean; angle?: number; gradient?: { colorStops?: { color: Rgb }[] } }[]
  bevel?: { enabled?: boolean; size?: { value: number }; highlightColor?: Rgb; shadowColor?: Rgb; highlightOpacity?: number }
  outerGlow?: { enabled?: boolean; color?: Rgb; size?: { value: number } }
}
type NoPsd = { name?: string; hidden?: boolean; opacity?: number; blendMode?: string; clipping?: boolean; left?: number; top?: number; right?: number; bottom?: number; children?: NoPsd[]; text?: TextoPsd & { warp?: { style?: string; value?: number } }; effects?: EfeitosPsd; blob?: Blob; artboard?: { left: number; top: number; right: number; bottom: number }; mascarada?: boolean }

/** Efeitos de camada do Photoshop → estilo do campo (o nome novo sai com o MESMO acabamento). */
function efeitosDoPsd(e: EfeitosPsd | undefined, tamanho: number): CampoDetectado['efeitos'] {
  if (!e) return undefined
  const cor = (c?: Rgb) => (c ? hex(c.r, c.g, c.b) : '#000000')
  const tr = e.stroke?.find(x => x.enabled !== false)
  const ds = e.dropShadow?.find(x => x.enabled !== false)
  const go = e.gradientOverlay?.find(x => x.enabled !== false)
  const paradas = go?.gradient?.colorStops || []
  const ang = ((ds?.angle ?? 120) * Math.PI) / 180, dist = ds?.distance?.value ?? 5
  return {
    contornoLargura: tr?.size?.value,
    gradiente: go && paradas.length >= 2 ? { de: cor(paradas[0].color), para: cor(paradas[paradas.length - 1].color), angulo: go.angle ?? 90 } : null,
    chanfro: e.bevel && e.bevel.enabled !== false ? { tamanho: Math.max(1, Math.min(20, ((e.bevel.size?.value ?? 5) / Math.max(1, tamanho)) * 100)), luz: cor(e.bevel.highlightColor || { r: 255, g: 255, b: 255 }), sombra: cor(e.bevel.shadowColor), intensidade: Math.round((e.bevel.highlightOpacity ?? 0.75) * 100) } : null,
    brilho: e.outerGlow && e.outerGlow.enabled !== false ? { cor: cor(e.outerGlow.color), blur: e.outerGlow.size?.value ?? 10 } : null,
    sombra: ds ? { cor: `rgba(${ds.color?.r ?? 0},${ds.color?.g ?? 0},${ds.color?.b ?? 0},${ds.opacity ?? 0.75})`, blur: ds.size?.value ?? 5, dx: Math.round(-Math.cos(ang) * dist), dy: Math.round(Math.sin(ang) * dist) } : null,
  }
}
type ArvorePsd = { width: number; height: number; escala: number; children?: NoPsd[]; camadas: number; puladas: number; reduzida: boolean }
/** Progresso da separação de camadas (feitas / total). */
export type ProgressoCamadas = (feitas: number, total: number) => void
/** Até 1 GB: o arquivo NÃO sobe para o servidor — é lido aqui, camada por camada. */
export const MAX_PSD = 1024 * 1024 * 1024

/**
 * PSD/PSB GRANDE sem estourar a memória (lib/estudio/psdLeve): Web Worker lê camada por camada já na
 * resolução de trabalho. Se ainda faltar memória, tenta de novo em resolução menor (com aviso).
 */
async function arvorePsd(f: File, progresso?: ProgressoCamadas): Promise<ArvorePsd> {
  if (f.size > MAX_PSD) throw new Error(`O arquivo tem ${(f.size / 1048576).toFixed(0)} MB — o limite é 1 GB. No Photoshop, mescle camadas que não mudam ou salve em resolução menor.`)
  const { LADO_TRABALHO } = await import('./psdLeve')
  const lados = [LADO_TRABALHO, 2400, 1600]
  let ultimo: Error | null = null
  for (const lado of lados) {
    try {
      const psd = typeof Worker !== 'undefined' ? await noWorker(f, lado, progresso) : await naPagina(f, lado, progresso)
      return { ...psd, reduzida: lado < LADO_TRABALHO && psd.escala < 1 }
    } catch (e) {
      ultimo = e as Error
      if (!/memory|memória|allocation|out of|array buffer/i.test(ultimo.message || '')) break   // erro de arquivo: não adianta reduzir
    }
  }
  throw new Error(/memory|memória|allocation|out of|array buffer/i.test(ultimo?.message || '')
    ? 'Este PSD é grande demais para este aparelho, mesmo reduzido. No Photoshop, mescle as camadas que não mudam (fundos, enfeites) e deixe separadas só as que vão virar campo — ou use um computador com mais memória.'
    : ultimo?.message || 'PSD ilegível')
}
function noWorker(f: File, lado: number, progresso?: ProgressoCamadas): Promise<Omit<ArvorePsd, 'reduzida'>> {
  return new Promise((res, rej) => {
    let w: Worker
    try { w = new Worker(new URL('./psd.worker.ts', import.meta.url), { type: 'module' }) } catch { naPagina(f, lado, progresso).then(res, rej); return }
    const t = setTimeout(() => { w.terminate(); rej(new Error('Demorou demais para separar as camadas.')) }, 15 * 60_000)
    let vivo = false
    w.onmessage = e => {
      vivo = true
      const m = e.data as { tipo: string; feitas?: number; total?: number; psd?: Omit<ArvorePsd, 'reduzida'>; erro?: string }
      if (m.tipo === 'progresso') { progresso?.(m.feitas || 0, m.total || 0); return }
      clearTimeout(t); w.terminate()
      if (m.tipo === 'fim' && m.psd) res(m.psd); else rej(new Error(m.erro || 'PSD ilegível'))
    }
    // worker que nem subiu → lê na página mesmo; worker que morre no meio da leitura = faltou memória
    w.onerror = e => {
      clearTimeout(t); w.terminate()
      if (!vivo) naPagina(f, lado, progresso).then(res, rej); else rej(new Error(e.message || 'out of memory'))
    }
    w.postMessage({ arquivo: f, maxLado: lado })
  })
}
async function naPagina(f: File, lado: number, progresso?: ProgressoCamadas): Promise<Omit<ArvorePsd, 'reduzida'>> {
  const { lerPsdLeve } = await import('./psdLeve')
  return lerPsdLeve(await f.arrayBuffer(), lado, progresso) as Promise<Omit<ArvorePsd, 'reduzida'>>
}
const bitmap = (b: Blob) => createImageBitmap(b)

async function lerPsd(f: File, progresso?: ProgressoCamadas): Promise<ArteImportada> {
  let psd: ArvorePsd
  try { psd = await arvorePsd(f, progresso) }
  catch (e) { throw new Error(`Não consegui separar as camadas deste PSD: ${(e as Error).message}`) }
  const W = psd.width, H = psd.height
  // folhas visíveis na ordem de desenho + grupos (com a lista de folhas de cada um)
  type Folha = { id: string; no: NoPsd; opac: number; grupos: string[] }
  const folhas: Folha[] = [], lista: CamadaLida[] = []
  const pixelsDe = new Map<string, Blob>()
  let n = 0
  const andar = (nos: NoPsd[] | undefined, opac: number, grupos: string[]) => {
    for (const l of nos || []) {
      if (l.hidden) continue
      const op = opac * (l.opacity ?? 1)
      if (l.children) {
        const id = `g${n++}`
        const antes = folhas.length
        andar(l.children, op, [...grupos, id])
        const minhas = folhas.slice(antes)
        const temTexto = minhas.some(x => x.no.text?.text?.trim())
        if (minhas.length) lista.push({ id, nome: l.name || 'Grupo', tipo: 'grupo', bbox: uniao(minhas.map(x => caixaNo(x.no))), sugerida: !temTexto && CANDIDATA.test(l.name || '') })
        continue
      }
      const id = `c${n++}`
      folhas.push({ id, no: l, opac: op, grupos })
      if (l.blob) pixelsDe.set(id, l.blob)
      const ehTexto = !!l.text?.text?.trim()
      lista.push({ id, nome: l.name || '(sem nome)', tipo: ehTexto ? 'texto' : 'imagem', bbox: caixaNo(l), texto: ehTexto ? l.text!.text.trim() : undefined, sugerida: !ehTexto && CANDIDATA.test(l.name || '') })
    }
  }
  andar(psd.children, 1, [])
  // compõe decodificando UMA camada por vez (a de baixo fica aberta só enquanto houver máscara de recorte)
  const desenhar = async (ocultar: Set<string>) => {
    const c = canvas(W, H), g = c.getContext('2d')!
    let base: { no: NoPsd; bmp: ImageBitmap } | null = null
    const fecharBase = () => { base?.bmp.close(); base = null }
    for (const fl of folhas) {
      const escondida = ocultar.has(fl.id) || fl.grupos.some(gid2 => ocultar.has(gid2))
      if (!fl.no.clipping) fecharBase()
      if (escondida || !fl.no.blob) continue
      const bmp = await bitmap(fl.no.blob)
      g.save(); g.globalAlpha = fl.opac; g.globalCompositeOperation = MISTURA[(fl.no.blendMode || '').toLowerCase()] || 'source-over'
      const b0 = base as { no: NoPsd; bmp: ImageBitmap } | null
      if (fl.no.clipping && b0) {
        // máscara de recorte: a camada só aparece onde a de baixo tem pixel
        const t = canvas(bmp.width, bmp.height), gt = t.getContext('2d')!
        gt.drawImage(bmp, 0, 0); gt.globalCompositeOperation = 'destination-in'
        gt.drawImage(b0.bmp, (b0.no.left || 0) - (fl.no.left || 0), (b0.no.top || 0) - (fl.no.top || 0))
        g.drawImage(t, fl.no.left || 0, fl.no.top || 0)
      } else if (!fl.no.clipping) g.drawImage(bmp, fl.no.left || 0, fl.no.top || 0)
      g.restore()
      if (!fl.no.clipping) base = { no: fl.no, bmp }; else bmp.close()
    }
    fecharBase()
    return c
  }
  const original = await desenhar(new Set())
  const pagina = { larguraPt: (W * 72) / 300 / psd.escala, alturaPt: (H * 72) / 300 / psd.escala }
  for (const c of lista) if (c.tipo === 'imagem' && pixelsDe.get(c.id)) { const bmp = await bitmap(pixelsDe.get(c.id)!); const k2 = coresDaCamada(bmp); bmp.close(); if (k2) { c.cor = k2.cor; c.contorno = k2.contorno } }
  // campos: camadas de TEXTO (com estilo clonado) + camadas de imagem/grupo sugeridas pelo nome
  const campos: CampoDetectado[] = []
  for (const fl of folhas) {
    const t = fl.no.text
    if (!t?.text?.trim()) continue
    const tr = t.transform || [1, 0, 0, 1, 0, 0]
    const rot = Math.round((Math.atan2(tr[1], tr[0]) * 180) / Math.PI)
    const esc = Math.hypot(tr[0], tr[1]) || 1
    const L = fl.no.left || 0, T = fl.no.top || 0, R = fl.no.right ?? L + 10, B = fl.no.bottom ?? T + 10
    const vertical = Math.abs(Math.abs(rot) - 90) < 20
    const w = vertical ? B - T : R - L, h = vertical ? R - L : B - T
    const cx = (L + R) / 2, cy = (T + B) / 2
    const st = t.style || {}
    const traco = fl.no.effects?.stroke?.find(s => s.enabled !== false)
    const p = papelDoTexto(t.text, fl.no.name || null)
    const j = t.paragraphStyle?.justification
    const campo: CampoDetectado = {
      id: gid(), origem: 'camada', camadaId: fl.id, textoOriginal: t.text.trim(), ...p, x: cx - w / 2, y: cy - h / 2, w, h, rotacao: rot,
      tamanho: (st.fontSize || h * 0.8) * esc, cor: st.fillColor ? hex(st.fillColor.r, st.fillColor.g, st.fillColor.b) : '#1f2937',
      estilo: null, fonteArquivo: st.font?.name || null, alinhamento: j === 'left' || j === 'right' ? j : 'center',
      negrito: !!st.fauxBold || /bold|black|heavy|semibold|extrabold/i.test(st.font?.name || ''), camada: fl.no.name || null, incluir: p.papel !== 'outro',
      contorno: traco?.color ? hex(traco.color.r, traco.color.g, traco.color.b) : st.strokeFlag && st.strokeColor ? hex(st.strokeColor.r, st.strokeColor.g, st.strokeColor.b) : null,
      sombra: !!fl.no.effects?.dropShadow?.some(s => s.enabled !== false),
      efeitos: efeitosDoPsd(fl.no.effects, (st.fontSize || h * 0.8) * esc),
      curvatura: t.warp?.style === 'arc' && t.warp.value ? Math.round(t.warp.value * 1.8) : 0,
    }
    campos.push(campo)
    const item = lista.find(x => x.id === fl.id); if (item) item.campoId = campo.id
  }
  const avisos: string[] = []
  if (psd.reduzida) avisos.push(`PSD muito grande para este aparelho — importei em resolução reduzida (${W}×${H}).`)
  if (psd.puladas) avisos.push(`${psd.puladas} camada(s) não couberam na memória e ficaram de fora. No Photoshop, reduza ou mescle essas camadas e importe de novo.`)
  const arte: ArteImportada = {
    formato: 'psd', caminho: lista.length > 1 ? 'camadas' : 'achatado', fundo: original, original, pagina,
    camadas: { total: folhas.length, texto: campos.length, nomes: lista.filter(c => c.tipo !== 'grupo').map(c => c.nome) },
    campos, avisos, lista, recompor: (ocultar: Set<string>) => desenhar(ocultar),
  }
  for (const c of lista.filter(x => x.sugerida && !x.campoId)) {
    const cp = campoDaCamada(arte, c.id); if (cp) { campos.push(cp); c.campoId = cp.id }
  }
  if (arte.caminho === 'achatado') avisos.push('O PSD tem uma camada só (achatado) — use a leitura de texto e a cobertura, ou suba o PSD com as camadas.')
  else if (!campos.length) avisos.push('Li as camadas, mas nenhuma é texto editável nem se chama "nome"/"idade". Marque abaixo qual camada é o nome (ou a idade).')
  arte.fundo = campos.some(c => c.incluir) ? await desenhar(camadasDosCampos(campos)) : original
  return arte
}
const caixaNo = (l: NoPsd): Caixa2 | null => (l.right !== undefined && l.bottom !== undefined && l.right > (l.left || 0) && l.bottom > (l.top || 0) ? { x: l.left || 0, y: l.top || 0, w: l.right - (l.left || 0), h: l.bottom - (l.top || 0) } : null)

// ── SVG e vetores XML (Illustrator, Inkscape, Figma, Canva) ──────────────────────
/** Tamanho real da página pelo width/height do SVG (mm, cm, in, pt) — senão 300 dpi. */
function paginaDoSvg(svg: Element, W: number, H: number): { larguraPt: number; alturaPt: number } {
  const pt = (v: string | null) => {
    const m = (v || '').match(/^([\d.]+)\s*(mm|cm|in|pt|px)?$/)
    if (!m) return null
    const n = parseFloat(m[1])
    return { mm: n * 72 / 25.4, cm: n * 720 / 25.4, in: n * 72, pt: n, px: n * 0.75 }[(m[2] || 'px') as 'mm']
  }
  const w = /mm|cm|in|pt/.test(svg.getAttribute('width') || '') ? pt(svg.getAttribute('width')) : null
  const h = /mm|cm|in|pt/.test(svg.getAttribute('height') || '') ? pt(svg.getAttribute('height')) : null
  return w && h ? { larguraPt: w, alturaPt: h } : { larguraPt: (W * 72) / 300, alturaPt: (H * 72) / 300 }
}
const ocultoNoSvg = (e: Element) => !!e.closest('[display="none"], [visibility="hidden"]') || !!e.closest('[style*="display:none"], [style*="display: none"]')

async function lerSvg(f: File, formato: ArteImportada['formato'] = 'svg'): Promise<ArteImportada> {
  const bruto = await f.text()
  const doc = new DOMParser().parseFromString(bruto, 'image/svg+xml')
  if (doc.querySelector('parsererror')) throw new Error('Este SVG está com defeito (não consegui ler o XML).')
  const svg = doc.documentElement
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  const W0 = vb.length === 4 ? vb[2] : parseFloat(svg.getAttribute('width') || '1000'), H0 = vb.length === 4 ? vb[3] : parseFloat(svg.getAttribute('height') || '1000')
  const k0 = Math.max(1, 2400 / Math.max(W0, H0)), k = k0 * escalaMax(W0 * k0, H0 * k0)
  const W = Math.round(W0 * k), H = Math.round(H0 * k)
  const ox = vb.length === 4 ? vb[0] : 0, oy = vb.length === 4 ? vb[1] : 0
  // marca cada candidato a camada: <text>, e grupos/elementos com nome (id, data-name, inkscape:label)
  const rotulo = (e: Element) => e.getAttribute('inkscape:label') || e.getAttribute('data-name') || e.getAttribute('id') || ''
  // texto de camada oculta/congelada não vira campo
  const textos = [...doc.querySelectorAll('text')].filter(t => !ocultoNoSvg(t) && (t.textContent || '').trim())
  const nomeados = [...doc.querySelectorAll('g, path, image, use, rect, circle, ellipse, polygon')].filter(e => {
    const r = rotulo(e); if (!r || e.closest('defs, clipPath, mask, symbol, pattern')) return false
    const camadaInkscape = e.getAttribute('inkscape:groupmode') === 'layer'
    return camadaInkscape || e.parentElement === svg || CANDIDATA.test(r)
  })
  const marcados = [...textos, ...nomeados]
  marcados.forEach((e, i) => e.setAttribute('data-soa-camada', `s${i}`))
  const texto = new XMLSerializer().serializeToString(doc)
  // medidas reais: SVG montado escondido na página
  const host = document.createElement('div'); host.style.cssText = `position:absolute;left:-99999px;top:0;width:${W0}px;height:${H0}px`
  host.innerHTML = texto; document.body.appendChild(host)
  const raiz = host.querySelector('svg') as SVGSVGElement | null
  if (raiz) { raiz.setAttribute('width', String(W0)); raiz.setAttribute('height', String(H0)) }
  const rr = raiz?.getBoundingClientRect()
  const bboxTela = (id: string): Caixa2 | null => {
    const el = host.querySelector(`[data-soa-camada="${id}"]`) as SVGGraphicsElement | null
    if (!el || !rr || !rr.width) return null
    const b = el.getBoundingClientRect()
    if (!b.width || !b.height) return null
    return { x: ((b.left - rr.left) / rr.width) * W, y: ((b.top - rr.top) / rr.height) * H, w: (b.width / rr.width) * W, h: (b.height / rr.height) * H }
  }
  const lista: CamadaLida[] = []
  const campos: CampoDetectado[] = textos.map(t => {
    const id = t.getAttribute('data-soa-camada')!
    const vivo = host.querySelector(`[data-soa-camada="${id}"]`) as SVGTextElement | null
    const conteudo = (t.textContent || '').replace(/\s+/g, ' ').trim()
    const cs = vivo ? getComputedStyle(vivo) : null
    let bb = { x: parseFloat(t.getAttribute('x') || '0'), y: parseFloat(t.getAttribute('y') || '0') - 20, width: conteudo.length * 12, height: 24 }
    let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    try { if (vivo?.getBBox) bb = vivo.getBBox(); const ctm = vivo?.getCTM?.(), rc = raiz?.getCTM?.(); if (ctm && rc) { const inv = rc.inverse().multiply(ctm); m = { a: inv.a, b: inv.b, c: inv.c, d: inv.d, e: inv.e, f: inv.f } } } catch { /* estimativa */ }
    const cxU = bb.x + bb.width / 2, cyU = bb.y + bb.height / 2
    const cx = (m.a * cxU + m.c * cyU + m.e - ox) * k, cy = (m.b * cxU + m.d * cyU + m.f - oy) * k
    const esc = Math.hypot(m.a, m.b) || 1
    const rot = Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI)
    const w = bb.width * esc * k, h = bb.height * esc * k
    const fs = parseFloat(cs?.fontSize || t.getAttribute('font-size') || '16') * esc * k
    const rgb = (v?: string | null) => (v && v.startsWith('rgb') ? hex(...(v.match(/[\d.]+/g)!.slice(0, 3).map(Number) as [number, number, number])) : v && /^#[0-9a-f]{6}$/i.test(v) ? v : null)
    const cor = rgb(cs?.fill) || rgb(t.getAttribute('fill')) || '#1f2937'
    const traco = cs && cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth || '0') > 0 ? rgb(cs.stroke) : null
    const anc = t.getAttribute('text-anchor') || cs?.textAnchor
    const nomeCamada = rotulo(t) || rotulo(t.closest('g') || t) || null
    const p = papelDoTexto(conteudo, nomeCamada)
    const campo: CampoDetectado = {
      id: gid(), origem: 'camada', camadaId: id, textoOriginal: conteudo, ...p, x: cx - w / 2, y: cy - h / 2, w, h, rotacao: rot, tamanho: fs,
      cor, estilo: null, fonteArquivo: (cs?.fontFamily || t.getAttribute('font-family') || '').replace(/["']/g, '').split(',')[0] || null,
      alinhamento: anc === 'start' ? 'left' : anc === 'end' ? 'right' : 'center', negrito: /bold|[6-9]00/.test(cs?.fontWeight || t.getAttribute('font-weight') || ''), camada: nomeCamada, incluir: p.papel !== 'outro',
      contorno: traco,
    }
    lista.push({ id, nome: nomeCamada || conteudo.slice(0, 30), tipo: 'texto', bbox: { x: campo.x, y: campo.y, w, h }, texto: conteudo, campoId: campo.id })
    return campo
  })
  for (const e of nomeados) {
    const id = e.getAttribute('data-soa-camada')!
    // grupo que JÁ tem texto (ex.: camada "Nome" do DXF com o texto dentro) não é sugerido: o texto é o campo
    lista.push({ id, nome: e.getAttribute('data-name') || rotulo(e), tipo: e.tagName.toLowerCase() === 'g' ? 'grupo' : 'vetor', bbox: bboxTela(id), sugerida: CANDIDATA.test(rotulo(e)) && !e.querySelector('text') && !ocultoNoSvg(e) })
  }
  host.remove()
  const render = async (s: string) => paraCanvas(await imagemDe(new Blob([s], { type: 'image/svg+xml' })), W, H)
  const original = await render(texto)
  const semCamadas = async (ocultar: Set<string>) => {
    if (!ocultar.size) return original
    const d = new DOMParser().parseFromString(texto, 'image/svg+xml')
    d.querySelectorAll('[data-soa-camada]').forEach(el => { if (ocultar.has(el.getAttribute('data-soa-camada')!)) el.remove() })
    return render(new XMLSerializer().serializeToString(d))
  }
  // cor das camadas vetoriais nomeadas: o que some quando ela é escondida
  for (const c of lista.filter(x => x.sugerida)) { const k2 = coresDaCamada(await diferenca(original, await semCamadas(new Set([c.id])), c.bbox)); if (k2) { c.cor = k2.cor; c.contorno = k2.contorno } }
  const pagina = paginaDoSvg(svg, W, H)
  const arte: ArteImportada = {
    formato, caminho: lista.length ? 'camadas' : 'achatado', fundo: original, original, pagina,
    camadas: { total: lista.length, texto: textos.length, nomes: lista.map(c => c.nome) }, campos,
    avisos: textos.length ? [] : lista.length ? ['O texto deste SVG virou desenho (contorno). Marque abaixo qual camada é o nome (ou a idade).'] : ['O SVG não tem texto editável nem camadas com nome — use a leitura de texto.'],
    lista, recompor: semCamadas,
  }
  for (const c of lista.filter(x => x.sugerida && !x.campoId)) { const cp = campoDaCamada(arte, c.id); if (cp) { campos.push(cp); c.campoId = cp.id } }
  if (campos.some(c => c.incluir)) arte.fundo = await semCamadas(camadasDosCampos(campos))
  return arte
}

/** Pixels que mudam entre `com` e `sem` (dentro da caixa) — é o desenho da camada escondida. */
async function diferenca(com: HTMLCanvasElement, sem: HTMLCanvasElement, bb: Caixa2 | null): Promise<HTMLCanvasElement | null> {
  if (!bb) return null
  const x = Math.max(0, Math.floor(bb.x)), y = Math.max(0, Math.floor(bb.y)), w = Math.min(com.width - x, Math.ceil(bb.w)), h = Math.min(com.height - y, Math.ceil(bb.h))
  if (w < 2 || h < 2) return null
  const a = com.getContext('2d', { willReadFrequently: true })!.getImageData(x, y, w, h), b = sem.getContext('2d', { willReadFrequently: true })!.getImageData(x, y, w, h)
  for (let i = 0; i < a.data.length; i += 4) {
    const dif = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) + Math.abs(a.data[i + 3] - b.data[i + 3])
    if (dif < 40) a.data[i + 3] = 0
  }
  const c = canvas(w, h); c.getContext('2d')!.putImageData(a, 0, 0); return c
}
/** Caixa dos pixels que mudaram entre duas renderizações (camada OCG sem texto). */
function caixaDaDiferenca(a: HTMLCanvasElement, b: HTMLCanvasElement): Caixa2 | null {
  const W = a.width, H = a.height
  const da = a.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data, db = b.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 36) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

// ── PDF (e .ai compatível com PDF): texto real + camadas OCG ─────────────────────
async function lerPdf(f: File, formato: ArteImportada['formato'] = 'pdf', numero = 1, progresso?: ProgressoCamadas): Promise<ArteImportada> {
  const buf = await f.arrayBuffer()
  // 1) PDF do Photoshop com "Preservar recursos de edição": o PSD inteiro vem dentro → camadas reais
  const psd = await psdEmbutido(buf)
  if (psd) {
    const a = await lerPsd(new File([psd as BlobPart], f.name.replace(/\.\w+$/, '') + '.psd'), progresso)
    return { ...a, formato, avisos: ['PDF do Photoshop com as camadas preservadas — li o PSD que vem dentro dele.', ...a.avisos] }
  }
  const pdfjs = await carregarPdfJs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), fontExtraProperties: true }).promise
  const pg = await doc.getPage(Math.min(Math.max(1, numero), doc.numPages))
  const base = pg.getViewport({ scale: 1 })
  const esc = Math.min(300 / 72, escalaMax(base.width, base.height, 100))
  const vp = pg.getViewport({ scale: esc })
  const W = Math.round(vp.width), H = Math.round(vp.height)
  const pagina = { larguraPt: base.width, alturaPt: base.height }
  type Ocg = { getGroups?: () => Record<string, { name: string }> | null; setVisibility?: (id: string, v: boolean) => void }
  const ocg = await doc.getOptionalContentConfig().catch(() => null) as unknown as Ocg | null
  const grupos = ocg?.getGroups?.() || null
  // respeita o estado inicial: camada que já vem desligada no PDF continua desligada
  const ocgs = grupos ? Object.entries(grupos).map(([id, g]) => ({ id, nome: g.name, ligada: (g as { visible?: boolean }).visible !== false })) : []
  const renderizar = async (semTexto: boolean, ocultar: string[] = [], escala = esc) => {
    const v = escala === esc ? vp : pg.getViewport({ scale: escala })
    const c = canvas(v.width, v.height), g = c.getContext('2d')!
    if (semTexto) { (g as unknown as { fillText: () => void }).fillText = () => {}; (g as unknown as { strokeText: () => void }).strokeText = () => {} }
    if (ocg?.setVisibility) for (const o of ocgs) ocg.setVisibility(o.id, o.ligada && !ocultar.includes(o.id))
    await pg.render({ canvasContext: g, viewport: v, canvas: c, ...(ocgs.length ? { optionalContentConfigPromise: Promise.resolve(ocg) } : {}) } as never).promise
    return c
  }
  const original = await renderizar(false)
  const tc = await pg.getTextContent()
  // fonte EMBUTIDA de cada texto (carregada pelo pdf.js ao desenhar) — o nome novo sai na mesma fonte
  const fontesPdf = new Map<string, FonteEmbutida | null>()
  const fonteDe = async (loaded: string): Promise<FonteEmbutida | null> => {
    if (fontesPdf.has(loaded)) return fontesPdf.get(loaded)!
    const o = await new Promise<{ name?: string; data?: Uint8Array; loadedName?: string } | null>(res => {
      const t = setTimeout(() => res(null), 3000)
      try { (pg.commonObjs as unknown as { get: (id: string, cb: (v: unknown) => void) => void }).get(loaded, v => { clearTimeout(t); res(v as never) }) } catch { clearTimeout(t); res(null) }
    })
    const nomePdf = o?.name || loaded
    const fe = o ? { nomePdf, nome: nomePdf.replace(/^[A-Z]{6}\+/, ''), dados: o.data ? new Uint8Array(o.data) : null, subconjunto: /^[A-Z]{6}\+/.test(nomePdf), familiaSessao: o.loadedName || loaded } : null
    fontesPdf.set(loaded, fe)
    return fe
  }
  const itens = (tc.items as { str: string; transform: number[]; width: number; height: number; fontName: string }[]).filter(i => i.str?.trim())
  const lista: CamadaLida[] = []
  const campos: CampoDetectado[] = itens.map((it, i) => {
    const [a, b, c2, d, e, fy] = it.transform
    const alt = Math.hypot(c2, d) || it.height || 10
    const dir = { x: a / (Math.hypot(a, b) || 1), y: b / (Math.hypot(a, b) || 1) }
    const cima = { x: -dir.y, y: dir.x }
    const p0 = { x: e, y: fy }, p1 = { x: e + dir.x * it.width, y: fy + dir.y * it.width }
    const meio = { x: (p0.x + p1.x) / 2 + cima.x * alt * 0.35, y: (p0.y + p1.y) / 2 + cima.y * alt * 0.35 }
    const [cx, cy] = vp.convertToViewportPoint(meio.x, meio.y)
    const rot = -Math.round((Math.atan2(b, a) * 180) / Math.PI)
    const p = papelDoTexto(it.str, null)
    const id = `t${i}`
    const campo: CampoDetectado = {
      id: gid(), origem: 'camada', camadaId: id, textoOriginal: it.str.trim(), ...p, x: cx - (it.width * esc) / 2, y: cy - (alt * 1.2 * esc) / 2, w: it.width * esc, h: alt * 1.2 * esc,
      rotacao: rot, tamanho: alt * esc, cor: '#1f2937', estilo: null, fonteArquivo: (tc.styles as Record<string, { fontFamily?: string }>)[it.fontName]?.fontFamily || null,
      alinhamento: 'center', negrito: false, camada: null, incluir: p.papel !== 'outro',
      fonteNomePdf: it.fontName,
    } as CampoDetectado & { fonteNomePdf?: string }
    lista.push({ id, nome: it.str.trim().slice(0, 30), tipo: 'texto', bbox: { x: campo.x, y: campo.y, w: campo.w, h: campo.h }, texto: it.str.trim(), campoId: campo.id })
    return campo
  })
  for (const cp of campos as (CampoDetectado & { fonteNomePdf?: string })[]) {
    const fe = cp.fonteNomePdf ? await fonteDe(cp.fonteNomePdf) : null
    delete cp.fonteNomePdf
    if (fe) { cp.fonteEmbutida = fe; cp.fonteArquivo = fe.nome }
  }
  // OCG: onde cada camada está = diferença entre desenhar com e sem ela (em baixa resolução)
  if (ocgs.length && ocgs.length <= 40 && ocg?.setVisibility) {
    const kb = Math.min(1, 900 / Math.max(W, H)), eb = esc * kb
    const todas = await renderizar(false, [], eb)
    for (const o of ocgs.filter(x => x.ligada)) {
      const sem = await renderizar(false, [o.id], eb)
      const bb = caixaDaDiferenca(todas, sem)
      lista.push({ id: `o:${o.id}`, nome: o.nome, tipo: 'ocg', bbox: bb ? { x: bb.x / kb, y: bb.y / kb, w: bb.w / kb, h: bb.h / kb } : null, sugerida: CANDIDATA.test(o.nome) })
    }
  }
  // texto do PDF some "tudo ou nada" (o desenho de texto é desligado inteiro); OCG some uma a uma
  const recompor = async (ocultar: Set<string>) => {
    const semTexto = [...ocultar].some(x => x.startsWith('t'))
    const ocultarOcg = [...ocultar].filter(x => x.startsWith('o:')).map(x => x.slice(2))
    return semTexto || ocultarOcg.length ? renderizar(semTexto, ocultarOcg) : original
  }
  const temCamadas = itens.length > 0 || ocgs.length > 0
  const avisos: string[] = []
  if (itens.length) avisos.push('A cor e a fonte do PDF são estimadas — confira em cada campo.')
  if (!itens.length && ocgs.length) avisos.push(`Li ${ocgs.length} camada(s) do PDF. Marque qual é o nome (ou a idade) — ela some do fundo e vira campo.`)
  const produtor = await doc.getMetadata().then(m => ((m.info as Record<string, unknown>)?.Producer as string) || null).catch(() => null)
  if (!temCamadas) avisos.push(formato === 'ai'
    ? 'Este .ai não tem texto nem camadas legíveis (texto em curvas?) — use a leitura de texto, ou exporte SVG/PDF com as camadas.'
    : avisoPdfAchatado({ ladrilhos: false, produtor }))
  if (doc.numPages > 1) avisos.push(`Este PDF tem ${doc.numPages} páginas — abri a página ${Math.min(Math.max(1, numero), doc.numPages)}.`)
  const arte: ArteImportada = {
    formato, caminho: temCamadas ? 'camadas' : 'achatado', fundo: original, original, pagina,
    camadas: { total: itens.length + ocgs.length, texto: itens.length, nomes: lista.map(c => c.nome) }, campos, avisos, lista, recompor,
    textoTudoOuNada: itens.length > 0, totalPaginas: doc.numPages,
  }
  for (const c of lista.filter(x => x.sugerida && !x.campoId)) {
    const cp = campoDaCamada(arte, c.id); if (cp) { campos.push(cp); c.campoId = cp.id }
  }
  for (const c of lista.filter(x => x.tipo === 'ocg' && x.bbox)) { const k2 = coresDaCamada(await diferenca(original, await renderizar(false, [c.id.slice(2)]), c.bbox)); if (k2) { c.cor = k2.cor; c.contorno = k2.contorno } }
  // cor do texto real = o que some quando o texto é desligado
  if (itens.length) {
    const semTexto = await renderizar(true)
    for (const cp of campos.filter(x => x.camadaId?.startsWith('t'))) { const k2 = coresDaCamada(await diferenca(original, semTexto, { x: cp.x, y: cp.y, w: cp.w, h: cp.h })); if (k2) { cp.cor = k2.cor; cp.contorno = k2.contorno } }
  }
  for (const cp of campos.filter(x => x.camadaId?.startsWith('o:'))) { const l = lista.find(c => c.id === cp.camadaId); if (l?.cor) { cp.cor = l.cor; cp.contorno = l.contorno || null } }
  if (campos.some(c => c.incluir)) arte.fundo = await recompor(camadasDosCampos(campos))
  return arte
}

async function lerImagem(f: File): Promise<ArteImportada> {
  const i = await imagemDe(f)
  const k = escalaMax(i.naturalWidth, i.naturalHeight)
  const c = paraCanvas(i, i.naturalWidth * k, i.naturalHeight * k)
  return { formato: 'imagem', caminho: 'achatado', fundo: c, original: c, pagina: { larguraPt: (c.width * 72) / 300, alturaPt: (c.height * 72) / 300 }, camadas: { total: 1, texto: 0, nomes: [] }, campos: [], avisos: [], lista: [] }
}

/** Arquivo aceito mas sem leitura (formato fechado): leva a prévia embutida e a orientação de exportar. */
export class ArquivoSoPrevia extends Error {
  miniatura: Blob | null
  passos: string[]
  constructor(msg: string, miniatura: Blob | null, passos: string[]) { super(msg); this.miniatura = miniatura; this.passos = passos }
}

/** Formato pelo CONTEÚDO (magic bytes), não só pela extensão. */
export async function formatoDoArquivo(f: File): Promise<'psd' | 'pdf' | 'svg' | 'dxf' | 'studio' | 'eps' | 'cdr' | 'ai-antigo' | 'imagem'> {
  const n = f.name.toLowerCase()
  const cab = new Uint8Array(await f.slice(0, 64).arrayBuffer())
  if (ehStudio(f.name, cab)) return 'studio'
  if (ehDxf(f.name, new TextDecoder('latin1').decode(await f.slice(0, 256).arrayBuffer()))) return 'dxf'
  const ascii = String.fromCharCode(...cab.slice(0, 12))
  if (ascii.startsWith('8BPS')) return 'psd'                                   // PSD (v1) e PSB (v2)
  if (ascii.startsWith('%PDF')) return 'pdf'                                   // PDF e .ai "compatível com PDF"
  if (ascii.startsWith('%!PS') || (cab[0] === 0xc5 && cab[1] === 0xd0 && cab[2] === 0xd3 && cab[3] === 0xc6)) return n.endsWith('.ai') ? 'ai-antigo' : 'eps'
  if (ascii.startsWith('RIFF') && /CDR/i.test(String.fromCharCode(...cab.slice(8, 12)))) return 'cdr'
  if (n.endsWith('.cdr')) return 'cdr'
  if (n.endsWith('.eps')) return 'eps'
  if (n.endsWith('.ai')) return 'ai-antigo'
  const inicio = new TextDecoder().decode(cab).trimStart()
  if (n.endsWith('.svg') || f.type === 'image/svg+xml' || inicio.startsWith('<svg') || (inicio.startsWith('<?xml') && /<svg/i.test(await f.slice(0, 2048).text()))) return 'svg'
  return 'imagem'
}

/** Roteador: com camadas → leitor de camadas (o ORIGINAL, antes de qualquer achatamento); chapado → imagem. */
export async function importarArte(f: File, pagina = 1, progresso?: ProgressoCamadas): Promise<ArteImportada> {
  const fmt = await formatoDoArquivo(f)
  if (fmt === 'psd') return lerPsd(f, progresso)
  if (fmt === 'pdf') return lerPdf(f, f.name.toLowerCase().endsWith('.ai') ? 'ai' : 'pdf', pagina, progresso)
  if (fmt === 'svg') return lerSvg(f)
  if (fmt === 'dxf') {
    // DXF (arquivo de corte, com camadas) → SVG que preserva as camadas e os textos → mesmo leitor
    const d = await dxfParaSvg(decodificarDxf(await f.arrayBuffer()))
    const a = await lerSvg(new File([d.svg], f.name.replace(/\.\w+$/, '') + '.svg', { type: 'image/svg+xml' }), 'dxf')
    return { ...a, avisos: [...d.avisos, ...a.avisos] }
  }
  if (fmt === 'studio') throw new ArquivoSoPrevia(ORIENTACAO_STUDIO, extrairMiniaturaStudio(await f.arrayBuffer()), PASSOS_EXPORT_STUDIO)
  if (fmt === 'eps') throw new Error('EPS ainda não tem leitura de camadas aqui. Exporte como SVG, PDF ou PSD (ou PNG, se for arte chapada) e suba de novo.')
  if (fmt === 'cdr') throw new Error('CorelDRAW (.cdr) não tem leitura no navegador. No Corel, exporte como SVG ou PDF (mantendo o texto como texto) e suba de novo.')
  if (fmt === 'ai-antigo') throw new Error('Este .ai não é compatível com PDF. No Illustrator, salve com "Criar arquivo compatível com PDF" marcado, ou exporte SVG/PDF.')
  return lerImagem(f)
}

/** Campos a partir do OCR (caixas normalizadas na imagem inteira) — já na orientação do texto. */
export function camposDoOcr(textos: { texto: string; x: number; y: number; w: number; h: number; rotacao: number; tipo: PapelCampo; nome: string | null; idade: string | null; estilo: string; cor: string; contorno?: string | null; sombra?: boolean }[], W: number, H: number): CampoDetectado[] {
  // Número de 1–2 caracteres não tem "direção de leitura" clara para a visão: herda o giro do nome.
  const giroNome = textos.find(t => t.tipo === 'nome' || t.tipo === 'nome_idade')?.rotacao
  return textos.map(t => {
    if (giroNome !== undefined && t.tipo === 'idade' && t.texto.replace(/\s/g, '').length <= 2) t = { ...t, rotacao: giroNome }
    const bw = t.w * W, bh = t.h * H, cx = (t.x + t.w / 2) * W, cy = (t.y + t.h / 2) * H
    const vertical = Math.abs(Math.abs(t.rotacao) - 90) < 1
    const w = vertical ? bh : bw, h = vertical ? bw : bh
    const papel = t.tipo
    return {
      id: gid(), origem: 'ocr', textoOriginal: t.texto, papel, nome: t.nome, idade: t.idade, x: cx - w / 2, y: cy - h / 2, w, h,
      rotacao: t.rotacao, tamanho: h * 0.85, cor: t.cor, estilo: t.estilo, fonteArquivo: null, alinhamento: 'center',
      negrito: t.estilo === 'sem_serifa', camada: null, incluir: papel !== 'outro', contorno: t.contorno ?? null, sombra: !!t.sombra,
    }
  })
}

/**
 * Mede as cores do texto NOS PIXELS da arte (a visão confunde preenchimento × contorno): o anel da
 * borda da caixa diz qual é o fundo; dentro dela, a cor mais frequente que não é fundo = preenchimento
 * e a segunda, se for bem diferente, = contorno. Sem confiança suficiente, mantém o que veio.
 */
export function refinarCores(campos: CampoDetectado[], arte: CanvasImageSource & { width: number; height: number }): CampoDetectado[] {
  return campos.map(c => {
    if (!c.incluir) return c
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2
    const vertical = Math.abs(Math.abs(c.rotacao) - 90) < 1
    const bw = vertical ? c.h : c.w, bh = vertical ? c.w : c.h
    const x0 = Math.max(0, Math.round(cx - bw / 2)), y0 = Math.max(0, Math.round(cy - bh / 2))
    const W = Math.min(arte.width - x0, Math.round(bw)), H = Math.min(arte.height - y0, Math.round(bh))
    if (W < 8 || H < 8) return c
    const k = Math.min(1, 220 / Math.max(W, H))
    const tw = Math.max(4, Math.round(W * k)), th = Math.max(4, Math.round(H * k))
    const cv = canvas(tw, th), g = cv.getContext('2d', { willReadFrequently: true })!
    g.drawImage(arte, x0, y0, W, H, 0, 0, tw, th)
    const d = g.getImageData(0, 0, tw, th).data
    const bin = (i: number) => ((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5)
    const anel = new Map<number, number>(), dentro = new Map<number, { n: number; r: number; g: number; b: number }>()
    const m = Math.max(1, Math.round(Math.min(tw, th) * 0.06))
    let nAnel = 0
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const i = (y * tw + x) * 4
      if (d[i + 3] < 128) continue
      const b = bin(i)
      if (x < m || y < m || x >= tw - m || y >= th - m) { anel.set(b, (anel.get(b) || 0) + 1); nAnel++ }
      else { const e = dentro.get(b) || { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2]; dentro.set(b, e) }
    }
    // fundo = bins que somam 85% do anel
    const fundo = new Set<number>()
    let soma = 0
    for (const [b, n] of [...anel.entries()].sort((a, z) => z[1] - a[1])) { if (soma > nAnel * 0.85) break; fundo.add(b); soma += n }
    const cands = [...dentro.entries()].filter(([b]) => !fundo.has(b)).map(([, e]) => ({ n: e.n, cor: [e.r / e.n, e.g / e.n, e.b / e.n] })).sort((a, z) => z.n - a.n)
    if (!cands.length) return c
    const dist = (a: number[], z: number[]) => Math.hypot(a[0] - z[0], a[1] - z[1], a[2] - z[2])
    // junta tons vizinhos (degradê da letra) no mesmo grupo
    const grupos: { n: number; cor: number[] }[] = []
    for (const x of cands) {
      const gp = grupos.find(q => dist(q.cor, x.cor) < 70)
      if (gp) { const t = gp.n + x.n; gp.cor = gp.cor.map((v, i) => (v * gp.n + x.cor[i] * x.n) / t); gp.n = t } else grupos.push({ ...x })
    }
    grupos.sort((a, z) => z.n - a.n)
    const total = grupos.reduce((s, q) => s + q.n, 0)
    if (grupos[0].n < total * 0.25) return c
    let a = grupos[0].cor, z: number[] | null = grupos[1] && grupos[1].n > grupos[0].n * 0.18 && dist(grupos[1].cor, grupos[0].cor) > 90 ? grupos[1].cor : null
    // A visão acerta QUAIS cores o texto tem (só confunde qual é qual): usa isso para escolher entre os
    // grupos medidos — a caixa às vezes pega um pedaço de personagem/ilustração junto.
    const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
    const prior = [c.cor, c.contorno].filter((x): x is string => !!x && /^#[0-9a-f]{6}$/i.test(x)).map(rgb)
    const casados = [...new Set(prior.map(p => grupos.filter(q => q.n > total * 0.06).sort((x, y) => dist(x.cor, p) - dist(y.cor, p))[0]).filter(q => q && prior.some(p => dist(q.cor, p) < 150)))]
    if (casados.length) { a = casados[0].cor; z = casados[1]?.cor ?? null }
    // Contorno costuma ser branco/claro ou preto; o preenchimento é a cor "de verdade" (mais saturada).
    const neutro = (q: number[]) => { const mx = Math.max(...q), mn = Math.min(...q); return (mx - mn) / (mx || 1) < 0.22 && (mn > 205 || mx < 60) }
    const sat = (q: number[]) => { const mx = Math.max(...q), mn = Math.min(...q); return (mx - mn) / (mx || 1) }
    if (z && ((neutro(a) && !neutro(z)) || (!neutro(a) && !neutro(z) && sat(z) > sat(a) + 0.25))) [a, z] = [z, a]
    const preench = hex(a[0], a[1], a[2])
    const seg = z ? hex(z[0], z[1], z[2]) : null
    return { ...c, cor: preench, contorno: seg ?? (c.contorno && c.contorno.toLowerCase() !== preench ? c.contorno : null) }
  })
}

// ── CAMADAS PARA O EDITOR DE IMAGEM: cada camada do PSD/SVG vira uma camada editável ─────────
export interface CamadaEditor {
  nome: string
  /** Pixels da camada (recortados), posição em px da arte. PSD grande manda `blob` (leve) no lugar. */
  pixels?: HTMLCanvasElement
  blob?: Blob
  /** Opacidade da camada no arquivo (vira a opacidade do objeto, continua editável). */
  opacidade?: number
  x: number; y: number; w: number; h: number
  /** Recorte (máscara de recorte do PSD): índice, nesta página, da camada-base que recorta esta. */
  clipDe?: number
  /** Modo de mesclagem do arquivo (multiplicar, tela…). */
  mistura?: GlobalCompositeOperation
  /** Molde/peça a que a camada pertence (pasta do PSD ou base do recorte) — agrupa no painel. */
  grupo?: string | null
  /** Camada de texto: vira Textbox editável com o estilo do arquivo. */
  texto?: { conteudo: string; fonte: string; tamanho: number; cor: string; alinhamento: 'left' | 'center' | 'right'; negrito: boolean; rotacao: number; fonteArquivo?: string | null; fonteEmbutida?: FonteEmbutida | null }
}

export interface PaginaEditor { W: number; H: number; itens: CamadaEditor[]; nome?: string }

function aparado(src: Pixels, x: number, y: number): { c: HTMLCanvasElement; x: number; y: number } | null {
  const t = canvas(src.width, src.height), g = t.getContext('2d', { willReadFrequently: true })!
  g.drawImage(src, 0, 0)
  const d = g.getImageData(0, 0, t.width, t.height).data
  let x0 = t.width, y0 = t.height, x1 = -1, y1 = -1
  for (let yy = 0; yy < t.height; yy++) for (let xx = 0; xx < t.width; xx++) if (d[(yy * t.width + xx) * 4 + 3] > 2) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy }
  if (x1 < 0) return null
  const o = canvas(x1 - x0 + 1, y1 - y0 + 1); o.getContext('2d')!.drawImage(t, x0, y0, o.width, o.height, 0, 0, o.width, o.height)
  return { c: o, x: x + x0, y: y + y0 }
}

const NAO_DESENHA = ['defs', 'style', 'title', 'desc', 'metadata', 'script']

/** PSD/SVG → lista de camadas (de baixo para cima) para montar no editor. null = formato sem camadas. */
export async function camadasParaEditor(f: File, progresso?: ProgressoCamadas): Promise<{ W: number; H: number; itens: CamadaEditor[]; avisos: string[]; paginasExtras?: PaginaEditor[] } | null> {
  const fmt = await formatoDoArquivo(f)
  if (fmt === 'pdf') {
    const buf = await f.arrayBuffer()
    const psd = await psdEmbutido(buf)
    if (psd) {
      const r = await camadasParaEditor(new File([psd as BlobPart], f.name.replace(/\.\w+$/, '') + '.psd'), progresso)
      return r ? { ...r, avisos: ['PDF do Photoshop com as camadas preservadas — li o PSD que vem dentro dele.', ...r.avisos] } : null
    }
    // cada página vira uma página do editor; em cada uma: vetores/fundo + cada imagem + cada texto (com a fonte embutida)
    const primeira = await analisarPaginaPdf(buf.slice(0), 1)
    const paginas: PaginaEditor[] = []
    const avisos: string[] = []
    const montar = (pp: Awaited<ReturnType<typeof analisarPaginaPdf>>): PaginaEditor => {
      const itens: CamadaEditor[] = []
      if (pp.ladrilhos || (!pp.textos.length && !pp.imagens.length && !pp.vetores)) {
        itens.push({ nome: 'Página (achatada)', pixels: pp.original, x: 0, y: 0, w: pp.W, h: pp.H })
        return { W: pp.W, H: pp.H, itens }
      }
      if (pp.vetores) { const a = aparado(pp.vetores, 0, 0); if (a) itens.push({ nome: 'Vetores e fundo', pixels: a.c, x: a.x, y: a.y, w: a.c.width, h: a.c.height }) }
      pp.imagens.forEach((im, i) => itens.push({ nome: `Imagem ${i + 1}`, pixels: im.canvas, x: im.x, y: im.y, w: im.w, h: im.h }))
      for (const t of pp.textos) {
        const px = canvas(Math.max(1, t.w), Math.max(1, t.h))
        itens.push({
          nome: t.texto.slice(0, 30), pixels: px, x: t.x, y: t.y, w: t.w, h: t.h,
          texto: { conteudo: t.texto, fonte: 'poppins', tamanho: t.tamanho, cor: '#1f2937', alinhamento: 'left', negrito: false, rotacao: t.rotacao, fonteArquivo: t.fonte?.nome || null, fonteEmbutida: t.fonte },
        })
      }
      // cor de cada texto = o que some quando o texto é desligado
      return { W: pp.W, H: pp.H, itens }
    }
    const coresTexto = async (pp: Awaited<ReturnType<typeof analisarPaginaPdf>>, pgE: PaginaEditor) => {
      if (!pp.textos.length) return
      const sem = pp.vetores || null
      for (const it of pgE.itens.filter(x => x.texto)) {
        const k2 = sem ? coresDaCamada(await diferenca(pp.original, sem, { x: it.x, y: it.y, w: it.w, h: it.h })) : null
        if (k2 && it.texto) it.texto.cor = k2.cor
      }
    }
    const p1 = montar(primeira); await coresTexto(primeira, p1)
    for (let n = 2; n <= Math.min(primeira.totalPaginas, 60); n++) { const pp = await analisarPaginaPdf(buf.slice(0), n); const pe = montar(pp); await coresTexto(pp, pe); paginas.push(pe) }
    if (primeira.ladrilhos || p1.itens.length === 1 && p1.itens[0].nome === 'Página (achatada)') avisos.push(avisoPdfAchatado(primeira))
    if (primeira.totalPaginas > 60) avisos.push(`O PDF tem ${primeira.totalPaginas} páginas — abri as 60 primeiras.`)
    if (primeira.textos.some(t => t.fonte?.subconjunto)) avisos.push('A fonte embutida no PDF tem só as letras usadas no arquivo (subconjunto). Para escrever nomes novos com ela, suba o arquivo completo da fonte (.ttf/.otf).')
    return { W: p1.W, H: p1.H, itens: p1.itens, avisos, paginasExtras: paginas }
  }
  if (fmt === 'psd') {
    // IMPORT FIEL: posição/escala/ordem/opacidade/mesclagem de cada camada; máscaras de camada/vetor já aplicadas
    // nos pixels (psdLeve); máscara de RECORTE vira recorte editável (clipDe); cada PRANCHETA vira uma página.
    const psd = await arvorePsd(f, progresso)
    const tops = (psd.children || []).filter(n => !n.hidden)
    const pranchetas = tops.filter(n => n.artboard && n.artboard.right > n.artboard.left)
    const soltas = tops.filter(n => !n.artboard)
    const paginas: { nome?: string; x0: number; y0: number; W: number; H: number; nos: NoPsd[] }[] = pranchetas.length
      ? pranchetas.map((a, i) => ({ nome: a.name, x0: a.artboard!.left, y0: a.artboard!.top, W: a.artboard!.right - a.artboard!.left, H: a.artboard!.bottom - a.artboard!.top, nos: [...(i === 0 ? soltas : []), ...(a.children || [])] }))
      : [{ x0: 0, y0: 0, W: psd.width, H: psd.height, nos: psd.children || [] }]
    let mascaradas = 0
    const montar = (pg: typeof paginas[number]): PaginaEditor => {
      const itens: CamadaEditor[] = []
      let baseIdx = -1
      const andar = (nos: NoPsd[], grupo: string | null, raiz: boolean) => {
        for (const l of nos) {
          if (l.hidden) { if (!l.clipping) baseIdx = -1; continue }
          if (l.children) { andar(l.children, raiz ? l.name || grupo : grupo, false); baseIdx = -1; continue }
          if (!l.blob) { if (!l.clipping) baseIdx = -1; continue }
          if (l.mascarada) mascaradas++
          const x = (l.left || 0) - pg.x0, y = (l.top || 0) - pg.y0
          const w = Math.max(1, (l.right ?? (l.left || 0) + 1) - (l.left || 0)), h = Math.max(1, (l.bottom ?? (l.top || 0) + 1) - (l.top || 0))
          const tx = l.text?.text?.trim() ? l.text : null
          const st = tx?.style || {}, tr = tx?.transform || [1, 0, 0, 1, 0, 0]
          const j2 = tx?.paragraphStyle?.justification
          const recortada = !!l.clipping && baseIdx >= 0
          itens.push({
            nome: l.name || 'Camada', blob: l.blob, x, y, w, h, opacidade: l.opacity ?? 1,
            mistura: MISTURA[(l.blendMode || '').toLowerCase()],
            clipDe: recortada ? baseIdx : undefined,
            grupo: recortada ? itens[baseIdx].grupo ?? itens[baseIdx].nome : grupo,
            texto: tx ? {
              conteudo: tx.text.trim(), fonte: fontePorNome(st.font?.name || null, null), tamanho: (st.fontSize || h * 0.8) * (Math.hypot(tr[0], tr[1]) || 1),
              cor: st.fillColor ? hex(st.fillColor.r, st.fillColor.g, st.fillColor.b) : '#1f2937',
              alinhamento: j2 === 'left' || j2 === 'right' ? j2 : 'center',
              negrito: !!st.fauxBold || /bold|black|heavy/i.test(st.font?.name || ''), rotacao: Math.round((Math.atan2(tr[1], tr[0]) * 180) / Math.PI),
              fonteArquivo: st.font?.name || null,
            } : undefined,
          })
          if (!l.clipping) baseIdx = itens.length - 1
        }
      }
      andar(pg.nos, null, true)
      return { W: Math.max(1, Math.round(pg.W)), H: Math.max(1, Math.round(pg.H)), itens, nome: pg.nome }
    }
    const todas = paginas.map(montar).filter(p => p.itens.length)
    if (!todas.length) return { W: psd.width, H: psd.height, itens: [], avisos: ['O PSD não tem camadas visíveis.'] }
    const avisos: string[] = []
    if (todas.length === 1 && todas[0].itens.length <= 1) avisos.push('O PSD tem uma camada só (achatado).')
    const recortes = todas.reduce((n, p) => n + p.itens.filter(i => i.clipDe !== undefined).length, 0)
    if (recortes || mascaradas) avisos.push(`Máscaras do PSD reconstruídas: ${recortes ? `${recortes} recorte(s) editável(is)` : ''}${recortes && mascaradas ? ' e ' : ''}${mascaradas ? `${mascaradas} camada(s) com máscara aplicada` : ''}.`)
    if (psd.reduzida) avisos.push(`PSD muito grande para este aparelho — importei em resolução reduzida.`)
    if (psd.puladas) avisos.push(`${psd.puladas} camada(s) não couberam na memória e ficaram de fora.`)
    return { W: todas[0].W, H: todas[0].H, itens: todas[0].itens, avisos, paginasExtras: todas.slice(1) }
  }
  if (fmt === 'studio') throw new ArquivoSoPrevia(ORIENTACAO_STUDIO, extrairMiniaturaStudio(await f.arrayBuffer()), PASSOS_EXPORT_STUDIO)
  if (fmt === 'svg' || fmt === 'dxf') {
    const svgTexto = fmt === 'dxf' ? (await dxfParaSvg(decodificarDxf(await f.arrayBuffer()))).svg : await f.text()
    const doc = new DOMParser().parseFromString(svgTexto, 'image/svg+xml')
    const svg = doc.documentElement
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
    const W0 = vb.length === 4 ? vb[2] : parseFloat(svg.getAttribute('width') || '1000'), H0 = vb.length === 4 ? vb[3] : parseFloat(svg.getAttribute('height') || '1000')
    const k = Math.min(3, 2400 / Math.max(W0, H0)), W = Math.round(W0 * k), H = Math.round(H0 * k)
    // unidades: cada elemento do topo; grupo com TEXTO dentro (camada do DXF/Illustrator) abre um nível —
    // assim o texto vira objeto de texto editável e o desenho da camada vira outro objeto
    const unidades: Element[] = []
    for (const e of [...svg.children].filter(x => !NAO_DESENHA.includes(x.tagName.toLowerCase()) && !ocultoNoSvg(x))) {
      if (e.tagName.toLowerCase() === 'g' && e.querySelector('text')) unidades.push(...[...e.children].filter(x => !ocultoNoSvg(x)))
      else unidades.push(e)
    }
    unidades.forEach((e, i) => e.setAttribute('data-soa-u', String(i)))
    const filhos = unidades
    const itens: CamadaEditor[] = []
    for (let i = 0; i < filhos.length; i++) {
      const copia = svg.cloneNode(true) as Element
      copia.querySelectorAll('[data-soa-u]').forEach(e => { if (e.getAttribute('data-soa-u') !== String(i)) e.remove() })
      const img = await imagemDe(new Blob([new XMLSerializer().serializeToString(copia)], { type: 'image/svg+xml' }))
      const a = aparado(paraCanvas(img, W, H), 0, 0)
      if (!a) continue
      const e = filhos[i]
      const ehTexto = e.tagName.toLowerCase() === 'text' && !!(e.textContent || '').trim()
      const pai = e.parentElement && e.parentElement !== svg ? (e.parentElement.getAttribute('data-name') || e.parentElement.getAttribute('id')) : null
      const nome = e.getAttribute('inkscape:label') || e.getAttribute('data-name') || e.getAttribute('id') || (ehTexto ? (e.textContent || '').trim().slice(0, 30) : `${pai ? pai + ' · ' : ''}${e.tagName}`)
      itens.push({
        nome, pixels: a.c, x: a.x, y: a.y, w: a.c.width, h: a.c.height,
        texto: ehTexto ? { conteudo: (e.textContent || '').trim(), fonte: fontePorNome(e.getAttribute('font-family'), null), tamanho: parseFloat(e.getAttribute('font-size') || '16') * k, cor: corPredominante(a.c) || '#1f2937', alinhamento: 'center', negrito: /bold|[6-9]00/.test(e.getAttribute('font-weight') || ''), rotacao: Number((e.getAttribute('transform') || '').match(/rotate\(\s*(-?[\d.]+)/)?.[1] || 0), fonteArquivo: (e.getAttribute('font-family') || '').replace(/["']/g, '').split(',')[0] || null } : undefined,
      })
    }
    return { W, H, itens, avisos: [] }
  }
  return null
}
