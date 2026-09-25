// SOA Edition — MÉTODO MÃE: tema montado UMA vez por face (frente, laterais, trás, cima) e replicado em
// todas as caixas do kit. Aqui fica o desenho de cada molde com o tema + nome/idade (impressão) e a
// FOLHA DE APLIQUES (o que é aplique 3D não sai na caixa: vai numa folha PNG transparente à parte).
// Só navegador. O desenho do texto é o mesmo renderizador da Edição em massa (desenharCaixa).
import { desenharCaixa, type ResolverFonte } from './render'
import { novaCaixa, type Caixa, type Linha } from './tipos'
import { caminhoForma } from './montada'
import type { ElementoFace, FaceMolde, MoldeCaixa, MoldeCaixaDef, PosFace, TemaCaixas } from './caixasTipos'

export const DPI_IMPRESSAO = 300
export const mmParaPx = (mm: number, dpi = DPI_IMPRESSAO) => Math.round((mm / 25.4) * dpi)

/** Rasteriza o SVG do molde do acervo (impressão 300 dpi por padrão). */
export async function dieLineDoAcervo(def: MoldeCaixaDef, dpi = DPI_IMPRESSAO): Promise<HTMLCanvasElement> {
  const W = mmParaPx(def.larguraMm, dpi), H = mmParaPx(def.alturaMm, dpi)
  const url = URL.createObjectURL(new Blob([def.svg], { type: 'image/svg+xml' }))
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('molde')); i.src = url })
    const c = document.createElement('canvas'); c.width = W; c.height = H
    c.getContext('2d')!.drawImage(img, 0, 0, W, H)
    return c
  } finally { URL.revokeObjectURL(url) }
}

/** Elementos que valem para este molde + face (replicados na face-role, ou só desta caixa). */
export function elementosDaFace(tema: TemaCaixas, molde: Pick<MoldeCaixa, 'id' | 'faces'>, f: FaceMolde): ElementoFace[] {
  const principal = facePrincipal(molde.faces, f.role)?.id === f.id
  return tema.elementos.filter(e => e.role === f.role && (e.escopo === 'replicado' || e.moldeId === molde.id) && (e.tipo === 'papel' || principal))
}

/**
 * Face principal de um papel no molde (a maior): alguns moldes têm várias faces com o mesmo papel (os
 * oitões da Milk, a faixa da maleta coração). Papel digital cobre todas; elemento/texto vai só na principal.
 */
export function facePrincipal(faces: FaceMolde[], role: FaceMolde['role']): FaceMolde | undefined {
  let m: FaceMolde | undefined
  for (const f of faces) if (f.role === role && (!m || f.w * f.h > m.w * m.h)) m = f
  return m
}

/** Posição efetiva do elemento neste molde (padrão + ajuste fino da caixa). */
export const posNoMolde = (e: ElementoFace, moldeId: string): PosFace => ({ ...e.pos, ...(e.ajustes?.[moldeId] || {}) })

/** Tamanho do quadro EM PÉ da face (px) numa folha W×H. */
export function quadroFace(f: FaceMolde, W: number, H: number) {
  const fw = f.w * W, fh = f.h * H
  const deitada = f.rot === 90 || f.rot === 270
  return { cx: (f.x + f.w / 2) * W, cy: (f.y + f.h / 2) * H, uw: deitada ? fh : fw, uh: deitada ? fw : fh }
}

/** Caixa de texto (px no quadro em pé) a partir do campo normalizado da face. */
export function caixaDoTexto(e: ElementoFace, uw: number, uh: number, pos?: PosFace): Caixa {
  const t = e.texto!
  const k = pos && e.pos ? pos.escala / (e.pos.escala || 1) : 1   // ajuste de tamanho por caixa
  const dx = pos ? (pos.cx - e.pos.cx) * uw : 0, dy = pos ? (pos.cy - e.pos.cy) * uh : 0
  const w = t.w * uw * k, h = t.h * uh * k, u = (uh / 1000) * k
  const cx = (t.x + t.w / 2) * uw + dx, cy = (t.y + t.h / 2) * uh + dy
  return {
    ...novaCaixa(cx - w / 2, cy - h / 2, w, h, t.modelo),
    fonte: t.fonte, tamanho: Math.max(6, t.tamanho * uh * k), tamanhoMin: Math.max(6, t.tamanhoMin * uh * k), cor: t.cor,
    // espessuras em "milésimos da altura da face": prévia e impressão saem iguais
    negrito: t.negrito, curvatura: t.curvatura, autoAjuste: true,
    contorno: t.contorno ? { cor: t.contorno.cor, largura: t.contorno.largura * u } : null,
    sombra: t.sombra ? { cor: t.sombra.cor, blur: t.sombra.blur * u, dx: t.sombra.dx * u, dy: t.sombra.dy * u } : null,
    estilo: t.estilo ? { ...t.estilo, brilho: t.estilo.brilho ? { ...t.estilo.brilho, blur: t.estilo.brilho.blur * u } : null } : null,
    rotacao: pos?.rot || 0,
  }
}

export type Imagens = Map<string, HTMLImageElement | null>

/** Desenha um elemento no quadro em pé da face (origem no canto superior esquerdo do quadro). */
function desenharElemento(g: CanvasRenderingContext2D, e: ElementoFace, pos: PosFace, uw: number, uh: number, linha: Linha, fonte: ResolverFonte, imgs: Imagens) {
  if (e.tipo === 'texto' && e.texto) { desenharCaixa(g, caixaDoTexto(e, uw, uh, pos), linha, fonte); return }
  const img = e.url ? imgs.get(e.url) : null
  if (!img) return
  const iw = img.naturalWidth, ih = img.naturalHeight
  g.save()
  g.translate(pos.cx * uw, pos.cy * uh); g.rotate((pos.rot * Math.PI) / 180)
  if (e.tipo === 'papel') {
    // papel digital: cobre a face inteira (escala 1 = "cover"); o ajuste amplia/reduz a partir disso
    const k = Math.max(uw / iw, uh / ih) * (pos.escala || 1)
    g.drawImage(img, (-iw * k) / 2, (-ih * k) / 2, iw * k, ih * k)
  } else {
    const w = pos.escala * uw, h = (w / iw) * ih
    g.drawImage(img, -w / 2, -h / 2, w, h)
  }
  g.restore()
}

/**
 * Uma página de impressão: o molde com o tema em cada face + campos. Apliques ficam DE FORA (vão para
 * a folha). `dieLine` = imagem do molde (linhas) no tamanho W×H de saída.
 */
export function renderMoldeTema(p: {
  molde: MoldeCaixa; dieLine: CanvasImageSource; W: number; H: number; tema: TemaCaixas; linha: Linha
  fonte: ResolverFonte; imgs: Imagens; fundoBranco?: boolean; destacarFace?: string | null
}): HTMLCanvasElement {
  const { molde, W, H, tema } = p
  const out = document.createElement('canvas'); out.width = W; out.height = H
  const g = out.getContext('2d')!
  if (p.fundoBranco !== false) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H) }
  // molde próprio sem linhas vetoriais: a própria imagem é a base
  if (molde.tipo === 'proprio') g.drawImage(p.dieLine, 0, 0, W, H)
  for (const f of molde.faces) {
    const q = quadroFace(f, W, H)
    g.save()
    g.translate(q.cx, q.cy); g.rotate((-f.rot * Math.PI) / 180); g.translate(-q.uw / 2, -q.uh / 2)
    g.beginPath(); caminhoForma(g, f, q.uw, q.uh); g.clip()
    if (tema.fundo) { g.fillStyle = tema.fundo; g.fillRect(0, 0, q.uw, q.uh) }
    const els = elementosDaFace(tema, molde, f).filter(e => !e.aplique)
    const ordem = { papel: 0, imagem: 1, texto: 2 } as const
    for (const e of [...els].sort((a, b) => ordem[a.tipo] - ordem[b.tipo])) desenharElemento(g, e, posNoMolde(e, molde.id), q.uw, q.uh, p.linha, p.fonte, p.imgs)
    if (p.destacarFace === f.id) { g.fillStyle = 'rgba(249,115,22,0.18)'; g.fillRect(0, 0, q.uw, q.uh) }
    g.restore()
  }
  // linhas de corte/vinco por cima (acervo); molde próprio: reaplica as linhas escuras em "multiply"
  if (tema.linhas) { g.save(); g.globalCompositeOperation = 'multiply'; g.drawImage(p.dieLine, 0, 0, W, H); g.restore() }
  return out
}

/**
 * FOLHA DE APLIQUES: cada aplique de cada caixa (um por caixa — o replicado vira N apliques), no tamanho
 * real em que ficaria na face, arrumados em folhas A4 (300 dpi) de fundo TRANSPARENTE.
 */
export function folhaApliques(p: {
  moldes: { molde: MoldeCaixa; W: number; H: number }[]; tema: TemaCaixas; linha: Linha; fonte: ResolverFonte; imgs: Imagens
  folha?: { W: number; H: number }
}): HTMLCanvasElement[] {
  const pecas: HTMLCanvasElement[] = []
  for (const { molde, W, H } of p.moldes) for (const f of molde.faces) {
    const q = quadroFace(f, W, H)
    for (const e of elementosDaFace(p.tema, molde, f).filter(x => x.aplique)) {
      const pos = posNoMolde(e, molde.id)
      let c: HTMLCanvasElement | null = null
      if (e.tipo === 'texto' && e.texto) {
        const cx = caixaDoTexto(e, q.uw, q.uh, pos)
        const pad = Math.ceil(cx.tamanho * 0.6)
        c = document.createElement('canvas'); c.width = Math.ceil(cx.w + 2 * pad); c.height = Math.ceil(cx.h + 2 * pad)
        desenharCaixa(c.getContext('2d')!, { ...cx, x: pad, y: pad }, p.linha, p.fonte)
      } else if (e.url && p.imgs.get(e.url)) {
        const img = p.imgs.get(e.url)!
        const w = Math.round(pos.escala * q.uw), h = Math.round((w / img.naturalWidth) * img.naturalHeight)
        const r = (pos.rot * Math.PI) / 180, bw = Math.ceil(Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r))), bh = Math.ceil(Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)))
        c = document.createElement('canvas'); c.width = Math.max(1, bw); c.height = Math.max(1, bh)
        const g = c.getContext('2d')!; g.translate(bw / 2, bh / 2); g.rotate(r); g.drawImage(img, -w / 2, -h / 2, w, h)
      }
      if (c) pecas.push(aparar(c))
    }
  }
  if (!pecas.length) return []
  // prateleiras (maiores primeiro) em A4 retrato 300 dpi
  const FW = p.folha?.W || mmParaPx(210), FH = p.folha?.H || mmParaPx(297)
  const gap = mmParaPx(3), mg = mmParaPx(8)
  pecas.sort((a, b) => b.height - a.height)
  const folhas: HTMLCanvasElement[] = []
  let g: CanvasRenderingContext2D | null = null, x = mg, y = mg, alturaLinha = 0
  const novaFolha = () => { const f = document.createElement('canvas'); f.width = FW; f.height = FH; folhas.push(f); g = f.getContext('2d')!; x = mg; y = mg; alturaLinha = 0 }
  novaFolha()
  for (let pc of pecas) {
    const maxW = FW - 2 * mg, maxH = FH - 2 * mg
    if (pc.width > maxW || pc.height > maxH) { const k = Math.min(maxW / pc.width, maxH / pc.height); const r = document.createElement('canvas'); r.width = Math.floor(pc.width * k); r.height = Math.floor(pc.height * k); r.getContext('2d')!.drawImage(pc, 0, 0, r.width, r.height); pc = r }
    if (x + pc.width > FW - mg) { x = mg; y += alturaLinha + gap; alturaLinha = 0 }
    if (y + pc.height > FH - mg) novaFolha()
    g!.drawImage(pc, x, y)
    x += pc.width + gap; alturaLinha = Math.max(alturaLinha, pc.height)
  }
  return folhas
}

function aparar(c: HTMLCanvasElement): HTMLCanvasElement {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 4) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) return c
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1
  o.getContext('2d')!.drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height)
  return o
}

/** Nome do arquivo pela regra ({tema}_{nome}_{idade}) — sem acento/caractere estranho. */
export function nomeDaRegra(regra: string, v: { tema: string; nome: string; idade: string; molde?: string }): string {
  const t = (regra || '{tema}_{nome}_{idade}').replace(/\{(tema|nome|idade|molde)\}/g, (_, k: string) => (v as Record<string, string | undefined>)[k] || '')
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 90) || 'arte'
}

/** Pasta de saída: por data do dia (AAAA-MM-DD) ou pela categoria do tema. */
export function pastaDeSaida(modo: 'data' | 'categoria' | 'nenhuma', tema: TemaCaixas, hoje = new Date()): string {
  if (modo === 'nenhuma') return ''
  if (modo === 'categoria') return tema.categoria === 'temas-editados' ? 'Temas editados' : tema.categoria === 'temas-novos' ? 'Temas novos' : (tema.categoria || 'Temas')
  const sp = new Date(hoje.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  return `${sp.getFullYear()}-${String(sp.getMonth() + 1).padStart(2, '0')}-${String(sp.getDate()).padStart(2, '0')}`
}

/** URLs de imagem usadas pelo tema (para carregar antes de desenhar). */
export const urlsDoTema = (tema: TemaCaixas) => [...new Set(tema.elementos.map(e => e.url).filter((u): u is string => !!u))]

export async function carregarImagensTema(tema: TemaCaixas, cache: Imagens): Promise<void> {
  await Promise.all(urlsDoTema(tema).filter(u => !cache.has(u)).map(u => new Promise<void>(res => {
    const i = new Image(); i.crossOrigin = 'anonymous'
    i.onload = () => { cache.set(u, i); res() }; i.onerror = () => { cache.set(u, null); res() }
    i.src = u
  })))
}

/** Tema vazio para um kit. */
export const temaVazio = (moldeIds: string[]): TemaCaixas => ({ tipo: 'kit-caixas', versao: 1, moldeIds, elementos: [], fundo: '#ffffff', linhas: true, regraNome: '{tema}_{nome}_{idade}', categoria: 'temas-novos' })
