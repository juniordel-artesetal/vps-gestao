// SOA Edition — MOCKUP (Fase 3): arte aplicada no produto real + cena de estúdio + kit de listagem.
// Só navegador (canvas). A área de aplicação é a mesma peça do "Replicar em moldes" (areaMolde).
//
// Realismo sem IA: a arte é distorcida para a área (perspectiva/malha), recortada pela silhueta do
// produto e recebe a LUZ e a SOMBRA da própria foto (luminância do produto multiplicada/somada sobre a
// arte) — assim dobras, curvatura e brilho da caneca aparecem por cima, como se estivesse impressa.
import { distorcer } from './transform'
import type { AreaAplicacao, RecorteArea } from './areaMolde'
import { gerarTextura, type TipoTextura } from './efeitos'
import type { ConfigCena, ConfigKitListagem, ConfigMockup, Tomada } from './mockupTipos'
import { TAMANHOS_CANAIS, type TamanhoCanal } from './tamanhos'
import { FUNDOS_PRONTOS, PROPS } from './cenasAcervo'

export const novoCanvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c }
const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!
const dim = (s: CanvasImageSource) => {
  const o = s as { naturalWidth?: number; naturalHeight?: number; width: number; height: number }
  return { w: o.naturalWidth || o.width, h: o.naturalHeight || o.height }
}
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

// ── 1) ISOLAR O PRODUTO (plano B local, sem IA) ────────────────────────────────────────────────────
/**
 * Remove fundo liso/degradê: estima a cor do fundo pelas BORDAS da foto e "inunda" a partir delas tudo
 * que se parece com o fundo. Buracos fechados com a cor do fundo (vão da alça da caneca) também saem.
 * Bom para produto fotografado sobre cartolina/parede lisa; foto com fundo cheio de coisa → use a IA.
 */
export function removerFundoLocal(src: CanvasImageSource, maxLado = 1600, recortar = true): HTMLCanvasElement {
  const d = dim(src)
  const k = Math.min(1, maxLado / Math.max(d.w, d.h))
  const W = Math.round(d.w * k), H = Math.round(d.h * k)
  const c = novoCanvas(W, H), g = ctx2d(c)
  g.drawImage(src, 0, 0, W, H)
  const img = g.getImageData(0, 0, W, H), px = img.data
  // amostras da borda (cor local por trecho: aguenta fundo em degradê)
  const amostras: number[][] = []
  const passo = Math.max(1, Math.round((W + H) / 400))
  for (let x = 0; x < W; x += passo) for (const y of [0, 1, H - 2, H - 1]) { const i = (y * W + x) * 4; amostras.push([px[i], px[i + 1], px[i + 2], x, y]) }
  for (let y = 0; y < H; y += passo) for (const x of [0, 1, W - 2, W - 1]) { const i = (y * W + x) * 4; amostras.push([px[i], px[i + 1], px[i + 2], x, y]) }
  const media = [0, 1, 2].map(k2 => amostras.reduce((s, a) => s + a[k2], 0) / amostras.length)
  const desvio = Math.sqrt(amostras.reduce((s, a) => s + (a[0] - media[0]) ** 2 + (a[1] - media[1]) ** 2 + (a[2] - media[2]) ** 2, 0) / amostras.length)
  const tol = Math.min(70, 22 + desvio * 1.6)
  // cor de fundo de referência por posição = média das amostras de borda mais próximas (degradê)
  const refDe = (x: number, y: number) => {
    let melhor = 0, dMin = Infinity
    for (let i = 0; i < amostras.length; i += 3) { const a = amostras[i]; const dd = (a[3] - x) ** 2 + (a[4] - y) ** 2; if (dd < dMin) { dMin = dd; melhor = i } }
    return amostras[melhor]
  }
  const grade = 24, refs: number[][] = []
  for (let gy = 0; gy <= grade; gy++) for (let gx = 0; gx <= grade; gx++) refs.push(refDe((gx / grade) * W, (gy / grade) * H))
  const ref = (x: number, y: number) => refs[Math.round((y / H) * grade) * (grade + 1) + Math.round((x / W) * grade)]
  const pareceFundo = (i: number, x: number, y: number) => {
    const r = ref(x, y)
    const dl = Math.hypot(px[i] - r[0], px[i + 1] - r[1], px[i + 2] - r[2]), dg = Math.hypot(px[i] - media[0], px[i + 1] - media[1], px[i + 2] - media[2])
    return Math.min(dl, dg * 1.15) < tol
  }
  const fundo = new Uint8Array(W * H)
  const pilha: number[] = []
  const semear = (x: number, y: number) => { const p = y * W + x; if (!fundo[p] && pareceFundo(p * 4, x, y)) { fundo[p] = 1; pilha.push(p) } }
  for (let x = 0; x < W; x++) { semear(x, 0); semear(x, H - 1) }
  for (let y = 0; y < H; y++) { semear(0, y); semear(W - 1, y) }
  while (pilha.length) {
    const p = pilha.pop()!, x = p % W, y = (p - x) / W
    if (x > 0) semear(x - 1, y); if (x < W - 1) semear(x + 1, y); if (y > 0) semear(x, y - 1); if (y < H - 1) semear(x, y + 1)
  }
  // buracos fechados com cara de fundo (vão da alça): regiões ≥ 0,2% da foto
  const visto = new Uint8Array(W * H)
  for (let p0 = 0; p0 < W * H; p0++) {
    if (fundo[p0] || visto[p0] || !pareceFundo(p0 * 4, p0 % W, (p0 - (p0 % W)) / W)) continue
    const regiao: number[] = [p0]; visto[p0] = 1
    for (let q = 0; q < regiao.length; q++) {
      const p = regiao[q], x = p % W, y = (p - x) / W
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const n = ny * W + nx
        if (!visto[n] && !fundo[n] && pareceFundo(n * 4, nx, ny)) { visto[n] = 1; regiao.push(n) }
      }
    }
    if (regiao.length > W * H * 0.002) for (const p of regiao) fundo[p] = 1
  }
  // borda suave (1 px de transição) + fica só o maior pedaço do produto
  const maior = maiorComponente(fundo, W, H)
  for (let p = 0; p < W * H; p++) {
    if (!maior[p]) { px[p * 4 + 3] = 0; continue }
    const x = p % W, y = (p - x) / W
    let viz = 0
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) if (nx >= 0 && ny >= 0 && nx < W && ny < H && !maior[ny * W + nx]) viz++
    if (viz) px[p * 4 + 3] = Math.round(px[p * 4 + 3] * (1 - viz * 0.18))
  }
  g.putImageData(img, 0, 0)
  return recortar ? aparar(c) : c
}

function maiorComponente(fundo: Uint8Array, W: number, H: number): Uint8Array {
  const rot = new Int32Array(W * H).fill(-1), tam: number[] = [], borda: number[] = [], cx: number[] = [], cy: number[] = []
  for (let p0 = 0; p0 < W * H; p0++) {
    if (fundo[p0] || rot[p0] >= 0) continue
    const id = tam.length, fila = [p0]; rot[p0] = id
    let toca = 0, sx = 0, sy = 0
    for (let q = 0; q < fila.length; q++) {
      const p = fila[q], x = p % W, y = (p - x) / W
      sx += x; sy += y
      if (x === 0 || x === W - 1 || y === 0) toca++          // encostar na base é normal (produto cortado embaixo)
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const n = ny * W + nx
        if (!fundo[n] && rot[n] < 0) { rot[n] = id; fila.push(n) }
      }
    }
    tam.push(fila.length); borda.push(toca); cx.push(sx / fila.length / W); cy.push(sy / fila.length / H)
  }
  const out = new Uint8Array(W * H)
  if (!tam.length) return out
  // produto = pedaço grande e central; pedaço preso nas bordas laterais/topo é fundo (parede, janela)
  const nota = tam.map((t, i) => t * (1 - Math.min(0.9, Math.hypot(cx[i] - 0.5, cy[i] - 0.5) * 1.4)) * (borda[i] > 3 ? 0.25 : 1))
  const melhor = nota.indexOf(Math.max(...nota)), max = tam[melhor]
  // fica o produto e pedaços soltos grandes (ex.: tampa) que NÃO encostam nas bordas
  for (let p = 0; p < W * H; p++) { const r = rot[p]; if (r >= 0 && (r === melhor || (tam[r] >= max * 0.08 && borda[r] <= 3))) out[p] = 1 }
  return out
}

/** Recorta as bordas transparentes (produto encostado nas margens do canvas). */
export function aparar(c: HTMLCanvasElement, folga = 2): HTMLCanvasElement {
  const g = ctx2d(c), { data } = g.getImageData(0, 0, c.width, c.height)
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) return c
  x0 = Math.max(0, x0 - folga); y0 = Math.max(0, y0 - folga); x1 = Math.min(c.width - 1, x1 + folga); y1 = Math.min(c.height - 1, y1 + folga)
  const o = novoCanvas(x1 - x0 + 1, y1 - y0 + 1)
  o.getContext('2d')!.drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height)
  return o
}

/** Contorno do produto devolvido pela IA (polígono normalizado 0…1 + furos, ex.: o vão da alça). */
export interface MascaraIA { box?: { x: number; y: number; w: number; h: number }; contorno: [number, number][]; furos?: [number, number][][]; label?: string }

/**
 * Recorta a foto pelo(s) polígono(s) da IA (preenchimento "evenodd": furo vira transparente) e suaviza a
 * borda em 1–2 px (o polígono é facetado).
 */
export function aplicarMascaras(src: CanvasImageSource, mascaras: MascaraIA[], recortar = true): HTMLCanvasElement {
  const d = dim(src), W = d.w, H = d.h
  const m = novoCanvas(W, H), gm = ctx2d(m)
  gm.fillStyle = '#fff'
  for (const mk of mascaras) {
    if (!mk.contorno || mk.contorno.length < 3) continue
    gm.beginPath()
    for (const anel of [mk.contorno, ...(mk.furos || [])]) {
      anel.forEach(([x, y], i) => (i ? gm.lineTo(x * W, y * H) : gm.moveTo(x * W, y * H))); gm.closePath()
    }
    gm.fill('evenodd')
  }
  // borda suave: reduz a máscara um tiquinho e desfoca (sem ctx.filter — sombra deslocada)
  const suave = novoCanvas(W, H), gs = ctx2d(suave)
  const r = Math.max(1, Math.round(Math.max(W, H) / 900))
  gs.shadowColor = '#fff'; gs.shadowBlur = r * 2; gs.shadowOffsetX = 20000
  gs.drawImage(m, -20000, 0)
  // sombra DESLIGADA antes do destination-in (senão a passada de sombra, fora da tela, apaga tudo)
  gs.shadowColor = 'transparent'; gs.shadowBlur = 0; gs.shadowOffsetX = 0
  gs.globalCompositeOperation = 'destination-in'; gs.drawImage(m, 0, 0)
  const out = novoCanvas(W, H), go = ctx2d(out)
  go.drawImage(src, 0, 0, W, H)
  go.globalCompositeOperation = 'destination-in'; go.drawImage(suave, 0, 0)
  return recortar ? aparar(out) : out
}

export function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous'
    i.onload = () => res(i); i.onerror = () => rej(new Error('Não consegui abrir a imagem.'))
    i.src = url
  })
}

// ── 2) PROPOR A ÁREA DE APLICAÇÃO ────────────────────────────────────────────────────────────────
/**
 * Sugere onde a arte vai: a maior região clara e lisa do produto (a face "em branco"). Devolve um
 * quadrilátero (perspectiva) nos extremos da região — a artesã ajusta os 4 pontos ou vira malha.
 */
export function proporArea(produto: HTMLCanvasElement): AreaAplicacao {
  const k = Math.min(1, 400 / Math.max(produto.width, produto.height))
  const W = Math.max(8, Math.round(produto.width * k)), H = Math.max(8, Math.round(produto.height * k))
  const c = novoCanvas(W, H), g = ctx2d(c)
  g.drawImage(produto, 0, 0, W, H)
  const d = g.getImageData(0, 0, W, H).data
  const L = new Float32Array(W * H), A = new Uint8Array(W * H)
  const lums: number[] = []
  for (let p = 0; p < W * H; p++) { L[p] = lum(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]); A[p] = d[p * 4 + 3] > 200 ? 1 : 0; if (A[p]) lums.push(L[p]) }
  if (lums.length < 50) return quadPadrao()
  lums.sort((a, b) => a - b)
  const corte = lums[Math.floor(lums.length * 0.2)]   // inclui o lado na sombra (caneca), não só o iluminado
  const ok = new Uint8Array(W * H)
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const p = y * W + x
    if (!A[p] || L[p] < corte) continue
    const gr = Math.abs(L[p + 1] - L[p - 1]) + Math.abs(L[p + W] - L[p - W])
    if (gr < 18) ok[p] = 1
  }
  // maior região lisa
  const rot = new Int32Array(W * H).fill(-1)
  let melhor: number[] = []
  for (let p0 = 0; p0 < W * H; p0++) {
    if (!ok[p0] || rot[p0] >= 0) continue
    const fila = [p0]; rot[p0] = p0
    for (let q = 0; q < fila.length; q++) {
      const p = fila[q], x = p % W, y = (p - x) / W
      for (const n of [p - 1, p + 1, p - W, p + W]) {
        const nx = n % W, ny = (n - nx) / W
        if (n < 0 || n >= W * H || Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
        if (ok[n] && rot[n] < 0) { rot[n] = p0; fila.push(n) }
      }
    }
    if (fila.length > melhor.length) melhor = fila
  }
  if (melhor.length < W * H * 0.01) return quadPadrao()
  // mede a região em 3 colunas (esquerda, meio, direita): onde começa e termina em cada uma. Boca de
  // caneca/lata = topo curvo (meio mais baixo que as pontas) → MALHA; face plana → 4 PONTOS.
  const dentro = new Uint8Array(W * H); for (const p of melhor) dentro[p] = 1
  let x0 = W, x1 = 0
  const ys = melhor.map(p => (p - (p % W)) / W).sort((a, b) => a - b)
  const yMeio = ys[Math.floor(ys.length / 2)]
  for (const p of melhor) { const x = p % W, y = (p - x) / W; if (Math.abs(y - yMeio) <= 2) { if (x < x0) x0 = x; if (x > x1) x1 = x } }
  if (x1 - x0 < 6) return quadPadrao()
  const mg = 0.07 * (x1 - x0)
  const colunas = [x0 + mg, (x0 + x1) / 2, x1 - mg].map(Math.round)
  const extremos = colunas.map(x => {
    let top = -1, bot = -1
    for (let y = 0; y < H; y++) { let hit = false; for (let dx = -1; dx <= 1 && !hit; dx++) hit = !!dentro[y * W + Math.min(W - 1, Math.max(0, x + dx))]; if (hit) { if (top < 0) top = y; bot = y } }
    return { top, bot }
  })
  if (extremos.some(e => e.top < 0 || e.bot - e.top < 6)) return quadPadrao()
  const alt = Math.max(...extremos.map(e => e.bot - e.top))
  const m2 = 0.05 * alt
  const T = extremos.map(e => e.top + m2), B = extremos.map(e => e.bot - m2)
  // cilindro visto de cima: topo E base curvam para o mesmo lado (sorriso). Só um lado torto = recorte
  // irregular (telhadinho da caixa) → trata como face plana com os cantos de baixo + o topo mais baixo.
  const dT = T[1] - (T[0] + T[2]) / 2, dB = B[1] - (B[0] + B[2]) / 2
  const curvo = Math.abs(dT) > 0.02 * alt && Math.abs(dB) > 0.02 * alt && Math.sign(dT) === Math.sign(dB)
  if (!curvo) { const topo = Math.max(T[0], T[2]); T[0] = T[2] = Math.max(topo, Math.min(T[0], T[2])) }
  const n = (x: number, y: number) => ({ x: x / W, y: y / H })
  if (!curvo) return { tipo: 'perspectiva', cols: 2, rows: 2, pontos: [n(colunas[0], T[0]), n(colunas[2], T[2]), n(colunas[0], B[0]), n(colunas[2], B[2])] }
  const pts = [] as { x: number; y: number }[]
  for (const f of [0, 0.5, 1]) for (let c = 0; c < 3; c++) pts.push(n(colunas[c], T[c] + (B[c] - T[c]) * f))
  return { tipo: 'malha', cols: 3, rows: 3, pontos: pts }
}
const quadPadrao = (): AreaAplicacao => ({ tipo: 'perspectiva', cols: 2, rows: 2, pontos: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.25, y: 0.75 }, { x: 0.75, y: 0.75 }] })

// ── 3) COMPOR: arte no produto com luz/sombra da foto ─────────────────────────────────────────────
/**
 * Produto (fundo transparente) + arte → produto com a arte "impressa". Mesmo tamanho do produto.
 * `cfg.cor` tinge o produto (caixa branca → rosa) mantendo o sombreado.
 */
export function comporMockup(produto: HTMLCanvasElement, arte: CanvasImageSource | null, cfg: ConfigMockup): HTMLCanvasElement {
  const W = produto.width, H = produto.height
  const out = novoCanvas(W, H), g = ctx2d(out)
  g.drawImage(produto, 0, 0)
  if (cfg.cor && cfg.cor.intensidade > 0) {
    const t = novoCanvas(W, H), gt = ctx2d(t)
    gt.drawImage(produto, 0, 0)
    gt.globalCompositeOperation = 'multiply'; gt.fillStyle = cfg.cor.cor; gt.fillRect(0, 0, W, H)
    gt.globalCompositeOperation = 'destination-in'; gt.drawImage(produto, 0, 0)
    g.globalAlpha = Math.min(1, cfg.cor.intensidade / 100); g.drawImage(t, 0, 0); g.globalAlpha = 1
  }
  if (!arte) return out
  const da = dim(arte)
  const pontos = cfg.area.pontos.map(p => ({ x: p.x * W, y: p.y * H }))
  const r = distorcer(arte, da.w, da.h, { tipo: cfg.area.tipo, cols: cfg.area.cols, rows: cfg.area.rows, pontos })
  const camada = novoCanvas(W, H), gc = ctx2d(camada)
  gc.save()
  if (cfg.recorte) clipRecorte(gc, cfg.recorte, W, H)
  gc.drawImage(r.canvas, r.minX, r.minY, r.canvas.width / r.escala, r.canvas.height / r.escala)
  gc.restore()
  // a arte nunca sai da silhueta do produto
  gc.globalCompositeOperation = 'destination-in'; gc.drawImage(produto, 0, 0); gc.globalCompositeOperation = 'source-over'
  // luz/sombra da própria foto por cima da arte
  const base = out  // produto já tingido
  const pd = ctx2d(base).getImageData(0, 0, W, H).data
  const ad = gc.getImageData(0, 0, W, H)
  const a = ad.data
  // branco de referência = luminância "alta típica" do produto na área (percentil 80)
  const amostra: number[] = []
  for (let p = 0; p < W * H; p += 7) if (a[p * 4 + 3] > 40 && pd[p * 4 + 3] > 200) amostra.push(lum(pd[p * 4], pd[p * 4 + 1], pd[p * 4 + 2]))
  amostra.sort((x, y) => x - y)
  const ref = Math.max(40, amostra.length ? amostra[Math.floor(amostra.length * 0.8)] : 235)
  const kS = cfg.ls.sombra / 100, kL = cfg.ls.luz / 100, op = Math.max(0, Math.min(1, cfg.opacidade / 100))
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    if (!a[i + 3]) continue
    const l = lum(pd[i], pd[i + 1], pd[i + 2])
    const s = 1 - kS * (1 - Math.min(1, l / ref))                // sombra: escurece onde a foto é mais escura
    const h = kL * Math.max(0, Math.min(1, (l - ref) / Math.max(12, 255 - ref)))   // brilho acima do branco de referência
    for (let c = 0; c < 3; c++) { const v = a[i + c] * s; a[i + c] = Math.min(255, v + (255 - v) * h) }
    a[i + 3] = Math.round(a[i + 3] * op)
  }
  gc.putImageData(ad, 0, 0)
  g.drawImage(camada, 0, 0)
  return out
}

function clipRecorte(g: CanvasRenderingContext2D, q: RecorteArea, W: number, H: number) {
  g.beginPath()
  if (q.forma === 'elipse') g.ellipse((q.x + q.w / 2) * W, (q.y + q.h / 2) * H, (q.w / 2) * W, (q.h / 2) * H, 0, 0, Math.PI * 2)
  else g.rect(q.x * W, q.y * H, q.w * W, q.h * H)
  g.clip()
}

// ── 4) CENA DE ESTÚDIO ───────────────────────────────────────────────────────────────────────────
export type ResolverImagem = (url: string) => HTMLImageElement | null | undefined

export function desenharFundo(g: CanvasRenderingContext2D, cena: ConfigCena, W: number, H: number, img?: ResolverImagem) {
  const f = cena.fundo
  g.save()
  if (f.tipo === 'cor') { g.fillStyle = f.cor; g.fillRect(0, 0, W, H) }
  else if (f.tipo === 'gradiente') {
    const a = ((f.angulo - 90) * Math.PI) / 180, r = Math.hypot(W, H) / 2
    const gr = g.createLinearGradient(W / 2 - Math.cos(a) * r, H / 2 - Math.sin(a) * r, W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r)
    gr.addColorStop(0, f.de); gr.addColorStop(1, f.para); g.fillStyle = gr; g.fillRect(0, 0, W, H)
  } else if (f.tipo === 'textura') {
    g.fillStyle = f.cor; g.fillRect(0, 0, W, H)
    const t = gerarTextura(f.textura as TipoTextura, 256)
    g.globalCompositeOperation = 'multiply'; g.fillStyle = g.createPattern(t, 'repeat')!; g.fillRect(0, 0, W, H)
  } else if (f.tipo === 'foto') {
    const im = img?.(f.url)
    if (im) { const k = Math.max(W / im.naturalWidth, H / im.naturalHeight); g.drawImage(im, (W - im.naturalWidth * k) / 2, (H - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k) }
    else { g.fillStyle = '#f5f5f4'; g.fillRect(0, 0, W, H) }
  } else {
    const p = FUNDOS_PRONTOS.find(x => x.id === f.id) || FUNDOS_PRONTOS[0]
    if (p) p.desenhar(g, W, H); else { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H) }
  }
  g.restore()
}

/** Silhueta desfocada deslocada — sombra sem precisar de ctx.filter (funciona em todo navegador). */
function sombraDe(g: CanvasRenderingContext2D, silhueta: CanvasImageSource, x: number, y: number, w: number, h: number, cor: string, blur: number) {
  g.save()
  g.shadowColor = cor; g.shadowBlur = blur; g.shadowOffsetX = 20000; g.shadowOffsetY = 0
  g.drawImage(silhueta, x - 20000, y, w, h)
  g.restore()
}

/**
 * Monta a cena: fundo → reflexo → sombras → produto → luz → props. `produto` já com a arte (comporMockup
 * ou caixa montada). Tamanho livre (W×H) — o kit de listagem chama uma vez por tamanho de canal.
 */
export function renderCena(produto: HTMLCanvasElement, cena: ConfigCena, W: number, H: number, img?: ResolverImagem, fundoBranco = false): HTMLCanvasElement {
  const out = novoCanvas(W, H), g = ctx2d(out)
  if (fundoBranco) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H) } else desenharFundo(g, cena, W, H, img)
  const ph = cena.produto.altura * H
  let pw = (produto.width / produto.height) * ph
  const maxW = W * 0.9
  const esc = pw > maxW ? maxW / pw : 1
  pw *= esc
  const phh = ph * esc
  const px = cena.produto.cx * W - pw / 2, py = cena.produto.cy * H - phh / 2, base = py + phh
  const fundos = cena.props.filter(p => p.y < cena.produto.cy), frente = cena.props.filter(p => p.y >= cena.produto.cy)
  for (const p of fundos) desenharProp(g, p, W, H)
  // reflexo no piso
  if (cena.reflexo > 0) {
    const r = novoCanvas(pw, phh * 0.5), gr = ctx2d(r)
    gr.translate(0, phh); gr.scale(1, -1); gr.drawImage(produto, 0, 0, pw, phh); gr.setTransform(1, 0, 0, 1, 0, 0)
    const fade = gr.createLinearGradient(0, 0, 0, r.height); fade.addColorStop(0, `rgba(0,0,0,${0.55 * cena.reflexo / 100})`); fade.addColorStop(1, 'rgba(0,0,0,0)')
    gr.globalCompositeOperation = 'destination-in'; gr.fillStyle = fade; gr.fillRect(0, 0, r.width, r.height)
    g.drawImage(r, px, base)
  }
  // silhueta preta do produto (para as sombras)
  const sil = novoCanvas(produto.width, produto.height), gs = ctx2d(sil)
  gs.drawImage(produto, 0, 0); gs.globalCompositeOperation = 'source-in'; gs.fillStyle = '#000'; gs.fillRect(0, 0, sil.width, sil.height)
  const suave = 0.2 + cena.sombra.suavidade / 100
  if (cena.sombra.projetada > 0) {
    // sombra "deitada" no piso, para o lado oposto à luz
    const a = (cena.luz.direcao * Math.PI) / 180, dx = -Math.cos(a) * pw * 0.45
    g.save()
    // base da silhueta no piso; o topo "deita" para trás (sobe na tela, achatado) e escorrega para o lado
    g.translate(px, base); g.transform(1, 0, -dx / phh, 0.32, dx, -0.32 * phh)
    sombraDe(g, sil, 0, 0, pw, phh, `rgba(0,0,0,${0.5 * cena.sombra.projetada / 100})`, 18 * suave * (W / 1000))
    g.restore()
  }
  if (cena.sombra.contato > 0) {
    g.save()
    const rx = pw * 0.46, ry = Math.max(4, phh * 0.035)
    const gr = g.createRadialGradient(px + pw / 2, base, 0, px + pw / 2, base, rx)
    gr.addColorStop(0, `rgba(0,0,0,${0.55 * cena.sombra.contato / 100})`); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.translate(px + pw / 2, base); g.scale(1, ry / rx); g.translate(-(px + pw / 2), -base)
    g.fillStyle = gr; g.beginPath(); g.arc(px + pw / 2, base, rx, 0, Math.PI * 2); g.fill()
    g.restore()
    sombraDe(g, sil, px, py + phh * 0.01, pw, phh, `rgba(0,0,0,${0.18 * cena.sombra.contato / 100})`, 6 * suave * (W / 1000))
  }
  g.drawImage(produto, px, py, pw, phh)
  // luz geral: lado iluminado mais claro, oposto mais escuro + vinheta leve
  if (cena.luz.intensidade > 0) {
    const a = (cena.luz.direcao * Math.PI) / 180, r = Math.hypot(W, H) / 2
    const gr = g.createLinearGradient(W / 2 + Math.cos(a) * r, H / 2 - Math.sin(a) * r, W / 2 - Math.cos(a) * r, H / 2 + Math.sin(a) * r)
    const k = cena.luz.intensidade / 100
    gr.addColorStop(0, `rgba(255,255,255,${0.22 * k})`); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.18 * k})`)
    g.fillStyle = gr; g.fillRect(0, 0, W, H)
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6)
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${0.16 * k})`)
    g.fillStyle = v; g.fillRect(0, 0, W, H)
  }
  for (const p of frente) desenharProp(g, p, W, H)
  return out
}

function desenharProp(g: CanvasRenderingContext2D, p: ConfigCena['props'][number], W: number, H: number) {
  const def = PROPS.find(x => x.id === p.elemento)
  if (!def) return
  g.save()
  g.translate(p.x * W, p.y * H); g.rotate((p.rot * Math.PI) / 180)
  def.desenhar(g, p.escala * Math.min(W, H), p.cor || '#f472b6')
  g.restore()
}

// ── 5) KIT DE LISTAGEM ───────────────────────────────────────────────────────────────────────────
export interface VistasProduto {
  /** Produto (com a arte) visto de frente — obrigatório. */
  frente: HTMLCanvasElement
  /** Outra vista real (caixa montada 3/4). Sem ela, o ângulo é simulado inclinando a foto. */
  angulo?: HTMLCanvasElement | null
  /** Área da arte no `frente` (para o detalhe/zoom), normalizada. */
  area?: AreaAplicacao | null
}

export interface FotoKit { tomada: Tomada; canal: TamanhoCanal; canvas: HTMLCanvasElement }

/** "Ângulo" de uma foto única: gira ~18° em perspectiva (o lado que se afasta encolhe e escurece). */
export function anguloSimulado(frente: HTMLCanvasElement): HTMLCanvasElement {
  const W = frente.width, H = frente.height, rec = 0.1
  const r = distorcer(frente, W, H, { tipo: 'perspectiva', cols: 2, rows: 2, pontos: [{ x: 0, y: 0 }, { x: W * 0.84, y: H * rec }, { x: 0, y: H }, { x: W * 0.84, y: H * (1 - rec) }] })
  const c = novoCanvas(r.canvas.width / r.escala, r.canvas.height / r.escala), g = ctx2d(c)
  g.drawImage(r.canvas, 0, 0, c.width, c.height)
  const gr = g.createLinearGradient(0, 0, c.width, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.16)')
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height)
  return c
}

/** Zoom na arte: recorte em volta da área de aplicação. */
export function detalhe(frente: HTMLCanvasElement, area: AreaAplicacao | null | undefined): HTMLCanvasElement {
  const W = frente.width, H = frente.height
  const pts = area?.pontos.map(p => ({ x: p.x * W, y: p.y * H })) || [{ x: W * 0.25, y: H * 0.25 }, { x: W * 0.75, y: H * 0.75 }]
  const x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y))
  const m = 0.08 * Math.max(x1 - x0, y1 - y0)
  const x = Math.max(0, x0 - m), y = Math.max(0, y0 - m), w = Math.min(W, x1 + m) - x, h = Math.min(H, y1 + m) - y
  const c = novoCanvas(w, h); c.getContext('2d')!.drawImage(frente, x, y, w, h, 0, 0, w, h)
  return c
}

/** Produto sobre branco com as cotas (largura embaixo, altura à direita, profundidade opcional). */
export function comMedidas(produto: HTMLCanvasElement, W: number, H: number, m: ConfigKitListagem['medidas']): HTMLCanvasElement {
  const out = novoCanvas(W, H), g = ctx2d(out)
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H)
  const esc = Math.min((W * 0.66) / produto.width, (H * 0.62) / produto.height)
  const pw = produto.width * esc, ph = produto.height * esc
  const px = (W - pw) / 2 - W * 0.04, py = (H - ph) / 2 - H * 0.04
  g.drawImage(produto, px, py, pw, ph)
  const cor = '#334155', lw = Math.max(2, W / 400), fs = Math.round(Math.min(W, H) * 0.042)
  g.strokeStyle = cor; g.fillStyle = cor; g.lineWidth = lw; g.font = `600 ${fs}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
  const seta = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke()
    const a = Math.atan2(y2 - y1, x2 - x1), t = lw * 5
    for (const [x, y, s] of [[x1, y1, 1], [x2, y2, -1]] as const) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * t * Math.cos(a - 0.45), y + s * t * Math.sin(a - 0.45)); g.lineTo(x + s * t * Math.cos(a + 0.45), y + s * t * Math.sin(a + 0.45)); g.closePath(); g.fill()
    }
  }
  const fmt = (v: number) => `${String(Math.round(v * 10) / 10).replace('.', ',')} cm`
  const yb = py + ph + H * 0.06
  g.setLineDash([lw * 2, lw * 2]); g.beginPath(); g.moveTo(px, py + ph); g.lineTo(px, yb + lw * 4); g.moveTo(px + pw, py + ph); g.lineTo(px + pw, yb + lw * 4); g.stroke(); g.setLineDash([])
  seta(px, yb, px + pw, yb); g.fillText(fmt(m.largura), px + pw / 2, yb + fs * 0.95)
  const xr = px + pw + W * 0.06
  g.setLineDash([lw * 2, lw * 2]); g.beginPath(); g.moveTo(px + pw, py); g.lineTo(xr + lw * 4, py); g.moveTo(px + pw, py + ph); g.lineTo(xr + lw * 4, py + ph); g.stroke(); g.setLineDash([])
  seta(xr, py, xr, py + ph)
  g.save(); g.translate(xr + fs * 0.95, py + ph / 2); g.rotate(-Math.PI / 2); g.fillText(fmt(m.altura), 0, 0); g.restore()
  if (m.profundidade) { g.textAlign = 'left'; g.fillText(`Profundidade: ${fmt(m.profundidade)}`, W * 0.06, H * 0.08) }
  return out
}

function badge(g: CanvasRenderingContext2D, W: number, H: number, b: NonNullable<ConfigKitListagem['badge']>) {
  if (!b.ativo || !(b.texto || b.preco)) return
  const fs = Math.round(Math.min(W, H) * 0.045)
  g.save()
  g.font = `700 ${fs}px sans-serif`
  const linhas = [b.texto, b.preco].filter(Boolean)
  const larg = Math.max(...linhas.map(l => g.measureText(l).width)) + fs * 1.4
  const alt = linhas.length * fs * 1.25 + fs * 0.8
  const x = W * 0.05, y = H - alt - H * 0.05
  g.fillStyle = b.cor || '#f97316'
  g.beginPath(); g.roundRect(x, y, larg, alt, fs * 0.6); g.fill()
  g.fillStyle = '#ffffff'; g.textBaseline = 'top'
  linhas.forEach((l, i) => g.fillText(l, x + fs * 0.7, y + fs * 0.4 + i * fs * 1.25))
  g.restore()
}

/**
 * Gera o conjunto de fotos do marketplace: cada tomada × cada tamanho de canal. Cada foto = 1 imagem
 * da cota (quem chama autoriza ANTES de cada uma — `autorizar(i)`).
 */
export async function gerarKitListagem(p: {
  vistas: VistasProduto; kit: ConfigKitListagem; cenaUso: ConfigCena; img?: ResolverImagem
  autorizar: (i: number) => Promise<void>; aoProgredir?: (feitos: number, total: number) => void
}): Promise<FotoKit[]> {
  const { vistas, kit } = p
  const canais = kit.tamanhos.map(id => TAMANHOS_CANAIS.find(t => t.id === id)).filter((t): t is TamanhoCanal => !!t)
  const estudio: ConfigCena = { fundo: { tipo: 'cor', cor: '#ffffff' }, produto: { cx: 0.5, cy: 0.5, altura: 0.74 }, sombra: { contato: 60, projetada: 0, suavidade: 70 }, reflexo: 0, luz: { direcao: 60, intensidade: 0 }, props: [] }
  const ang = vistas.angulo || anguloSimulado(vistas.frente)
  const det = detalhe(vistas.frente, vistas.area)
  const total = kit.tomadas.length * canais.length
  const fotos: FotoKit[] = []
  let i = 0
  for (const tomada of kit.tomadas) for (const canal of canais) {
    await p.autorizar(i)
    const { largura: W, altura: H } = canal
    let c: HTMLCanvasElement
    if (tomada === 'frente') c = renderCena(vistas.frente, estudio, W, H)
    else if (tomada === 'angulo') c = renderCena(ang, { ...estudio, sombra: { contato: 55, projetada: 20, suavidade: 70 } }, W, H)
    else if (tomada === 'detalhe') c = renderCena(det, { ...estudio, produto: { cx: 0.5, cy: 0.5, altura: 0.86 }, sombra: { contato: 0, projetada: 0, suavidade: 0 } }, W, H)
    else if (tomada === 'medidas') c = comMedidas(vistas.frente, W, H, kit.medidas)
    else c = renderCena(vistas.frente, p.cenaUso, W, H, p.img)
    if (kit.badge) badge(ctx2d(c), W, H, kit.badge)
    fotos.push({ tomada, canal, canvas: c })
    i++; p.aoProgredir?.(i, total)
    await new Promise(r => setTimeout(r, 0))
  }
  return fotos
}

/** Cena "festa" padrão do "em uso" quando o kit não escolheu uma. */
export const CENA_FESTA: ConfigCena = {
  fundo: { tipo: 'preset', id: 'confete' },
  produto: { cx: 0.5, cy: 0.56, altura: 0.62 },
  sombra: { contato: 60, projetada: 30, suavidade: 60 },
  reflexo: 0,
  luz: { direcao: 60, intensidade: 30 },
  props: [
    { id: 'p1', elemento: 'balao', x: 0.14, y: 0.24, escala: 0.22, rot: -8, cor: '#f472b6' },
    { id: 'p2', elemento: 'balao', x: 0.86, y: 0.2, escala: 0.2, rot: 10, cor: '#60a5fa' },
    { id: 'p3', elemento: 'presente', x: 0.84, y: 0.82, escala: 0.16, rot: 0, cor: '#a78bfa' },
  ],
}

/** Nome de arquivo seguro (sem acento/espaço estranho). */
export const nomeArquivo = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 80) || 'arquivo'

export async function blobDe(c: HTMLCanvasElement, mime = 'image/jpeg', q = 0.92): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Não consegui gerar a imagem.'))), mime, q))
}
