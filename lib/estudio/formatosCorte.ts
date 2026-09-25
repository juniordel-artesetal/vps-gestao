// SOA Edition — FORMATOS DE CORTE (DXF e Silhouette .studio). Roda no navegador e no Node (sem DOM).
//   • DXF (ASCII) → SVG que PRESERVA as camadas do DXF (<g id data-name>) e os textos TEXT/MTEXT como
//     <text> de verdade — daí o leitor de SVG (importarArte) transforma "Sophia" em campo, etc.
//   • .studio/.studio3 (Silhouette) é formato fechado: não lemos as formas; só puxamos a miniatura
//     PNG/JPEG embutida (quando existe) e orientamos a artesã a exportar SVG/PDF/DXF.
import type DxfParserTipo from 'dxf-parser'
import type { IDxf, IEntity, IBlock } from 'dxf-parser'

// ── Silhouette .studio / .studio3 ────────────────────────────────────────────────
export const ORIENTACAO_STUDIO = 'Arquivos .studio da Silhouette não podem ser lidos direto (formato fechado). No Silhouette Studio, exporte como SVG, PDF ou DXF e suba aqui — aí as camadas/vetores entram para edição. Dica: o SVG exportado pela Silhouette sai achatado; para manter camadas, prefira DXF (ou o arquivo original PSD/AI).'

export const PASSOS_EXPORT_STUDIO: string[] = [
  'Abra o arquivo no Silhouette Studio.',
  'SVG ou PDF: Arquivo → Salvar como → Salvar no disco rígido → em "Tipo", escolha SVG ou PDF (nas versões novas também em Arquivo → Exportar). Pode exigir a edição Business.',
  'DXF (mantém as camadas): Arquivo → Salvar como → Salvar no disco rígido → em "Tipo", escolha .DXF.',
  'Suba aqui o arquivo exportado.',
  '(O nome do menu pode variar conforme a versão do Silhouette Studio.)',
]

/** .studio/.studio3 pela extensão ou pelo cabeçalho "silhouetteNN;" (conferido em arquivos .studio3 reais: "silhouette05;"). */
export function ehStudio(nome: string, cab: Uint8Array): boolean {
  if (/\.studio\d?$/i.test(nome)) return true
  const ini = String.fromCharCode(...cab.slice(0, 16))
  return /^silhouette\d{2};/.test(ini)
}

/**
 * Miniatura embutida no .studio: procura PNGs (assinatura 89 50 4E 47 0D 0A 1A 0A, corta no IEND + CRC)
 * e fica com o MAIOR; sem PNG, tenta JPEG (FF D8 FF … FF D9). null = não achou imagem.
 */
export function extrairMiniaturaStudio(buf: ArrayBuffer): Blob | null {
  const b = new Uint8Array(buf)
  const n = b.length
  const u32 = (i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]
  let melhor: { ini: number; fim: number } | null = null
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i + 8 <= n; i++) {
    if (b[i] !== 0x89 || b[i + 1] !== 0x50) continue
    if (!SIG.every((v, k) => b[i + k] === v)) continue
    // percorre os chunks até o IEND (tamanho 4 + tipo 4 + dados + CRC 4)
    let p = i + 8, fim = -1
    while (p + 12 <= n) {
      const len = u32(p)
      const tipo = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7])
      if (!/^[A-Za-z]{4}$/.test(tipo) || p + 12 + len > n) break
      p += 12 + len
      if (tipo === 'IEND') { fim = p; break }
    }
    if (fim > 0) {
      if (!melhor || fim - i > melhor.fim - melhor.ini) melhor = { ini: i, fim }
      i = fim - 1
    }
  }
  if (melhor) return new Blob([b.slice(melhor.ini, melhor.fim)], { type: 'image/png' })
  // JPEG: segmentos com tamanho até o SOS; depois, dados comprimidos até FF D9
  let jpg: { ini: number; fim: number } | null = null
  for (let i = 0; i + 4 <= n; i++) {
    if (b[i] !== 0xff || b[i + 1] !== 0xd8 || b[i + 2] !== 0xff) continue
    let p = i + 2, fim = -1
    while (p + 4 <= n && b[p] === 0xff) {
      const m = b[p + 1]
      if (m === 0xff) { p++; continue }
      if (m === 0xd9) { fim = p + 2; break }
      const len = (b[p + 2] << 8) + b[p + 3]
      if (len < 2) break
      p += 2 + len
      if (m === 0xda) {
        while (p + 1 < n && !(b[p] === 0xff && b[p + 1] !== 0 && !(b[p + 1] >= 0xd0 && b[p + 1] <= 0xd7))) p++
        if (p + 1 < n && b[p + 1] === 0xd9) { fim = p + 2; break }
      }
    }
    if (fim > 0) {
      if (!jpg || fim - i > jpg.fim - jpg.ini) jpg = { ini: i, fim }
      i = fim - 1
    }
  }
  return jpg ? new Blob([b.slice(jpg.ini, jpg.fim)], { type: 'image/jpeg' }) : null
}

// ── DXF: detecção e leitura do texto ─────────────────────────────────────────────
/** DXF pela extensão ou pelo começo do arquivo ("0 / SECTION"); DXF binário também conta (o conversor avisa). */
export function ehDxf(nome: string, textoInicio: string): boolean {
  if (/\.dxf$/i.test(nome)) return true
  const t = textoInicio.replace(/^﻿/, '')
  if (t.startsWith('AutoCAD Binary DXF')) return true
  return /^\s*(?:999\s*\r?\n[^\r\n]*\r?\n\s*)*0\s*\r?\n\s*SECTION\s*\r?\n\s*2\s*\r?\n\s*(?:HEADER|CLASSES|TABLES|BLOCKS|ENTITIES|OBJECTS)\b/.test(t)
}

/**
 * Bytes do DXF → texto com a codificação certa: DXF até o AutoCAD 2006 (AC1018-) grava em ANSI
 * ($DWGCODEPAGE, ex. ANSI_1252) — lido como UTF-8, "ção" viraria lixo. Do 2007 em diante é UTF-8.
 */
export function decodificarDxf(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf)
  const cab = new TextDecoder('latin1').decode(b.slice(0, 64 * 1024))
  const versao = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*AC(\d{4})/.exec(cab)?.[1]
  const pagina = /\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*ANSI_(\d+)/i.exec(cab)?.[1]
  const antigo = versao ? Number(versao) < 1021 : false
  if (antigo) {
    try { return new TextDecoder(`windows-${pagina || '1252'}`).decode(b) } catch { return new TextDecoder('windows-1252').decode(b) }
  }
  const utf = new TextDecoder('utf-8').decode(b).replace(/^﻿/, '')
  if (!versao && utf.includes('�')) return new TextDecoder('windows-1252').decode(b)
  return utf
}

// ── geometria ─────────────────────────────────────────────────────────────────────
type Pt = { x: number; y: number }
type Mat = [number, number, number, number, number, number] // x' = a·x + c·y + e ; y' = b·x + d·y + f
const ID: Mat = [1, 0, 0, 1, 0, 0]
const mul = (m: Mat, k: Mat): Mat => [
  m[0] * k[0] + m[2] * k[1], m[1] * k[0] + m[3] * k[1],
  m[0] * k[2] + m[2] * k[3], m[1] * k[2] + m[3] * k[3],
  m[0] * k[4] + m[2] * k[5] + m[4], m[1] * k[4] + m[3] * k[5] + m[5],
]
const ap = (m: Mat, x: number, y: number): Pt => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] })
const trans = (x: number, y: number): Mat => [1, 0, 0, 1, x, y]
const giro = (rad: number): Mat => [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0]
const escala = (sx: number, sy: number): Mat => [sx, 0, 0, sy, 0, 0]
const RAD = Math.PI / 180
const fin = (v: unknown, pad = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : pad)

class Caixa {
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity
  add(p: Pt) { if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return; if (p.x < this.x0) this.x0 = p.x; if (p.x > this.x1) this.x1 = p.x; if (p.y < this.y0) this.y0 = p.y; if (p.y > this.y1) this.y1 = p.y }
  get vazia() { return this.x1 < this.x0 }
}

/** Traçado em coordenadas do MUNDO (DXF, Y para cima): tudo vira M/L/C (arco → Bézier), o que aceita qualquer afim (INSERT). */
class Tracado {
  segs: (string | number)[][] = []
  private ult: Pt | null = null
  constructor(private m: Mat, private cx: Caixa) {}
  private p(x: number, y: number) { const q = ap(this.m, x, y); this.cx.add(q); return q }
  moveTo(x: number, y: number) { const q = this.p(x, y); this.segs.push(['M', q.x, q.y]); this.ult = { x, y } }
  lineTo(x: number, y: number) {
    if (!this.ult) return this.moveTo(x, y)
    const q = this.p(x, y); this.segs.push(['L', q.x, q.y]); this.ult = { x, y }
  }
  curveTo(a: Pt, b: Pt, c: Pt) {
    const qa = this.p(a.x, a.y), qb = this.p(b.x, b.y), qc = this.p(c.x, c.y)
    this.segs.push(['C', qa.x, qa.y, qb.x, qb.y, qc.x, qc.y]); this.ult = c
  }
  fechar() { if (this.segs.length) this.segs.push(['Z']); this.ult = null }
  /** Liga ao ponto (sem traço repetido quando já está lá). */
  juntar(x: number, y: number) {
    if (!this.ult) return this.moveTo(x, y)
    if (Math.hypot(this.ult.x - x, this.ult.y - y) > 1e-9) this.lineTo(x, y)
  }
  /** Arco elíptico: centro c, semi-eixo maior u, razão menor/maior, parâmetro t0 e varredura dt (radianos, + = anti-horário). */
  arco(c: Pt, u: Pt, razao: number, t0: number, dt: number, juntar = true) {
    const v = { x: -u.y * razao, y: u.x * razao }
    const P = (t: number) => ({ x: c.x + u.x * Math.cos(t) + v.x * Math.sin(t), y: c.y + u.y * Math.cos(t) + v.y * Math.sin(t) })
    const D = (t: number) => ({ x: -u.x * Math.sin(t) + v.x * Math.cos(t), y: -u.y * Math.sin(t) + v.y * Math.cos(t) })
    const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9))
    const h = dt / n, k = (4 / 3) * Math.tan(h / 4)
    const p0 = P(t0)
    if (juntar) this.juntar(p0.x, p0.y); else this.moveTo(p0.x, p0.y)
    let a = t0
    for (let i = 0; i < n; i++) {
      const b = a + h, A = P(a), dA = D(a), B = P(b), dB = D(b)
      this.curveTo({ x: A.x + k * dA.x, y: A.y + k * dA.y }, { x: B.x - k * dB.x, y: B.y - k * dB.y }, B)
      a = b
    }
  }
  /** Segmento com "bulge" do DXF (tan(ângulo/4); + = anti-horário). */
  bulge(x1: number, y1: number, x2: number, y2: number, bg: number) {
    if (!bg || Math.abs(bg) < 1e-9 || (x1 === x2 && y1 === y2)) return this.juntar(x2, y2)
    const f = (1 - bg * bg) / (4 * bg), dx = x2 - x1, dy = y2 - y1
    const c = { x: (x1 + x2) / 2 - dy * f, y: (y1 + y2) / 2 + dx * f }
    const r = Math.hypot(x1 - c.x, y1 - c.y)
    this.arco(c, { x: r, y: 0 }, 1, Math.atan2(y1 - c.y, x1 - c.x), 4 * Math.atan(bg))
  }
  pontos(pts: Pt[], fechado: boolean) {
    pts.forEach((q, i) => (i ? this.lineTo(q.x, q.y) : this.moveTo(q.x, q.y)))
    if (fechado && pts.length > 2) this.fechar()
  }
}

/** B-spline (de Boor, com pesos se houver) amostrada em pontos. */
function bspline(ctrl: Pt[], grau: number, nos?: number[], pesos?: number[]): Pt[] {
  const n = ctrl.length
  if (n < 2) return ctrl.slice()
  const p = Math.max(1, Math.min(grau || 3, n - 1))
  let K = nos && nos.length === n + p + 1 && nos.every((v, i) => i === 0 || v >= nos[i - 1]) ? nos : null
  if (!K) { K = []; for (let i = 0; i < n + p + 1; i++) K.push(i <= p ? 0 : i >= n ? n - p : i - p) }
  const W = pesos && pesos.length === n ? pesos : null
  const t0 = K[p], t1 = K[n]
  if (!(t1 > t0)) return ctrl.slice()
  const amostras = Math.max(24, Math.min(4000, n * 12))
  const out: Pt[] = []
  for (let s = 0; s <= amostras; s++) {
    const t = s === amostras ? t1 : t0 + ((t1 - t0) * s) / amostras
    let k = p
    while (k < n - 1 && !(t < K[k + 1])) k++
    const d = [] as { x: number; y: number; w: number }[]
    for (let j = 0; j <= p; j++) { const q = ctrl[k - p + j], w = W ? W[k - p + j] : 1; d.push({ x: q.x * w, y: q.y * w, w }) }
    for (let r = 1; r <= p; r++) for (let j = p; j >= r; j--) {
      const i = k - p + j, den = K[i + p - r + 1] - K[i]
      const a = den ? (t - K[i]) / den : 0
      d[j] = { x: (1 - a) * d[j - 1].x + a * d[j].x, y: (1 - a) * d[j - 1].y + a * d[j].y, w: (1 - a) * d[j - 1].w + a * d[j].w }
    }
    const e = d[p]; out.push({ x: e.x / (e.w || 1), y: e.y / (e.w || 1) })
  }
  return out
}

/** Curva suave passando pelos pontos (Catmull-Rom → Bézier) — SPLINE só com pontos de ajuste. */
function suave(tr: Tracado, pts: Pt[], fechado: boolean) {
  if (pts.length < 3) return tr.pontos(pts, false)
  const q = (i: number) => (fechado ? pts[(i + pts.length) % pts.length] : pts[Math.max(0, Math.min(pts.length - 1, i))])
  tr.moveTo(pts[0].x, pts[0].y)
  const fim = fechado ? pts.length : pts.length - 1
  for (let i = 0; i < fim; i++) {
    const p0 = q(i - 1), p1 = q(i), p2 = q(i + 1), p3 = q(i + 2)
    tr.curveTo({ x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }, { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }, p2)
  }
  if (fechado) tr.fechar()
}

// ── leitores extras para o dxf-parser (TEXT/MTEXT com estilo, ATTRIB e HATCH) ─────
type Grupo = { code: number; value: number | string | boolean }
interface Leitor { next(): Grupo; peek(): Grupo; rewind(n?: number): void; isEOF(): boolean; lastReadGroup: Grupo }
type Ent = IEntity & Record<string, unknown>

function comum(e: Record<string, unknown>, g: Grupo, sc: Leitor) {
  switch (g.code) {
    case 5: e.handle = g.value; break
    case 6: e.lineType = g.value; break
    case 8: e.layer = g.value; break
    case 48: e.lineTypeScale = g.value; break
    case 60: e.visible = g.value === 0; break
    case 62: e.colorIndex = g.value; break
    case 67: e.inPaperSpace = g.value !== 0; break
    case 420: e.trueColor = g.value; break
    case 101: { let c = g; while (c.code !== 0 && !sc.isEOF()) c = sc.next(); sc.rewind(); break } // objeto embutido (R2018)
  }
}
function lerPonto(sc: Leitor, g: Grupo): Pt & { z?: number } {
  const p: Pt & { z?: number } = { x: Number(g.value), y: 0 }
  const gy = sc.next()
  if (gy.code !== g.code + 10) { sc.rewind(); return p }
  p.y = Number(gy.value)
  if (sc.peek().code === g.code + 20) p.z = Number(sc.next().value)
  return p
}

class LeitorTexto {
  ForEntityName = 'TEXT'
  parseEntity(sc: Leitor, cur: Grupo) {
    const e: Record<string, unknown> = { type: cur.value }
    const attrib = cur.value === 'ATTRIB'
    let g = sc.next()
    while (!sc.isEOF() && g.code !== 0) {
      switch (g.code) {
        case 1: e.text = g.value; break
        case 7: e.style = g.value; break
        case 10: e.startPoint = lerPonto(sc, g); break
        case 11: e.endPoint = lerPonto(sc, g); break
        case 40: e.textHeight = g.value; break
        case 41: e.xScale = g.value; break
        case 50: e.rotation = g.value; break
        case 70: if (attrib) e.invisivel = (Number(g.value) & 1) === 1; break
        case 72: e.halign = g.value; break
        case 73: if (!attrib) e.valign = g.value; break
        case 74: if (attrib) e.valign = g.value; break
        case 210: e.extrusao = lerPonto(sc, g); break
        default: comum(e, g, sc)
      }
      g = sc.next()
    }
    return e
  }
}
class LeitorAtributo extends LeitorTexto { ForEntityName = 'ATTRIB' }
class LeitorMtexto {
  ForEntityName = 'MTEXT'
  parseEntity(sc: Leitor, cur: Grupo) {
    const e: Record<string, unknown> = { type: cur.value }
    let texto = ''
    let g = sc.next()
    while (!sc.isEOF() && g.code !== 0) {
      switch (g.code) {
        case 1: case 3: texto += String(g.value); break
        case 7: e.style = g.value; break
        case 10: e.position = lerPonto(sc, g); break
        case 11: e.directionVector = lerPonto(sc, g); break
        case 40: e.height = g.value; break
        case 41: e.width = g.value; break
        case 44: e.espacamento = g.value; break
        case 50: e.rotation = g.value; break
        case 71: e.attachmentPoint = g.value; break
        case 210: e.extrusao = lerPonto(sc, g); break
        default: comum(e, g, sc)
      }
      g = sc.next()
    }
    e.text = texto
    return e
  }
}

type Aresta =
  | { t: 'linha'; a: Pt; b: Pt }
  | { t: 'arco'; c: Pt; r: number; a0: number; a1: number; ccw: boolean }
  | { t: 'elipse'; c: Pt; u: Pt; razao: number; a0: number; a1: number; ccw: boolean }
  | { t: 'spline'; grau: number; nos: number[]; ctrl: Pt[]; pesos: number[] }
type Contorno = { poli: { x: number; y: number; bulge: number }[]; fechado: boolean } | { arestas: Aresta[] }

class LeitorHachura {
  ForEntityName = 'HATCH'
  parseEntity(sc: Leitor, cur: Grupo) {
    const e: Record<string, unknown> = { type: cur.value }
    const contornos: Contorno[] = []
    const talvez = (code: number): number | undefined => (sc.peek().code === code ? Number(sc.next().value) : undefined)
    const ponto = (code: number): Pt => ({ x: talvez(code) ?? 0, y: talvez(code + 10) ?? 0 })
    let g = sc.next()
    while (!sc.isEOF() && g.code !== 0) {
      switch (g.code) {
        case 2: e.padrao = g.value; break
        case 70: e.solido = Number(g.value) === 1; break
        case 91: {
          const qtd = Number(g.value)
          for (let i = 0; i < qtd && sc.peek().code === 92; i++) {
            const flags = Number(sc.next().value)
            if (flags & 2) {
              const temBulge = (talvez(72) ?? 0) !== 0, fechado = (talvez(73) ?? 1) !== 0, nv = talvez(93) ?? 0
              const poli: { x: number; y: number; bulge: number }[] = []
              for (let k = 0; k < nv && sc.peek().code === 10; k++) { const p = ponto(10); poli.push({ ...p, bulge: temBulge ? talvez(42) ?? 0 : 0 }) }
              contornos.push({ poli, fechado })
            } else {
              const na = talvez(93) ?? 0, arestas: Aresta[] = []
              for (let k = 0; k < na && sc.peek().code === 72; k++) {
                const tipo = Number(sc.next().value)
                if (tipo === 1) arestas.push({ t: 'linha', a: ponto(10), b: ponto(11) })
                else if (tipo === 2) { const c = ponto(10); const r = talvez(40) ?? 0, a0 = talvez(50) ?? 0, a1 = talvez(51) ?? 360; arestas.push({ t: 'arco', c, r, a0, a1, ccw: (talvez(73) ?? 1) !== 0 }) }
                else if (tipo === 3) { const c = ponto(10), u = ponto(11); const razao = talvez(40) ?? 1, a0 = talvez(50) ?? 0, a1 = talvez(51) ?? 360; arestas.push({ t: 'elipse', c, u, razao, a0, a1, ccw: (talvez(73) ?? 1) !== 0 }) }
                else if (tipo === 4) {
                  const grau = talvez(94) ?? 3; const racional = (talvez(73) ?? 0) !== 0; talvez(74)
                  const nk = talvez(95) ?? 0, nc = talvez(96) ?? 0
                  const nos: number[] = [], ctrl: Pt[] = [], pesos: number[] = []
                  for (let j = 0; j < nk && sc.peek().code === 40; j++) nos.push(Number(sc.next().value))
                  for (let j = 0; j < nc && sc.peek().code === 10; j++) { ctrl.push(ponto(10)); if (racional || sc.peek().code === 42) { const w = talvez(42); if (w !== undefined) pesos.push(w) } }
                  const nf = talvez(97) ?? 0
                  for (let j = 0; j < nf && sc.peek().code === 11; j++) ponto(11)
                  if (sc.peek().code === 12) { ponto(12); ponto(13) }
                  arestas.push({ t: 'spline', grau, nos, ctrl, pesos })
                } else break
              }
              contornos.push({ arestas })
            }
            const nf = talvez(97) ?? 0
            for (let j = 0; j < nf && sc.peek().code === 330; j++) sc.next()
          }
          break
        }
        default: comum(e, g, sc)
      }
      g = sc.next()
    }
    e.contornos = contornos
    return e
  }
}

// ── texto: códigos do DXF ─────────────────────────────────────────────────────────
const ESPECIAIS: Record<string, string> = { c: 'Ø', d: '°', p: '±', '%': '%' }
function decodTexto(s: string): string {
  return s
    .replace(/\\U\+([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\M\+\d[0-9a-fA-F]{4}/g, '')
    .replace(/%%(\d{3})/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/%%([cdpCDP%])/g, (_, c) => ESPECIAIS[c.toLowerCase()])
    .replace(/%%[uoUOkK]/g, '')
}

/** MTEXT sem os códigos de formatação (\P, {\f…;}, \H…;, \S…;…) + a 1ª fonte/altura que ele pede. */
function limparMtexto(bruto: string): { linhas: string[]; fonte: string | null; negrito: boolean; italico: boolean; altura: { abs?: number; rel?: number } | null } {
  const s = decodTexto(bruto)
  let out = '', fonte: string | null = null, negrito = false, italico = false
  let altura: { abs?: number; rel?: number } | null = null
  const ate = (i: number) => { const f = s.indexOf(';', i); return f < 0 ? s.length : f }
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '{' || ch === '}') continue
    if (ch === '^' && i + 1 < s.length) { const n = s[i + 1]; if (n === 'I') { out += ' '; i++; continue } if (n === 'J' || n === 'M') { out += '\n'; i++; continue } }
    if (ch !== '\\') { out += ch; continue }
    const c = s[i + 1]
    if (c === undefined) break
    i++
    if (c === 'P' || c === 'N' || c === 'X') out += '\n'
    else if (c === '~') out += ' '
    else if (c === '\\' || c === '{' || c === '}') out += c
    else if (c === 'f' || c === 'F') {
      const f = ate(i + 1), arg = s.slice(i + 1, f)
      const partes = arg.split('|')
      if (!fonte && partes[0]) {
        fonte = partes[0].replace(/\.(ttf|otf|shx)$/i, '')
        negrito = partes.includes('b1'); italico = partes.includes('i1')
      }
      i = f
    } else if (c === 'H') {
      const f = ate(i + 1), arg = s.slice(i + 1, f)
      if (!altura) { const v = parseFloat(arg); if (v > 0) altura = /x$/i.test(arg) ? { rel: v } : { abs: v } }
      i = f
    } else if (c === 'S') {
      const f = ate(i + 1); out += s.slice(i + 1, f).replace(/[\^#]/g, '/'); i = f
    } else if ('ACcTQWpq'.includes(c)) i = ate(i + 1)
    // \L \l \O \o \K \k: sublinhado/sobrelinha/riscado — só liga/desliga, some
  }
  const linhas = out.split('\n').map(l => l.replace(/\s+$/, ''))
  while (linhas.length > 1 && !linhas[linhas.length - 1].trim()) linhas.pop()
  return { linhas, fonte, negrito, italico, altura }
}

const FONTES_CONHECIDAS: Record<string, string> = {
  arial: 'Arial', arialbd: 'Arial', ariali: 'Arial', arialbi: 'Arial', arialn: 'Arial Narrow', times: 'Times New Roman', timesbd: 'Times New Roman',
  calibri: 'Calibri', calibrib: 'Calibri', comic: 'Comic Sans MS', comicbd: 'Comic Sans MS', verdana: 'Verdana', tahoma: 'Tahoma',
  georgia: 'Georgia', cour: 'Courier New', courbd: 'Courier New', segoeui: 'Segoe UI', impact: 'Impact', trebuc: 'Trebuchet MS',
}

// ── cores (ACI) ───────────────────────────────────────────────────────────────────
/** Cores básicas do AutoCAD; a 7 (branco/preto) sai PRETA — papel branco. */
const ACI_BASICO: Record<number, string> = { 1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff', 7: '#000000', 8: '#808080', 9: '#c0c0c0', 250: '#333333', 251: '#505050', 252: '#696969', 253: '#828282', 254: '#bebebe', 255: '#ffffff' }
const hexCor = (n: number) => { const h = '#' + (n & 0xffffff).toString(16).padStart(6, '0'); return h === '#ffffff' ? '#000000' : h }
const COR_PADRAO = '#111111'

// ── SVG ───────────────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const num = (v: number) => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r) }

type Item = { tipo: 'traco' | 'preench' | 'texto'; segs?: (string | number)[][]; cor: string | null; tracejado?: string | null; opacidade?: number; texto?: TextoSaida }
type TextoSaida = { ancora: Pt; rot: number; fs: number; linhas: string[]; lh: number; dy0: number; alinh: 'start' | 'middle' | 'end'; familia: string | null; negrito: boolean; italico: boolean; escX: number }
type CamadaInfo = { nome: string; cor: string; tracejado: string | null; oculta: boolean; motivo: string | null; itens: Item[]; entidades: number; textos: number }
type Estilo = { arquivo: string | null; familia: string | null; negrito: boolean; italico: boolean }

const SUPORTADAS = new Set(['LINE', 'LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC', 'ELLIPSE', 'SPLINE', 'POINT', 'TEXT', 'MTEXT', 'INSERT', 'HATCH', 'SOLID', 'ATTRIB', 'ATTDEF', 'DIMENSION', 'VERTEX', 'SEQEND', 'BLOCK', 'ENDBLK', 'ENDSEC', 'SECTION', 'EOF'])
const UNIDADE_MM: Record<number, number> = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 8: 0.0000254, 9: 0.0254, 10: 914.4, 14: 100 }

/** Leitura crua (pares código/valor) do que o dxf-parser não guarda: ordem/linetype das camadas, tabela STYLE e tipos de entidade. */
function varrerDxf(texto: string) {
  const L = texto.split(/\r\n|\r|\n/)
  const camadas: { nome: string; linetype: string | null; cor420: number | null }[] = []
  const estilos = new Map<string, Estilo>()
  const tipos = new Map<string, number>()
  let secao = '', tabela = '', reg: Record<string, unknown> | null = null, xdata = ''
  const fecha = () => {
    if (!reg) return
    if (reg.kind === 'LAYER' && typeof reg.nome === 'string') camadas.push({ nome: reg.nome, linetype: (reg.lt as string) || null, cor420: (reg.cor as number) ?? null })
    if (reg.kind === 'STYLE' && typeof reg.nome === 'string') {
      const fl = Number(reg.fl || 0)
      estilos.set(reg.nome.toUpperCase(), { arquivo: (reg.arq as string) || null, familia: (reg.fam as string) || null, negrito: (fl & 0x2000000) !== 0, italico: (fl & 0x1000000) !== 0 })
    }
    reg = null
  }
  for (let i = 0; i + 1 < L.length; i += 2) {
    const code = parseInt(L[i], 10), v = L[i + 1].trim()
    if (code === 0) {
      fecha()
      if (v === 'SECTION') { secao = ''; continue }
      if (v === 'ENDSEC') { secao = ''; tabela = ''; continue }
      if (secao === 'TABLES') {
        if (v === 'TABLE') tabela = '?'
        else if (v === 'ENDTAB') tabela = ''
        else if ((v === 'LAYER' || v === 'STYLE') && tabela === v) { reg = { kind: v }; xdata = '' }
      } else if (secao === 'ENTITIES' || secao === 'BLOCKS') tipos.set(v, (tipos.get(v) || 0) + 1)
      continue
    }
    if (code === 2 && !secao && (L[i - 1] !== undefined)) { secao = v; continue }
    if (secao === 'TABLES' && tabela === '?' && code === 2) { tabela = v; continue }
    if (!reg) continue
    if (code === 2) reg.nome = v
    else if (code === 6 && reg.kind === 'LAYER') reg.lt = v
    else if (code === 420 && reg.kind === 'LAYER') reg.cor = parseInt(v, 10)
    else if (code === 3 && reg.kind === 'STYLE') reg.arq = v
    else if (code === 1001) xdata = v
    else if (code === 1000 && reg.kind === 'STYLE' && xdata === 'ACAD' && !reg.fam) reg.fam = v
    else if (code === 1071 && reg.kind === 'STYLE' && xdata === 'ACAD') reg.fl = parseInt(v, 10)
  }
  fecha()
  return { camadas, estilos, tipos }
}

/**
 * DXF (ASCII) → SVG com as CAMADAS do DXF como <g id data-name> (na ordem da tabela LAYER) e TEXT/MTEXT como
 * <text> reais. Y do DXF (para cima) vira Y do SVG (para baixo); width/height em mm pelo $INSUNITS.
 */
export async function dxfParaSvg(texto: string): Promise<{ svg: string; camadas: { nome: string; entidades: number; textos: number }[]; avisos: string[] }> {
  const limpo = texto.replace(/^﻿/, '')
  if (limpo.startsWith('AutoCAD Binary DXF')) throw new Error('DXF binário não é suportado — salve como DXF ASCII')
  if (!ehDxf('', limpo.slice(0, 4096))) throw new Error('Este arquivo não parece um DXF (não começa com "0 / SECTION"). Exporte de novo como DXF ASCII.')
  const mod = (await import('dxf-parser')) as unknown as { default?: unknown; DxfParser?: unknown }
  const cand = [mod.default, (mod.default as { default?: unknown } | undefined)?.default, mod.DxfParser, (mod.default as { DxfParser?: unknown } | undefined)?.DxfParser]
  const Parser = cand.find(c => typeof c === 'function') as (new () => DxfParserTipo) | undefined
  if (!Parser) throw new Error('Leitor de DXF indisponível.')
  const parser = new Parser()
  type Handler = Parameters<DxfParserTipo['registerEntityHandler']>[0]
  for (const h of [LeitorTexto, LeitorAtributo, LeitorMtexto, LeitorHachura]) parser.registerEntityHandler(h as unknown as Handler)
  let dxf: IDxf | null
  try { dxf = parser.parseSync(limpo) } catch (e) { throw new Error(`Não consegui ler este DXF (${(e as Error).message}). Salve de novo como DXF ASCII (R2000 ou mais novo) e suba de novo.`) }
  if (!dxf || !dxf.entities) throw new Error('Este arquivo não parece um DXF válido (não achei a seção de entidades).')

  const avisos: string[] = []
  const bruto = varrerDxf(limpo)
  const header = dxf.header || {}
  const insunits = fin(header.$INSUNITS as number, 0)
  let mmPorUnidade = UNIDADE_MM[insunits]
  if (!mmPorUnidade) {
    mmPorUnidade = 1
    avisos.push(insunits ? `Unidade do DXF ($INSUNITS=${insunits}) sem conversão para mm — assumi milímetros.` : 'O DXF não diz a unidade — assumi milímetros. Confira o tamanho.')
  }
  const ltscale = fin(header.$LTSCALE as number, 1) || 1
  const tiposLinha = dxf.tables?.lineType?.lineTypes || {}
  const camadasTab = dxf.tables?.layer?.layers || {}

  // camadas na ordem da tabela (a leitura crua preserva a ordem; o objeto do parser reordena nomes numéricos)
  const camadas = new Map<string, CamadaInfo>()
  const infoCamada = (nome: string): CamadaInfo => {
    let c = camadas.get(nome)
    if (c) return c
    const t = camadasTab[nome] as (typeof camadasTab)[string] | undefined
    const raw = bruto.camadas.find(x => x.nome === nome)
    const cor = raw?.cor420 != null ? hexCor(raw.cor420) : typeof t?.color === 'number' ? hexCor(t.color) : ACI_BASICO[t?.colorIndex ?? 7] || COR_PADRAO
    const oculta = !!t && (t.frozen || t.visible === false)
    c = { nome, cor, tracejado: tracejadoDe(raw?.linetype || null, 1), oculta, motivo: t?.frozen ? 'congelada' : t?.visible === false ? 'desligada' : null, itens: [], entidades: 0, textos: 0 }
    camadas.set(nome, c)
    return c
  }
  function tracejadoDe(nome: string | null, escLocal: number): string | null {
    if (!nome || /^(continuous|bylayer|byblock)$/i.test(nome)) return null
    const lt = (tiposLinha as unknown as Record<string, { pattern?: number[] }>)[nome]
    const pad = lt?.pattern?.filter(v => Number.isFinite(v))
    if (!pad?.length) return null
    const k = ltscale * (escLocal || 1)
    const vals = pad.map(v => Math.max(Math.abs(v) * k, 1e-3))
    if (pad[0] < 0) vals.unshift(0)
    return vals.map(num).join(' ')
  }
  for (const c of bruto.camadas) infoCamada(c.nome)

  const caixa = new Caixa()
  const ignoradas = new Map<string, number>()
  const conta = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1)
  let padraoHachura = 0, papel = 0, profundo = 0
  const blocoFaltando = new Set<string>(), shx = new Set<string>()
  const blocos: Record<string, IBlock> = dxf.blocks || {}

  type Ctx = { m: Mat; camada: string | null; cor: string | null; pilha: string[] }
  const corDe = (e: Ent, ctx: Ctx): string | null => {
    const idx = e.colorIndex as number | undefined
    const tc = e.trueColor as number | undefined
    if (typeof tc === 'number') return hexCor(tc)
    if (idx === 0) return ctx.cor // BYBLOCK
    if (idx === undefined || idx === 256) return null // BYLAYER: herda do <g> da camada
    if (typeof e.color === 'number' && idx > 0) return hexCor(e.color as number)
    return ACI_BASICO[Math.abs(idx)] || null
  }
  const estiloDe = (nome: unknown): Estilo | null => (typeof nome === 'string' ? bruto.estilos.get(nome.toUpperCase()) || null : null)
  const familiaDe = (est: Estilo | null, fonteMt: string | null): string | null => {
    if (fonteMt) return fonteMt
    if (!est) return null
    if (est.familia) return est.familia
    const arq = (est.arquivo || '').replace(/^.*[\\/]/, '')
    if (!arq) return null
    if (/\.shx$/i.test(arq) || !/\./.test(arq)) { shx.add(arq.toLowerCase()); return null }
    const base = arq.replace(/\.(ttf|otf|ttc)$/i, '')
    return FONTES_CONHECIDAS[base.toLowerCase()] || base.replace(/(^|[\s_-])[a-z]/g, s => s.toUpperCase())
  }
  const ocsEspelho = (e: Ent): Mat => {
    const z = (e.extrusionDirectionZ as number | undefined) ?? (e.extrusionDirection as Pt & { z?: number } | undefined)?.z ?? (e.extrusao as Pt & { z?: number } | undefined)?.z
    return typeof z === 'number' && z < 0 ? [-1, 0, 0, 1, 0, 0] : ID
  }

  const desenhar = (e: Ent, ctx: Ctx) => {
    const tipo = String(e.type)
    if (e.inPaperSpace) { papel++; return }
    if (e.visible === false) return
    const nomeCamada = String(e.layer ?? '0') === '0' && ctx.camada ? ctx.camada : String(e.layer ?? '0')
    const camada = infoCamada(nomeCamada)
    const cor = corDe(e, ctx)
    const m = mul(ctx.m, ocsEspelho(e))
    const lt = typeof e.lineType === 'string' && !/^by(layer|block)$/i.test(e.lineType) ? tracejadoDe(e.lineType, fin(e.lineTypeScale as number, 1)) : undefined
    const novo = () => new Tracado(m, caixa)
    const traco = (tr: Tracado) => { if (tr.segs.length) { camada.itens.push({ tipo: 'traco', segs: tr.segs, cor, tracejado: lt }); camada.entidades++ } }
    switch (tipo) {
      case 'LINE': {
        const v = (e.vertices as Pt[] | undefined) || []
        if (v.length >= 2) { const tr = novo(); tr.moveTo(v[0].x, v[0].y); tr.lineTo(v[1].x, v[1].y); traco(tr) }
        return
      }
      case 'LWPOLYLINE': case 'POLYLINE': {
        if (e.is3dPolygonMesh || e.isPolyfaceMesh) { conta(ignoradas, 'malha 3D (POLYLINE)'); return }
        let v = ((e.vertices as (Pt & { bulge?: number; splineVertex?: boolean; splineControlPoint?: boolean })[] | undefined) || []).filter(q => Number.isFinite(q.x) && Number.isFinite(q.y))
        if (v.some(q => q.splineVertex)) v = v.filter(q => !q.splineControlPoint)
        if (!v.length) return
        const fechado = !!e.shape
        const tr = novo()
        tr.moveTo(v[0].x, v[0].y)
        const n = fechado ? v.length : v.length - 1
        for (let i = 0; i < n; i++) { const a = v[i], b = v[(i + 1) % v.length]; tr.bulge(a.x, a.y, b.x, b.y, fin(a.bulge)) }
        if (fechado) tr.fechar()
        traco(tr)
        return
      }
      case 'CIRCLE': {
        const c = e.center as Pt, r = fin(e.radius as number)
        if (!c || !(r > 0)) return
        const tr = novo(); tr.arco(c, { x: r, y: 0 }, 1, 0, Math.PI * 2, false); tr.fechar(); traco(tr)
        return
      }
      case 'ARC': {
        const c = e.center as Pt, r = fin(e.radius as number)
        if (!c || !(r > 0)) return
        const a0 = fin(e.startAngle as number), a1 = fin(e.endAngle as number, Math.PI * 2)
        let d = a1 - a0; while (d <= 0) d += Math.PI * 2
        const tr = novo(); tr.arco(c, { x: r, y: 0 }, 1, a0, d, false); traco(tr)
        return
      }
      case 'ELLIPSE': {
        const c = e.center as Pt, u = e.majorAxisEndPoint as Pt
        if (!c || !u) return
        const a0 = fin(e.startAngle as number), a1 = fin(e.endAngle as number, Math.PI * 2)
        let d = a1 - a0; while (d <= 1e-9) d += Math.PI * 2
        const tr = novo(); tr.arco(c, u, fin(e.axisRatio as number, 1), a0, d, false)
        if (Math.abs(d - Math.PI * 2) < 1e-6) tr.fechar()
        traco(tr)
        return
      }
      case 'SPLINE': {
        const ctrl = (e.controlPoints as Pt[] | undefined) || [], fit = (e.fitPoints as Pt[] | undefined) || []
        const tr = novo()
        if (ctrl.length >= 2) tr.pontos(bspline(ctrl, fin(e.degreeOfSplineCurve as number, 3), e.knotValues as number[] | undefined), !!e.closed)
        else if (fit.length >= 2) suave(tr, fit, !!e.closed)
        traco(tr)
        return
      }
      case 'SOLID': case '3DFACE': {
        const p = ((e.points || e.vertices) as Pt[] | undefined) || []
        if (p.length < 3) return
        const ord = tipo === 'SOLID' ? [p[0], p[1], p[3] || p[2], p[2]] : p
        const tr = novo(); tr.pontos(ord.filter(Boolean), true)
        camada.itens.push({ tipo: 'preench', segs: tr.segs, cor }); camada.entidades++
        return
      }
      case 'HATCH': {
        const contornos = (e.contornos as Contorno[] | undefined) || []
        const tr = novo()
        for (const k of contornos) {
          if ('poli' in k) {
            const v = k.poli; if (v.length < 2) continue
            tr.moveTo(v[0].x, v[0].y)
            for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; tr.bulge(a.x, a.y, b.x, b.y, a.bulge) } // área: sempre fecha
            tr.fechar()
          } else {
            let comecou = false
            for (const a of k.arestas) {
              if (a.t === 'linha') { if (comecou) tr.juntar(a.a.x, a.a.y); else tr.moveTo(a.a.x, a.a.y); tr.lineTo(a.b.x, a.b.y) }
              else if (a.t === 'arco' || a.t === 'elipse') {
                // aresta horária: o DXF grava os ângulos espelhados (−ângulo)
                const s = a.a0 * RAD, f = a.a1 * RAD
                let d = ((((f - s) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) || 2 * Math.PI
                const t0 = a.ccw ? s : -s
                if (!a.ccw) d = -d
                if (a.t === 'arco') tr.arco(a.c, { x: a.r, y: 0 }, 1, t0, d, comecou)
                else tr.arco(a.c, a.u, a.razao, t0, d, comecou)
              } else if (a.ctrl.length >= 2) {
                const pts = bspline(a.ctrl, a.grau, a.nos, a.pesos)
                pts.forEach((q, i) => (i || comecou ? tr.juntar(q.x, q.y) : tr.moveTo(q.x, q.y)))
              }
              comecou = true
            }
            if (comecou) tr.fechar()
          }
        }
        if (!tr.segs.length) { conta(ignoradas, 'hachura sem contorno legível (HATCH)'); return }
        if (!e.solido) padraoHachura++
        camada.itens.push({ tipo: 'preench', segs: tr.segs, cor, opacidade: e.solido ? 1 : 0.3 }); camada.entidades++
        return
      }
      case 'TEXT': case 'ATTRIB': case 'MTEXT': {
        if (e.invisivel) return
        const ehM = tipo === 'MTEXT'
        const est = estiloDe(e.style)
        let linhas: string[], fonteMt: string | null = null, negrito = est?.negrito || false, italico = est?.italico || false
        let h = fin((ehM ? e.height : e.textHeight) as number, 0)
        if (ehM) {
          const r = limparMtexto(String(e.text ?? ''))
          linhas = r.linhas; fonteMt = r.fonte; negrito = negrito || r.negrito; italico = italico || r.italico
          if (r.altura?.abs) h = r.altura.abs; else if (r.altura?.rel && h) h *= r.altura.rel
        } else linhas = [decodTexto(String(e.text ?? ''))]
        if (!linhas.some(l => l.trim())) return
        if (!(h > 0)) h = 2.5
        const p10 = (ehM ? e.position : e.startPoint) as Pt | undefined
        const p11 = e.endPoint as Pt | undefined
        let rot = fin(e.rotation as number)
        if (ehM && e.directionVector) { const dv = e.directionVector as Pt; if (dv.x || dv.y) rot = Math.atan2(dv.y, dv.x) / RAD }
        let ancora = p10 || { x: 0, y: 0 }, alinh: TextoSaida['alinh'] = 'start', dy0 = 0
        const lh = h * (5 / 3) * (fin(e.espacamento as number, 1) || 1), n = linhas.length
        if (ehM) {
          const ap0 = fin(e.attachmentPoint as number, 1), col = (ap0 - 1) % 3, lin = Math.floor((ap0 - 1) / 3)
          alinh = col === 1 ? 'middle' : col === 2 ? 'end' : 'start'
          const total = h + (n - 1) * lh
          dy0 = lin === 0 ? h : lin === 1 ? h - total / 2 : -(n - 1) * lh
        } else {
          const ha = fin(e.halign as number), va = fin(e.valign as number)
          if ((ha || va) && p11) ancora = p11
          if (ha === 3 || ha === 5) {
            if (p10 && p11) { ancora = { x: (p10.x + p11.x) / 2, y: (p10.y + p11.y) / 2 }; rot = Math.atan2(p11.y - p10.y, p11.x - p10.x) / RAD }
            alinh = 'middle'
          } else alinh = ha === 1 || ha === 4 ? 'middle' : ha === 2 ? 'end' : 'start'
          dy0 = ha === 4 ? h / 2 : va === 3 ? h : va === 2 ? h / 2 : va === 1 ? -0.3 * h : 0
        }
        // afim do bloco: posição, giro e escala do texto
        const q = ap(m, ancora.x, ancora.y)
        const dir = { x: m[0] * Math.cos(rot * RAD) + m[2] * Math.sin(rot * RAD), y: m[1] * Math.cos(rot * RAD) + m[3] * Math.sin(rot * RAD) }
        const cima = { x: -m[0] * Math.sin(rot * RAD) + m[2] * Math.cos(rot * RAD), y: -m[1] * Math.sin(rot * RAD) + m[3] * Math.cos(rot * RAD) }
        const k = Math.hypot(cima.x, cima.y) || 1
        const rotW = Math.atan2(dir.y, dir.x) / RAD
        const hW = h * k, fs = hW * 1.4
        const escX = ehM ? 1 : fin(e.xScale as number, 1) || 1
        const familia = familiaDe(est, fonteMt)
        const t: TextoSaida = { ancora: q, rot: rotW, fs, linhas, lh: lh * k, dy0: dy0 * k, alinh, familia, negrito, italico, escX }
        // caixa aproximada do texto (para o viewBox), no referencial do texto
        const largura = Math.max(...linhas.map(l => l.length)) * fs * 0.6 * escX
        const xs = alinh === 'start' ? [0, largura] : alinh === 'middle' ? [-largura / 2, largura / 2] : [-largura, 0]
        const ys = [-(t.dy0 - fs * 0.8), -(t.dy0 + (n - 1) * t.lh + fs * 0.25)] // Y para cima
        const c = Math.cos(rotW * RAD), s = Math.sin(rotW * RAD)
        for (const x of xs) for (const y of ys) caixa.add({ x: q.x + x * c - y * s, y: q.y + x * s + y * c })
        camada.itens.push({ tipo: 'texto', cor, texto: t }); camada.entidades++; camada.textos++
        return
      }
      case 'INSERT': case 'DIMENSION': {
        const nome = String((tipo === 'INSERT' ? e.name : e.block) ?? '')
        const b = blocos[nome]
        if (!b) { if (tipo === 'INSERT' && nome) blocoFaltando.add(nome); return }
        if (ctx.pilha.length >= 16 || ctx.pilha.includes(nome)) { profundo++; return }
        const filhoCtx = (mm: Mat): Ctx => ({ m: mm, camada: nomeCamada, cor: cor ?? camada.cor, pilha: [...ctx.pilha, nome] })
        const base = (b.position as Pt | undefined) || { x: 0, y: 0 }
        if (tipo === 'DIMENSION') { for (const f of b.entities || []) desenhar(f as Ent, filhoCtx(ctx.m)); return }
        const pos = (e.position as Pt | undefined) || { x: 0, y: 0 }
        const sx = fin(e.xScale as number, 1) || 1, sy = fin(e.yScale as number, 1) || 1, r = fin(e.rotation as number) * RAD
        const cols = Math.max(1, fin(e.columnCount as number, 1)), rows = Math.max(1, fin(e.rowCount as number, 1))
        const cs = fin(e.columnSpacing as number), rs = fin(e.rowSpacing as number)
        for (let li = 0; li < Math.min(rows, 200); li++) for (let co = 0; co < Math.min(cols, 200); co++) {
          const mm = mul(mul(mul(mul(mul(m, trans(pos.x, pos.y)), giro(r)), trans(co * cs, li * rs)), escala(sx, sy)), trans(-base.x, -base.y))
          for (const f of b.entities || []) {
            if ((f as Ent).type === 'ATTDEF') continue
            desenhar(f as Ent, filhoCtx(mm))
          }
        }
        return
      }
      case 'POINT': case 'ATTDEF': case 'VIEWPORT': return
      default: conta(ignoradas, tipo)
    }
  }
  // ATTRIB vem logo depois do seu INSERT; atributo na camada 0 acompanha a camada do INSERT
  let camadaInsert: string | null = null
  for (const e of dxf.entities as Ent[]) {
    if (e.type === 'INSERT') camadaInsert = String(e.layer ?? '0')
    else if (e.type !== 'ATTRIB') camadaInsert = null
    desenhar(e, { m: ID, camada: e.type === 'ATTRIB' ? camadaInsert : null, cor: null, pilha: [] })
  }

  // tipos que o leitor nem entrega (ex.: LEADER, IMAGE, 3DSOLID)
  for (const [t, n] of bruto.tipos) if (!SUPORTADAS.has(t) && !ignoradas.has(t) && t !== '3DFACE') ignoradas.set(t, n)
  if (caixa.vazia) throw new Error('Não achei nada desenhável neste DXF (só pontos, cotas ou espaço de papel?). Confira se o desenho está no Model/Espaço do modelo e exporte de novo.')

  // ── monta o SVG: Y invertido, viewBox a partir de 0 com margem ─────────────────
  const larg0 = caixa.x1 - caixa.x0, alt0 = caixa.y1 - caixa.y0
  const lado = Math.max(larg0, alt0) || 1
  const margem = lado * 0.02
  const W = Math.max(larg0, lado * 0.01) + 2 * margem, H = Math.max(alt0, lado * 0.01) + 2 * margem
  const X = (x: number) => x - caixa.x0 + margem
  const Y = (y: number) => caixa.y1 - y + margem
  const d = (segs: (string | number)[][]) => segs.map(s => {
    if (s[0] === 'Z') return 'Z'
    const out: string[] = [s[0] as string]
    for (let i = 1; i < s.length; i += 2) out.push(num(X(s[i] as number)), num(Y(s[i + 1] as number)))
    return out.join(' ')
  }).join(' ')
  const traco = lado / 700
  const ids = new Set<string>()
  const idDe = (nome: string) => {
    let id = nome.trim().replace(/[^\w\-.À-ÿ]+/g, '_') || 'camada'
    if (!/^[A-Za-z_À-ÿ]/.test(id)) id = 'camada_' + id
    let k = id, i = 2
    while (ids.has(k)) k = `${id}_${i++}`
    ids.add(k)
    return k
  }
  const partes: string[] = []
  const lista: { nome: string; entidades: number; textos: number }[] = []
  for (const c of camadas.values()) {
    if (!c.itens.length) continue
    lista.push({ nome: c.nome, entidades: c.entidades, textos: c.textos })
    if (c.oculta) avisos.push(`A camada "${c.nome}" está ${c.motivo} no DXF — veio escondida.`)
    const at = [`id="${esc(idDe(c.nome))}"`, `data-name="${esc(c.nome)}"`, `stroke="${c.cor}"`]
    if (c.tracejado) at.push(`stroke-dasharray="${c.tracejado}"`)
    if (c.oculta) at.push('display="none"')
    partes.push(`<g ${at.join(' ')}>`)
    for (const it of c.itens) {
      if (it.tipo === 'traco') {
        const x = [`d="${d(it.segs!)}"`]
        if (it.cor && it.cor !== c.cor) x.push(`stroke="${it.cor}"`)
        if (it.tracejado !== undefined && it.tracejado !== c.tracejado) x.push(`stroke-dasharray="${it.tracejado ?? 'none'}"`)
        partes.push(`<path ${x.join(' ')}/>`)
      } else if (it.tipo === 'preench') {
        partes.push(`<path d="${d(it.segs!)}" fill="${it.cor || c.cor}" fill-rule="evenodd" stroke="none"${it.opacidade !== undefined && it.opacidade < 1 ? ` fill-opacity="${it.opacidade}"` : ''}/>`)
      } else if (it.texto) {
        const t = it.texto, tx = X(t.ancora.x), ty = Y(t.ancora.y)
        const conteudo = t.linhas.join(' ').replace(/\s+/g, ' ').trim()
        const at2 = [`x="${num(tx)}"`, `y="${num(ty + t.dy0)}"`, `font-size="${num(t.fs)}"`, `fill="${it.cor || c.cor}"`, 'stroke="none"', `data-name="${esc(conteudo.slice(0, 40))}"`]
        if (t.familia) at2.push(`font-family="${esc(/\s/.test(t.familia) ? `'${t.familia}'` : t.familia)}, sans-serif"`)
        else at2.push('font-family="Arial, Helvetica, sans-serif"')
        if (t.alinh !== 'start') at2.push(`text-anchor="${t.alinh}"`)
        if (t.negrito) at2.push('font-weight="bold"')
        if (t.italico) at2.push('font-style="italic"')
        const tf: string[] = []
        if (Math.abs(t.rot) > 0.01) tf.push(`rotate(${num(-t.rot)} ${num(tx)} ${num(ty)})`)
        if (Math.abs(t.escX - 1) > 0.02) tf.push(`translate(${num(tx)} 0) scale(${num(t.escX)} 1) translate(${num(-tx)} 0)`)
        if (tf.length) at2.push(`transform="${tf.join(' ')}"`)
        const corpo = t.linhas.length === 1
          ? esc(t.linhas[0])
          : t.linhas.map((l, i) => `<tspan x="${num(tx)}"${i ? ` dy="${num(t.lh)}"` : ''}>${esc(l) || ' '}</tspan>`).join(' ') // espaço entre linhas: o textContent não gruda as palavras
        partes.push(`<text ${at2.join(' ')} xml:space="preserve">${corpo}</text>`)
      }
    }
    partes.push('</g>')
  }
  if (padraoHachura) avisos.push(`${padraoHachura} hachura(s) com padrão viraram preenchimento claro (o desenho do padrão não é reproduzido).`)
  if (papel) avisos.push(`${papel} objeto(s) do espaço de papel (layout) foram ignorados — só o Model entra.`)
  if (blocoFaltando.size) avisos.push(`Bloco(s) citados mas não definidos no arquivo: ${[...blocoFaltando].slice(0, 5).join(', ')}.`)
  if (profundo) avisos.push('Alguns blocos aninhados demais (ou que se referenciam) foram cortados.')
  if (shx.size) avisos.push(`Fonte(s) do AutoCAD (${[...shx].slice(0, 3).join(', ')}) trocadas por Arial — confira a fonte dos textos.`)
  if (ignoradas.size) avisos.push(`Ignorei o que não sei desenhar: ${[...ignoradas].map(([t, n]) => `${n}× ${t}`).join(', ')}.`)

  const wmm = W * mmPorUnidade, hmm = H * mmPorUnidade
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${num(wmm)}mm" height="${num(hmm)}mm" viewBox="0 0 ${num(W)} ${num(H)}" data-origem="dxf" data-mm-por-unidade="${mmPorUnidade}" fill="none" stroke-width="${num(traco)}" stroke-linecap="round" stroke-linejoin="round">\n${partes.join('\n')}\n</svg>`
  return { svg, camadas: lista, avisos }
}
