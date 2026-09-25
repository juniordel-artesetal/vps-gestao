// SOA Edition — ESTILOS DE CAMADA (modelo Photoshop), iguais em IMAGEM, FORMA e TEXTO: sombra projetada, sombra
// interna, brilho externo/interno, traçado (fora/dentro/centro), chanfro e entalhe, sobreposição de cor, de degradê e
// de textura, moldura. Cada um liga/desliga, edita, empilha (vários ao mesmo tempo) e pode ser reordenado.
// Não-destrutivo: o pixel/vetor original nunca é alterado — o estilo é desenhado por cima na hora de renderizar.
// 100% AUTORAL: as texturas (papel, kraft, tecido, linho) são GERADAS por código com ruído determinístico.
//
// Imagem: desenhado no pipeline da camada (lib/estudio/camadas), ao redor do conteúdo já ajustado/distorcido.
// Texto e forma: o mesmo motor roda sobre o cache do Fabric (vetor nítido em qualquer zoom/exportação).

export type Mistura = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light' | 'color-dodge' | 'color-burn'
  | 'darken' | 'lighten' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'
/** `off` = efeito guardado mas desligado (o "olhinho" do Photoshop). */
interface Liga { off?: boolean }
export interface Sombra extends Liga { cor: string; opacidade: number; desfoque: number; dx: number; dy: number; espalhar?: number; mistura?: Mistura }
export interface Brilho extends Liga { cor: string; opacidade: number; desfoque: number; espalhar?: number; mistura?: Mistura }
export interface BrilhoInterno extends Liga { cor: string; opacidade: number; desfoque: number; origem?: 'borda' | 'centro'; mistura?: Mistura }
export interface Contorno extends Liga { cor: string; largura: number; posicao?: 'fora' | 'dentro' | 'centro'; opacidade?: number; mistura?: Mistura }
export interface Chanfro extends Liga {
  estilo: 'interno' | 'externo' | 'relevo' | 'almofada'; tecnica?: 'suave' | 'cinzel'
  profundidade: number; direcao: 'cima' | 'baixo'; tamanho: number; suavizar: number; angulo: number; altitude: number
  corLuz: string; opLuz: number; corSombra: string; opSombra: number
}
export interface CorSobreposta extends Liga { cor: string; opacidade: number; mistura: Mistura }
export interface Degrade extends Liga {
  cores: { cor: string; pos: number }[]; angulo: number; escala: number; tipo: 'linear' | 'radial'
  opacidade: number; mistura: Mistura; inverter?: boolean
}
export interface Efeitos {
  sombra?: Sombra | null
  sombraInterna?: Sombra | null
  brilho?: Brilho | null
  brilhoInterno?: BrilhoInterno | null
  contorno?: Contorno | null
  chanfro?: Chanfro | null
  corSobreposta?: CorSobreposta | null
  degrade?: Degrade | null
  /** legado (antes de haver cor e degradê separados) — convertido por `normalizarEfeitos` */
  sobreposicao?: { tipo: 'cor' | 'gradiente'; cor: string; cor2: string; angulo: number; opacidade: number; mistura: 'normal' | 'multiply' | 'screen' | 'overlay' } & Liga | null
  textura?: { tipo: TipoTextura; intensidade: number } & Liga | null
  moldura?: { cor: string; largura: number; raio: number } & Liga | null
  /** Opacidade do PREENCHIMENTO (0–100): o conteúdo some, os estilos ficam (ex.: só o contorno do texto). */
  preenchimento?: number
  /** Ordem de empilhamento (de cima para baixo) — a lista do painel. */
  ordem?: ChaveEfeito[]
}
export type TipoTextura = 'papel' | 'kraft' | 'tecido' | 'linho' | 'granulado'
export type ChaveEfeito = 'chanfro' | 'contorno' | 'sombraInterna' | 'brilhoInterno' | 'corSobreposta' | 'degrade' | 'textura' | 'moldura' | 'brilho' | 'sombra'
/** Ordem padrão do Photoshop (de cima para baixo). */
export const ORDEM_PADRAO: ChaveEfeito[] = ['chanfro', 'contorno', 'sombraInterna', 'brilhoInterno', 'corSobreposta', 'degrade', 'textura', 'moldura', 'brilho', 'sombra']
export const NOMES_EFEITOS: Record<ChaveEfeito, string> = {
  chanfro: 'Chanfro e entalhe', contorno: 'Traçado (contorno)', sombraInterna: 'Sombra interna', brilhoInterno: 'Brilho interno',
  corSobreposta: 'Sobreposição de cor', degrade: 'Sobreposição de degradê', textura: 'Sobreposição de textura', moldura: 'Moldura / borda',
  brilho: 'Brilho externo', sombra: 'Sombra projetada',
}

/** Converte o formato antigo (uma "sobreposição" cor OU gradiente) no atual (cor E degradê independentes). */
export function normalizarEfeitos(e: Efeitos | null | undefined): Efeitos {
  if (!e) return {}
  const n: Efeitos = { ...e }
  if (n.sobreposicao) {
    const s = n.sobreposicao
    if (s.tipo === 'gradiente' && !n.degrade) n.degrade = { cores: [{ cor: s.cor, pos: 0 }, { cor: s.cor2, pos: 1 }], angulo: s.angulo, escala: 100, tipo: 'linear', opacidade: s.opacidade, mistura: s.mistura, off: s.off }
    else if (s.tipo === 'cor' && !n.corSobreposta) n.corSobreposta = { cor: s.cor, opacidade: s.opacidade, mistura: s.mistura, off: s.off }
    delete n.sobreposicao
  }
  return n
}
const ligado = <T extends Liga>(x: T | null | undefined): x is T => !!x && !x.off

export const semEfeitos = (e: Efeitos | null | undefined) => {
  if (!e) return true
  const n = normalizarEfeitos(e)
  return !(ORDEM_PADRAO.some(k => ligado(n[k] as Liga | null)) || (n.preenchimento !== undefined && n.preenchimento < 100))
}

export function rgba(cor: string, opacidade: number): string {
  const h = cor.replace('#', '')
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0')
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, opacidade / 100))})`
}
const rgbDe = (cor: string): [number, number, number] => {
  const h = cor.replace('#', ''), n = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0')
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}
/** Sombra/brilho: ângulo (°, de onde vem a luz, padrão Photoshop) + distância ↔ deslocamento. */
export const deslocamento = (angulo: number, distancia: number) => ({ dx: Math.round(-Math.cos((angulo * Math.PI) / 180) * distancia), dy: Math.round(Math.sin((angulo * Math.PI) / 180) * distancia) })
export const anguloDistancia = (dx: number, dy: number) => ({ angulo: Math.round(((Math.atan2(dy, -dx) * 180) / Math.PI + 360) % 360), distancia: Math.round(Math.hypot(dx, dy)) })

/** Valores padrão ao LIGAR um efeito no painel. */
export function efeitoPadrao(k: ChaveEfeito): NonNullable<Efeitos[ChaveEfeito]> {
  switch (k) {
    case 'sombra': return { cor: '#000000', opacidade: 45, desfoque: 10, ...deslocamento(120, 6), espalhar: 0, mistura: 'multiply' }
    case 'sombraInterna': return { cor: '#000000', opacidade: 45, desfoque: 8, ...deslocamento(120, 4), mistura: 'multiply' }
    case 'brilho': return { cor: '#fde68a', opacidade: 80, desfoque: 14, espalhar: 0, mistura: 'screen' }
    case 'brilhoInterno': return { cor: '#fff7d6', opacidade: 70, desfoque: 10, origem: 'borda', mistura: 'screen' }
    case 'contorno': return { cor: '#ffffff', largura: 6, posicao: 'fora', opacidade: 100, mistura: 'normal' }
    case 'chanfro': return { estilo: 'interno', tecnica: 'suave', profundidade: 100, direcao: 'cima', tamanho: 8, suavizar: 1, angulo: 120, altitude: 30, corLuz: '#ffffff', opLuz: 75, corSombra: '#000000', opSombra: 60 }
    case 'corSobreposta': return { cor: '#f97316', opacidade: 100, mistura: 'normal' }
    case 'degrade': return { cores: [{ cor: '#f5c542', pos: 0 }, { cor: '#b45309', pos: 1 }], angulo: 90, escala: 100, tipo: 'linear', opacidade: 100, mistura: 'normal' }
    case 'textura': return { tipo: 'papel', intensidade: 45 }
    case 'moldura': return { cor: '#ffffff', largura: 12, raio: 0 }
  }
}

// ── catálogo pronto (1 clique; tudo editável depois) ─────────────────────────────
export interface EfeitoPronto { id: string; nome: string; categoria: string; efeitos: Efeitos }
export const CATEGORIAS_EFEITOS = ['Texto', 'Sombras', 'Brilhos', 'Contornos', 'Cores', 'Texturas', 'Molduras', 'Combos'] as const

export const EFEITOS_PRONTOS: EfeitoPronto[] = [
  { id: 'txt-neon', nome: 'Neon', categoria: 'Texto', efeitos: { brilho: { cor: '#f97316', opacidade: 95, desfoque: 18 }, contorno: { cor: '#fff7ed', largura: 1 } } },
  { id: 'txt-neon-rosa', nome: 'Neon rosa', categoria: 'Texto', efeitos: { brilho: { cor: '#ec4899', opacidade: 95, desfoque: 18 }, contorno: { cor: '#fdf2f8', largura: 1 } } },
  { id: 'txt-bloco', nome: 'Bloco 3D', categoria: 'Texto', efeitos: { sombra: { cor: '#1f2937', opacidade: 100, desfoque: 0, dx: 5, dy: 5 } } },
  { id: 'txt-sombra-longa', nome: 'Sombra longa', categoria: 'Texto', efeitos: { sombra: { cor: '#000000', opacidade: 35, desfoque: 6, dx: 14, dy: 14 } } },
  { id: 'txt-adesivo', nome: 'Letra adesivo', categoria: 'Texto', efeitos: { contorno: { cor: '#ffffff', largura: 8 }, sombra: { cor: '#000000', opacidade: 30, desfoque: 8, dx: 0, dy: 4 } } },
  { id: 'txt-dourado', nome: 'Dourado', categoria: 'Texto', efeitos: { sobreposicao: { tipo: 'gradiente', cor: '#f5c542', cor2: '#b45309', angulo: 90, opacidade: 100, mistura: 'normal' } } },
  { id: 'sombra-suave', nome: 'Sombra suave', categoria: 'Sombras', efeitos: { sombra: { cor: '#000000', opacidade: 30, desfoque: 18, dx: 0, dy: 8 } } },
  { id: 'sombra-dura', nome: 'Sombra marcada', categoria: 'Sombras', efeitos: { sombra: { cor: '#000000', opacidade: 55, desfoque: 2, dx: 6, dy: 6 } } },
  { id: 'sombra-longa', nome: 'Sombra longa', categoria: 'Sombras', efeitos: { sombra: { cor: '#1f2937', opacidade: 35, desfoque: 30, dx: 18, dy: 24 } } },
  { id: 'sombra-interna', nome: 'Sombra interna', categoria: 'Sombras', efeitos: { sombraInterna: { cor: '#000000', opacidade: 45, desfoque: 14, dx: 4, dy: 4 } } },
  { id: 'brilho-laranja', nome: 'Neon laranja', categoria: 'Brilhos', efeitos: { brilho: { cor: '#f97316', opacidade: 85, desfoque: 22 } } },
  { id: 'brilho-dourado', nome: 'Brilho dourado', categoria: 'Brilhos', efeitos: { brilho: { cor: '#f5c542', opacidade: 80, desfoque: 18 } } },
  { id: 'brilho-branco', nome: 'Aura branca', categoria: 'Brilhos', efeitos: { brilho: { cor: '#ffffff', opacidade: 90, desfoque: 26 } } },
  { id: 'contorno-adesivo', nome: 'Adesivo (branco)', categoria: 'Contornos', efeitos: { contorno: { cor: '#ffffff', largura: 14 } } },
  { id: 'contorno-fino', nome: 'Fino preto', categoria: 'Contornos', efeitos: { contorno: { cor: '#111827', largura: 3 } } },
  { id: 'contorno-rosa', nome: 'Rosa grosso', categoria: 'Contornos', efeitos: { contorno: { cor: '#ec4899', largura: 10 } } },
  { id: 'cor-sepia', nome: 'Tom sépia', categoria: 'Cores', efeitos: { sobreposicao: { tipo: 'cor', cor: '#a0703c', cor2: '#a0703c', angulo: 0, opacidade: 35, mistura: 'multiply' } } },
  { id: 'grad-por-do-sol', nome: 'Pôr do sol', categoria: 'Cores', efeitos: { sobreposicao: { tipo: 'gradiente', cor: '#f97316', cor2: '#db2777', angulo: 45, opacidade: 45, mistura: 'overlay' } } },
  { id: 'grad-candy', nome: 'Candy', categoria: 'Cores', efeitos: { sobreposicao: { tipo: 'gradiente', cor: '#f9a8d4', cor2: '#93c5fd', angulo: 90, opacidade: 40, mistura: 'screen' } } },
  { id: 'tex-papel', nome: 'Papel', categoria: 'Texturas', efeitos: { textura: { tipo: 'papel', intensidade: 45 } } },
  { id: 'tex-kraft', nome: 'Kraft', categoria: 'Texturas', efeitos: { textura: { tipo: 'kraft', intensidade: 55 } } },
  { id: 'tex-tecido', nome: 'Tecido', categoria: 'Texturas', efeitos: { textura: { tipo: 'tecido', intensidade: 45 } } },
  { id: 'tex-linho', nome: 'Linho', categoria: 'Texturas', efeitos: { textura: { tipo: 'linho', intensidade: 40 } } },
  { id: 'tex-granulado', nome: 'Granulado', categoria: 'Texturas', efeitos: { textura: { tipo: 'granulado', intensidade: 35 } } },
  { id: 'mold-fina', nome: 'Moldura fina', categoria: 'Molduras', efeitos: { moldura: { cor: '#ffffff', largura: 12, raio: 0 } } },
  { id: 'mold-arred', nome: 'Arredondada', categoria: 'Molduras', efeitos: { moldura: { cor: '#ffffff', largura: 24, raio: 36 } } },
  { id: 'mold-escura', nome: 'Escura', categoria: 'Molduras', efeitos: { moldura: { cor: '#1f2937', largura: 18, raio: 8 } } },
  { id: 'combo-adesivo', nome: 'Adesivo com sombra', categoria: 'Combos', efeitos: { contorno: { cor: '#ffffff', largura: 16 }, sombra: { cor: '#000000', opacidade: 30, desfoque: 14, dx: 0, dy: 6 } } },
  { id: 'combo-polaroid', nome: 'Polaroid', categoria: 'Combos', efeitos: { moldura: { cor: '#fafafa', largura: 22, raio: 4 }, sombra: { cor: '#000000', opacidade: 28, desfoque: 16, dx: 0, dy: 8 } } },
]

// ── texturas geradas (determinísticas: mesmo tipo → mesma textura) ────────────────
function aleatorio(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const cacheTextura = new Map<string, HTMLCanvasElement>()

/** Ladrilho de textura em tons de cinza (claro = neutro), para mesclar por multiplicação. */
export function gerarTextura(tipo: TipoTextura, tam = 256): HTMLCanvasElement {
  const k = `${tipo}:${tam}`
  const ja = cacheTextura.get(k)
  if (ja) return ja
  const c = document.createElement('canvas'); c.width = c.height = tam
  const g = c.getContext('2d')!
  const img = g.createImageData(tam, tam)
  const r = aleatorio(tipo.length * 7919 + tam)
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    let v = 235
    const n = r()
    if (tipo === 'papel') v = 225 + n * 30
    else if (tipo === 'granulado') v = 200 + n * 55
    else if (tipo === 'kraft') v = 205 + n * 35 - ((Math.sin((x + y * 0.3) * 0.9) + 1) * 4)
    else if (tipo === 'tecido') v = 215 + n * 18 - ((x % 4 < 2) !== (y % 4 < 2) ? 22 : 0)
    else if (tipo === 'linho') v = 222 + n * 20 - ((x % 3 === 0) ? 14 : 0) - ((y % 5 === 0) ? 10 : 0)
    const i = (y * tam + x) * 4
    const b = Math.max(0, Math.min(255, v))
    img.data[i] = tipo === 'kraft' ? b : b; img.data[i + 1] = tipo === 'kraft' ? b * 0.86 : b; img.data[i + 2] = tipo === 'kraft' ? b * 0.68 : b; img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  if (tipo === 'kraft' || tipo === 'papel') { // fibras
    g.globalAlpha = 0.08; g.strokeStyle = '#000'
    for (let i = 0; i < 90; i++) { g.beginPath(); const x = r() * tam, y = r() * tam; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 8); g.stroke() }
    g.globalAlpha = 1
  }
  cacheTextura.set(k, c)
  return c
}

/** Quanto os efeitos "vazam" para fora do conteúdo (px) — o canvas cresce para caber. */
export function margemEfeitos(e0: Efeitos): number {
  const e = normalizarEfeitos(e0)
  let m = 0
  if (ligado(e.sombra)) m = Math.max(m, e.sombra.desfoque * 2 + Math.max(Math.abs(e.sombra.dx), Math.abs(e.sombra.dy)) + (e.sombra.espalhar || 0) / 100 * e.sombra.desfoque)
  if (ligado(e.brilho)) m = Math.max(m, e.brilho.desfoque * 2.2)
  if (ligado(e.contorno) && e.contorno.posicao !== 'dentro') m = Math.max(m, e.contorno.largura + 2)
  if (ligado(e.chanfro) && e.chanfro.estilo !== 'interno') m = Math.max(m, e.chanfro.tamanho + 2)
  if (ligado(e.moldura)) m = Math.max(m, e.moldura.largura)
  return Math.ceil(m)
}

// ── mapa de distância (EDT exata, Felzenszwalb) ────────────────────────────────────────────────
const INF = 1e20
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]) }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]] }
}
/** Distância (px) de cada pixel ao pixel "alvo" mais próximo. */
function distancia(alvo: (i: number) => boolean, W: number, H: number): Float32Array {
  const n = Math.max(W, H)
  const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1), v = new Int32Array(n)
  const g = new Float64Array(W * H)
  for (let i = 0; i < W * H; i++) g[i] = alvo(i) ? 0 : INF
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = g[y * W + x]; edt1d(f, H, d, v, z); for (let y = 0; y < H; y++) g[y * W + x] = d[y] }
  const out = new Float32Array(W * H)
  for (let y = 0; y < H; y++) { const o = y * W; for (let x = 0; x < W; x++) f[x] = g[o + x]; edt1d(f, W, d, v, z); for (let x = 0; x < W; x++) out[o + x] = Math.sqrt(d[x]) }
  return out
}
const novoCv = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c }
/** Pinta `cor` com alfa por pixel (0…1) num canvas W×H. */
function pintarAlfa(W: number, H: number, cor: string, alfa: (i: number) => number): HTMLCanvasElement {
  const c = novoCv(W, H), g = c.getContext('2d')!, img = g.createImageData(W, H), [r, gg, b] = rgbDe(cor)
  const d = img.data
  for (let i = 0; i < W * H; i++) { const a = alfa(i); if (a <= 0) continue; d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = Math.min(255, a * 255) }
  g.putImageData(img, 0, 0)
  return c
}
/** Blur de caixa (3 passadas ≈ gaussiano) num campo escalar. */
function borrar(a: Float32Array<ArrayBuffer>, W: number, H: number, r: number): Float32Array<ArrayBuffer> {
  if (r < 1) return a
  let src = a, dst = new Float32Array(W * H)
  for (let p = 0; p < 3; p++) {
    for (let y = 0; y < H; y++) { let s = 0; const o = y * W; for (let x = -r; x <= r; x++) s += src[o + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { dst[o + x] = s / (2 * r + 1); s += src[o + Math.min(W - 1, x + r + 1)] - src[o + Math.max(0, x - r)] } }
    ;[src, dst] = [dst, src]
    for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += src[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { dst[y * W + x] = s / (2 * r + 1); s += src[Math.min(H - 1, y + r + 1) * W + x] - src[Math.max(0, y - r) * W + x] } }
    ;[src, dst] = [dst, src]
  }
  return src
}
const cop = (m?: Mistura | string): GlobalCompositeOperation => (!m || m === 'normal' ? 'source-over' : m as GlobalCompositeOperation)
const um = (v: number) => Math.max(0, Math.min(1, v))

/**
 * Desenha os estilos ao redor/sobre `src` (w×h). Devolve o canvas maior e a margem usada.
 * `k` = px do alvo por px "de cena" (os estilos têm tamanho estável em qualquer resolução/zoom).
 */
export function aplicarEfeitosImagem(src: CanvasImageSource, w: number, h: number, e0: Efeitos, k = 1): { canvas: HTMLCanvasElement; pad: number } {
  const e = normalizarEfeitos(e0)
  const pad = Math.ceil(margemEfeitos(e) * k)
  const W = w + pad * 2, H = h + pad * 2
  const ordem = (e.ordem?.length ? [...e.ordem, ...ORDEM_PADRAO.filter(x => !e.ordem!.includes(x))] : ORDEM_PADRAO)
  const ativo = (x: ChaveEfeito) => ligado(e[x] as Liga | null)

  // conteúdo (com o canto arredondado da moldura, se houver)
  const corpo = novoCv(w, h), cg = corpo.getContext('2d')!
  if (ativo('moldura') && e.moldura!.raio > 0) { cg.beginPath(); cg.roundRect(0, 0, w, h, e.moldura!.raio * k); cg.clip() }
  cg.drawImage(src, 0, 0, w, h)
  // silhueta no canvas com margem (a forma que todos os estilos seguem)
  const sil = novoCv(W, H), sg = sil.getContext('2d')!
  sg.drawImage(corpo, pad, pad)
  const precisaMapa = ativo('contorno') || ativo('chanfro') || ativo('brilhoInterno') || (ativo('sombra') && (e.sombra!.espalhar || 0) > 0) || (ativo('brilho') && (e.brilho!.espalhar || 0) > 0)
  let dFora: Float32Array | null = null, dDentro: Float32Array | null = null
  if (precisaMapa) {
    const a = sg.getImageData(0, 0, W, H).data
    dFora = distancia(i => a[i * 4 + 3] >= 128, W, H)
    dDentro = distancia(i => a[i * 4 + 3] < 128, W, H)
  }
  /** silhueta engordada (espalhar) — para sombra/brilho com "espalhar" */
  const silhueta = (espalharPx: number) => (espalharPx > 0.5 && dFora ? pintarAlfa(W, H, '#000', i => um(espalharPx + 1 - dFora![i])) : sil)
  const offTela = 100000
  /** sombra/brilho pelo shadowBlur do canvas, desenhando a forma FORA da tela (só a sombra aparece) */
  const sombraDe = (s: HTMLCanvasElement, cor: string, op: number, desf: number, dx: number, dy: number, vezes = 1) => {
    const c = novoCv(W, H), g = c.getContext('2d')!
    g.shadowColor = rgba(cor, op); g.shadowBlur = desf * k; g.shadowOffsetX = offTela + dx * k; g.shadowOffsetY = dy * k
    for (let i = 0; i < vezes; i++) g.drawImage(s, -offTela, 0)
    // o contexto volta limpo: quem reusar o canvas (recorte na forma) não pode herdar a sombra fora da tela
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0
    return c
  }
  /** chanfro: mapa de altura → normal → luz; devolve [realce, sombra] recortados na região pedida */
  const chanfro = (regiao: 'dentro' | 'fora', tam: number): [HTMLCanvasElement, HTMLCanvasElement] => {
    const c = e.chanfro!, T = Math.max(1, tam * k)
    const dist = regiao === 'dentro' ? dDentro! : dFora!
    let alt: Float32Array<ArrayBuffer> = new Float32Array(W * H)
    for (let i = 0; i < W * H; i++) {
      let t = um(dist[i] / T)
      if (regiao === 'fora') t = dist[i] > T ? 0 : 1 - t
      alt[i] = c.tecnica === 'cinzel' ? t : 1 - (1 - t) * (1 - t)
    }
    alt = borrar(alt, W, H, Math.round((c.suavizar || 0) * k))
    const prof = (c.profundidade / 100) * T * (c.direcao === 'baixo' ? -1 : 1) * (regiao === 'fora' ? 1 : 1)
    const ang = (c.angulo * Math.PI) / 180, alti = (c.altitude * Math.PI) / 180
    const L = [Math.cos(alti) * Math.cos(ang) * -1, Math.cos(alti) * Math.sin(ang), Math.sin(alti)]   // luz vindo de `angulo`
    const plano = L[2]
    const luz = new Float32Array(W * H), sombra = new Float32Array(W * H)
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      const dentroReg = regiao === 'dentro' ? dist[i] > 0 && dist[i] <= T + 1 : dist[i] > 0 && dist[i] <= T + 1
      if (!dentroReg) continue
      const gx = (alt[i + 1] - alt[i - 1]) * prof / 2, gy = (alt[i + W] - alt[i - W]) * prof / 2
      const nl = Math.hypot(gx, gy, 1)
      const s = (-gx * -L[0] + -gy * L[1] + L[2]) / nl
      const dif = s - plano
      if (dif > 0) luz[i] = um(dif / Math.max(0.05, 1 - plano)); else sombra[i] = um(-dif / Math.max(0.05, plano))
    }
    return [pintarAlfa(W, H, c.corLuz, i => luz[i] * c.opLuz / 100), pintarAlfa(W, H, c.corSombra, i => sombra[i] * c.opSombra / 100)]
  }

  // ── EXTERNOS: atrás do conteúdo, de baixo para cima ──
  const out = novoCv(W, H), g = out.getContext('2d')!
  for (const x of [...ordem].reverse()) {
    if (!ativo(x)) continue
    if (x === 'sombra') {
      const s = e.sombra!
      g.globalCompositeOperation = cop(s.mistura === 'multiply' ? 'normal' : s.mistura)   // sobre o vazio, multiplicar = normal
      g.drawImage(sombraDe(silhueta(((s.espalhar || 0) / 100) * s.desfoque * k), s.cor, s.opacidade, s.desfoque * (1 - (s.espalhar || 0) / 100), s.dx, s.dy), 0, 0)
    } else if (x === 'brilho') {
      const b = e.brilho!
      g.globalCompositeOperation = cop(b.mistura === 'screen' ? 'normal' : b.mistura)
      g.drawImage(sombraDe(silhueta(((b.espalhar || 0) / 100) * b.desfoque * k), b.cor, b.opacidade, b.desfoque * (1 - (b.espalhar || 0) / 100), 0, 0, 2), 0, 0)
    } else if (x === 'contorno' && e.contorno!.posicao !== 'dentro') {
      const c = e.contorno!, L = (c.posicao === 'centro' ? c.largura / 2 : c.largura) * k
      g.globalCompositeOperation = cop(c.mistura)
      g.globalAlpha = um((c.opacidade ?? 100) / 100)
      g.drawImage(pintarAlfa(W, H, c.cor, i => (dFora![i] > 0 ? um(L + 1 - dFora![i]) : dDentro![i] <= 1.5 ? 1 : 0)), 0, 0)
      g.globalAlpha = 1
    } else if (x === 'chanfro' && e.chanfro!.estilo !== 'interno') {
      const t = e.chanfro!.estilo === 'externo' ? e.chanfro!.tamanho : e.chanfro!.tamanho / 2
      const [luz, som] = chanfro('fora', t)
      g.globalCompositeOperation = 'source-over'; g.drawImage(som, 0, 0); g.drawImage(luz, 0, 0)
    }
  }
  g.globalCompositeOperation = 'source-over'

  // ── INTERNOS: sobre o conteúdo, recortados na forma ──
  const inter = novoCv(W, H), ig = inter.getContext('2d')!
  ig.globalAlpha = um((e.preenchimento ?? 100) / 100)
  ig.drawImage(corpo, pad, pad)
  ig.globalAlpha = 1
  const naForma = (c: HTMLCanvasElement) => { const t = c.getContext('2d')!; t.save(); t.shadowColor = 'transparent'; t.globalCompositeOperation = 'destination-in'; t.drawImage(sil, 0, 0); t.restore(); return c }
  const sobre = (c: HTMLCanvasElement, m?: Mistura | string, op = 100) => { ig.save(); ig.globalCompositeOperation = cop(m); ig.globalAlpha = um(op / 100); ig.drawImage(naForma(c), 0, 0); ig.restore() }
  for (const x of [...ordem].reverse()) {
    if (!ativo(x)) continue
    if (x === 'textura') {
      const t = gerarTextura(e.textura!.tipo), c = novoCv(W, H), tg = c.getContext('2d')!
      tg.fillStyle = tg.createPattern(t, 'repeat')!; tg.fillRect(0, 0, W, H)
      sobre(c, 'multiply', e.textura!.intensidade)
    } else if (x === 'degrade') {
      const d = e.degrade!, c = novoCv(W, H), dg = c.getContext('2d')!
      const cx = W / 2, cy = H / 2, a = (d.angulo * Math.PI) / 180
      const L = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) * (d.escala / 100)
      const gr = d.tipo === 'radial'
        ? dg.createRadialGradient(cx, cy, 0, cx, cy, (Math.max(w, h) / 2) * (d.escala / 100))
        : dg.createLinearGradient(cx - (Math.cos(a) * L) / 2, cy + (Math.sin(a) * L) / 2, cx + (Math.cos(a) * L) / 2, cy - (Math.sin(a) * L) / 2)
      const cores = d.inverter ? [...d.cores].reverse().map(p => ({ ...p, pos: 1 - p.pos })) : d.cores
      for (const p of cores) gr.addColorStop(um(p.pos), p.cor)
      dg.fillStyle = gr; dg.fillRect(0, 0, W, H)
      sobre(c, d.mistura, d.opacidade)
    } else if (x === 'corSobreposta') {
      const s = e.corSobreposta!, c = novoCv(W, H), dg = c.getContext('2d')!
      dg.fillStyle = s.cor; dg.fillRect(0, 0, W, H)
      sobre(c, s.mistura, s.opacidade)
    } else if (x === 'brilhoInterno') {
      const b = e.brilhoInterno!, T = Math.max(1, b.desfoque * k)
      const c = pintarAlfa(W, H, b.cor, i => (dDentro![i] > 0 ? (b.origem === 'centro' ? um(dDentro![i] / T) : 1 - um(dDentro![i] / T)) : 0))
      sobre(c, b.mistura === 'screen' ? 'screen' : b.mistura, b.opacidade)
    } else if (x === 'sombraInterna') {
      const s = e.sombraInterna!
      // sombra do "furo" (o avesso da forma), recortada dentro da forma
      const inv = novoCv(W, H), vg = inv.getContext('2d')!
      vg.fillStyle = '#000'; vg.fillRect(0, 0, W, H); vg.globalCompositeOperation = 'destination-out'; vg.drawImage(sil, 0, 0)
      sobre(sombraDe(inv, s.cor, 100, s.desfoque, s.dx, s.dy), s.mistura || 'multiply', s.opacidade)
    } else if (x === 'contorno' && e.contorno!.posicao !== 'fora') {
      const c = e.contorno!, L = (c.posicao === 'centro' ? c.largura / 2 : c.largura) * k
      sobre(pintarAlfa(W, H, c.cor, i => (dDentro![i] > 0 ? um(L + 1 - dDentro![i]) : 0)), c.mistura, c.opacidade ?? 100)
    } else if (x === 'chanfro' && e.chanfro!.estilo !== 'externo') {
      const c = e.chanfro!
      const [luz, som] = chanfro('dentro', c.estilo === 'interno' ? c.tamanho : c.tamanho / 2)
      if (c.estilo === 'almofada') { sobre(luz, 'multiply', 100); sobre(som, 'screen', 100) } else { sobre(som, 'multiply', 100); sobre(luz, 'screen', 100) }
    } else if (x === 'moldura') {
      const m = e.moldura!, lw = m.largura * k, r = m.raio * k
      ig.save(); ig.strokeStyle = m.cor; ig.lineWidth = lw * 2
      ig.beginPath(); if (r > 0) ig.roundRect(pad, pad, w, h, r); else ig.rect(pad, pad, w, h); ig.stroke(); ig.restore()
    }
  }
  g.drawImage(inter, 0, 0)
  return { canvas: out, pad }
}

/** Multiplica tamanhos/distâncias dos estilos (ex.: PSD importado reduzido para caber no design). */
export function escalarEfeitos(e: Efeitos, k: number): Efeitos {
  const n = normalizarEfeitos(structuredClone(e))
  const px = (v: number) => Math.round(v * k * 100) / 100
  if (n.sombra) Object.assign(n.sombra, { desfoque: px(n.sombra.desfoque), dx: px(n.sombra.dx), dy: px(n.sombra.dy) })
  if (n.sombraInterna) Object.assign(n.sombraInterna, { desfoque: px(n.sombraInterna.desfoque), dx: px(n.sombraInterna.dx), dy: px(n.sombraInterna.dy) })
  if (n.brilho) n.brilho.desfoque = px(n.brilho.desfoque)
  if (n.brilhoInterno) n.brilhoInterno.desfoque = px(n.brilhoInterno.desfoque)
  if (n.contorno) n.contorno.largura = px(n.contorno.largura)
  if (n.chanfro) Object.assign(n.chanfro, { tamanho: px(n.chanfro.tamanho), suavizar: px(n.chanfro.suavizar) })
  if (n.moldura) Object.assign(n.moldura, { largura: px(n.moldura.largura), raio: px(n.moldura.raio) })
  return n
}

// ── LEITURA DO PSD (ag-psd `layer.effects`) → estilos ─────────────────────────────────────────────
type CorPsd = { r?: number; g?: number; b?: number; fr?: number; fg?: number; fb?: number } | undefined
type UnPsd = { value?: number } | undefined
const hexPsd = (c: CorPsd, padrao = '#000000') => {
  if (!c) return padrao
  const r = c.r ?? (c.fr !== undefined ? c.fr * 255 : undefined), g = c.g ?? (c.fg !== undefined ? c.fg * 255 : undefined), b = c.b ?? (c.fb !== undefined ? c.fb * 255 : undefined)
  if (r === undefined || g === undefined || b === undefined) return padrao
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}
const MISTURAS_PSD: Record<string, Mistura> = {
  normal: 'normal', multiply: 'multiply', screen: 'screen', overlay: 'overlay', 'soft light': 'soft-light', 'hard light': 'hard-light',
  'color dodge': 'color-dodge', 'color burn': 'color-burn', darken: 'darken', lighten: 'lighten', difference: 'difference', exclusion: 'exclusion',
  hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity', 'linear dodge': 'screen', 'linear burn': 'multiply',
}
const mistPsd = (m: unknown, padrao: Mistura = 'normal'): Mistura => MISTURAS_PSD[String(m || '').toLowerCase()] || padrao
const op = (v: unknown) => Math.round((typeof v === 'number' ? (v <= 1 ? v * 100 : v) : 100))
const val = (u: UnPsd, p = 0) => (typeof u?.value === 'number' ? u.value : p)

/** Estilos de camada do PSD (ag-psd) no modelo do SOA. `anguloGlobal` = luz global do documento. */
export function efeitosDoPsd(fx: Record<string, any> | undefined | null, anguloGlobal = 120): Efeitos | null {   // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!fx || fx.disabled) return null
  const e: Efeitos = {}
  const desligado = (x: { enabled?: boolean } | undefined) => x?.enabled === false
  const ang = (x: { angle?: number; useGlobalLight?: boolean }) => (x.useGlobalLight !== false && x.useGlobalLight !== undefined ? anguloGlobal : x.angle ?? anguloGlobal)
  const ds = fx.dropShadow?.find((x: { enabled?: boolean }) => x.enabled !== false) || fx.dropShadow?.[0]
  if (ds) e.sombra = { cor: hexPsd(ds.color), opacidade: op(ds.opacity), desfoque: val(ds.size), ...deslocamento(ang(ds), val(ds.distance)), espalhar: val(ds.choke), mistura: mistPsd(ds.blendMode, 'multiply'), off: desligado(ds) }
  const is = fx.innerShadow?.find((x: { enabled?: boolean }) => x.enabled !== false) || fx.innerShadow?.[0]
  if (is) e.sombraInterna = { cor: hexPsd(is.color), opacidade: op(is.opacity), desfoque: val(is.size), ...deslocamento(ang(is), val(is.distance)), mistura: mistPsd(is.blendMode, 'multiply'), off: desligado(is) }
  if (fx.outerGlow) { const o = fx.outerGlow; e.brilho = { cor: hexPsd(o.color, '#ffffbe'), opacidade: op(o.opacity), desfoque: val(o.size), espalhar: val(o.choke), mistura: mistPsd(o.blendMode, 'screen'), off: desligado(o) } }
  if (fx.innerGlow) { const o = fx.innerGlow; e.brilhoInterno = { cor: hexPsd(o.color, '#ffffbe'), opacidade: op(o.opacity), desfoque: val(o.size), origem: o.source === 'center' ? 'centro' : 'borda', mistura: mistPsd(o.blendMode, 'screen'), off: desligado(o) } }
  const st = fx.stroke?.find((x: { enabled?: boolean }) => x.enabled !== false) || fx.stroke?.[0]
  if (st) {
    const corSt = st.fillType === 'gradient' && st.gradient?.colorStops?.length ? hexPsd(st.gradient.colorStops[0].color) : hexPsd(st.color)
    e.contorno = { cor: corSt, largura: val(st.size, 3), posicao: st.position === 'inside' ? 'dentro' : st.position === 'center' ? 'centro' : 'fora', opacidade: op(st.opacity), mistura: mistPsd(st.blendMode), off: desligado(st) }
  }
  if (fx.bevel) {
    const b = fx.bevel
    e.chanfro = {
      estilo: b.style === 'outer bevel' ? 'externo' : b.style === 'emboss' ? 'relevo' : b.style === 'pillow emboss' ? 'almofada' : 'interno',
      tecnica: /chisel/.test(String(b.technique || '')) ? 'cinzel' : 'suave', profundidade: op(b.strength), direcao: b.direction === 'down' ? 'baixo' : 'cima',
      tamanho: val(b.size, 5), suavizar: val(b.soften), angulo: ang(b), altitude: b.altitude ?? 30,
      corLuz: hexPsd(b.highlightColor, '#ffffff'), opLuz: op(b.highlightOpacity), corSombra: hexPsd(b.shadowColor), opSombra: op(b.shadowOpacity), off: desligado(b),
    }
  }
  const sf = fx.solidFill?.find((x: { enabled?: boolean }) => x.enabled !== false) || fx.solidFill?.[0]
  if (sf) e.corSobreposta = { cor: hexPsd(sf.color), opacidade: op(sf.opacity), mistura: mistPsd(sf.blendMode), off: desligado(sf) }
  const go = fx.gradientOverlay?.find((x: { enabled?: boolean }) => x.enabled !== false) || fx.gradientOverlay?.[0]
  if (go?.gradient?.colorStops?.length) {
    const stops = (go.gradient.colorStops as { color: CorPsd; location: number }[])
    const maxLoc = Math.max(1, ...stops.map(s => s.location || 0))
    e.degrade = {
      cores: stops.map(s => ({ cor: hexPsd(s.color), pos: (s.location || 0) / (maxLoc > 1 ? 4096 : 1) })),
      angulo: go.angle ?? 90, escala: go.scale !== undefined ? op(go.scale) : 100, tipo: go.type === 'radial' ? 'radial' : 'linear',
      opacidade: op(go.opacity), mistura: mistPsd(go.blendMode), inverter: !!go.reverse, off: desligado(go),
    }
  }
  return semEfeitos(e) ? null : e
}
