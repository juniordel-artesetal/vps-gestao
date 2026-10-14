// mae-texto — DIAGRAMAÇÃO do nome numa posição (Sprint 7): caixa alta/baixa, nome simples × composto
// (1 ou 2 linhas, quebra equilibrada), alinhamento, tracking, kerning, entrelinha, escala, linha de base,
// texto em curva e AUTO-AJUSTE (reduz o tamanho até 70%, depois o tracking; se ainda não couber,
// "revisar"). Sai uma lista de comandos de caminho em mm, com origem no canto superior esquerdo da
// caixa — o motor desenha esse caminho (tela = arquivo).
import { moldar, type Cmd, type EscolhaMoldar, type FonteHB, type GlifoMoldado } from './fonte'

export interface EstiloDiagrama {
  caixa?: 'normal' | 'alta' | 'baixa'
  align?: 'left' | 'center' | 'right'
  tracking?: number
  kerning?: boolean
  lineHeight?: number
  scaleX?: number
  scaleY?: number
  baselineMm?: number
  curveRadiusMm?: number
  features?: string[]
  glyphChoices?: ({ index: number; char: string; kind: 'feature'; tag: string; value: number } | { index: number; char: string; kind: 'unicode'; cp: number } | { index: number; char: string; kind: 'glyph'; gid: number })[]
  /** Lote 5 (item 75): trocar uma letra por outra fonte ou outro glifo (ver EstiloTexto.trocas). */
  trocas?: TrocaLetra[]
  /** Lote 10 (item 163): MONTAR ACENTOS que a fonte não tem (ligado por padrão). */
  acentos?: AcentosMontados
}
/** Letra acentuada que a fonte não tem = a letra base da fonte + o acento (da própria fonte, ou da fonte dos acentos). */
export interface AcentosMontados { ligado?: boolean; fonte?: { postscriptName: string }; escala?: number; alturaMm?: number; dxMm?: number }
export interface TrocaLetra { letra: string; so?: 'inicial' | 'todas'; fonte?: { postscriptName: string }; gid?: number; escala?: number; baselineMm?: number; espacoMm?: number }
/** Glifo moldado com, opcionalmente, a fonte da troca e o ajuste fino (Lote 5, item 75). */
type Glifo = GlifoMoldado & { f?: FonteHB; esc?: number; dy?: number; esp?: number; acento?: true; dx?: number; base?: Glifo }
/** Fontes das trocas de letra (já carregadas), pelo nome técnico. */
export type OutraFonte = (postscriptName: string) => FonteHB | undefined
export interface ConfigPosicao {
  single?: { lines: 1 | 2; sizePt: number; lineHeight?: number; dx?: number; dy?: number }
  compound?: { lines: 1 | 2; sizePt: number; lineHeight?: number; dx?: number; dy?: number }
  autoFit?: { minScale: number }
}
export interface ResultadoTexto {
  cmds: Cmd[]
  bbox: [number, number, number, number]
  linhas: string[]
  composto: boolean
  /** Escala do tamanho aplicada pelo auto-ajuste (1 = tamanho pedido). */
  escala: number
  trackingFinal: number
  revisar: boolean
  aviso: string | null
  /** Lote 12 (item 171): letra trocada que não pôde ser aplicada (tem prioridade sobre os outros avisos). */
  avisoTroca?: string | null
  /** Lote 13 (item 185): o lado da área que segurou o nome (no tamanho pedido ele não cabia). */
  limite?: 'largura' | 'altura' | null
}

export const MM_POR_PT = 25.4 / 72
const TRACK_MIN = -120

/** Aplica caixa e as escolhas de glifo do Unicode privado (trocar a letra pelo glifo escolhido). */
export function prepararTexto(valor: string, e: EstiloDiagrama): string {
  let t = valor.replace(/\s+/g, ' ').trim()
  if (e.caixa === 'alta') t = t.toLocaleUpperCase('pt-BR')
  else if (e.caixa === 'baixa') t = t.toLocaleLowerCase('pt-BR')
  const chars = [...t]
  for (const c of e.glyphChoices ?? []) if (c.kind === 'unicode' && chars[c.index] === c.char) chars[c.index] = String.fromCodePoint(c.cp)
  return chars.join('')
}

export const ehComposto = (t: string) => t.trim().split(/\s+/).filter(Boolean).length >= 2

/** Lote 4 (item 50): partículas que ficam com o nome seguinte na quebra ("Maria" / "de Fátima"). */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', "d'", 'di', 'del', 'van', 'von'])
export const ehParticula = (p: string) => PARTICULAS.has(p.toLocaleLowerCase('pt-BR'))

// ── Lote 10 (item 163): acentos montados ──
/** Acento combinante → glifos que servem de acento (o combinante, o "modificador" e o solto do teclado). */
const ACENTO_GLIFOS: Record<number, number[]> = {
  0x0301: [0x0301, 0x02ca, 0x00b4], 0x0300: [0x0300, 0x02cb, 0x0060], 0x0302: [0x0302, 0x02c6, 0x005e], 0x0303: [0x0303, 0x02dc, 0x007e],
  0x0308: [0x0308, 0x00a8], 0x0327: [0x0327, 0x00b8], 0x030a: [0x030a, 0x02da, 0x00b0], 0x030c: [0x030c, 0x02c7], 0x0304: [0x0304, 0x02c9, 0x00af],
}
const ABAIXO = new Set([0x0327])
const temCp = (f: FonteHB, cp: number) => f.unicodes.has(cp)
/**
 * Lote 13 (item 180): a fonte TEM a letra de verdade — declarada E com desenho. Fontes DEMO costumam declarar o "ê"
 * com o glifo VAZIO: antes o MAE acreditava na tabela, não avisava nem montava o acento (a letra sumia na arte).
 */
export function temGlifo(f: FonteHB, cp: number): boolean {
  if (!f.unicodes.has(cp)) return false
  const gid = f.font.glyph?.(cp) ?? 0
  return !!gid && f.contorno(gid).length > 0
}
/** Lote 13 (item 180): as letras acentuadas do português (o teste ao escolher a fonte do tema). */
export const LETRAS_ACENTUADAS_PT = 'áéíóúàâêôãõçÁÉÍÓÚÀÂÊÔÃÕÇ'
/** A letra que FALTA na fonte e dá para montar: [base, acento]. HarfBuzz já resolve quando a fonte tem o acento combinante. */
function decompor(f: FonteHB, c: string): [string, number] | null {
  const cp = c.codePointAt(0) ?? 0
  if (cp < 0xc0 || temGlifo(f, cp)) return null
  const d = [...c.normalize('NFD')]
  if (d.length !== 2) return null
  const marca = d[1].codePointAt(0) ?? 0
  if (!ACENTO_GLIFOS[marca] || !temGlifo(f, d[0].codePointAt(0) ?? 0)) return null
  // o HarfBuzz decompõe e posiciona pela própria fonte (âncoras) — só se a letra NÃO estiver declarada (vazia, ele não
  // decompõe: usa o glifo vazio) e o combinante tiver desenho
  if (!temCp(f, cp) && temGlifo(f, marca)) return null
  return [d[0] === 'i' && temCp(f, 0x131) ? 'ı' : d[0], marca]
}
/** Letras do texto que a fonte não tem (sem contar espaço). Para o aviso no painel e na edição em massa. */
export function letrasSemGlifo(f: FonteHB, texto: string): string[] {
  return [...new Set([...texto].filter(c => c.trim() && !temGlifo(f, c.codePointAt(0) ?? 0) && !(decompor(f, c) === null && !temCp(f, c.codePointAt(0) ?? 0) && [...c.normalize('NFD')].length === 2 && [...c.normalize('NFD')].every(x => temGlifo(f, x.codePointAt(0) ?? 0)))))]
}
/** Letras que dá para montar com a fonte (e a dos acentos, se houver). */
export function letrasMontaveis(f: FonteHB, texto: string, fa?: FonteHB): string[] {
  return letrasSemGlifo(f, texto).filter(c => { const d = decompor(f, c); return !!d && !!glifoDoAcento([fa, f], d[1]) })
}
function glifoDoAcento(fontes: (FonteHB | undefined)[], marca: number): { fa: FonteHB; gid: number } | null {
  for (const fa of fontes) {
    if (!fa) continue
    for (const cp of ACENTO_GLIFOS[marca] ?? []) {
      if (!temGlifo(fa, cp)) continue
      const gid = fa.font.glyph?.(cp) ?? 0
      if (gid && fa.contorno(gid).length) return { fa, gid }
    }
  }
  return null
}
function caixaDoGlifo(f: FonteHB, gid: number): [number, number, number, number] | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const c of f.contorno(gid)) for (let i = 1; i < c.length; i += 2) { const x = c[i] as number, y = c[i + 1] as number; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return isFinite(x0) ? [x0, y0, x1, y1] : null
}

/** Molda a linha; a letra acentuada que a fonte não tem sai MONTADA (letra base + acento por cima/baixo). */
function moldarLinha(f: FonteHB, texto: string, e: EstiloDiagrama, desloc: number, outra?: OutraFonte): Glifo[] {
  if (e.acentos?.ligado === false) return moldarLinhaBase(f, texto, e, desloc, outra)
  const montar = new Map<number, number>()
  let texto2 = ''
  ;[...texto].forEach((c, i) => {
    const d = (e.trocas ?? []).some(t => t.letra === c) ? null : decompor(f, c)
    if (d && c.length === 1) { montar.set(i, d[1]); texto2 += d[0] } else texto2 += c
  })
  if (!montar.size || texto2.length !== texto.length) return moldarLinhaBase(f, texto, e, desloc, outra)
  const g = moldarLinhaBase(f, texto2, e, desloc, outra)
  const a = e.acentos ?? {}
  const fa = a.fonte && outra ? outra(a.fonte.postscriptName) : undefined
  const k = a.escala ?? 1
  const out: Glifo[] = []
  const feitos = new Set<number>()
  for (const gl of g) {
    const marca = montar.get(gl.cluster)
    if (marca !== undefined && !feitos.has(gl.cluster)) {
      feitos.add(gl.cluster)
      const F = gl.f ?? f
      const ac = glifoDoAcento([fa, F, f], marca)
      const cb = caixaDoGlifo(F, gl.gid), ca = ac ? caixaDoGlifo(ac.fa, ac.gid) : null
      if (ac && cb && ca) {
        // posição em unidades do acento: centro sobre o centro da letra; logo acima do topo (ou abaixo, na cedilha)
        const rb = (gl.esc ?? 1) / F.upem, ra = k / ac.fa.upem
        const xOff = (((cb[0] + cb[2]) / 2 + gl.xOff) * rb) / ra - (ca[0] + ca[2]) / 2
        const yOff = ABAIXO.has(marca)
          ? ((Math.min(cb[1], 0) + gl.yOff + 0.04 * F.upem) * rb) / ra - ca[3]
          : ((cb[3] + gl.yOff + 0.06 * F.upem) * rb) / ra - ca[1]
        out.push({ gid: ac.gid, cluster: gl.cluster, xAdv: 0, xOff, yOff, f: ac.fa, esc: k, dy: (gl.dy ?? 0) + (a.alturaMm ?? 0), dx: a.dxMm, acento: true, base: gl })
      }
    }
    out.push(gl)
  }
  return out
}

// ── Lote 12 (item 171): letra trocada para outra fonte ──
const alturas = new WeakMap<FonteHB, Map<string, number | null>>()
/** Altura (fração do em) do topo da letra de referência: "x" para minúscula, "H" para maiúscula. */
function alturaRef(f: FonteHB, ref: string): number | null {
  let m = alturas.get(f)
  if (!m) { m = new Map(); alturas.set(f, m) }
  if (!m.has(ref)) {
    const gid = f.font.glyph?.(ref.codePointAt(0) ?? 0) ?? 0
    const cx = gid ? caixaDoGlifo(f, gid) : null
    m.set(ref, cx && cx[3] > 0 ? cx[3] / f.upem : null)
  }
  return m.get(ref) ?? null
}
/** Escala que deixa a letra da outra fonte da MESMA altura visual das letras do nome. */
function fatorAltura(f: FonteHB, fi: FonteHB, c: string): number {
  // referência: a letra-base (o "e" do "ê") nas duas fontes; senão "x" (minúscula) / "H" (maiúscula)
  const baseLetra = [...c.normalize('NFD')][0] ?? c
  const refs = [baseLetra, c !== c.toLocaleLowerCase('pt-BR') ? 'H' : 'x']
  for (const ref of refs) {
    const a = alturaRef(f, ref), b = alturaRef(fi, ref)
    if (a && b) return Math.max(0.5, Math.min(2, a / b))
  }
  return 1
}
/** Troca que não dá para aplicar (fonte não carregou / a outra fonte também não tem a letra) — nunca em silêncio. */
export function problemaDasTrocas(texto: string, e: EstiloDiagrama, outra?: OutraFonte): string | null {
  for (const t of e.trocas ?? []) {
    if (!t.fonte || !texto.includes(t.letra)) continue
    const nome = (t.fonte as { family?: string }).family || t.fonte.postscriptName
    const fi = outra?.(t.fonte.postscriptName)
    if (!fi) return `a letra "${t.letra}" (${nome}) não carregou — revisar`
    const cp = t.letra.codePointAt(0) ?? 0
    const partes = [...t.letra.normalize('NFD')].map(x => x.codePointAt(0) ?? 0)
    if (!temGlifo(fi, cp) && !partes.every(p => temGlifo(fi, p))) return `a fonte ${nome} também não tem "${t.letra}" — escolha outra`
  }
  return null
}

/** Molda a linha com caixa, escolhas de glifo e trocas de letra (sem montar acentos). */
function moldarLinhaBase(f: FonteHB, texto: string, e: EstiloDiagrama, desloc: number, outra?: OutraFonte): Glifo[] {
  // as escolhas por recurso valem pela posição no texto INTEIRO: desloca para a linha
  const escolhas = (e.glyphChoices ?? []).filter(c => c.kind === 'feature' || c.kind === 'glyph').map(c => ({ ...c, index: c.index - desloc })).filter(c => c.index >= 0 && c.index < texto.length) as EscolhaMoldar[]
  // Lote 5 (item 75): a troca vale na letra igual (como digitada); "inicial" = 1ª letra de cada palavra
  const trocaEm = (i: number): TrocaLetra | null => {
    for (const t of e.trocas ?? []) if (texto[i] === t.letra && (t.so !== 'inicial' || i === 0 || texto[i - 1] === ' ')) return t
    return null
  }
  const trocas = [...texto].map((_, i) => trocaEm(i))
  // outro glifo da MESMA fonte = uma escolha de glifo naquela posição
  trocas.forEach((t, i) => { if (t?.gid && !t.fonte && !escolhas.some(c => c.index === i)) escolhas.push({ index: i, char: texto[i], kind: 'glyph', gid: t.gid }) })
  const fonteDa = (t: TrocaLetra | null) => (t?.fonte && outra ? outra(t.fonte.postscriptName) : undefined)
  if (!trocas.some(t => fonteDa(t))) {
    const g = moldar(f, texto, { features: e.features, kerning: e.kerning !== false, escolhas }) as Glifo[]
    // ajuste fino também na troca por glifo
    for (const gl of g) { const t = trocas[gl.cluster]; if (t && (t.escala || t.baselineMm || t.espacoMm)) Object.assign(gl, { esc: t.escala, dy: t.baselineMm, esp: t.espacoMm }) }
    return g
  }
  // outra FONTE: o texto é moldado em pedaços (cada pedaço com a sua fonte)
  const out: Glifo[] = []
  let i = 0
  while (i < texto.length) {
    const fi = fonteDa(trocas[i])
    let j = i + 1
    while (j < texto.length && fonteDa(trocas[j]) === fi) j++
    const pedaco = texto.slice(i, j)
    const gs = (fi
      ? moldar(fi, pedaco, { kerning: e.kerning !== false })
      : moldar(f, pedaco, { features: e.features, kerning: e.kerning !== false, escolhas: escolhas.filter(c => c.index >= i && c.index < j).map(c => ({ ...c, index: c.index - i })) })) as Glifo[]
    for (const gl of gs) {
      const t = trocas[i + gl.cluster]
      // Lote 12 (item 171): a letra de OUTRA fonte fica da altura das letras do nome (sem ajuste manual de tamanho)
      const esc = t && fi ? (t.escala ?? fatorAltura(f, fi, texto[i + gl.cluster])) : t?.escala
      out.push({ ...gl, cluster: gl.cluster + i, ...(fi ? { f: fi } : {}), ...(t && (fi || t.gid) ? { esc, dy: t.baselineMm, esp: t.espacoMm } : {}) })
    }
    i = j
  }
  return out
}

/** Largura da linha (mm) no tamanho e tracking dados. */
function largura(g: Glifo[], f: FonteHB, tamMm: number, tracking: number, sx: number): number {
  const n = g.filter(x => !x.acento).length
  return g.reduce((a, x) => a + (x.acento ? 0 : x.xAdv * (tamMm / (x.f ?? f).upem) * (x.esc ?? 1) * sx + (x.esp ?? 0)), 0) + Math.max(0, n - 1) * (tracking / 1000) * tamMm * sx
}

/** Quebra em 2 linhas no espaço que deixa as duas mais parecidas (a maior o menor possível). */
export function quebrarEmDuas(f: FonteHB, texto: string, e: EstiloDiagrama, tamMm: number, outra?: OutraFonte): string[] {
  const p = texto.split(' ')
  if (p.length < 2) return [texto]
  let melhor: string[] = [texto], pior = Infinity
  // Lote 4 (item 50): não quebra logo depois de uma partícula ("Maria de" / "Fátima" não; "Maria" / "de Fátima" sim)
  const pontos = [...Array(p.length - 1).keys()].map(i => i + 1).filter(k => !ehParticula(p[k - 1]))
  for (const k of pontos.length ? pontos : [...Array(p.length - 1).keys()].map(i => i + 1)) {
    const a = p.slice(0, k).join(' '), b = p.slice(k).join(' ')
    const m = Math.max(largura(moldarLinha(f, a, e, 0, outra), f, tamMm, e.tracking ?? 0, e.scaleX ?? 1), largura(moldarLinha(f, b, e, a.length + 1, outra), f, tamMm, e.tracking ?? 0, e.scaleX ?? 1))
    if (m < pior) { pior = m; melhor = [a, b] }
  }
  return melhor
}

export function diagramar(f: FonteHB, valor: string, e: EstiloDiagrama, caixa: { w: number; h: number }, cfg: ConfigPosicao, outra?: OutraFonte): ResultadoTexto {
  const texto = prepararTexto(valor, e)
  const composto = ehComposto(texto)
  const c = (composto ? cfg.compound ?? cfg.single : cfg.single ?? cfg.compound) ?? { lines: 1 as const, sizePt: 24 }
  const tam0 = c.sizePt * MM_POR_PT
  const linhas = c.lines === 2 && composto ? quebrarEmDuas(f, texto, e, tam0, outra) : [texto]
  const sx = e.scaleX ?? 1, sy = e.scaleY ?? 1
  const lh = (e.lineHeight ?? 1) * (c.lineHeight ?? (composto ? 0.9 : 1))
  const minEsc = cfg.autoFit?.minScale ?? 0.7
  const deslocs = linhas.map((_, i) => linhas.slice(0, i).reduce((a, l) => a + l.length + 1, 0))
  const moldadas = linhas.map((l, i) => moldarLinha(f, l, e, deslocs[i], outra))
  const alturaEm = (f.ascender - f.descender) / f.upem
  const medir = (esc: number, tr: number) => {
    const tam = tam0 * esc
    const w = Math.max(...moldadas.map(g => largura(g, f, tam, tr, sx)))
    const h = (alturaEm + (linhas.length - 1) * lh) * tam * sy
    return { w, h, tam }
  }
  // AUTO-AJUSTE: tamanho até o mínimo; depois o tracking; senão, "revisar"
  let esc = 1, tr = e.tracking ?? 0, revisar = false
  const cabe = (m: { w: number; h: number }) => m.w <= caixa.w + 1e-6 && m.h <= caixa.h + 1e-6
  const m1 = medir(1, tr)   // Lote 13 (item 185): também diz qual lado segura o nome
  if (!cabe(m1)) {
    let ok = false
    for (let s = 0.99; s >= minEsc - 1e-9; s -= 0.01) { if (cabe(medir(s, tr))) { esc = s; ok = true; break } }
    if (!ok) {
      esc = minEsc
      if (tr > 0) {
        // Lote 6 (item 111): espaçamento entre letras ESCOLHIDO pela usuária não é desfeito pelo auto-ajuste (antes
        // virava o mesmo valor que fazia caber — qualquer tracking dava o mesmo resultado): a letra diminui mais
        for (let s = minEsc - 0.01; s >= 0.5 - 1e-9; s -= 0.01) { if (cabe(medir(s, tr))) { esc = s; ok = true; break } }
        if (!ok) { esc = 0.5; revisar = true }
      } else {
        for (let t = tr - 5; t >= TRACK_MIN; t -= 5) { if (cabe(medir(esc, t))) { tr = t; ok = true; break } }
        if (!ok) { tr = Math.max(TRACK_MIN, Math.min(tr, TRACK_MIN)); revisar = true }
      }
    }
  }
  esc = Math.round(esc * 100) / 100
  const { tam, h: hBloco } = medir(esc, tr)
  const cmds: Cmd[] = []
  const topo = (caixa.h - hBloco) / 2 + (e.baselineMm ? -e.baselineMm : 0)
  const R = e.curveRadiusMm ?? 0
  moldadas.forEach((g, li) => {
    const wl = largura(g, f, tam, tr, sx)
    const x0 = e.align === 'left' ? 0 : e.align === 'right' ? caixa.w - wl : (caixa.w - wl) / 2
    const base = topo + (f.ascender / f.upem) * tam * sy + li * lh * tam * sy
    let pen = x0
    const meio = caixa.w / 2
    for (const gl of g) {
      // Lote 5 (item 75): a letra trocada usa a escala da fonte dela + o ajuste fino
      const s = (tam / (gl.f ?? f).upem) * (gl.esc ?? 1)
      const adv = gl.acento ? 0 : gl.xAdv * s * sx + (gl.esp ?? 0)
      // Lote 10 (item 163): o acento montado gira junto com a letra dele (mesmo centro)
      const advC = gl.base ? gl.base.xAdv * (tam / (gl.base.f ?? f).upem) * (gl.base.esc ?? 1) * sx + (gl.base.esp ?? 0) : adv
      // em curva: cada glifo gira em volta do centro do arco, pelo meio do glifo
      let ang = 0, px = 0, py = 0
      if (R) {
        const sArco = pen + advC / 2 - meio
        ang = sArco / R
        // centro do arco abaixo da linha de base (R > 0, arco-íris) ou acima (R < 0, sorriso)
        px = meio + R * Math.sin(ang) - (pen + advC / 2)
        py = R - R * Math.cos(ang)
      }
      const cxg = pen + advC / 2
      const tx = (x: number, y: number): [number, number] => {
        let X = pen + (x + gl.xOff) * s * sx + (gl.dx ?? 0), Y = base - (y + gl.yOff) * s * sy - (gl.dy ?? 0)
        if (R) {
          const dx = X - cxg, dy = Y - base
          const cs = Math.cos(ang), sn = Math.sin(ang)
          X = cxg + dx * cs - dy * sn + px; Y = base + dx * sn + dy * cs + py
        }
        return [X, Y]
      }
      for (const c0 of (gl.f ?? f).contorno(gl.gid)) {
        if (c0[0] === 'Z') { cmds.push(['Z']); continue }
        const v = c0.slice(1) as number[], out: number[] = []
        for (let i = 0; i < v.length; i += 2) out.push(...tx(v[i], v[i + 1]))
        cmds.push([c0[0], ...out] as Cmd)
      }
      if (!gl.acento) pen += adv + (tr / 1000) * tam * sx
    }
  })
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity
  for (const c1 of cmds) for (let i = 1; i < c1.length; i += 2) { const x = c1[i] as number, y = c1[i + 1] as number; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y }
  if (!isFinite(bx0)) { bx0 = by0 = bx1 = by1 = 0 }
  const aviso = revisar ? `não coube nem com ${Math.round(esc * 100)}% e letras mais juntas — revisar` : esc < 1 ? `fonte reduzida para ${Math.round(esc * 100)}%` : tr !== (e.tracking ?? 0) ? 'letras juntadas para caber' : null
  // Lote 12 (item 171): letra trocada que não pôde ser aplicada → revisar (tela, miniatura e PDF)
  const avisoTroca = problemaDasTrocas(texto, e, outra)
  // Lote 13 (item 185): no tamanho pedido, quem não coube — a largura ou a altura da área
  const rw = m1.w / Math.max(1e-6, caixa.w), rh = m1.h / Math.max(1e-6, caixa.h)
  const limite = rw <= 1 + 1e-6 && rh <= 1 + 1e-6 ? null : rw >= rh ? 'largura' as const : 'altura' as const
  return { cmds, bbox: [bx0, by0, bx1, by1], linhas, composto, escala: esc, trackingFinal: tr, revisar: revisar || !!avisoTroca, aviso: avisoTroca ?? aviso, avisoTroca, limite }
}

/** Comandos (mm) → string de caminho SVG, passando cada ponto pela função (ex.: matriz da face). */
export function paraSvg(cmds: Cmd[], tx: (x: number, y: number) => [number, number] = (x, y) => [x, y], casas = 3): string {
  const n = (v: number) => { const r = Number(v.toFixed(casas)); return Object.is(r, -0) ? '0' : String(r) }
  let d = ''
  for (const c of cmds) {
    if (c[0] === 'Z') { d += 'Z'; continue }
    const v = c.slice(1) as number[], out: string[] = []
    for (let i = 0; i < v.length; i += 2) { const [x, y] = tx(v[i], v[i + 1]); out.push(n(x), n(y)) }
    d += c[0] + out.join(' ')
  }
  return d
}

/** HASHTAG da spec: "#" + nome sem espaços (acentos e maiúsculas como digitado) + texto do tema + idade. */
export function hashtag(nome: string, idade: string | number, meio = 'faz'): string {
  return `#${nome.replace(/\s+/g, '')}${meio.replace(/\s+/g, '')}${String(idade).trim()}`
}
