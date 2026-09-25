// SOA Edition — ROTEADOR DE ARTE (só navegador). A artesã sobe o arquivo e o sistema decide o caminho:
//   • CAMADAS (PSD com camada de texto, SVG com <text>, PDF com texto real ou camadas OCG de texto):
//     lê as camadas, TIRA o texto do fundo (o que está embaixo aparece limpo — sem "desqueimar" nada)
//     e transforma cada texto num campo já posicionado → caminho 2.
//   • ACHATADO (JPEG/PNG, PDF só com imagem, PSD sem camada de texto): o fundo é a própria arte; os
//     campos vêm do OCR assistente e, onde havia texto queimado, entram com COBERTURA → caminhos 1+3.
// Decisão de arquitetura: nunca tentar apagar/reconstruir texto queimado automaticamente.
import { novaCaixa, type Caixa } from './tipos'

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
  formato: 'psd' | 'svg' | 'pdf' | 'ai' | 'imagem'
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
      fonte: fontePorNome(c.fonteArquivo, c.estilo), tamanho: Math.max(8, Math.round(c.tamanho)), cor: c.cor,
      alinhamento: c.alinhamento, negrito: c.negrito, maiusculas: upper, autoAjuste: true, rotacao: c.rotacao,
      contorno: c.contorno ? { cor: c.contorno, largura: Math.max(2, Math.round(c.tamanho * 0.05)) } : null,
      sombra: c.sombra ? { cor: 'rgba(0,0,0,0.35)', blur: Math.max(4, Math.round(c.tamanho * 0.06)), dx: Math.round(c.tamanho * 0.02), dy: Math.round(c.tamanho * 0.03) } : null,
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
type NoPsd = { name?: string; hidden?: boolean; opacity?: number; blendMode?: string; clipping?: boolean; left?: number; top?: number; right?: number; bottom?: number; canvas?: Pixels; children?: NoPsd[]; text?: TextoPsd; effects?: { stroke?: { enabled?: boolean; size?: { value: number }; color?: { r: number; g: number; b: number } }[]; dropShadow?: { enabled?: boolean }[] } }
type ArvorePsd = { width: number; height: number; canvas?: Pixels; children?: NoPsd[] }

async function arvorePsd(f: File): Promise<ArvorePsd> {
  if (typeof Worker !== 'undefined') {
    let w: Worker | null = null
    try {
      w = new Worker(new URL('./psd.worker.ts', import.meta.url), { type: 'module' })
      const buf = await f.arrayBuffer()
      const r = await new Promise<{ ok: boolean; psd?: ArvorePsd; erro?: string }>((res, rej) => {
        const t = setTimeout(() => rej(new Error('tempo')), 180_000)
        w!.onmessage = e => { clearTimeout(t); res(e.data) }
        w!.onerror = e => { clearTimeout(t); rej(new Error(e.message || 'worker')) }
        w!.postMessage(buf, [buf])
      })
      if (r.ok && r.psd) return r.psd
      throw new Error(r.erro || 'PSD ilegível')
    } catch { /* cai na leitura direta abaixo (mensagem de erro real sai de lá) */ } finally { w?.terminate() }
  }
  const { readPsd } = await import('ag-psd')
  return readPsd(await f.arrayBuffer(), { skipThumbnail: true }) as unknown as ArvorePsd
}

async function lerPsd(f: File): Promise<ArteImportada> {
  let psd: ArvorePsd
  try { psd = await arvorePsd(f) }
  catch (e) { throw new Error(`Não consegui ler as camadas deste PSD (${(e as Error).message}). Salve de novo no Photoshop com "Maximizar compatibilidade" ou exporte PDF/PNG.`) }
  const W = psd.width, H = psd.height
  // folhas visíveis na ordem de desenho + grupos (com a lista de folhas de cada um)
  type Folha = { id: string; no: NoPsd; opac: number; grupos: string[] }
  const folhas: Folha[] = [], lista: CamadaLida[] = []
  const pixelsDe = new Map<string, Pixels>()
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
      if (l.canvas) pixelsDe.set(id, l.canvas)
      const ehTexto = !!l.text?.text?.trim()
      lista.push({ id, nome: l.name || '(sem nome)', tipo: ehTexto ? 'texto' : 'imagem', bbox: caixaNo(l), texto: ehTexto ? l.text!.text.trim() : undefined, sugerida: !ehTexto && CANDIDATA.test(l.name || '') })
    }
  }
  andar(psd.children, 1, [])
  const desenhar = (ocultar: Set<string>) => {
    const c = canvas(W, H), g = c.getContext('2d')!
    let base: { no: NoPsd } | null = null
    for (const fl of folhas) {
      const escondida = ocultar.has(fl.id) || fl.grupos.some(gid2 => ocultar.has(gid2))
      if (!fl.no.clipping) base = escondida ? null : fl
      if (escondida || !fl.no.canvas) continue
      g.save(); g.globalAlpha = fl.opac; g.globalCompositeOperation = MISTURA[(fl.no.blendMode || '').toLowerCase()] || 'source-over'
      if (fl.no.clipping && base?.no.canvas) {
        // máscara de recorte: a camada só aparece onde a de baixo tem pixel
        const cv = fl.no.canvas, t = canvas(cv.width, cv.height), gt = t.getContext('2d')!
        gt.drawImage(cv, 0, 0); gt.globalCompositeOperation = 'destination-in'
        gt.drawImage(base.no.canvas, (base.no.left || 0) - (fl.no.left || 0), (base.no.top || 0) - (fl.no.top || 0))
        g.drawImage(t, fl.no.left || 0, fl.no.top || 0)
      } else if (!fl.no.clipping) g.drawImage(fl.no.canvas, fl.no.left || 0, fl.no.top || 0)
      g.restore()
    }
    return c
  }
  const original = psd.canvas ? paraCanvas(psd.canvas, W, H) : desenhar(new Set())
  const pagina = { larguraPt: (W * 72) / 300, alturaPt: (H * 72) / 300 }
  for (const c of lista) if (c.tipo === 'imagem') { const k2 = coresDaCamada(pixelsDe.get(c.id)); if (k2) { c.cor = k2.cor; c.contorno = k2.contorno } }
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
      tamanho: (st.fontSize || h * 0.8) * esc, cor: st.fillColor ? hex(st.fillColor.r, st.fillColor.g, st.fillColor.b) : corPredominante(fl.no.canvas) || '#1f2937',
      estilo: null, fonteArquivo: st.font?.name || null, alinhamento: j === 'left' || j === 'right' ? j : 'center',
      negrito: !!st.fauxBold || /bold|black|heavy|semibold|extrabold/i.test(st.font?.name || ''), camada: fl.no.name || null, incluir: p.papel !== 'outro',
      contorno: traco?.color ? hex(traco.color.r, traco.color.g, traco.color.b) : st.strokeFlag && st.strokeColor ? hex(st.strokeColor.r, st.strokeColor.g, st.strokeColor.b) : null,
      sombra: !!fl.no.effects?.dropShadow?.some(s => s.enabled !== false),
    }
    campos.push(campo)
    const item = lista.find(x => x.id === fl.id); if (item) item.campoId = campo.id
  }
  const avisos: string[] = []
  const arte: ArteImportada = {
    formato: 'psd', caminho: lista.length > 1 ? 'camadas' : 'achatado', fundo: original, original, pagina,
    camadas: { total: folhas.length, texto: campos.length, nomes: lista.filter(c => c.tipo !== 'grupo').map(c => c.nome) },
    campos, avisos, lista, recompor: async (ocultar: Set<string>) => desenhar(ocultar),
  }
  for (const c of lista.filter(x => x.sugerida && !x.campoId)) {
    const cp = campoDaCamada(arte, c.id); if (cp) { campos.push(cp); c.campoId = cp.id }
  }
  if (arte.caminho === 'achatado') avisos.push('O PSD tem uma camada só (achatado) — use a leitura de texto e a cobertura, ou suba o PSD com as camadas.')
  else if (!campos.length) avisos.push('Li as camadas, mas nenhuma é texto editável nem se chama "nome"/"idade". Marque abaixo qual camada é o nome (ou a idade).')
  arte.fundo = campos.some(c => c.incluir) ? desenhar(camadasDosCampos(campos)) : original
  return arte
}
const caixaNo = (l: NoPsd): Caixa2 | null => (l.right !== undefined && l.bottom !== undefined && l.right > (l.left || 0) && l.bottom > (l.top || 0) ? { x: l.left || 0, y: l.top || 0, w: l.right - (l.left || 0), h: l.bottom - (l.top || 0) } : null)

// ── SVG e vetores XML (Illustrator, Inkscape, Figma, Canva) ──────────────────────
async function lerSvg(f: File): Promise<ArteImportada> {
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
  const textos = [...doc.querySelectorAll('text')]
  const nomeados = [...doc.querySelectorAll('g, path, image, use, rect, circle, ellipse, polygon')].filter(e => {
    const r = rotulo(e); if (!r || e.closest('defs, clipPath, mask, symbol, pattern')) return false
    const camadaInkscape = e.getAttribute('inkscape:groupmode') === 'layer'
    return camadaInkscape || e.parentElement === svg || CANDIDATA.test(r)
  }).filter(e => !textos.some(t => e.contains(t) && !CANDIDATA.test(rotulo(e))))
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
    lista.push({ id, nome: rotulo(e), tipo: e.tagName.toLowerCase() === 'g' ? 'grupo' : 'vetor', bbox: bboxTela(id), sugerida: CANDIDATA.test(rotulo(e)) })
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
  const pagina = { larguraPt: (W * 72) / 300, alturaPt: (H * 72) / 300 }
  const arte: ArteImportada = {
    formato: 'svg', caminho: lista.length ? 'camadas' : 'achatado', fundo: original, original, pagina,
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
async function lerPdf(f: File, formato: ArteImportada['formato'] = 'pdf'): Promise<ArteImportada> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = '/estudio/pdf.worker.min.mjs'
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise
  const pg = await doc.getPage(1)
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
    }
    lista.push({ id, nome: it.str.trim().slice(0, 30), tipo: 'texto', bbox: { x: campo.x, y: campo.y, w: campo.w, h: campo.h }, texto: it.str.trim(), campoId: campo.id })
    return campo
  })
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
  if (!temCamadas) avisos.push(formato === 'ai'
    ? 'Este .ai não tem texto nem camadas legíveis (texto em curvas?) — use a leitura de texto, ou exporte SVG/PDF com as camadas.'
    : 'PDF achatado: o texto faz parte da imagem (não há texto nem camadas editáveis).')
  const arte: ArteImportada = {
    formato, caminho: temCamadas ? 'camadas' : 'achatado', fundo: original, original, pagina,
    camadas: { total: itens.length + ocgs.length, texto: itens.length, nomes: lista.map(c => c.nome) }, campos, avisos, lista, recompor,
    textoTudoOuNada: itens.length > 0,
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

/** Formato pelo CONTEÚDO (magic bytes), não só pela extensão. */
export async function formatoDoArquivo(f: File): Promise<'psd' | 'pdf' | 'svg' | 'eps' | 'cdr' | 'ai-antigo' | 'imagem'> {
  const n = f.name.toLowerCase()
  const cab = new Uint8Array(await f.slice(0, 64).arrayBuffer())
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
export async function importarArte(f: File): Promise<ArteImportada> {
  const fmt = await formatoDoArquivo(f)
  if (fmt === 'psd') return lerPsd(f)
  if (fmt === 'pdf') return lerPdf(f, f.name.toLowerCase().endsWith('.ai') ? 'ai' : 'pdf')
  if (fmt === 'svg') return lerSvg(f)
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
  /** Pixels da camada (recortados), posição em px da arte. */
  pixels: HTMLCanvasElement
  x: number; y: number; w: number; h: number
  /** Camada de texto: vira Textbox editável com o estilo do arquivo. */
  texto?: { conteudo: string; fonte: string; tamanho: number; cor: string; alinhamento: 'left' | 'center' | 'right'; negrito: boolean; rotacao: number }
}

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
export async function camadasParaEditor(f: File): Promise<{ W: number; H: number; itens: CamadaEditor[] } | null> {
  const fmt = await formatoDoArquivo(f)
  if (fmt === 'psd') {
    const psd = await arvorePsd(f)
    const itens: CamadaEditor[] = []
    let base: NoPsd | null = null
    const andar = (nos: NoPsd[] | undefined) => {
      for (const l of nos || []) {
        if (l.hidden) continue
        if (l.children) { andar(l.children); continue }
        if (!l.clipping) base = l
        if (!l.canvas) continue
        let px: Pixels = l.canvas
        const b: NoPsd | null = base
        if (l.clipping && b?.canvas) {   // máscara de recorte já aplicada nos pixels da camada
          const t = canvas(l.canvas.width, l.canvas.height), g = t.getContext('2d')!
          g.drawImage(l.canvas, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(b.canvas, (b.left || 0) - (l.left || 0), (b.top || 0) - (l.top || 0)); px = t
        }
        if ((l.opacity ?? 1) < 1) { const t = canvas(px.width, px.height), g = t.getContext('2d')!; g.globalAlpha = l.opacity ?? 1; g.drawImage(px, 0, 0); px = t }
        const a = aparado(px, l.left || 0, l.top || 0)
        if (!a) continue
        const tx = l.text?.text?.trim() ? l.text : null
        const st = tx?.style || {}, tr = tx?.transform || [1, 0, 0, 1, 0, 0]
        const j = tx?.paragraphStyle?.justification
        itens.push({
          nome: l.name || 'Camada', pixels: a.c, x: a.x, y: a.y, w: a.c.width, h: a.c.height,
          texto: tx ? {
            conteudo: tx.text.trim(), fonte: fontePorNome(st.font?.name || null, null), tamanho: (st.fontSize || a.c.height * 0.8) * (Math.hypot(tr[0], tr[1]) || 1),
            cor: st.fillColor ? hex(st.fillColor.r, st.fillColor.g, st.fillColor.b) : corPredominante(a.c) || '#1f2937',
            alinhamento: j === 'left' || j === 'right' ? j : 'center',
            negrito: !!st.fauxBold || /bold|black|heavy/i.test(st.font?.name || ''), rotacao: Math.round((Math.atan2(tr[1], tr[0]) * 180) / Math.PI),
          } : undefined,
        })
      }
    }
    andar(psd.children)
    return { W: psd.width, H: psd.height, itens }
  }
  if (fmt === 'svg') {
    const doc = new DOMParser().parseFromString(await f.text(), 'image/svg+xml')
    const svg = doc.documentElement
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
    const W0 = vb.length === 4 ? vb[2] : parseFloat(svg.getAttribute('width') || '1000'), H0 = vb.length === 4 ? vb[3] : parseFloat(svg.getAttribute('height') || '1000')
    const k = Math.min(3, 2400 / Math.max(W0, H0)), W = Math.round(W0 * k), H = Math.round(H0 * k)
    const filhos = [...svg.children].filter(e => !NAO_DESENHA.includes(e.tagName.toLowerCase()))
    const itens: CamadaEditor[] = []
    for (let i = 0; i < filhos.length; i++) {
      const copia = svg.cloneNode(true) as Element
      ;[...copia.children].filter(e => !NAO_DESENHA.includes(e.tagName.toLowerCase())).forEach((e, j) => { if (j !== i) e.remove() })
      const img = await imagemDe(new Blob([new XMLSerializer().serializeToString(copia)], { type: 'image/svg+xml' }))
      const a = aparado(paraCanvas(img, W, H), 0, 0)
      if (!a) continue
      const e = filhos[i]
      const ehTexto = e.tagName.toLowerCase() === 'text' && !!(e.textContent || '').trim()
      const nome = e.getAttribute('inkscape:label') || e.getAttribute('data-name') || e.getAttribute('id') || (ehTexto ? (e.textContent || '').trim().slice(0, 30) : e.tagName)
      itens.push({
        nome, pixels: a.c, x: a.x, y: a.y, w: a.c.width, h: a.c.height,
        texto: ehTexto ? { conteudo: (e.textContent || '').trim(), fonte: fontePorNome(e.getAttribute('font-family'), null), tamanho: parseFloat(e.getAttribute('font-size') || '16') * k, cor: corPredominante(a.c) || '#1f2937', alinhamento: 'center', negrito: /bold|[6-9]00/.test(e.getAttribute('font-weight') || ''), rotacao: 0 } : undefined,
      })
    }
    return { W, H, itens }
  }
  return null
}
