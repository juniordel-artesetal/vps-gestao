// SOA Edition — RENDERIZADOR ÚNICO (só navegador). A prévia do editor e o lote usam esta
// mesma função: o que a artesã vê no editor é exatamente o que sai no arquivo.
//
// Tudo em pixels do molde original. Canvas 2D puro (sem Fabric) para ser rápido e previsível.
import { aplicar, type Caixa, type ConfigTemplate, type Linha } from './tipos'

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
    if (!c.autoAjuste || (larg <= c.w && alt <= c.h) || px <= 6) break
    px = Math.max(6, Math.floor(px * 0.93))
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
    if (!c.autoAjuste || (corda <= c.w && flecha <= c.h) || px <= 6) break
    px = Math.max(6, Math.floor(px * 0.93))
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
    ctx.save()
    if (c.tipo === 'imagem') {
      const url = aplicar(c.texto, linha).trim()
      const img = url ? op.imagens?.get(url) : null
      if (img) imagemNaCaixa(ctx, c, img)
    } else {
      let t = aplicar(c.texto, linha)
      if (c.maiusculas) t = t.toLocaleUpperCase('pt-BR')
      if (t.trim()) {
        const fam = resolverFonte(c.fonte)
        if (c.curvatura && Math.abs(c.curvatura) >= 1) textoCurvo(ctx, c, t, fam)
        else textoReto(ctx, c, t, fam)
      }
    }
    ctx.restore()
  }
}

/** Garante que as fontes usadas estão carregadas antes de desenhar (senão sai na fonte padrão). */
export async function carregarFontes(cfg: ConfigTemplate, resolverFonte: ResolverFonte): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const pedidos = new Set<string>()
  for (const c of cfg.caixas) if (c.tipo === 'texto') pedidos.add(fontCss(c, 40, resolverFonte(c.fonte)))
  await Promise.all([...pedidos].map(f => document.fonts.load(f).catch(() => [])))
}
