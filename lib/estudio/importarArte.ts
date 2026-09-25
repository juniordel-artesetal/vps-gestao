// SOA Edition — ROTEADOR DE ARTE (só navegador). A artesã sobe o arquivo e o sistema decide o caminho:
//   • CAMADAS (PSD com camada de texto, SVG com <text>, PDF com texto real ou camadas OCG de texto):
//     lê as camadas, TIRA o texto do fundo (o que está embaixo aparece limpo — sem "desqueimar" nada)
//     e transforma cada texto num campo já posicionado → caminho 2.
//   • ACHATADO (JPEG/PNG, PDF só com imagem, PSD sem camada de texto): o fundo é a própria arte; os
//     campos vêm do OCR assistente e, onde havia texto queimado, entram com COBERTURA → caminhos 1+3.
// Decisão de arquitetura: nunca tentar apagar/reconstruir texto queimado automaticamente.
import { novaCaixa, type Caixa } from './tipos'
import { ehPdf } from './cliente'

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
}
export interface ArteImportada {
  formato: 'psd' | 'svg' | 'pdf' | 'imagem'
  caminho: 'camadas' | 'achatado'
  /** Molde a usar: SEM o texto quando veio de camadas; a própria arte quando achatada. */
  fundo: HTMLCanvasElement
  /** A arte como veio (com o texto) — para a prévia de comparação e para o OCR. */
  original: HTMLCanvasElement
  pagina: { larguraPt: number; alturaPt: number }
  camadas: { total: number; texto: number; nomes: string[] }
  campos: CampoDetectado[]
  avisos: string[]
  /**
   * Refaz o fundo devolvendo as camadas de texto que NÃO viram campo (ex.: título fixo "Minha festa").
   * `manter` = ids dos campos a manter desenhados. Ausente → o fundo não muda (achatado/PDF).
   */
  recompor?: (manter: Set<string>) => Promise<HTMLCanvasElement>
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
function fontePorNome(nome: string | null, estilo: string | null): string {
  const n = (nome || '').toLowerCase()
  if (/script|brush|hand|cursiv|pacifico|dancing|vibes|lobster|signature|calligr/.test(n)) return /vibes|signature|calligr/.test(n) ? 'greatvibes' : 'pacifico'
  if (/fredoka|baloo|round|bubble|comic/.test(n)) return 'fredoka'
  if (/amatic/.test(n)) return 'amatic'
  return FONTE_POR_ESTILO[estilo || ''] || 'poppins'
}

/** Campos confirmados → caixas do editor (fonte, cor, giro, auto-ajuste e cobertura quando achatado). */
export function caixasDosCampos(campos: CampoDetectado[], achatado: boolean): Caixa[] {
  return campos.filter(c => c.incluir).map(c => {
    const cx = novaCaixa(Math.round(c.x), Math.round(c.y), Math.max(10, Math.round(c.w)), Math.max(10, Math.round(c.h)), c.modelo?.trim() || modeloDoTexto(c))
    const upper = c.textoOriginal === c.textoOriginal.toUpperCase() && /[A-Z]/.test(c.textoOriginal) && c.papel === 'nome'
    return {
      ...cx, tipo: 'texto' as const,
      fonte: fontePorNome(c.fonteArquivo, c.estilo), tamanho: Math.max(8, Math.round(c.tamanho)), cor: c.cor,
      alinhamento: c.alinhamento, negrito: c.negrito, maiusculas: upper, autoAjuste: true, rotacao: c.rotacao,
      contorno: c.contorno ? { cor: c.contorno, largura: Math.max(2, Math.round(c.tamanho * 0.05)) } : null,
      sombra: c.sombra ? { cor: 'rgba(0,0,0,0.35)', blur: Math.max(4, Math.round(c.tamanho * 0.06)), dx: Math.round(c.tamanho * 0.02), dy: Math.round(c.tamanho * 0.03) } : null,
      cobertura: achatado ? { modo: 'entorno' as const, cor: '#ffffff', dx: 0, dy: 0, folga: 10 } : null,
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

type Camada = { name?: string; hidden?: boolean; opacity?: number; blendMode?: string; left?: number; top?: number; right?: number; bottom?: number; canvas?: HTMLCanvasElement; children?: Camada[]; text?: { text: string; transform?: number[]; style?: { font?: { name?: string }; fontSize?: number; fillColor?: { r: number; g: number; b: number }; fauxBold?: boolean }; paragraphStyle?: { justification?: string } } }
const MISTURA: Record<string, GlobalCompositeOperation> = { multiply: 'multiply', screen: 'screen', overlay: 'overlay', darken: 'darken', lighten: 'lighten', 'color dodge': 'color-dodge', 'color burn': 'color-burn', 'soft light': 'soft-light', 'hard light': 'hard-light', difference: 'difference', exclusion: 'exclusion' }

async function lerPsd(f: File): Promise<ArteImportada> {
  const { readPsd } = await import('ag-psd')
  const psd = readPsd(await f.arrayBuffer(), { skipThumbnail: true }) as unknown as { width: number; height: number; canvas?: HTMLCanvasElement; children?: Camada[] }
  const W = psd.width, H = psd.height
  const nomes: string[] = [], textos: Camada[] = []
  let total = 0
  const fundo = canvas(W, H), completo = canvas(W, H)
  const contar = (lista: Camada[] | undefined) => { for (const l of lista || []) { if (l.hidden) continue; if (l.children) contar(l.children); else { total++; nomes.push(l.name || '(sem nome)') } } }
  contar(psd.children)
  // mantidos: camadas de texto que continuam no fundo (não viram campo)
  const desenhar = (lista: Camada[] | undefined, gF: CanvasRenderingContext2D, gC: CanvasRenderingContext2D | null, opac: number, mantidos?: Set<Camada>) => {
    for (const l of lista || []) {
      if (l.hidden) continue
      const op = opac * (l.opacity ?? 1)
      if (l.children) { desenhar(l.children, gF, gC, op, mantidos); continue }
      const pinta = (g: CanvasRenderingContext2D) => {
        if (!l.canvas) return
        g.save(); g.globalAlpha = op; g.globalCompositeOperation = MISTURA[(l.blendMode || '').toLowerCase()] || 'source-over'
        g.drawImage(l.canvas, l.left || 0, l.top || 0); g.restore()
      }
      if (gC) pinta(gC)
      const ehTexto = !!l.text?.text?.trim()
      if (ehTexto && gC) textos.push(l)
      if (!ehTexto || mantidos?.has(l)) pinta(gF)   // texto que vira campo NÃO entra no fundo → fundo limpo
    }
  }
  desenhar(psd.children, fundo.getContext('2d')!, completo.getContext('2d')!, 1)
  const original = psd.canvas ? paraCanvas(psd.canvas, W, H) : completo
  const pagina = { larguraPt: (W * 72) / 300, alturaPt: (H * 72) / 300 }
  if (!textos.length) {
    return { formato: 'psd', caminho: 'achatado', fundo: original, original, pagina, camadas: { total, texto: 0, nomes }, campos: [], avisos: ['O PSD não tem camada de TEXTO (o texto está rasterizado) — use a leitura de texto e a cobertura, ou suba o PSD com o texto editável.'] }
  }
  const campos: CampoDetectado[] = textos.map(l => {
    const t = l.text!
    const tr = t.transform || [1, 0, 0, 1, 0, 0]
    const rot = Math.round((Math.atan2(tr[1], tr[0]) * 180) / Math.PI)
    const esc = Math.hypot(tr[0], tr[1]) || 1
    const L = l.left || 0, T = l.top || 0, R = l.right ?? L + 10, B = l.bottom ?? T + 10
    const vertical = Math.abs(Math.abs(rot) - 90) < 20
    const w = vertical ? B - T : R - L, h = vertical ? R - L : B - T
    const cx = (L + R) / 2, cy = (T + B) / 2
    const cor = t.style?.fillColor ? hex(t.style.fillColor.r, t.style.fillColor.g, t.style.fillColor.b) : '#1f2937'
    const p = papelDoTexto(t.text, l.name || null)
    const j = t.paragraphStyle?.justification
    return {
      id: gid(), origem: 'camada', textoOriginal: t.text.trim(), ...p, x: cx - w / 2, y: cy - h / 2, w, h, rotacao: rot,
      tamanho: (t.style?.fontSize || h * 0.8) * esc, cor, estilo: null, fonteArquivo: t.style?.font?.name || null,
      alinhamento: j === 'left' || j === 'right' ? j : 'center', negrito: !!t.style?.fauxBold || /bold|black|heavy|semibold|extrabold/i.test(t.style?.font?.name || ''), camada: l.name || null, incluir: p.papel !== 'outro',
    }
  })
  const recompor = async (manter: Set<string>) => {
    const c = canvas(W, H)
    desenhar(psd.children, c.getContext('2d')!, null, 1, new Set(textos.filter((_, i) => manter.has(campos[i].id))))
    return c
  }
  return { formato: 'psd', caminho: 'camadas', fundo, original, pagina, camadas: { total, texto: textos.length, nomes }, campos, avisos: [], recompor }
}

async function lerSvg(f: File): Promise<ArteImportada> {
  const texto = await f.text()
  const doc = new DOMParser().parseFromString(texto, 'image/svg+xml')
  const svg = doc.documentElement
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  const W0 = vb.length === 4 ? vb[2] : parseFloat(svg.getAttribute('width') || '1000'), H0 = vb.length === 4 ? vb[3] : parseFloat(svg.getAttribute('height') || '1000')
  const k = Math.max(1, 2400 / Math.max(W0, H0)) * escalaMax(W0 * Math.max(1, 2400 / Math.max(W0, H0)), H0 * Math.max(1, 2400 / Math.max(W0, H0)))
  const W = Math.round(W0 * k), H = Math.round(H0 * k)
  const ox = vb.length === 4 ? vb[0] : 0, oy = vb.length === 4 ? vb[1] : 0
  const textos = [...doc.querySelectorAll('text')]
  // medidas reais: monta o SVG escondido na página (getBBox/getCTM)
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden'
  host.innerHTML = texto; document.body.appendChild(host)
  const vivos = [...host.querySelectorAll('text')] as unknown as SVGTextElement[]
  const raiz = host.querySelector('svg') as SVGSVGElement | null
  const campos: CampoDetectado[] = textos.map((t, i) => {
    const vivo = vivos[i]
    const conteudo = (t.textContent || '').replace(/\s+/g, ' ').trim()
    const cs = vivo ? getComputedStyle(vivo) : null
    let bb = { x: parseFloat(t.getAttribute('x') || '0'), y: parseFloat(t.getAttribute('y') || '0') - 20, width: conteudo.length * 12, height: 24 }
    let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    try { if (vivo?.getBBox) bb = vivo.getBBox(); const ctm = vivo?.getCTM?.(), rc = raiz?.getCTM?.(); if (ctm && rc) { const inv = rc.inverse().multiply(ctm); m = { a: inv.a, b: inv.b, c: inv.c, d: inv.d, e: inv.e, f: inv.f } } } catch { /* usa a estimativa */ }
    const cxU = bb.x + bb.width / 2, cyU = bb.y + bb.height / 2
    const cx = (m.a * cxU + m.c * cyU + m.e - ox) * k, cy = (m.b * cxU + m.d * cyU + m.f - oy) * k
    const esc = Math.hypot(m.a, m.b) || 1
    const rot = Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI)
    const w = bb.width * esc * k, h = bb.height * esc * k
    const fs = parseFloat(cs?.fontSize || t.getAttribute('font-size') || '16') * esc * k
    const cor = cs?.fill && cs.fill.startsWith('rgb') ? hex(...(cs.fill.match(/\d+/g)!.slice(0, 3).map(Number) as [number, number, number])) : (t.getAttribute('fill') || '#1f2937')
    const anc = t.getAttribute('text-anchor') || cs?.textAnchor
    const nomeCamada = t.getAttribute('id') || t.closest('g')?.getAttribute('id') || t.getAttribute('inkscape:label') || null
    const p = papelDoTexto(conteudo, nomeCamada)
    return {
      id: gid(), origem: 'camada', textoOriginal: conteudo, ...p, x: cx - w / 2, y: cy - h / 2, w, h, rotacao: rot, tamanho: fs,
      cor: /^#[0-9a-f]{6}$/i.test(cor) ? cor : '#1f2937', estilo: null, fonteArquivo: (cs?.fontFamily || t.getAttribute('font-family') || '').replace(/["']/g, '').split(',')[0] || null,
      alinhamento: anc === 'start' ? 'left' : anc === 'end' ? 'right' : 'center', negrito: /bold|[6-9]00/.test(cs?.fontWeight || t.getAttribute('font-weight') || ''), camada: nomeCamada, incluir: p.papel !== 'outro',
    }
  })
  host.remove()
  const render = async (s: string) => paraCanvas(await imagemDe(new Blob([s], { type: 'image/svg+xml' })), W, H)
  const original = await render(texto)
  const semTextos = (manter: Set<string>) => {
    const d = new DOMParser().parseFromString(texto, 'image/svg+xml')
    ;[...d.querySelectorAll('text')].forEach((t, i) => { if (!manter.has(campos[i]?.id)) t.remove() })
    return render(new XMLSerializer().serializeToString(d))
  }
  const fundo = await semTextos(new Set())
  const pagina = { larguraPt: (W * 72) / 300, alturaPt: (H * 72) / 300 }
  const nomes = [...doc.querySelectorAll('g[id], image, path[id]')].map(e => e.getAttribute('id') || e.tagName)
  return { formato: 'svg', caminho: textos.length ? 'camadas' : 'achatado', fundo: textos.length ? fundo : original, original, pagina, camadas: { total: nomes.length + textos.length, texto: textos.length, nomes }, campos, avisos: textos.length ? [] : ['O SVG não tem texto editável (<text>) — os textos viraram desenho. Use a leitura de texto.'], ...(textos.length ? { recompor: semTextos } : {}) }
}

async function lerPdf(f: File): Promise<ArteImportada> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = '/estudio/pdf.worker.min.mjs'
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise
  const pg = await doc.getPage(1)
  const base = pg.getViewport({ scale: 1 })
  const esc = Math.min(300 / 72, escalaMax(base.width, base.height, 100))
  const vp = pg.getViewport({ scale: esc })
  const W = Math.round(vp.width), H = Math.round(vp.height)
  const pagina = { larguraPt: base.width, alturaPt: base.height }
  const renderizar = async (semTexto: boolean, config?: unknown) => {
    const c = canvas(W, H), g = c.getContext('2d')!
    if (semTexto) { (g as unknown as { fillText: () => void }).fillText = () => {}; (g as unknown as { strokeText: () => void }).strokeText = () => {} }
    await pg.render({ canvasContext: g, viewport: vp, canvas: c, ...(config ? { optionalContentConfigPromise: Promise.resolve(config) } : {}) } as never).promise
    return c
  }
  const original = await renderizar(false)
  const tc = await pg.getTextContent()
  const itens = (tc.items as { str: string; transform: number[]; width: number; height: number; fontName: string }[]).filter(i => i.str?.trim())
  // camadas opcionais (OCG) — some com as que parecem ser do texto personalizado
  const ocg = await doc.getOptionalContentConfig().catch(() => null) as unknown as { getGroups?: () => Record<string, { name: string }> | null; setVisibility?: (id: string, v: boolean) => void } | null
  const grupos = ocg?.getGroups?.() || null
  const nomesOcg = grupos ? Object.entries(grupos).map(([id, g]) => ({ id, nome: g.name })) : []
  const ocultar = nomesOcg.filter(g => /nome|idade|texto|name|text|age|personaliz/i.test(g.nome))
  if (itens.length) {
    const campos: CampoDetectado[] = itens.map(it => {
      const [a, b, c2, d, e, fy] = it.transform
      const alt = Math.hypot(c2, d) || it.height || 10
      const dir = { x: a / (Math.hypot(a, b) || 1), y: b / (Math.hypot(a, b) || 1) }
      const cima = { x: -dir.y, y: dir.x }
      const p0 = { x: e, y: fy }, p1 = { x: e + dir.x * it.width, y: fy + dir.y * it.width }
      const meio = { x: (p0.x + p1.x) / 2 + cima.x * alt * 0.35, y: (p0.y + p1.y) / 2 + cima.y * alt * 0.35 }
      const [cx, cy] = vp.convertToViewportPoint(meio.x, meio.y)
      const rot = -Math.round((Math.atan2(b, a) * 180) / Math.PI)
      const p = papelDoTexto(it.str, null)
      return {
        id: gid(), origem: 'camada', textoOriginal: it.str.trim(), ...p, x: cx - (it.width * esc) / 2, y: cy - (alt * 1.2 * esc) / 2, w: it.width * esc, h: alt * 1.2 * esc,
        rotacao: rot, tamanho: alt * esc, cor: '#1f2937', estilo: null, fonteArquivo: (tc.styles as Record<string, { fontFamily?: string }>)[it.fontName]?.fontFamily || null,
        alinhamento: 'center', negrito: false, camada: null, incluir: p.papel !== 'outro',
      }
    })
    const fundo = await renderizar(true)
    return { formato: 'pdf', caminho: 'camadas', fundo, original, pagina, camadas: { total: itens.length + nomesOcg.length, texto: itens.length, nomes: nomesOcg.map(g => g.nome) }, campos, avisos: ['A cor e a fonte do PDF são estimadas — confira em cada campo.'] }
  }
  if (ocultar.length && ocg?.setVisibility) {
    for (const g of ocultar) ocg.setVisibility(g.id, false)
    const fundo = await renderizar(false, ocg)
    return { formato: 'pdf', caminho: 'camadas', fundo, original, pagina, camadas: { total: nomesOcg.length, texto: ocultar.length, nomes: nomesOcg.map(g => g.nome) }, campos: [], avisos: [`Escondi as camadas ${ocultar.map(g => `“${g.nome}”`).join(', ')} — use a leitura de texto para posicionar os campos.`] }
  }
  return { formato: 'pdf', caminho: 'achatado', fundo: original, original, pagina, camadas: { total: nomesOcg.length, texto: 0, nomes: nomesOcg.map(g => g.nome) }, campos: [], avisos: ['PDF achatado: o texto faz parte da imagem (não há texto nem camadas editáveis).'] }
}

async function lerImagem(f: File): Promise<ArteImportada> {
  const i = await imagemDe(f)
  const k = escalaMax(i.naturalWidth, i.naturalHeight)
  const c = paraCanvas(i, i.naturalWidth * k, i.naturalHeight * k)
  return { formato: 'imagem', caminho: 'achatado', fundo: c, original: c, pagina: { larguraPt: (c.width * 72) / 300, alturaPt: (c.height * 72) / 300 }, camadas: { total: 1, texto: 0, nomes: [] }, campos: [], avisos: [] }
}

/** Roteador: detecta o formato pelo conteúdo/extensão e segue o caminho certo. */
export async function importarArte(f: File): Promise<ArteImportada> {
  const n = f.name.toLowerCase()
  const cab = new Uint8Array(await f.slice(0, 5).arrayBuffer())
  if (n.endsWith('.psd') || (cab[0] === 0x38 && cab[1] === 0x42 && cab[2] === 0x50 && cab[3] === 0x53)) return lerPsd(f)   // "8BPS"
  if (n.endsWith('.svg') || f.type === 'image/svg+xml') return lerSvg(f)
  if (ehPdf(f.type, f.name)) return lerPdf(f)
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
