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
}
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

function moldarLinha(f: FonteHB, texto: string, e: EstiloDiagrama, desloc: number): GlifoMoldado[] {
  // as escolhas por recurso valem pela posição no texto INTEIRO: desloca para a linha
  const escolhas = (e.glyphChoices ?? []).filter(c => c.kind === 'feature' || c.kind === 'glyph').map(c => ({ ...c, index: c.index - desloc })).filter(c => c.index >= 0 && c.index < texto.length) as EscolhaMoldar[]
  return moldar(f, texto, { features: e.features, kerning: e.kerning !== false, escolhas })
}

/** Largura da linha (mm) no tamanho e tracking dados. */
function largura(g: GlifoMoldado[], f: FonteHB, tamMm: number, tracking: number, sx: number): number {
  const s = tamMm / f.upem
  return g.reduce((a, x) => a + x.xAdv * s * sx, 0) + Math.max(0, g.length - 1) * (tracking / 1000) * tamMm * sx
}

/** Quebra em 2 linhas no espaço que deixa as duas mais parecidas (a maior o menor possível). */
export function quebrarEmDuas(f: FonteHB, texto: string, e: EstiloDiagrama, tamMm: number): string[] {
  const p = texto.split(' ')
  if (p.length < 2) return [texto]
  let melhor: string[] = [texto], pior = Infinity
  // Lote 4 (item 50): não quebra logo depois de uma partícula ("Maria de" / "Fátima" não; "Maria" / "de Fátima" sim)
  const pontos = [...Array(p.length - 1).keys()].map(i => i + 1).filter(k => !ehParticula(p[k - 1]))
  for (const k of pontos.length ? pontos : [...Array(p.length - 1).keys()].map(i => i + 1)) {
    const a = p.slice(0, k).join(' '), b = p.slice(k).join(' ')
    const m = Math.max(largura(moldarLinha(f, a, e, 0), f, tamMm, e.tracking ?? 0, e.scaleX ?? 1), largura(moldarLinha(f, b, e, a.length + 1), f, tamMm, e.tracking ?? 0, e.scaleX ?? 1))
    if (m < pior) { pior = m; melhor = [a, b] }
  }
  return melhor
}

export function diagramar(f: FonteHB, valor: string, e: EstiloDiagrama, caixa: { w: number; h: number }, cfg: ConfigPosicao): ResultadoTexto {
  const texto = prepararTexto(valor, e)
  const composto = ehComposto(texto)
  const c = (composto ? cfg.compound ?? cfg.single : cfg.single ?? cfg.compound) ?? { lines: 1 as const, sizePt: 24 }
  const tam0 = c.sizePt * MM_POR_PT
  const linhas = c.lines === 2 && composto ? quebrarEmDuas(f, texto, e, tam0) : [texto]
  const sx = e.scaleX ?? 1, sy = e.scaleY ?? 1
  const lh = (e.lineHeight ?? 1) * (c.lineHeight ?? (composto ? 0.9 : 1))
  const minEsc = cfg.autoFit?.minScale ?? 0.7
  const deslocs = linhas.map((_, i) => linhas.slice(0, i).reduce((a, l) => a + l.length + 1, 0))
  const moldadas = linhas.map((l, i) => moldarLinha(f, l, e, deslocs[i]))
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
  if (!cabe(medir(1, tr))) {
    let ok = false
    for (let s = 0.99; s >= minEsc - 1e-9; s -= 0.01) { if (cabe(medir(s, tr))) { esc = s; ok = true; break } }
    if (!ok) {
      esc = minEsc
      for (let t = tr - 5; t >= TRACK_MIN; t -= 5) { if (cabe(medir(esc, t))) { tr = t; ok = true; break } }
      if (!ok) { tr = Math.max(TRACK_MIN, Math.min(tr, TRACK_MIN)); revisar = true }
    }
  }
  esc = Math.round(esc * 100) / 100
  const { tam, h: hBloco } = medir(esc, tr)
  const s = tam / f.upem
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
      const adv = gl.xAdv * s * sx
      // em curva: cada glifo gira em volta do centro do arco, pelo meio do glifo
      let ang = 0, px = 0, py = 0
      if (R) {
        const sArco = pen + adv / 2 - meio
        ang = sArco / R
        // centro do arco abaixo da linha de base (R > 0, arco-íris) ou acima (R < 0, sorriso)
        px = meio + R * Math.sin(ang) - (pen + adv / 2)
        py = R - R * Math.cos(ang)
      }
      const cxg = pen + adv / 2
      const tx = (x: number, y: number): [number, number] => {
        let X = pen + (x + gl.xOff) * s * sx, Y = base - (y + gl.yOff) * s * sy
        if (R) {
          const dx = X - cxg, dy = Y - base
          const cs = Math.cos(ang), sn = Math.sin(ang)
          X = cxg + dx * cs - dy * sn + px; Y = base + dx * sn + dy * cs + py
        }
        return [X, Y]
      }
      for (const c0 of f.contorno(gl.gid)) {
        if (c0[0] === 'Z') { cmds.push(['Z']); continue }
        const v = c0.slice(1) as number[], out: number[] = []
        for (let i = 0; i < v.length; i += 2) out.push(...tx(v[i], v[i + 1]))
        cmds.push([c0[0], ...out] as Cmd)
      }
      pen += adv + (tr / 1000) * tam * sx
    }
  })
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity
  for (const c1 of cmds) for (let i = 1; i < c1.length; i += 2) { const x = c1[i] as number, y = c1[i + 1] as number; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y }
  if (!isFinite(bx0)) { bx0 = by0 = bx1 = by1 = 0 }
  const aviso = revisar ? 'não coube nem com 70% e tracking reduzido — revisar' : esc < 1 ? `fonte reduzida para ${Math.round(esc * 100)}%` : tr !== (e.tracking ?? 0) ? 'tracking reduzido para caber' : null
  return { cmds, bbox: [bx0, by0, bx1, by1], linhas, composto, escala: esc, trackingFinal: tr, revisar, aviso }
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
