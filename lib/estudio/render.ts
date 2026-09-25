// SOA Edition — RENDERIZADOR ÚNICO (só navegador). A prévia do editor e o lote usam esta
// mesma função: o que a artesã vê no editor é exatamente o que sai no arquivo.
//
// Tudo em pixels do molde original. Canvas 2D puro (sem Fabric) para ser rápido e previsível.
import { aplicar, type Caixa, type ConfigTemplate, type Linha } from './tipos'

// ── COBERTURA do texto antigo (plano B quando o molde não é limpo) ───────────────
type Retangulo = { x: number; y: number; w: number; h: number }

/** Caixa (com folga) e o retângulo alinhado que a contém depois de girar. */
function areaCoberta(c: Caixa): { caixa: Retangulo; envolve: Retangulo } {
  const f = ((c.cobertura?.folga ?? 8) / 100) * Math.min(c.w, c.h)
  const caixa = { x: c.x - f, y: c.y - f, w: c.w + 2 * f, h: c.h + 2 * f }
  const a = ((c.rotacao || 0) * Math.PI) / 180, cx = c.x + c.w / 2, cy = c.y + c.h / 2
  const cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a))
  const W = caixa.w * cs + caixa.h * sn, H = caixa.w * sn + caixa.h * cs
  return { caixa, envolve: { x: cx - W / 2, y: cy - H / 2, w: W, h: H } }
}

const cacheEntorno = new WeakMap<object, Map<string, HTMLCanvasElement>>()
/**
 * Preenche um retângulo interpolando as cores da BORDA em volta dele (esq↔dir e topo↔base) —
 * some com o texto antigo em fundo liso/degradê. Calculado uma vez por molde+caixa (lote reusa).
 */
function preenchimentoEntorno(molde: CanvasImageSource, r: Retangulo, W: number, H: number): HTMLCanvasElement | null {
  const x0 = Math.max(1, Math.floor(r.x)), y0 = Math.max(1, Math.floor(r.y))
  const x1 = Math.min(W - 2, Math.ceil(r.x + r.w)), y1 = Math.min(H - 2, Math.ceil(r.y + r.h))
  const w = x1 - x0, h = y1 - y0
  if (w < 2 || h < 2) return null
  const chave = `${x0},${y0},${w},${h}`
  let porMolde = cacheEntorno.get(molde as object)
  if (!porMolde) { porMolde = new Map(); cacheEntorno.set(molde as object, porMolde) }
  const ja = porMolde.get(chave)
  if (ja) return ja
  // lê o retângulo + 2 px de borda do molde
  const b = 2
  const amostra = document.createElement('canvas'); amostra.width = w + 2 * b; amostra.height = h + 2 * b
  const ag = amostra.getContext('2d', { willReadFrequently: true })!
  ag.drawImage(molde, x0 - b, y0 - b, w + 2 * b, h + 2 * b, 0, 0, w + 2 * b, h + 2 * b)
  const src = ag.getImageData(0, 0, w + 2 * b, h + 2 * b).data
  const aw = w + 2 * b
  const px = (x: number, y: number) => { const i = (y * aw + x) * 4; return [src[i], src[i + 1], src[i + 2], src[i + 3]] }
  const media = (lista: number[][]) => lista.reduce((s, p) => s.map((v, k) => v + p[k] / lista.length), [0, 0, 0, 0])
  // Bordas SUAVIZADAS (média móvel): sem isso cada linha herda o pixel exato da borda e sai "listrado".
  const suave = (v: number[][], janela: number) => v.map((_, i) => {
    const a0 = Math.max(0, i - janela), a1 = Math.min(v.length - 1, i + janela)
    return media(v.slice(a0, a1 + 1))
  })
  const esq = suave(Array.from({ length: h }, (_, j) => media([px(0, j + b), px(1, j + b)])), Math.max(2, Math.round(h * 0.08)))
  const dir = suave(Array.from({ length: h }, (_, j) => media([px(aw - 1, j + b), px(aw - 2, j + b)])), Math.max(2, Math.round(h * 0.08)))
  const topo = suave(Array.from({ length: w }, (_, i) => media([px(i + b, 0), px(i + b, 1)])), Math.max(2, Math.round(w * 0.08)))
  const base = suave(Array.from({ length: w }, (_, i) => media([px(i + b, h + 2 * b - 1), px(i + b, h + 2 * b - 2)])), Math.max(2, Math.round(w * 0.08)))
  const out = document.createElement('canvas'); out.width = w; out.height = h
  const og = out.getContext('2d')!
  const img = og.createImageData(w, h)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = w > 1 ? i / (w - 1) : 0, v = h > 1 ? j / (h - 1) : 0
    // peso de cada interpolação: a direção cujas bordas estão mais PERTO manda mais
    const dx = Math.min(u, 1 - u), dy = Math.min(v, 1 - v)
    const wx = dy / (dx + dy + 1e-6), wy = dx / (dx + dy + 1e-6)
    const k = (j * w + i) * 4
    for (let c = 0; c < 4; c++) {
      const hz = esq[j][c] * (1 - u) + dir[j][c] * u
      const vt = topo[i][c] * (1 - v) + base[i][c] * v
      img.data[k + c] = (dx + dy) < 1e-6 ? hz : hz * wx + vt * wy
    }
  }
  og.putImageData(img, 0, 0)
  const final = out
  porMolde.set(chave, final)
  return final
}

function cobrir(ctx: CanvasRenderingContext2D, molde: CanvasImageSource, cfg: ConfigTemplate, c: Caixa) {
  const cb = c.cobertura!
  const { caixa, envolve } = areaCoberta(c)
  const a = ((c.rotacao || 0) * Math.PI) / 180, cx = c.x + c.w / 2, cy = c.y + c.h / 2
  ctx.save()
  // recorta na caixa GIRADA (com folga)
  ctx.translate(cx, cy); ctx.rotate(a); ctx.translate(-cx, -cy)
  ctx.beginPath(); ctx.rect(caixa.x, caixa.y, caixa.w, caixa.h); ctx.clip()
  ctx.translate(cx, cy); ctx.rotate(-a); ctx.translate(-cx, -cy)
  if (cb.modo === 'cor') { ctx.fillStyle = cb.cor; ctx.fillRect(envolve.x, envolve.y, envolve.w, envolve.h) }
  else if (cb.modo === 'remendo') ctx.drawImage(molde, envolve.x + cb.dx, envolve.y + cb.dy, envolve.w, envolve.h, envolve.x, envolve.y, envolve.w, envolve.h)
  else {
    const p = preenchimentoEntorno(molde, envolve, cfg.largura, cfg.altura)
    if (p) ctx.drawImage(p, Math.max(1, Math.floor(envolve.x)), Math.max(1, Math.floor(envolve.y)))
  }
  ctx.restore()
}

/** Resolve o id de fonte da caixa para a família CSS registrada no documento. */
export type ResolverFonte = (id: string) => string

export interface OpcoesRender {
  /** Cor de fundo (variação "fundo"); pinta ANTES do molde — aparece onde o molde é transparente. */
  fundo?: string | null
  /** JPG não tem transparência: sem fundo, pinta branco (senão sairia preto). */
  fundoBrancoSeTransparente?: boolean
  /** Cache de imagens das caixas {foto} (url → imagem). */
  imagens?: Map<string, HTMLImageElement | null>
}

function fontCss(c: Caixa, px: number, familia: string): string {
  return `${c.italico ? 'italic ' : ''}${c.negrito ? '700 ' : '400 '}${Math.max(1, px)}px ${familia}`
}

/** Quebra em linhas que caibam em `max` px (por palavra; palavra maior que a linha fica sozinha). */
function quebrar(ctx: CanvasRenderingContext2D, texto: string, max: number): string[] {
  const out: string[] = []
  for (const paragrafo of texto.split('\n')) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean)
    if (!palavras.length) { out.push(''); continue }
    let linha = palavras[0]
    for (const p of palavras.slice(1)) {
      const teste = `${linha} ${p}`
      if (ctx.measureText(teste).width <= max) linha = teste
      else { out.push(linha); linha = p }
    }
    out.push(linha)
  }
  return out
}

function aplicarEfeitos(ctx: CanvasRenderingContext2D, c: Caixa, escala: number) {
  if (c.sombra) {
    ctx.shadowColor = c.sombra.cor
    ctx.shadowBlur = c.sombra.blur * escala
    ctx.shadowOffsetX = c.sombra.dx * escala
    ctx.shadowOffsetY = c.sombra.dy * escala
  } else {
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0
  }
}

function pintarTexto(ctx: CanvasRenderingContext2D, c: Caixa, t: string, x: number, y: number) {
  if (c.contorno && c.contorno.largura > 0) {
    ctx.save()
    ctx.lineJoin = 'round'; ctx.miterLimit = 2
    ctx.strokeStyle = c.contorno.cor
    ctx.lineWidth = c.contorno.largura * 2 // metade fica por baixo do preenchimento
    ctx.strokeText(t, x, y)
    ctx.restore()
    // a sombra já saiu no contorno; não duplica no preenchimento
    ctx.shadowColor = 'transparent'
  }
  ctx.fillStyle = c.cor
  ctx.fillText(t, x, y)
}

/** Texto reto: quebra de linha + auto-ajuste (encolhe até caber em largura E altura). */
function textoReto(ctx: CanvasRenderingContext2D, c: Caixa, texto: string, familia: string) {
  let px = c.tamanho
  let linhas: string[] = []
  const alturaLinha = () => px * 1.18
  for (let tent = 0; tent < 60; tent++) {
    ctx.font = fontCss(c, px, familia)
    linhas = c.autoAjuste ? quebrar(ctx, texto, c.w) : texto.split('\n')
    const larg = Math.max(...linhas.map(l => ctx.measureText(l).width), 0)
    const alt = linhas.length * alturaLinha()
    const min = Math.max(6, c.tamanhoMin || 0)
    if (!c.autoAjuste || (larg <= c.w && alt <= c.h) || px <= min) break
    px = Math.max(min, Math.floor(px * 0.93))
  }
  ctx.textBaseline = 'middle'
  ctx.textAlign = c.alinhamento
  const x = c.alinhamento === 'left' ? c.x : c.alinhamento === 'right' ? c.x + c.w : c.x + c.w / 2
  const total = linhas.length * alturaLinha()
  let y = c.y + (c.h - total) / 2 + alturaLinha() / 2
  aplicarEfeitos(ctx, c, px / Math.max(1, c.tamanho))
  for (const l of linhas) { pintarTexto(ctx, c, l, x, y); y += alturaLinha() }
}

/**
 * Texto curvo (1 linha) — cada caractere posicionado e girado sobre o arco.
 * `curvatura` = graus que o texto ocupa no círculo; + arco para cima, − para baixo.
 */
function textoCurvo(ctx: CanvasRenderingContext2D, c: Caixa, texto: string, familia: string) {
  const t = texto.replace(/\s*\n\s*/g, ' ')
  const ang = (Math.abs(c.curvatura) * Math.PI) / 180
  const cima = c.curvatura > 0
  let px = c.tamanho
  let larguras: number[] = [], total = 0, r = 1
  for (let tent = 0; tent < 60; tent++) {
    ctx.font = fontCss(c, px, familia)
    larguras = [...t].map(ch => ctx.measureText(ch).width)
    total = larguras.reduce((s, w) => s + w, 0)
    r = total / Math.max(ang, 0.0001)
    const corda = 2 * r * Math.sin(Math.min(ang, Math.PI * 1.999) / 2)
    const flecha = r * (1 - Math.cos(Math.min(ang, Math.PI) / 2)) + px
    const min = Math.max(6, c.tamanhoMin || 0)
    if (!c.autoAjuste || (corda <= c.w && flecha <= c.h) || px <= min) break
    px = Math.max(min, Math.floor(px * 0.93))
  }
  const cx = c.x + c.w / 2
  const flecha = r * (1 - Math.cos(Math.min(ang, Math.PI) / 2))
  // Centraliza o conjunto (arco + altura da letra) verticalmente na caixa.
  const cy = cima ? c.y + (c.h - flecha - px) / 2 + px / 2 : c.y + c.h - (c.h - flecha - px) / 2 - px / 2
  const centroY = cima ? cy + r : cy - r
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  aplicarEfeitos(ctx, c, px / Math.max(1, c.tamanho))
  let s = 0
  for (let i = 0; i < larguras.length; i++) {
    const meio = s + larguras[i] / 2
    const off = (meio - total / 2) / r
    const th = cima ? -Math.PI / 2 + off : Math.PI / 2 - off
    ctx.save()
    ctx.translate(cx + r * Math.cos(th), centroY + r * Math.sin(th))
    ctx.rotate(cima ? th + Math.PI / 2 : th - Math.PI / 2)
    pintarTexto(ctx, c, [...t][i], 0, 0)
    ctx.restore()
    s += larguras[i]
  }
}

/** Imagem (cover) dentro da caixa — caixa {foto} com URL na linha de dados. */
function imagemNaCaixa(ctx: CanvasRenderingContext2D, c: Caixa, img: HTMLImageElement) {
  const k = Math.max(c.w / img.naturalWidth, c.h / img.naturalHeight)
  const w = img.naturalWidth * k, h = img.naturalHeight * k
  ctx.save()
  ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip()
  ctx.drawImage(img, c.x + (c.w - w) / 2, c.y + (c.h - h) / 2, w, h)
  ctx.restore()
}

/** Carrega (com cache) as imagens das caixas {foto} de um conjunto de linhas. */
export async function carregarImagens(urls: string[], cache: Map<string, HTMLImageElement | null>) {
  await Promise.all(urls.filter(u => u && !cache.has(u)).map(u => new Promise<void>(res => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { cache.set(u, img); res() }
    img.onerror = () => { cache.set(u, null); res() }
    img.src = u
  })))
}

/** Desenha UMA arte completa no canvas (redimensiona o canvas para o tamanho do molde). */
export function renderizar(
  canvas: HTMLCanvasElement,
  molde: CanvasImageSource,
  cfg: ConfigTemplate,
  linha: Linha,
  resolverFonte: ResolverFonte,
  op: OpcoesRender = {},
): void {
  if (canvas.width !== cfg.largura) canvas.width = cfg.largura
  if (canvas.height !== cfg.altura) canvas.height = cfg.altura
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, cfg.largura, cfg.altura)
  const fundo = op.fundo || (op.fundoBrancoSeTransparente ? '#ffffff' : null)
  if (fundo) { ctx.fillStyle = fundo; ctx.fillRect(0, 0, cfg.largura, cfg.altura) }
  ctx.drawImage(molde, 0, 0, cfg.largura, cfg.altura)

  for (const c of cfg.caixas) {
    if (c.cobertura) cobrir(ctx, molde, cfg, c)
    desenharCaixa(ctx, c, linha, resolverFonte, op.imagens)
  }
}

/**
 * Desenha UMA caixa (texto ou {foto}) no contexto, no sistema de coordenadas atual — usada pelo
 * renderizador de template e pelas faces das caixas (Método Mãe), que já posicionam o contexto.
 */
export function desenharCaixa(ctx: CanvasRenderingContext2D, c: Caixa, linha: Linha, resolverFonte: ResolverFonte, imagens?: Map<string, HTMLImageElement | null>): void {
  ctx.save()
  if (c.rotacao) {
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2
    ctx.translate(cx, cy); ctx.rotate((c.rotacao * Math.PI) / 180); ctx.translate(-cx, -cy)
  }
  if (c.tipo === 'imagem') {
    const url = aplicar(c.texto, linha).trim()
    const img = url ? imagens?.get(url) : null
    if (img) imagemNaCaixa(ctx, c, img)
  } else {
    let t = aplicar(c.texto, linha)
    if (c.maiusculas) t = t.toLocaleUpperCase('pt-BR')
    if (t.trim()) {
      const fam = resolverFonte(c.fonte)
      const e = c.estilo
      if (e && (e.gradiente || e.chanfro || e.brilho)) textoEstilizado(ctx, c, t, fam)
      else if (c.curvatura && Math.abs(c.curvatura) >= 1) textoCurvo(ctx, c, t, fam)
      else textoReto(ctx, c, t, fam)
    }
  }
  ctx.restore()
}

/**
 * "Estilo de camada" do Photoshop no texto: brilho externo + sombra + contorno + preenchimento em
 * DEGRADÊ + CHANFRO interno. Desenha numa camada à parte (só a caixa + folga) e cola no lugar.
 */
function textoEstilizado(ctx: CanvasRenderingContext2D, c: Caixa, t: string, fam: string) {
  const e = c.estilo!
  const sb = c.sombra ? c.sombra.blur + Math.abs(c.sombra.dx) + Math.abs(c.sombra.dy) : 0
  const pad = Math.ceil(c.tamanho * 0.5 + (c.contorno?.largura || 0) * 2 + (e.brilho?.blur || 0) * 1.5 + sb)
  const W = Math.ceil(c.w + 2 * pad), H = Math.ceil(c.h + 2 * pad)
  const nova = () => { const k = document.createElement('canvas'); k.width = W; k.height = H; return k }
  const escrever = (alvo: HTMLCanvasElement, cc: Caixa) => {
    const g = alvo.getContext('2d')!
    if (cc.curvatura && Math.abs(cc.curvatura) >= 1) textoCurvo(g, cc, t, fam); else textoReto(g, cc, t, fam)
  }
  const local: Caixa = { ...c, x: pad, y: pad, rotacao: 0, sombra: null, contorno: null, estilo: null, cor: '#000000' }
  // 1) preenchimento (cor sólida ou degradê)
  const cheio = nova(); escrever(cheio, local)
  const gc = cheio.getContext('2d')!
  gc.globalCompositeOperation = 'source-in'
  if (e.gradiente) {
    const a = ((e.gradiente.angulo - 90) * Math.PI) / 180, r = Math.hypot(c.w, c.h) / 2, cx = W / 2, cy = H / 2
    const gr = gc.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    gr.addColorStop(0, e.gradiente.de); gr.addColorStop(1, e.gradiente.para); gc.fillStyle = gr
  } else gc.fillStyle = c.cor
  gc.fillRect(0, 0, W, H)
  gc.globalCompositeOperation = 'source-over'
  // 2) chanfro interno: faixa de luz no alto-esquerda e de sombra no baixo-direita, só dentro da letra
  if (e.chanfro && e.chanfro.intensidade > 0) {
    const d = Math.max(1, (c.tamanho * e.chanfro.tamanho) / 100)
    const faixa = (dx: number, dy: number, cor: string) => {
      const f = nova(), gf = f.getContext('2d')!
      gf.drawImage(cheio, 0, 0)
      gf.globalCompositeOperation = 'destination-out'; gf.drawImage(cheio, dx, dy)
      gf.globalCompositeOperation = 'source-in'; gf.fillStyle = cor; gf.fillRect(0, 0, W, H)
      return f
    }
    const luz = faixa(d, d, e.chanfro.luz), sombra = faixa(-d, -d, e.chanfro.sombra)
    gc.globalCompositeOperation = 'source-atop'; gc.globalAlpha = Math.min(1, e.chanfro.intensidade / 100)
    gc.drawImage(luz, 0, 0); gc.drawImage(sombra, 0, 0)
    gc.globalAlpha = 1; gc.globalCompositeOperation = 'source-over'
  }
  // 3) silhueta com contorno (base do brilho/sombra)
  let base: HTMLCanvasElement = cheio
  if (c.contorno && c.contorno.largura > 0) {
    base = nova(); escrever(base, { ...local, cor: c.contorno.cor, contorno: c.contorno })
  }
  const x0 = c.x - pad, y0 = c.y - pad
  const halo = (cor: string, blur: number, dx: number, dy: number) => {
    ctx.save(); ctx.shadowColor = cor; ctx.shadowBlur = blur; ctx.shadowOffsetX = 20000 + dx; ctx.shadowOffsetY = dy
    ctx.drawImage(base, x0 - 20000, y0); ctx.restore()
  }
  if (e.brilho) halo(e.brilho.cor, e.brilho.blur, 0, 0)
  if (c.sombra) halo(c.sombra.cor, c.sombra.blur, c.sombra.dx, c.sombra.dy)
  if (base !== cheio) ctx.drawImage(base, x0, y0)
  ctx.drawImage(cheio, x0, y0)
}

/** Garante que as fontes usadas estão carregadas antes de desenhar (senão sai na fonte padrão). */
export async function carregarFontes(cfg: ConfigTemplate, resolverFonte: ResolverFonte): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const pedidos = new Set<string>()
  for (const c of cfg.caixas) if (c.tipo === 'texto') pedidos.add(fontCss(c, 40, resolverFonte(c.fonte)))
  await Promise.all([...pedidos].map(f => document.fonts.load(f).catch(() => [])))
}
