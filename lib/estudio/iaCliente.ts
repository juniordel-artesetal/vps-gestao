// SOA Edition — FERRAMENTAS DE IA no navegador: chama /api/estudio/ia (o servidor debita 1 imagem da cota
// e ESTORNA se a IA falhar) e cai nos planos B locais quando a IA não entrega (fail-open: nunca trava).
import { aplicarMascaras, carregarImagem, novoCanvas, type MascaraIA } from './mockup'

export type OpIA = 'remover-fundo' | 'apagar' | 'expandir' | 'upscale' | 'fundo-tema'

export const ROTULOS_IA: Record<OpIA, string> = {
  'remover-fundo': 'Remover fundo', apagar: 'Apagar objeto', expandir: 'Expandir imagem', upscale: 'Aumentar resolução', 'fundo-tema': 'Fundo pelo tema',
}
/** Aviso de custo mostrado ANTES de cada ação. */
export const CUSTO_IA = 'Esta ação usa 1 imagem da sua cota (se a IA falhar, a imagem volta).'

export type RespostaIA =
  | { ok: true; imagem?: HTMLImageElement; mascaras?: MascaraIA[]; fallbackLocal?: boolean; mensagem?: string }
  | { ok: false; mensagem: string; semCota?: boolean; faltam?: number }

/** Reduz para ≤ lado px e codifica (o corpo da requisição tem limite de ~4,5 MB na Vercel). */
function dataUrl(src: CanvasImageSource, w: number, h: number, lado = 2048, mime = 'image/jpeg'): { url: string; k: number } {
  const k = Math.min(1, lado / Math.max(w, h))
  const c = novoCanvas(w * k, h * k), g = c.getContext('2d')!
  if (mime === 'image/jpeg') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height) }
  g.drawImage(src, 0, 0, c.width, c.height)
  return { url: c.toDataURL(mime, 0.9), k }
}

export async function chamarIA(op: OpIA, p: { imagem?: HTMLCanvasElement; mascara?: HTMLCanvasElement; tema?: string; proporcao?: '1:1' | '4:5' } = {}): Promise<RespostaIA> {
  const corpo: Record<string, unknown> = { op }
  if (p.imagem) {
    // expandir: o magenta precisa chegar puro → PNG; o resto vai em JPEG leve
    const mime = op === 'expandir' || op === 'apagar' ? 'image/png' : 'image/jpeg'
    corpo.imagem = dataUrl(p.imagem, p.imagem.width, p.imagem.height, op === 'expandir' || op === 'apagar' ? 1600 : 2048, mime).url
    if (p.mascara) corpo.mascara = dataUrl(p.mascara, p.mascara.width, p.mascara.height, 1600, 'image/png').url
  }
  if (p.tema) corpo.tema = p.tema.slice(0, 60)
  if (p.proporcao) corpo.proporcao = p.proporcao
  let r: Response
  try { r = await fetch('/api/estudio/ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }) }
  catch { return { ok: false, mensagem: 'Sem conexão com a IA agora — use as ferramentas manuais.' } }
  const j = await r.json().catch(() => ({}))
  if (r.status === 402) return { ok: false, mensagem: j.error || 'Suas imagens de hoje acabaram.', semCota: true, faltam: Number(j.faltam) || 1 }
  if (!r.ok) return { ok: false, mensagem: j.error || 'A IA não está disponível agora — use as ferramentas manuais.' }
  if (!j.ok) return { ok: false, mensagem: j.mensagem || 'A IA não conseguiu desta vez (a imagem da cota voltou). Tente de novo ou ajuste à mão.' }
  if (j.fallbackLocal) return { ok: true, fallbackLocal: true, mensagem: j.mensagem }
  const out: RespostaIA = { ok: true, mascaras: j.mascaras }
  if (j.imagem) out.imagem = await carregarImagem(j.imagem)
  return out
}

/** Remover fundo: IA (polígono/PNG) e, se ela falhar, o recorte local. */
/** `recortar` = aparar as bordas vazias (mockup); false mantém o tamanho da foto (camada do editor). */
export async function removerFundoIA(foto: HTMLCanvasElement, recortar = true): Promise<{ canvas: HTMLCanvasElement; via: 'ia' | 'local'; aviso?: string }> {
  const r = await chamarIA('remover-fundo', { imagem: foto })
  if (r.ok && r.imagem) { const c = novoCanvas(foto.width, foto.height); c.getContext('2d')!.drawImage(r.imagem, 0, 0, c.width, c.height); return { canvas: c, via: 'ia' } }
  if (r.ok && r.mascaras?.length) return { canvas: aplicarMascaras(foto, r.mascaras, recortar), via: 'ia' }
  const { removerFundoLocal } = await import('./mockup')
  return { canvas: removerFundoLocal(foto, 1600, recortar), via: 'local', aviso: r.ok ? 'A IA não achou o produto — usei o recorte automático local.' : `${r.mensagem} Usei o recorte automático local.` }
}

/** Resultado da IA no tamanho de volta (o modelo pode devolver noutra proporção/resolução). */
export function noTamanho(img: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = novoCanvas(w, h), g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h)
  return c
}

/** Prepara o "expandir": foto no centro de uma tela maior; o vazio vai MAGENTA puro (a IA preenche só ali). */
export function telaExpandir(foto: HTMLCanvasElement, W: number, H: number): HTMLCanvasElement {
  const c = novoCanvas(W, H), g = c.getContext('2d')!
  g.fillStyle = '#FF00FF'; g.fillRect(0, 0, W, H)
  const k = Math.min(W / foto.width, H / foto.height, 1)
  g.drawImage(foto, (W - foto.width * k) / 2, (H - foto.height * k) / 2, foto.width * k, foto.height * k)
  return c
}

/** Plano B do upscale: amplia em passos de 2× com suavização alta + nitidez leve (unsharp). */
export function upscaleLocal(src: HTMLCanvasElement, fator: number): HTMLCanvasElement {
  let atual = src
  let restante = Math.max(1, fator)
  while (restante > 1.001) {
    const f = Math.min(2, restante)
    const c = novoCanvas(atual.width * f, atual.height * f), g = c.getContext('2d')!
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(atual, 0, 0, c.width, c.height)
    atual = c; restante /= f
  }
  // nitidez: original + (original − desfocado) × 0,5
  const W = atual.width, H = atual.height
  if (W * H > 40_000_000) return atual
  const g = atual.getContext('2d', { willReadFrequently: true })!
  const img = g.getImageData(0, 0, W, H), d = img.data, o = new Uint8ClampedArray(d)
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4
    for (let k = 0; k < 3; k++) {
      const m = (o[i + k - 4] + o[i + k + 4] + o[i + k - W * 4] + o[i + k + W * 4] + o[i + k] * 4) / 8
      d[i + k] = o[i + k] + (o[i + k] - m) * 0.5
    }
  }
  g.putImageData(img, 0, 0)
  return atual
}

/**
 * RECOLORIR ÁREA (local, sem custo de IA): troca o matiz/saturação dos pixels da máscara pela cor alvo,
 * mantendo a luz (sombras e brilhos continuam). `mascara` null = imagem inteira.
 */
export function recolorir(src: HTMLCanvasElement, mascara: HTMLCanvasElement | null, cor: string, intensidade = 100): HTMLCanvasElement {
  const W = src.width, H = src.height
  const out = novoCanvas(W, H), g = out.getContext('2d', { willReadFrequently: true })!
  g.drawImage(src, 0, 0)
  const img = g.getImageData(0, 0, W, H), d = img.data
  let md: Uint8ClampedArray | null = null
  if (mascara) { const m = novoCanvas(W, H), gm = m.getContext('2d', { willReadFrequently: true })!; gm.drawImage(mascara, 0, 0, W, H); md = gm.getImageData(0, 0, W, H).data }
  const alvo = hexRgb(cor), [ha, sa] = rgbHsl(alvo[0], alvo[1], alvo[2])
  const k = Math.max(0, Math.min(1, intensidade / 100))
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    const peso = (md ? md[i + 3] / 255 : 1) * k
    if (peso <= 0) continue
    const [, , l] = rgbHsl(d[i], d[i + 1], d[i + 2])
    const [r, gg, b] = hslRgb(ha, sa, l)
    d[i] = d[i] + (r - d[i]) * peso; d[i + 1] = d[i + 1] + (gg - d[i + 1]) * peso; d[i + 2] = d[i + 2] + (b - d[i + 2]) * peso
  }
  g.putImageData(img, 0, 0)
  return out
}

const hexRgb = (h: string): [number, number, number] => { const s = h.replace('#', ''); const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
function rgbHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}
function hslRgb(h: number, s: number, l: number): [number, number, number] {
  if (!s) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
  const f = (t: number) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p }
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]
}
