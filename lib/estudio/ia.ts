// SOA Design — FERRAMENTAS DE IMAGEM COM IA (SOMENTE SERVIDOR — nunca importar em componente cliente).
// As chaves vêm de env e nunca saem do servidor (nome histórico: ANTHROPIC_API_KEY_GESTAO guarda a chave
// Google). Nada aqui loga URL, chave ou corpo de requisição. Toda falha vira Error com mensagem amigável
// em português — a rota devolve a cota e responde "falhou" sem quebrar a tela (as ferramentas manuais seguem).
//
// Operações:
//   remover-fundo  → remove.bg (se REMOVEBG_API_KEY) devolve PNG com alfa pronto; senão, segmentação por
//                    POLÍGONO (Gemini 3.x) e o NAVEGADOR compõe o recorte (decisão: o projeto não tem
//                    sharp/@napi-rs/canvas como dependência, então não há como compor PNG no runtime da
//                    Vercel sem adicionar lib nativa — e o cliente já tem <canvas>).
//   apagar         → modelo de imagem (Gemini *-flash-image) recebe a foto + a máscara (branco = remover).
//   expandir       → o cliente já pôs a foto numa tela maior com a área vazia em MAGENTA chapado (#FF00FF);
//                    o modelo preenche só o magenta continuando a cena.
//   upscale        → Replicate Real-ESRGAN (se REPLICATE_API_TOKEN); senão Gemini 3.1 Flash Image em 2K. Se
//                    a saída não for MAIOR que a entrada → { fallbackLocal } e o cliente usa o upscaler local.
//   fundo-tema     → texto→imagem: cenário/fundo para foto de produto evocando o tema (cores/clima), sem
//                    personagens, marcas, logos ou texto.

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models'
/** Modelos de imagem, em ordem de preferência (o 2º só entra se o 1º falhar e ainda houver prazo). */
const MODELOS_IMAGEM = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image']
/** Prazo total de uma operação (a rota tem maxDuration 60 s — sobra folga para banco/resposta). */
const PRAZO_MS = 52_000

export type OpIA = 'remover-fundo' | 'apagar' | 'expandir' | 'upscale' | 'fundo-tema' | 'area-produto' | 'regioes-faca' | 'casar-arquivos' | 'produto-base'
export const OPS_IA: OpIA[] = ['remover-fundo', 'apagar', 'expandir', 'upscale', 'fundo-tema', 'area-produto', 'regioes-faca', 'casar-arquivos', 'produto-base']

export interface ImagemB64 { base64: string; mime: string }
export interface MascaraIA {
  /** Caixa normalizada 0…1 na imagem ORIGINAL (x, y = canto sup. esq.). */
  box: { x: number; y: number; w: number; h: number }
  /** Contorno externo: polígono fechado de pontos [x, y] normalizados 0…1 na imagem ORIGINAL. */
  contorno: [number, number][]
  /** Vãos vazados dentro do contorno (ex.: dentro da alça) — preencher tudo junto com a regra 'evenodd'. */
  furos: [number, number][][]
  label: string
}
/** Faca: região proposta pela IA (a pessoa confirma → vira template determinístico). Pontos [x, y] 0…1. */
export interface RegiaoFacaIA { faceType: string; pontos: [number, number][]; confianca: number }
/** Mockup por foto: onde a arte vai (a assinante confirma/ajusta) + o contorno do produto (troca de fundo). */
export interface AreaProdutoIA {
  label: string
  forma: 'plano' | 'cilindro' | 'tecido'
  /** plano/tecido: TL, TR, BR, BL · cilindro: TL, TC, TR, BL, BC, BR — [x, y] normalizados 0…1 */
  pontos: [number, number][]
  contorno: [number, number][]
  /** vãos vazados (dentro da alça) — recortar junto (even-odd) */
  furos: [number, number][][]
}
export type ResultadoIA =
  | { tipo: 'area'; area: AreaProdutoIA; provedor: string }
  | { tipo: 'imagem'; imagem: ImagemB64; provedor: string }
  | { tipo: 'mascaras'; mascaras: MascaraIA[]; provedor: string }
  | { tipo: 'fallbackLocal'; motivo: string }
  | { tipo: 'regioes'; regioes: RegiaoFacaIA[]; tipoCaixa: string; provedor: string }
  | { tipo: 'casamentos'; casamentos: { indice: number; alvo: string; confianca: number }[]; provedor: string }

function chaveGoogle(): string | null {
  return process.env.ANTHROPIC_API_KEY_GESTAO || process.env.GEMINI_API_KEY || null
}
/** Quais provedores existem neste ambiente — só booleanos, nunca valores. */
export function provedoresIA() {
  return { removeBg: !!process.env.REMOVEBG_API_KEY, replicate: !!process.env.REPLICATE_API_TOKEN, gemini: !!chaveGoogle() }
}

/** Fluxo C (mockup 3D por API externa) — atrás de flag; sem provedor implementado ainda. */
export function mockup3dDisponivel(): boolean {
  return process.env.ESTUDIO_MOCKUP3D_IA === 'on'
}
// TODO(Fluxo C — mockup 3D ciente de perspectiva): escolher provedor e implementar `gerarMockup3d()`.
// Candidatos: Replicate (modelos de "product placement"/relight, ex. IC-Light, Flux Kontext),
// Photoroom API (/v2/edit com "AI backgrounds" e sombras), Dynamic Mockups API, Mediamodifier API,
// Placeit/Smartmockups (sem API pública estável). Critérios: preservar a arte sem distorção de texto,
// custo por imagem < R$0,30, resposta < 50 s.

// ─────────────────────────── utilidades ───────────────────────────

function prazo(inicio: number): number { return PRAZO_MS - (Date.now() - inicio) }

/** Lê largura/altura de PNG, JPEG ou WebP direto dos bytes (sem lib de imagem). */
export function dimensoes(buf: Buffer): { w: number; h: number } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue }
      const m = buf[i + 1]
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue }
      const len = buf.readUInt16BE(i + 2)
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
      i += 2 + len
    }
    return null
  }
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const t = buf.toString('ascii', 12, 16)
    if (t === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) }
    if (t === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff }
    if (t === 'VP8L') { const b = buf.readUInt32LE(21); return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) } }
  }
  return null
}

const PROPORCOES: [string, number][] = [['1:1', 1], ['4:5', 0.8], ['5:4', 1.25], ['3:4', 0.75], ['4:3', 4 / 3], ['2:3', 2 / 3], ['3:2', 1.5], ['9:16', 9 / 16], ['16:9', 16 / 9], ['21:9', 21 / 9]]
/** Proporção suportada pelo modelo mais próxima da imagem (a saída não sai cortada/esticada). */
function proporcaoMaisProxima(img: ImagemB64): string {
  const d = dimensoes(Buffer.from(img.base64, 'base64'))
  if (!d || !d.w || !d.h) return '1:1'
  const r = Math.log(d.w / d.h)
  return PROPORCOES.reduce((a, b) => (Math.abs(Math.log(b[1]) - r) < Math.abs(Math.log(a[1]) - r) ? b : a))[0]
}

type Parte = { text: string } | { inline_data: { mime_type: string; data: string } }
const parteImg = (i: ImagemB64): Parte => ({ inline_data: { mime_type: i.mime, data: i.base64 } })

/**
 * Chama os modelos de imagem em ordem até um devolver imagem. A chave vai no cabeçalho (não na URL).
 * Erros de um modelo (indisponível, recusa) passam para o próximo enquanto houver prazo.
 */
async function gerarImagemGemini(partes: Parte[], cfg: { aspectRatio?: string; imageSize?: string }, inicio: number): Promise<ImagemB64 & { modelo: string }> {
  const k = chaveGoogle()
  if (!k) throw new Error('IA de imagem indisponível neste ambiente.')
  let ultimoErro = 'A IA não devolveu imagem.'
  for (const modelo of MODELOS_IMAGEM) {
    const resta = prazo(inicio)
    if (resta < 8_000) break
    const imageConfig: Record<string, string> = {}
    if (cfg.aspectRatio) imageConfig.aspectRatio = cfg.aspectRatio
    // imageSize só existe na família 3.x.
    if (cfg.imageSize && modelo.startsWith('gemini-3')) imageConfig.imageSize = cfg.imageSize
    try {
      const r = await fetch(`${GEMINI}/${modelo}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: partes }],
          generationConfig: { responseModalities: ['IMAGE'], ...(Object.keys(imageConfig).length ? { imageConfig } : {}) },
        }),
        signal: AbortSignal.timeout(Math.min(resta, 50_000)),
      })
      if (!r.ok) { ultimoErro = r.status === 429 ? 'A IA está sobrecarregada agora. Tente de novo em instantes.' : `A IA de imagem falhou (${r.status}).`; continue }
      const j = await r.json()
      const cand = j?.candidates?.[0]
      const parte = (cand?.content?.parts || []).find((p: { inlineData?: { data?: string } }) => p.inlineData?.data)
      if (parte) return { base64: parte.inlineData.data, mime: parte.inlineData.mimeType || 'image/png', modelo }
      const motivo = j?.promptFeedback?.blockReason || cand?.finishReason
      ultimoErro = motivo && /SAFETY|PROHIBITED|BLOCK|IMAGE_OTHER|RECITATION/i.test(String(motivo))
        ? 'A IA recusou esta imagem/pedido. Tente outra imagem ou outro tema.'
        : 'A IA não devolveu imagem. Tente de novo.'
    } catch (e) {
      ultimoErro = (e as Error)?.name === 'TimeoutError' ? 'A IA demorou demais para responder. Tente de novo.' : 'Não consegui falar com a IA agora. Tente de novo.'
    }
  }
  throw new Error(ultimoErro)
}

// ─────────────────────────── remover fundo ───────────────────────────
// Testado em 25/09/2026: o gemini-2.5-flash servido hoje NÃO devolve mais a máscara PNG em data-URL
// (volta "<start_of_mask><seg_…>" ou lixo) — inutilizável. O que funciona e é rápido (~5 s) é pedir o
// CONTORNO em polígono (+ furos, ex. o vão da alça) a um modelo 3.x. O cliente preenche o polígono
// (regra even-odd) num <canvas> e usa como alfa. Borda é poligonal: o cliente deve suavizar 1–2 px.

const MODELOS_SEGMENTACAO: [string, Record<string, unknown>][] = [
  ['gemini-3.8-flash', { thinkingLevel: 'low' }],
  ['gemini-3.5-flash', { thinkingLevel: 'minimal' }],
]
const SCHEMA_SEGMENTACAO = {
  type: 'OBJECT', required: ['objetos'],
  properties: { objetos: { type: 'ARRAY', items: { type: 'OBJECT', required: ['label', 'box_2d', 'contorno'], properties: {
    label: { type: 'STRING' },
    box_2d: { type: 'ARRAY', items: { type: 'INTEGER' } },
    contorno: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'INTEGER' } } },
    furos: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'INTEGER' } } } },
  } } } },
}
const PROMPT_SEGMENTACAO = `Segment the MAIN PRODUCT of this product photo (the item being sold, including handles, lids and attached parts; if the product is a set of items arranged together, return each item). Exclude the background, the table/surface, shadows and small unrelated props next to it.
For each product item return:
- label: short description;
- box_2d: [ymin, xmin, ymax, xmax] normalized 0-1000;
- contorno: the precise OUTER outline as a closed polygon of 60 to 150 points [y, x] normalized 0-1000, following the real silhouette tightly (curves densely sampled);
- furos: polygons [y, x] of see-through HOLES inside the outline where the background shows through (e.g. the inside of a mug handle), or [] if none.`

export async function removerFundo(img: ImagemB64): Promise<ResultadoIA> {
  const inicio = Date.now()
  const rb = process.env.REMOVEBG_API_KEY
  if (rb) {
    try {
      const form = new FormData()
      form.append('image_file_b64', img.base64)
      form.append('size', 'auto')
      form.append('format', 'png')
      const r = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST', headers: { 'X-Api-Key': rb }, body: form, signal: AbortSignal.timeout(30_000),
      })
      if (r.ok) return { tipo: 'imagem', imagem: { base64: Buffer.from(await r.arrayBuffer()).toString('base64'), mime: 'image/png' }, provedor: 'remove.bg' }
      console.error('[ESTUDIO-IA] remove.bg status', r.status)
    } catch (e) {
      console.error('[ESTUDIO-IA] remove.bg', (e as Error)?.name)
    }
    // Falhou (sem crédito, fora do ar) → cai para a segmentação do Gemini.
  }
  const k = chaveGoogle()
  if (!k) throw new Error('Remoção de fundo indisponível neste ambiente.')
  const lim = (v: number) => Math.max(0, Math.min(1, v))
  // [y, x] 0…1000 → [x, y] 0…1 (formato do canvas).
  const pol = (p: unknown): [number, number][] =>
    Array.isArray(p) ? p.filter(q => Array.isArray(q) && q.length === 2 && q.every(n => Number.isFinite(Number(n))))
      .map(q => [lim(Number(q[1]) / 1000), lim(Number(q[0]) / 1000)] as [number, number]) : []
  for (const [modelo, thinkingConfig] of MODELOS_SEGMENTACAO) {
    const resta = prazo(inicio)
    if (resta < 6_000) break
    try {
      const r = await fetch(`${GEMINI}/${modelo}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [parteImg(img), { text: PROMPT_SEGMENTACAO }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 12_000, responseMimeType: 'application/json', responseSchema: SCHEMA_SEGMENTACAO, thinkingConfig },
        }),
        signal: AbortSignal.timeout(Math.min(resta, 30_000)),
      })
      if (!r.ok) { console.error('[ESTUDIO-IA] segmentação', modelo, r.status); continue }
      const j = await r.json()
      const txt = (j?.candidates?.[0]?.content?.parts || []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || '').join('')
      let v: { objetos?: { label?: string; box_2d?: number[]; contorno?: unknown; furos?: unknown[] }[] }
      try { v = JSON.parse(txt) } catch { console.error('[ESTUDIO-IA] segmentação', modelo, 'JSON inválido'); continue }
      const mascaras: MascaraIA[] = []
      for (const o of v.objetos || []) {
        const contorno = pol(o.contorno)
        if (contorno.length < 3) continue
        const xs = contorno.map(p => p[0]), ys = contorno.map(p => p[1])
        const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
        if (box.w < 0.005 || box.h < 0.005) continue
        const furos = (Array.isArray(o.furos) ? o.furos : []).map(pol).filter(f => f.length >= 3)
        mascaras.push({ box, contorno, furos, label: String(o.label || '').slice(0, 80) })
      }
      if (mascaras.length) return { tipo: 'mascaras', mascaras, provedor: modelo }
    } catch (e) {
      console.error('[ESTUDIO-IA] segmentação', modelo, (e as Error)?.name === 'TimeoutError' ? 'timeout' : 'erro de rede')
    }
  }
  throw new Error('Não consegui recortar o produto desta foto agora. Tente de novo ou use o recorte manual.')
}

// ─────────────────────────── mockup por foto: área da arte ───────────────────────────
const SCHEMA_AREA = {
  type: 'OBJECT', required: ['label', 'forma', 'pontos', 'contorno'],
  properties: {
    label: { type: 'STRING' },
    forma: { type: 'STRING', enum: ['plano', 'cilindro', 'tecido'] },
    pontos: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'INTEGER' } } },
    contorno: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'INTEGER' } } },
    furos: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'INTEGER' } } } },
  },
}
const PROMPT_AREA = `This is a photo of a BLANK product that will be used as a mockup: a new print/artwork will be applied on it.
Find the main product and the surface where the print goes (the largest printable face facing the camera). Return:
- label: short product name;
- forma: "plano" if that surface is flat (box face, bag, card, frame, notebook, sign, tag), "cilindro" if it curves around a vertical axis (mug, cup, tumbler, glass, can, bottle, candle, jar), "tecido" if it is fabric (t-shirt, tote bag, pillow, apron);
- pontos, as [y, x] normalized 0-1000:
  * plano or tecido: exactly 4 points - top-left, top-right, bottom-right, bottom-left corners of the printable face, slightly inside its edges (exclude lids, flaps, rims, handles, seams, straps);
  * cilindro: exactly 6 points - top-left, top-center, top-right, bottom-left, bottom-center, bottom-right of the printable BAND as seen in the photo: left/right points slightly inside the visible body edges; top points just below the rim and bottom points just above the base, following the elliptical curve (top-center and bottom-center are where that curve crosses the vertical middle of the body);
- contorno: the product OUTER outline as a closed polygon of 60 to 150 points [y, x] normalized 0-1000, following the real silhouette tightly with curves densely sampled (include handles and lids, exclude the shadow and the table);
- furos: polygons [y, x] of see-through HOLES inside the outline where the background shows through (e.g. the inside of a mug handle), or [] if none.`

export async function detectarAreaProduto(img: ImagemB64): Promise<ResultadoIA> {
  const inicio = Date.now()
  const k = chaveGoogle()
  if (!k) throw new Error('IA de visão indisponível neste ambiente — marque a área à mão.')
  const lim = (v: number) => Math.max(0, Math.min(1, v))
  const pol = (p: unknown): [number, number][] =>
    Array.isArray(p) ? p.filter(q => Array.isArray(q) && q.length === 2 && q.every(n => Number.isFinite(Number(n))))
      .map(q => [lim(Number(q[1]) / 1000), lim(Number(q[0]) / 1000)] as [number, number]) : []
  for (const [modelo, thinkingConfig] of MODELOS_SEGMENTACAO) {
    const resta = prazo(inicio)
    if (resta < 6_000) break
    try {
      const r = await fetch(`${GEMINI}/${modelo}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [parteImg(img), { text: PROMPT_AREA }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 8_000, responseMimeType: 'application/json', responseSchema: SCHEMA_AREA, thinkingConfig },
        }),
        signal: AbortSignal.timeout(Math.min(resta, 30_000)),
      })
      if (!r.ok) { console.error('[ESTUDIO-IA] área', modelo, r.status); continue }
      const j = await r.json()
      const txt = (j?.candidates?.[0]?.content?.parts || []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || '').join('')
      let v: { label?: string; forma?: string; pontos?: unknown; contorno?: unknown; furos?: unknown[] }
      try { v = JSON.parse(txt) } catch { console.error('[ESTUDIO-IA] área', modelo, 'JSON inválido'); continue }
      const forma = v.forma === 'cilindro' ? 'cilindro' : v.forma === 'tecido' ? 'tecido' : 'plano'
      const pontos = pol(v.pontos)
      if (pontos.length !== (forma === 'cilindro' ? 6 : 4)) { console.error('[ESTUDIO-IA] área', modelo, 'pontos', pontos.length); continue }
      return { tipo: 'area', area: { label: String(v.label || '').slice(0, 80), forma, pontos, contorno: pol(v.contorno), furos: (Array.isArray(v.furos) ? v.furos : []).map(pol).filter(f => f.length >= 3) }, provedor: modelo }
    } catch (e) {
      console.error('[ESTUDIO-IA] área', modelo, (e as Error)?.name === 'TimeoutError' ? 'timeout' : 'erro de rede')
    }
  }
  throw new Error('A IA não achou a superfície desta foto agora — marque a área à mão (4 pontos).')
}

// ─────────────────────────── apagar (inpainting) ───────────────────────────

export async function apagarObjeto(img: ImagemB64, mascara: ImagemB64): Promise<ResultadoIA> {
  const inicio = Date.now()
  const partes: Parte[] = [
    parteImg(img), parteImg(mascara),
    { text: `The first image is a product photo. The second image is a black-and-white MASK of the same size: WHITE marks the area to erase.
Edit the FIRST image: completely remove whatever object is under the white area of the mask and reconstruct the background there naturally (continue the surface, texture, lighting and shadows of the surroundings), as if the object had never been there.
Keep everything outside the white area IDENTICAL: same framing, same size, same colors, same products — do not add, move or restyle anything. Output only the edited photo.` },
  ]
  const r = await gerarImagemGemini(partes, { aspectRatio: proporcaoMaisProxima(img) }, inicio)
  return { tipo: 'imagem', imagem: { base64: r.base64, mime: r.mime }, provedor: r.modelo }
}

// ─────────────────────────── expandir (outpainting) ───────────────────────────

export async function expandirImagem(img: ImagemB64): Promise<ResultadoIA> {
  const inicio = Date.now()
  const partes: Parte[] = [
    parteImg(img),
    { text: `This photo was placed on a larger canvas; the empty area around it is painted flat MAGENTA (#FF00FF).
Fill ONLY the magenta area, seamlessly continuing the existing scene outward (same surface, background, perspective, lighting, colors and grain), so the result looks like one wider original photo.
Do not change anything in the non-magenta part, do not add new products, people, text or logos, and leave no magenta pixels. Output the full image at the same framing.` },
  ]
  const r = await gerarImagemGemini(partes, { aspectRatio: proporcaoMaisProxima(img) }, inicio)
  return { tipo: 'imagem', imagem: { base64: r.base64, mime: r.mime }, provedor: r.modelo }
}

// ─────────────────────────── upscale ───────────────────────────

// Real-ESRGAN no Replicate (versão sobrescrevível por env, caso o modelo publique nova versão).
const REPLICATE_VERSAO_PADRAO = 'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa'

async function upscaleReplicate(img: ImagemB64, token: string, inicio: number): Promise<ImagemB64> {
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const r = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST', headers: { ...h, Prefer: 'wait=30' },
    body: JSON.stringify({
      version: process.env.REPLICATE_UPSCALE_VERSION || REPLICATE_VERSAO_PADRAO,
      input: { image: `data:${img.mime};base64,${img.base64}`, scale: 2, face_enhance: false },
    }),
    signal: AbortSignal.timeout(Math.max(5_000, prazo(inicio))),
  })
  if (!r.ok) throw new Error(`replicate ${r.status}`)
  let p = await r.json() as { status?: string; output?: string | string[]; urls?: { get?: string } }
  while (p.status !== 'succeeded') {
    if (p.status === 'failed' || p.status === 'canceled') throw new Error('replicate falhou')
    if (prazo(inicio) < 6_000 || !p.urls?.get) throw new Error('replicate timeout')
    await new Promise(res => setTimeout(res, 1_500))
    const g = await fetch(p.urls.get, { headers: h, signal: AbortSignal.timeout(10_000) })
    if (!g.ok) throw new Error(`replicate ${g.status}`)
    p = await g.json()
  }
  const url = Array.isArray(p.output) ? p.output[0] : p.output
  if (!url) throw new Error('replicate sem saída')
  const o = await fetch(url, { signal: AbortSignal.timeout(Math.max(5_000, prazo(inicio))) })
  if (!o.ok) throw new Error(`replicate saída ${o.status}`)
  return { base64: Buffer.from(await o.arrayBuffer()).toString('base64'), mime: o.headers.get('content-type') || 'image/png' }
}

export async function ampliarImagem(img: ImagemB64): Promise<ResultadoIA> {
  const inicio = Date.now()
  const antes = dimensoes(Buffer.from(img.base64, 'base64'))
  const maior = (saida: ImagemB64) => {
    const d = dimensoes(Buffer.from(saida.base64, 'base64'))
    return !!(d && antes && d.w > antes.w * 1.1 && d.h > antes.h * 1.1)
  }
  const token = process.env.REPLICATE_API_TOKEN
  if (token) {
    try {
      const out = await upscaleReplicate(img, token, inicio)
      if (maior(out)) return { tipo: 'imagem', imagem: out, provedor: 'replicate-real-esrgan' }
    } catch (e) {
      console.error('[ESTUDIO-IA] replicate', (e as Error)?.message)
    }
  }
  // Imagem já grande: o modelo de imagem entrega no máximo ~2K no lado maior — não há ganho real.
  if (antes && Math.max(antes.w, antes.h) >= 1800) return { tipo: 'fallbackLocal', motivo: 'Imagem já grande para a IA — usando o ampliador local.' }
  const partes: Parte[] = [
    parteImg(img),
    { text: `Upscale this image to a higher resolution: output the SAME image, sharper and more detailed (clean edges, crisp texture, no blur, no JPEG artifacts).
Do NOT change the content in any way: same composition, framing, objects, colors, text and lettering exactly as they are. Do not add or remove anything.` },
  ]
  const r = await gerarImagemGemini(partes, { aspectRatio: proporcaoMaisProxima(img), imageSize: '2K' }, inicio)
  if (!maior(r)) return { tipo: 'fallbackLocal', motivo: 'A IA não conseguiu ampliar esta imagem — usando o ampliador local.' }
  return { tipo: 'imagem', imagem: { base64: r.base64, mime: r.mime }, provedor: r.modelo }
}

// ─────────────────────────── fundo por tema ───────────────────────────

export async function gerarFundoTema(tema: string, proporcao: '1:1' | '4:5' = '1:1'): Promise<ResultadoIA> {
  const inicio = Date.now()
  const t = tema.replace(/[\r\n"`]+/g, ' ').trim().slice(0, 60)
  if (!t) throw new Error('Diga o tema da festa.')
  const partes: Parte[] = [{ text: `Create a professional product-photography BACKGROUND / backdrop scene for a party-supplies shop, inspired by the party theme "${t}".
Evoke the theme ONLY through its typical color palette, mood, generic shapes and generic scenery (e.g. balloons, confetti, fabrics, paper decorations, generic nature or sky elements).
STRICT RULES: do NOT depict any character, mascot, person, animal character, brand, logo, emblem, trademarked design or copyrighted element associated with the theme, even partially or stylized; no text, letters or numbers anywhere; no products or objects in the foreground.
Composition: an empty tabletop or floor surface in the lower part with a softly blurred decorated backdrop behind (shallow depth of field), soft even studio lighting, clear empty space in the center where a product will be placed later. Photorealistic, high quality.` }]
  const r = await gerarImagemGemini(partes, { aspectRatio: proporcao }, inicio)
  return { tipo: 'imagem', imagem: { base64: r.base64, mime: r.mime }, provedor: r.modelo }
}

// ─────────────────────────── ASSISTENTE (Fase 6): a IA só SUGERE; a pessoa confirma e vira template determinístico ───────────────────────────

/** Chamada JSON estruturada a um modelo 3.x (visão/texto), com prazo e troca de modelo. */
async function jsonGemini<T>(partes: Parte[], schema: Record<string, unknown>, inicio: number, rotulo: string): Promise<{ v: T; modelo: string }> {
  const k = chaveGoogle()
  if (!k) throw new Error('IA indisponível neste ambiente — faça à mão.')
  for (const [modelo, thinkingConfig] of MODELOS_SEGMENTACAO) {
    const resta = prazo(inicio)
    if (resta < 6_000) break
    try {
      const r = await fetch(`${GEMINI}/${modelo}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k },
        body: JSON.stringify({ contents: [{ role: 'user', parts: partes }], generationConfig: { temperature: 0, maxOutputTokens: 6_000, responseMimeType: 'application/json', responseSchema: schema, thinkingConfig } }),
        signal: AbortSignal.timeout(Math.min(resta, 30_000)),
      })
      if (!r.ok) { console.error('[ESTUDIO-IA]', rotulo, modelo, r.status); continue }
      const j = await r.json()
      const txt = (j?.candidates?.[0]?.content?.parts || []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || '').join('')
      try { return { v: JSON.parse(txt) as T, modelo } } catch { console.error('[ESTUDIO-IA]', rotulo, modelo, 'JSON inválido'); continue }
    } catch (e) { console.error('[ESTUDIO-IA]', rotulo, modelo, (e as Error)?.name === 'TimeoutError' ? 'timeout' : 'erro de rede') }
  }
  throw new Error('A IA não respondeu agora — faça à mão (nada foi cobrado).')
}

const TIPOS_FACE_IA = ['frente', 'verso', 'lateral_esquerda', 'lateral_direita', 'tampa', 'fundo', 'alca', 'aba', 'outro']
const SCHEMA_REGIOES = {
  type: 'OBJECT', required: ['tipoCaixa', 'regioes'],
  properties: {
    tipoCaixa: { type: 'STRING' },
    regioes: { type: 'ARRAY', items: { type: 'OBJECT', required: ['faceType', 'pontos', 'confianca'], properties: {
      faceType: { type: 'STRING', enum: TIPOS_FACE_IA }, pontos: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'INTEGER' } } }, confianca: { type: 'NUMBER' },
    } } },
  },
}
const PROMPT_REGIOES = `This image is a DIE-LINE (flat unfolded template / "faca") of a paper box or bag used by a craft shop. Solid lines are cuts, dashed lines are folds.
Identify each PANEL of the die-line and what it becomes when the box is assembled. Return:
- tipoCaixa: short box type in Portuguese (e.g. "caixa milk", "cubo", "sacola", "maleta", "pirâmide", "cone").
- regioes: one entry per panel with faceType one of: frente (front), verso (back), lateral_esquerda (left side), lateral_direita (right side), tampa (top/lid), fundo (bottom), alca (handle), aba (glue flap or small tuck flap that does not show), outro;
  pontos: the panel outline as a closed polygon of 4 to 12 points [y, x] normalized 0-1000 (follow the fold/cut lines of that panel);
  confianca: 0 to 1.
The front is usually the widest wall panel in the middle of the wall row; the sides are the narrower walls next to it; the back is the other wide wall. Glue flaps are thin trapezoids at an end.`

export async function sugerirRegioesFaca(img: ImagemB64): Promise<ResultadoIA> {
  const inicio = Date.now()
  const lim = (v: number) => Math.max(0, Math.min(1, v))
  const { v, modelo } = await jsonGemini<{ tipoCaixa?: string; regioes?: { faceType?: string; pontos?: unknown; confianca?: number }[] }>([parteImg(img), { text: PROMPT_REGIOES }], SCHEMA_REGIOES, inicio, 'faca')
  const regioes = (v.regioes || []).map(r => ({
    faceType: TIPOS_FACE_IA.includes(String(r.faceType)) ? String(r.faceType) : 'outro',
    pontos: (Array.isArray(r.pontos) ? r.pontos : []).filter(q => Array.isArray(q) && q.length === 2).map(q => [lim(Number((q as number[])[1]) / 1000), lim(Number((q as number[])[0]) / 1000)] as [number, number]),
    confianca: Math.max(0, Math.min(1, Number(r.confianca) || 0.5)),
  })).filter(r => r.pontos.length >= 3)
  if (!regioes.length) throw new Error('A IA não reconheceu os painéis desta faca — use “Detectar painéis” ou desenhe.')
  return { tipo: 'regioes', regioes, tipoCaixa: String(v.tipoCaixa || '').slice(0, 60), provedor: modelo }
}

const SCHEMA_CASAR = {
  type: 'OBJECT', required: ['casamentos'],
  properties: { casamentos: { type: 'ARRAY', items: { type: 'OBJECT', required: ['indice', 'alvo', 'confianca'], properties: { indice: { type: 'INTEGER' }, alvo: { type: 'STRING' }, confianca: { type: 'NUMBER' } } } } },
}
/** Fallback do file matcher: nomes de arquivo que a regra não resolveu → o alvo mais provável (id) + confiança. */
export async function sugerirCasamentos(nomes: string[], alvos: string[]): Promise<ResultadoIA> {
  const inicio = Date.now()
  const lista = nomes.slice(0, 200).map((n, i) => `${i}: ${n.replace(/[\r\n]+/g, ' ').slice(0, 160)}`).join('\n')
  const opcoes = alvos.slice(0, 40).map(a => a.replace(/[\r\n]+/g, ' ').slice(0, 160)).join('\n')
  const prompt = `A craft shop uploaded artwork files for product mockups. Each file must be matched to ONE of the target products/slots below (format "id: name (aliases)").
Targets:
${opcoes}
Files (index: path/name):
${lista}
For each file return {indice, alvo, confianca}: alvo = the target id (exactly as written before the colon) the file most likely belongs to, judging by names, abbreviations, typos, Portuguese/English words and folder names; confianca 0-1 (below 0.5 if it is a guess). Skip files that clearly match nothing.`
  const { v, modelo } = await jsonGemini<{ casamentos?: { indice?: number; alvo?: string; confianca?: number }[] }>([{ text: prompt }], SCHEMA_CASAR, inicio, 'casar')
  const ids = new Set(alvos.map(a => a.split(':')[0].trim()))
  const casamentos = (v.casamentos || []).map(c => ({ indice: Math.round(Number(c.indice)), alvo: String(c.alvo || '').trim(), confianca: Math.max(0, Math.min(1, Number(c.confianca) || 0)) }))
    .filter(c => Number.isInteger(c.indice) && c.indice >= 0 && c.indice < nomes.length && ids.has(c.alvo))
  return { tipo: 'casamentos', casamentos, provedor: modelo }
}

/** Foto-base do produto LISO (para quem não tem foto): caixa/sacola/caneca branca em estúdio, sem arte nem marca. */
export async function gerarProdutoBase(descricao: string): Promise<ResultadoIA> {
  const inicio = Date.now()
  const d = descricao.replace(/[\r\n"`]+/g, ' ').trim().slice(0, 80)
  if (!d) throw new Error('Diga qual produto (ex.: caixa milk branca).')
  const partes: Parte[] = [{ text: `Professional product photograph of a single BLANK ${d} for a craft shop mockup: plain, completely unprinted surfaces (pure white or natural material), no artwork, no text, no logo, no label, no pattern.
Three-quarter view showing the front and one side, centered, whole product visible with margin, soft even studio light, soft contact shadow, clean light-grey seamless background. Photorealistic, sharp, high quality.` }]
  const r = await gerarImagemGemini(partes, { aspectRatio: '1:1' }, inicio)
  return { tipo: 'imagem', imagem: { base64: r.base64, mime: r.mime }, provedor: r.modelo }
}
