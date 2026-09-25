// SOA Edition — ACERVO de moldes de caixa (die-lines) PARAMÉTRICOS e 100% autorais: cada molde é
// desenhado por código aqui (nada copiado de modelo de terceiros). O MESMO desenho gera o SVG de
// impressão, o mapa de faces (FaceMolde) e a montagem 3D (Face3D) → medidas sempre batem.
// Molde em mm (viewBox = folha A4/A3); 3D em cm. Corte = contínuo #111; vinco = tracejado #888;
// aba de cola = cinza claro com "cola".
//
// Convenções de "em pé" (rot) usadas em todos os modelos:
// - Paredes: topo = aresta de cima da caixa em pé.
// - cima: vista DE CIMA com a frente embaixo → topo do quadro = aresta de TRÁS.
// - fundo: vista DE BAIXO com a caixa tombada para trás (frente para cima) → topo = aresta da FRENTE.
// - Molde visto pelo lado impresso (= lado de FORA). Numa tira de paredes, a que fica à DIREITA da
//   frente no molde vira a lateral_direita (+x) ao dobrar.
// 3D: cantos na ordem do tipo ([topo-esq, topo-dir, base-dir, base-esq] / [ponta, base-dir, base-esq])
// vistos de FORA → sentido horário visto de fora; a normal para FORA é cross(c3−c0, c1−c0)
// (quad) / cross(c2−c0, c1−c0) (triângulo).
import type { Face3D, FaceMolde, FaceRole, FormaFace, MoldeCaixaDef } from './caixasTipos'

type Pt = [number, number]
type V3 = [number, number, number]
/** c = corte, v = vinco (dobra), n = não desenha (aresta já desenhada por outra peça). */
type Traco = 'c' | 'v' | 'n'

const r2 = (n: number) => Math.round(n * 100) / 100
const fm = (n: number) => String(r2(n))
const r5 = (n: number) => Math.round(n * 1e5) / 1e5
const soma = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]]
const menos = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]]
const vez = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k]
const unit = (a: Pt): Pt => { const m = Math.hypot(a[0], a[1]) || 1; return [a[0] / m, a[1] / m] }
const centro = (ps: Pt[]): Pt => vez(ps.reduce((s, p) => soma(s, p), [0, 0] as Pt), 1 / ps.length)

const COR_CORTE = '#111'
const COR_VINCO = '#888'
const COR_COLA = '#f3f4f6'

/** Prancheta de um molde: acumula traços (com dedupe — vinco vence corte), abas, cortes extras e faces. */
class Prancheta {
  private segs = new Map<string, { a: Pt; b: Pt; t: 'c' | 'v' }>()
  private colas: { pts: Pt[]; rotulo: boolean; ang: number }[] = []
  private extras: string[] = []
  private bb: Pt[] = []
  private fs: (Omit<FaceMolde, 'x' | 'y' | 'w' | 'h'> & { r: [number, number, number, number] })[] = []

  linha(a: Pt, b: Pt, t: Traco) {
    this.bb.push(a, b)
    if (t === 'n') return
    const ka = `${Math.round(a[0] * 100)},${Math.round(a[1] * 100)}`
    const kb = `${Math.round(b[0] * 100)},${Math.round(b[1] * 100)}`
    const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
    const old = this.segs.get(k)
    if (!old || (old.t === 'c' && t === 'v')) this.segs.set(k, { a, b, t })
  }

  poli(pts: Pt[], tipos: Traco | Traco[]) {
    pts.forEach((p, i) => this.linha(p, pts[(i + 1) % pts.length], Array.isArray(tipos) ? tipos[i] : tipos))
  }

  /** Retângulo em sentido horário na tela; tipos = [topo, direita, base, esquerda]. */
  ret(x: number, y: number, w: number, h: number, t: [Traco, Traco, Traco, Traco]) {
    this.poli([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], t)
  }

  /** Aba trapezoidal na aresta a→b, do lado oposto a `dentro`. chA/chB = recuo das pontas. */
  aba(a: Pt, b: Pt, prof: number, chA: number, chB: number, dentro: Pt, cola = false, rotulo = true): Pt[] {
    const t = unit(menos(b, a))
    let n: Pt = [t[1], -t[0]]
    const meio = vez(soma(a, b), 0.5)
    if ((meio[0] - dentro[0]) * n[0] + (meio[1] - dentro[1]) * n[1] < 0) n = vez(n, -1)
    const pts: Pt[] = [a, b, soma(soma(b, vez(n, prof)), vez(t, -chB)), soma(soma(a, vez(n, prof)), vez(t, chA))]
    this.poli(pts, ['n', 'c', 'c', 'c'])
    if (cola) this.cola(pts, rotulo, Math.atan2(t[1], t[0]))
    return pts
  }

  /** Área de cola (tinta clara + "cola" ao longo do ângulo dado, em rad). */
  cola(pts: Pt[], rotulo = true, ang = 0) {
    let g = (ang * 180) / Math.PI
    if (g > 90) g -= 180
    if (g < -90) g += 180
    this.colas.push({ pts, rotulo, ang: g })
  }

  circulo(c: Pt, r: number) {
    this.extras.push(`<circle cx="${fm(c[0])}" cy="${fm(c[1])}" r="${fm(r)}"/>`)
    this.bb.push([c[0] - r, c[1] - r], [c[0] + r, c[1] + r])
  }

  /** Corte curvo livre (path d em coords locais) + pontos que limitam sua caixa. */
  curva(d: string, limites: Pt[]) {
    this.extras.push(`<path d="${d}"/>`)
    this.bb.push(...limites)
  }

  face(id: string, role: FaceRole, x: number, y: number, w: number, h: number, rot: FaceMolde['rot'], forma: FormaFace = 'retangulo') {
    this.fs.push({ id, role, rot, forma, r: [x, y, w, h] })
  }

  /** Fecha na folha (centralizado): SVG + faces normalizadas. */
  fechar(larg: number, alt: number): { svg: string; faces: FaceMolde[] } {
    const xs = this.bb.map((p) => p[0]), ys = this.bb.map((p) => p[1])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const dx = (larg - (x1 - x0)) / 2 - x0
    const dy = (alt - (y1 - y0)) / 2 - y0
    const caminho = (t: 'c' | 'v') =>
      [...this.segs.values()].filter((s) => s.t === t).map((s) => `M${fm(s.a[0])} ${fm(s.a[1])}L${fm(s.b[0])} ${fm(s.b[1])}`).join('')
    const colas = this.colas.map((c) => `<polygon points="${c.pts.map((p) => `${fm(p[0])},${fm(p[1])}`).join(' ')}"/>`).join('')
    const rotulos = this.colas.filter((c) => c.rotulo).map((c) => {
      const m = centro(c.pts)
      return `<text x="${fm(m[0])}" y="${fm(m[1])}" dy="0.8" transform="rotate(${fm(c.ang)} ${fm(m[0])} ${fm(m[1])})">cola</text>`
    }).join('')
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${larg}mm" height="${alt}mm" viewBox="0 0 ${larg} ${alt}">` +
      `<g transform="translate(${fm(dx)} ${fm(dy)})">` +
      `<g fill="${COR_COLA}" stroke="none">${colas}</g>` +
      `<g fill="#9ca3af" font-family="Arial, Helvetica, sans-serif" font-size="2.2" text-anchor="middle">${rotulos}</g>` +
      `<path d="${caminho('v')}" fill="none" stroke="${COR_VINCO}" stroke-width="0.25" stroke-dasharray="2 1.5"/>` +
      `<path d="${caminho('c')}" fill="none" stroke="${COR_CORTE}" stroke-width="0.3" stroke-linecap="round"/>` +
      `<g fill="none" stroke="${COR_CORTE}" stroke-width="0.3">${this.extras.join('')}</g>` +
      `</g></svg>`
    const faces: FaceMolde[] = this.fs.map(({ r, ...f }) => ({
      ...f, x: r5((r[0] + dx) / larg), y: r5((r[1] + dy) / alt), w: r5(r[2] / larg), h: r5(r[3] / alt),
    }))
    return { svg, faces }
  }
}

// ── 3D ──────────────────────────────────────────────────────────────────────────────────────────

const q = (faceId: string, te: V3, td: V3, bd: V3, be: V3): Face3D => ({ faceId, cantos: [te, td, bd, be] })
const tri = (faceId: string, ponta: V3, bd: V3, be: V3): Face3D => ({ faceId, cantos: [ponta, bd, be] })
const r2v = (v: V3): V3 => [r2(v[0]), r2(v[1]), r2(v[2])]

/** Paredes de uma caixa reta (x ∈ ±l/2, z ∈ ±p/2, y ∈ 0…a), vistas de fora. */
function paredes(l: number, p: number, a: number, quais: FaceRole[]): Face3D[] {
  const x = l / 2, z = p / 2
  const todas: Record<FaceRole, Face3D> = {
    frente: q('frente', [-x, a, z], [x, a, z], [x, 0, z], [-x, 0, z]),
    tras: q('tras', [x, a, -z], [-x, a, -z], [-x, 0, -z], [x, 0, -z]),
    lateral_direita: q('lateral_direita', [x, a, z], [x, a, -z], [x, 0, -z], [x, 0, z]),
    lateral_esquerda: q('lateral_esquerda', [-x, a, -z], [-x, a, z], [-x, 0, z], [-x, 0, -z]),
    cima: q('cima', [-x, a, -z], [x, a, -z], [x, a, z], [-x, a, z]),
    fundo: q('fundo', [-x, 0, z], [x, 0, z], [x, 0, -z], [-x, 0, -z]),
  }
  return quais.map((r) => todas[r])
}

/** Arco (semi-elipse) de alça entre x0 e x1, subindo `altura` a partir de yBase, no plano z. */
function arco(x0: number, x1: number, yBase: number, altura: number, z: number, n = 15): V3[] {
  const cx = (x0 + x1) / 2, hw = (x1 - x0) / 2
  return Array.from({ length: n }, (_, i) => {
    const th = Math.PI - (Math.PI * i) / (n - 1)
    return r2v([cx + hw * Math.cos(th), yBase + altura * Math.sin(th), z])
  })
}

// ── Modelos ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Caixa Milk 6×6×10 (A4 deitado). Tira: lateral_esquerda | frente | lateral_direita | tras | cola.
 * Telhado a 45° (água = 30√2 mm → cumeeira 3 cm acima do corpo): frente e trás sobem como águas
 * (topo = cumeeira → rot 0); nas laterais o triângulo de vinco (base 60, altura 30) é a empena em pé
 * (ponta no topo → rot 0) e o resto dobra para dentro ao meio. Crista de 12 mm com furo para fita.
 * Fundo: 4 abas (frente/trás com sobreposição de 8 mm, colada).
 */
function milk(): MoldeCaixaDef {
  const W = 60, A = 100, s = 30 * Math.SQRT2, crista = 12
  const yTel = crista, yb = crista + s, yBase = yb + A
  const m = new Prancheta()
  m.linha([0, 0], [0, yBase], 'c')
  m.linha([0, 0], [4 * W, 0], 'c')
  m.linha([4 * W, 0], [4 * W, yBase], 'v')
  m.aba([4 * W, 0], [4 * W, yBase], 10, 3, 3, [200, 60], true)
  for (const x of [W, 2 * W, 3 * W]) m.linha([x, 0], [x, yBase], 'v')
  m.linha([0, yTel], [4 * W, yTel], 'v')
  m.linha([0, yb], [4 * W, yb], 'v')
  for (let i = 0; i < 4; i++) {
    const x = i * W
    m.linha([x + W, yBase], [x, yBase], 'v')
    const frenteTras = i % 2 === 1
    m.aba([x + W, yBase], [x, yBase], frenteTras ? 34 : 26, frenteTras ? 2 : 10, frenteTras ? 2 : 10, [x + W / 2, yb], i === 3)
    if (!frenteTras) {
      // empena: vincos da base até a ponta (meia largura) e vinco central até a crista
      const ponta: Pt = [x + W / 2, yb - W / 2]
      m.linha([x, yb], ponta, 'v')
      m.linha([x + W, yb], ponta, 'v')
      m.linha(ponta, [x + W / 2, 0], 'v')
    } else {
      m.circulo([x + W / 2, crista / 2], 2.2)
    }
  }
  m.face('lateral_esquerda', 'lateral_esquerda', 0, yb, W, A, 0)
  m.face('frente', 'frente', W, yb, W, A, 0)
  m.face('lateral_direita', 'lateral_direita', 2 * W, yb, W, A, 0)
  m.face('tras', 'tras', 3 * W, yb, W, A, 0)
  m.face('cima', 'cima', W, yTel, W, s, 0)
  m.face('cima_tras', 'cima', 3 * W, yTel, W, s, 0)
  m.face('lateral_esquerda_topo', 'lateral_esquerda', 0, yb - W / 2, W, W / 2, 0, 'triangulo')
  m.face('lateral_direita_topo', 'lateral_direita', 2 * W, yb - W / 2, W, W / 2, 0, 'triangulo')
  const { svg, faces } = m.fechar(297, 210)
  const l = 6, p = 6, a = 10, cume = a + 3
  return {
    id: 'milk', nome: 'Caixa Milk', categoria: 'caixa', larguraMm: 297, alturaMm: 210, svg, faces,
    montagem: {
      dims: { l, p, a },
      faces: [
        ...paredes(l, p, a, ['frente', 'lateral_direita', 'tras', 'lateral_esquerda']),
        q('cima', [-3, cume, 0], [3, cume, 0], [3, a, 3], [-3, a, 3]),
        q('cima_tras', [3, cume, 0], [-3, cume, 0], [-3, a, -3], [3, a, -3]),
        tri('lateral_direita_topo', [3, cume, 0], [3, a, -3], [3, a, 3]),
        tri('lateral_esquerda_topo', [-3, cume, 0], [-3, a, 3], [-3, a, -3]),
      ],
      extra: {
        laco: { em: [0, cume + 0.6, 0], tamanho: 3 },
        pedra: { em: [0, 8.2, p / 2 + 0.1], tamanho: 0.8 },
      },
    },
  }
}

/**
 * Cubo 6 cm (A4 deitado). Tira: lateral_esquerda | frente | lateral_direita | tras | cola.
 * Tampa (cima) presa no topo de TRÁS com aba de encaixe: a aresta presa (= trás) fica embaixo no
 * molde → topo em pé aponta para baixo → rot 180. Fundo preso na base da FRENTE: aresta presa
 * (= frente) fica em cima no molde → rot 0. Abas de pó nas laterais (cima e baixo).
 */
function cubo(): MoldeCaixaDef {
  const C = 60, enc = 10, y0 = enc + C
  const m = new Prancheta()
  m.ret(0, y0, C, C, ['v', 'v', 'v', 'c'])
  m.ret(C, y0, C, C, ['c', 'v', 'v', 'v'])
  m.ret(2 * C, y0, C, C, ['v', 'v', 'v', 'v'])
  m.ret(3 * C, y0, C, C, ['v', 'v', 'c', 'v'])
  m.ret(3 * C, enc, C, C, ['v', 'c', 'n', 'c'])
  m.ret(C, y0 + C, C, C, ['n', 'c', 'v', 'c'])
  m.aba([3 * C, enc], [4 * C, enc], enc, 3, 3, [3.5 * C, y0])
  m.aba([2 * C, y0 + 2 * C], [C, y0 + 2 * C], enc, 3, 3, [1.5 * C, y0])
  for (const x of [0, 2 * C]) {
    m.aba([x, y0], [x + C, y0], 16, 10, 10, [x + C / 2, y0 + C / 2])
    m.aba([x + C, y0 + C], [x, y0 + C], 16, 10, 10, [x + C / 2, y0 + C / 2])
  }
  m.aba([4 * C, y0], [4 * C, y0 + C], 12, 4, 4, [3.5 * C, y0 + C / 2], true)
  m.face('lateral_esquerda', 'lateral_esquerda', 0, y0, C, C, 0)
  m.face('frente', 'frente', C, y0, C, C, 0)
  m.face('lateral_direita', 'lateral_direita', 2 * C, y0, C, C, 0)
  m.face('tras', 'tras', 3 * C, y0, C, C, 0)
  m.face('cima', 'cima', 3 * C, enc, C, C, 180)
  m.face('fundo', 'fundo', C, y0 + C, C, C, 0)
  const { svg, faces } = m.fechar(297, 210)
  const l = 6, p = 6, a = 6
  return {
    id: 'cubo', nome: 'Cubo', categoria: 'caixa', larguraMm: 297, alturaMm: 210, svg, faces,
    montagem: {
      dims: { l, p, a },
      faces: paredes(l, p, a, ['frente', 'lateral_direita', 'tras', 'lateral_esquerda', 'cima', 'fundo']),
      extra: {
        laco: { em: [0, a + 0.3, 0], tamanho: 3 },
        pedra: { em: [0, 4.6, p / 2 + 0.1], tamanho: 0.8 },
      },
    },
  }
}

/**
 * Triângulo Love 8×5×6 (prisma deitado; A4 deitado). Tira vertical: tras | fundo | frente | encaixe.
 * No molde o eixo +x fica à ESQUERDA (fundo visto de baixo com a frente embaixo), então:
 * tras (cumeeira no alto) rot 0; fundo (aresta da frente embaixo) rot 180; frente (cumeeira embaixo)
 * rot 180. Triângulo preso à esquerda do fundo = lateral_direita, ponta p/ esquerda → rot 90; o da
 * direita = lateral_esquerda → rot 270. Abas dos triângulos: a de trás é colada; a da frente é de pó
 * (a frente abre como tampa e encaixa na cumeeira).
 */
function trianguloLove(): MoldeCaixaDef {
  const L = 80, P = 50, H = 60, S = Math.hypot(P / 2, H)
  const xT = H, yF = S, yFr = S + P, yEnc = 2 * S + P
  const m = new Prancheta()
  m.ret(xT, 0, L, S, ['c', 'c', 'v', 'c'])
  m.ret(xT, yF, L, P, ['v', 'v', 'v', 'v'])
  m.ret(xT, yFr, L, S, ['v', 'c', 'v', 'c'])
  m.aba([xT + L, yEnc], [xT, yEnc], 15, 6, 6, [xT + L / 2, yFr])
  // lateral_direita (esquerda do molde)
  const A: Pt = [0, yF + P / 2], B: Pt = [xT, yF], Cc: Pt = [xT, yF + P]
  m.poli([A, B, Cc], 'v')
  const cA = centro([A, B, Cc])
  m.aba(A, B, 10, 10, 4, cA, true)
  m.aba(Cc, A, 10, 4, 10, cA)
  // lateral_esquerda (direita do molde)
  const A2: Pt = [xT + L + H, yF + P / 2], B2: Pt = [xT + L, yF], C2: Pt = [xT + L, yF + P]
  m.poli([A2, B2, C2], 'v')
  const cA2 = centro([A2, B2, C2])
  m.aba(B2, A2, 10, 4, 10, cA2, true)
  m.aba(A2, C2, 10, 10, 4, cA2)
  m.face('tras', 'tras', xT, 0, L, S, 0)
  m.face('fundo', 'fundo', xT, yF, L, P, 180)
  m.face('frente', 'frente', xT, yFr, L, S, 180)
  m.face('lateral_direita', 'lateral_direita', 0, yF, H, P, 90, 'triangulo')
  m.face('lateral_esquerda', 'lateral_esquerda', xT + L, yF, H, P, 270, 'triangulo')
  const { svg, faces } = m.fechar(297, 210)
  const l = 8, p = 5, a = 6, x = l / 2, z = p / 2
  // pedra: 70% da altura da frente inclinada, 1 mm para fora pela normal
  const nz = H / S, ny = P / 2 / S, t = 0.7
  return {
    id: 'triangulo-love', nome: 'Triângulo Love', categoria: 'caixa', larguraMm: 297, alturaMm: 210, svg, faces,
    montagem: {
      dims: { l, p, a },
      faces: [
        q('frente', [-x, a, 0], [x, a, 0], [x, 0, z], [-x, 0, z]),
        q('tras', [x, a, 0], [-x, a, 0], [-x, 0, -z], [x, 0, -z]),
        tri('lateral_direita', [x, a, 0], [x, 0, -z], [x, 0, z]),
        tri('lateral_esquerda', [-x, a, 0], [-x, 0, z], [-x, 0, -z]),
        q('fundo', [-x, 0, z], [x, 0, z], [x, 0, -z], [-x, 0, -z]),
      ],
      extra: {
        laco: { em: [0, a + 0.3, 0], tamanho: 3 },
        pedra: { em: r2v([0, a * t + 0.1 * ny, z * (1 - t) + 0.1 * nz]), tamanho: 0.8 },
      },
    },
  }
}

/**
 * Pirâmide base 6×6, altura 6 (A4 deitado). Estrela: fundo no meio, 4 triângulos. Fundo visto de
 * baixo com a frente embaixo no molde (rot 180) → +x fica à ESQUERDA: triângulo de baixo = frente
 * (ponta p/ baixo, rot 180), de cima = tras (rot 0), da esquerda = lateral_direita (rot 90), da
 * direita = lateral_esquerda (rot 270). Cada triângulo tem aba de encaixe na aresta "horária"
 * (catavento) e furo perto da ponta para a fita.
 */
function piramide(): MoldeCaixaDef {
  const B = 60, Hp = 60, S = Math.hypot(Hp, B / 2), h = B / 2
  const m = new Prancheta()
  m.ret(-h, -h, B, B, ['v', 'v', 'v', 'v'])
  // giro horário na tela de k×90° em torno do centro
  const gira = (p: Pt, k: number): Pt => { let r = p; for (let i = 0; i < k; i++) r = [-r[1], r[0]]; return r }
  for (let k = 0; k < 4; k++) {
    const be = gira([-h, -h], k), ponta = gira([0, -h - S], k), bd = gira([h, -h], k)
    m.poli([be, ponta, bd], ['c', 'v', 'v'])
    m.aba(ponta, bd, 10, 16, 4, centro([be, ponta, bd]))
    m.circulo(gira([0, -h - S + 10], k), 1.8)
  }
  m.face('tras', 'tras', -h, -h - S, B, S, 0, 'triangulo')
  m.face('lateral_esquerda', 'lateral_esquerda', h, -h, S, B, 270, 'triangulo')
  m.face('frente', 'frente', -h, h, B, S, 180, 'triangulo')
  m.face('lateral_direita', 'lateral_direita', -h - S, -h, S, B, 90, 'triangulo')
  m.face('fundo', 'fundo', -h, -h, B, B, 180)
  const { svg, faces } = m.fechar(297, 210)
  const l = 6, p = 6, a = 6, x = l / 2, z = p / 2, topo: V3 = [0, a, 0]
  const t = 0.62, nrm = Math.hypot(a, z)
  return {
    id: 'piramide', nome: 'Pirâmide', categoria: 'caixa', larguraMm: 297, alturaMm: 210, svg, faces,
    montagem: {
      dims: { l, p, a },
      faces: [
        tri('frente', topo, [x, 0, z], [-x, 0, z]),
        tri('lateral_direita', topo, [x, 0, -z], [x, 0, z]),
        tri('tras', topo, [-x, 0, -z], [x, 0, -z]),
        tri('lateral_esquerda', topo, [-x, 0, z], [-x, 0, -z]),
        q('fundo', [-x, 0, z], [x, 0, z], [x, 0, -z], [-x, 0, -z]),
      ],
      extra: {
        laco: { em: [0, a + 0.2, 0], tamanho: 3 },
        pedra: { em: r2v([0, a * t + (0.1 * z) / nrm, z * (1 - t) + (0.1 * a) / nrm]), tamanho: 0.7 },
      },
    },
  }
}

/**
 * Maleta Coração 9×3,5×8,2 (A4 deitado) — APROXIMADA. Coração geométrico autoral = quadrado de lado
 * s girado 45° + dois semicírculos (diâmetro s) nos lados de cima; frente e trás iguais (rot 0,
 * ponta p/ baixo). Cinta de 35 mm (reta, dobra na curva) dá a volta: ponta → lado esq. (reto) →
 * lóbulo esq. → fenda → lóbulo dir. → lado dir. (reto) → ponta, com dentes de cola nas duas bordas.
 * Na cinta, a borda de BAIXO do molde é a da frente: lateral_esquerda sobe da ponta p/ a direita do
 * molde → topo à direita → rot 270; lateral_direita desce → rot 90; trechos de cima (topo = trás) rot 0.
 * Os lóbulos são curvos: cada lóbulo vira 3 trechos planos no 3D (cima, cima_2…cima_6), cada um com
 * seu retângulo na cinta. Alça de papel colada no alto dos lóbulos.
 */
function maletaCoracao(): MoldeCaixaDef {
  const W = 90, s = W / (1 + Math.SQRT1_2), Hc = s * (1.5 * Math.SQRT1_2 + 0.5), D = 35
  const Arc = (Math.PI * s) / 2, Lt = 2 * s + 2 * Arc, xFenda = s + Arc, dente = 6
  const m = new Prancheta()
  // cinta
  m.linha([0, 0], [0, D], 'c')
  m.linha([Lt, 0], [Lt, D], 'v')
  m.aba([Lt, 0], [Lt, D], 10, 3, 3, [Lt / 2, D / 2], true)
  m.linha([xFenda, 0], [xFenda, D], 'v')
  const passo = 10, larg = 8
  const dentes: [number, number][] = []
  for (let x = 3; x + larg <= Lt - 3; x += passo) {
    if (Math.abs(x + larg / 2 - xFenda) < 7) continue
    dentes.push([x, x + larg])
  }
  for (const y of [0, D]) {
    let cur = 0
    for (const [xa, xb] of dentes) {
      m.linha([cur, y], [xa, y], 'c')
      m.linha([xa, y], [xb, y], 'v')
      const pts = m.aba([xa, y], [xb, y], dente, 2.5, 2.5, [xa, D / 2])
      m.cola(pts, false)
      cur = xb
    }
    m.linha([cur, y], [Lt, y], 'c')
  }
  m.face('lateral_esquerda', 'lateral_esquerda', 0, 0, s, D, 270)
  const trecho = Arc / 3
  for (let i = 0; i < 6; i++) m.face(i === 0 ? 'cima' : `cima_${i + 1}`, 'cima', s + i * trecho, 0, trecho, D, 0)
  m.face('lateral_direita', 'lateral_direita', s + 2 * Arc, 0, s, D, 90)
  // corações
  const yC = D + dente + 8
  const coracao = (hx: number, hy: number) => {
    const ponta: Pt = [hx + W / 2, hy + Hc], d = s * Math.SQRT1_2
    const L: Pt = [ponta[0] - d, ponta[1] - d], R: Pt = [ponta[0] + d, ponta[1] - d], fenda: Pt = [ponta[0], ponta[1] - 2 * d]
    const r = s / 2
    m.curva(
      `M${fm(ponta[0])} ${fm(ponta[1])}L${fm(L[0])} ${fm(L[1])}A${fm(r)} ${fm(r)} 0 0 1 ${fm(fenda[0])} ${fm(fenda[1])}` +
      `A${fm(r)} ${fm(r)} 0 0 1 ${fm(R[0])} ${fm(R[1])}Z`,
      [[hx, hy], [hx + W, hy + Hc]],
    )
  }
  coracao(0, yC)
  coracao(W + 10, yC)
  m.face('frente', 'frente', 0, yC, W, Hc, 0, 'coracao')
  m.face('tras', 'tras', W + 10, yC, W, Hc, 0, 'coracao')
  // alça: tira com pontas de cola
  const cA = 110, lA = 12, yA = yC + Hc + 8, xA = 0
  m.ret(xA, yA, cA, lA, ['c', 'c', 'c', 'c'])
  m.linha([xA + 15, yA], [xA + 15, yA + lA], 'v')
  m.linha([xA + cA - 15, yA], [xA + cA - 15, yA + lA], 'v')
  m.cola([[xA, yA], [xA + 15, yA], [xA + 15, yA + lA], [xA, yA + lA]])
  m.cola([[xA + cA - 15, yA], [xA + cA, yA], [xA + cA, yA + lA], [xA + cA - 15, yA + lA]])
  const { svg, faces } = m.fechar(297, 210)

  // 3D (cm): ponta em y=0; L/R = cantos do quadrado; lóbulos com centro no meio dos lados de cima
  const sc = s / 10, d = sc * Math.SQRT1_2, z = D / 20, rr = sc / 2
  const Lp: [number, number] = [-d, d], Rp: [number, number] = [d, d]
  const lob = (cx: number, cy: number, a0: number, a1: number) =>
    [0, 1, 2, 3].map((i) => { const th = ((a0 + ((a1 - a0) * i) / 3) * Math.PI) / 180; return [cx + rr * Math.cos(th), cy + rr * Math.sin(th)] as [number, number] })
  const pts = [...lob(-d / 2, 1.5 * d, 225, 45), ...lob(d / 2, 1.5 * d, 135, -45).slice(1)]
  const trechos: Face3D[] = []
  for (let i = 0; i < 6; i++) {
    const a = pts[i], b = pts[i + 1]
    trechos.push(q(i === 0 ? 'cima' : `cima_${i + 1}`, r2v([a[0], a[1], -z]), r2v([b[0], b[1], -z]), r2v([b[0], b[1], z]), r2v([a[0], a[1], z])))
  }
  const Ht = r2(1.5 * d + rr), Wt = r2(W / 10), xw = Wt / 2
  return {
    id: 'maleta-coracao', nome: 'Maleta Coração', categoria: 'maleta', larguraMm: 297, alturaMm: 210, svg, faces,
    montagem: {
      dims: { l: Wt, p: D / 10, a: Ht },
      faces: [
        q('frente', [-xw, Ht, z], [xw, Ht, z], [xw, 0, z], [-xw, 0, z]),
        q('tras', [xw, Ht, -z], [-xw, Ht, -z], [-xw, 0, -z], [xw, 0, -z]),
        q('lateral_esquerda', r2v([Lp[0], Lp[1], -z]), r2v([Lp[0], Lp[1], z]), [0, 0, z], [0, 0, -z]),
        q('lateral_direita', r2v([Rp[0], Rp[1], z]), r2v([Rp[0], Rp[1], -z]), [0, 0, -z], [0, 0, z]),
        ...trechos,
      ],
      extra: {
        alca: { pontos: arco(-d / 2, d / 2, Ht, 3, 0), espessura: 0.5, cor: '#e7e2da' },
        laco: { em: [0, r2(Ht + 3), 0], tamanho: 2.5 },
        pedra: { em: [0, r2(1.5 * d - 0.9), r2(z + 0.1)], tamanho: 0.8 },
      },
    },
  }
}

/**
 * Maleta com alça 9×4×8 (A4 deitado). Tira: lateral_esquerda | frente | lateral_direita | tras | cola.
 * Tampa (cima) presa em TRÁS com encaixe na frente → rot 180 (como no cubo); fundo preso na FRENTE
 * com encaixe → rot 0. Alça = peça à parte (placa com furo de mão + 2 linguetas de cola): a placa
 * passa de baixo p/ cima pelo corte central da tampa e as linguetas se abrem e colam por dentro.
 */
function maletaAlca(): MoldeCaixaDef {
  const L = 90, P = 40, A = 80, enc = 15, yb = enc + P
  const m = new Prancheta()
  m.ret(0, yb, P, A, ['v', 'v', 'v', 'c'])
  m.ret(P, yb, L, A, ['c', 'v', 'v', 'v'])
  m.ret(P + L, yb, P, A, ['v', 'v', 'v', 'v'])
  m.ret(2 * P + L, yb, L, A, ['v', 'v', 'c', 'v'])
  m.ret(2 * P + L, enc, L, P, ['v', 'c', 'n', 'c'])
  m.ret(P, yb + A, L, P, ['n', 'c', 'v', 'c'])
  m.aba([2 * P + L, enc], [2 * P + 2 * L, enc], enc, 5, 5, [2 * P + 1.5 * L, yb])
  m.aba([P + L, yb + A + P], [P, yb + A + P], enc, 5, 5, [P + L / 2, yb])
  for (const x of [0, P + L]) {
    m.aba([x, yb], [x + P, yb], 16, 8, 8, [x + P / 2, yb + A / 2])
    m.aba([x + P, yb + A], [x, yb + A], 16, 8, 8, [x + P / 2, yb + A / 2])
  }
  m.aba([2 * P + 2 * L, yb], [2 * P + 2 * L, yb + A], 12, 4, 4, [2 * P + 1.5 * L, yb + A / 2], true)
  // corte da alça no meio da tampa (paralelo à frente)
  const cx = 2 * P + 1.5 * L, cy = enc + P / 2
  m.linha([cx - 26, cy], [cx + 26, cy], 'c')
  // peça da alça, na sobra acima da frente
  const ax = P + L / 2 - 25, ay = 4, pw = 50, ph = 26, lg = 10, ra = 10
  m.curva(
    `M${ax} ${ay + ph}L${ax} ${ay + ra}A${ra} ${ra} 0 0 1 ${ax + ra} ${ay}L${ax + pw - ra} ${ay}` +
    `A${ra} ${ra} 0 0 1 ${ax + pw} ${ay + ra}L${ax + pw} ${ay + ph}`,
    [[ax, ay], [ax + pw, ay + ph]],
  )
  const mx = ax + pw / 2, my = ay + 11
  m.curva(`M${mx - 11} ${my - 4}L${mx + 11} ${my - 4}A4 4 0 0 1 ${mx + 11} ${my + 4}L${mx - 11} ${my + 4}A4 4 0 0 1 ${mx - 11} ${my - 4}Z`, [])
  m.linha([ax, ay + ph], [ax + pw, ay + ph], 'v')
  m.poli([[ax, ay + ph], [ax, ay + ph + lg], [ax + pw, ay + ph + lg], [ax + pw, ay + ph]], ['c', 'c', 'c', 'n'])
  m.linha([mx, ay + ph], [mx, ay + ph + lg], 'c')
  m.cola([[ax, ay + ph], [mx, ay + ph], [mx, ay + ph + lg], [ax, ay + ph + lg]])
  m.cola([[mx, ay + ph], [ax + pw, ay + ph], [ax + pw, ay + ph + lg], [mx, ay + ph + lg]])
  m.face('lateral_esquerda', 'lateral_esquerda', 0, yb, P, A, 0)
  m.face('frente', 'frente', P, yb, L, A, 0)
  m.face('lateral_direita', 'lateral_direita', P + L, yb, P, A, 0)
  m.face('tras', 'tras', 2 * P + L, yb, L, A, 0)
  m.face('cima', 'cima', 2 * P + L, enc, L, P, 180)
  m.face('fundo', 'fundo', P, yb + A, L, P, 0)
  const { svg, faces } = m.fechar(297, 210)
  const l = 9, p = 4, a = 8
  return {
    id: 'maleta-alca', nome: 'Maleta com alça', categoria: 'maleta', larguraMm: 297, alturaMm: 210, svg, faces,
    montagem: {
      dims: { l, p, a },
      faces: paredes(l, p, a, ['frente', 'lateral_direita', 'tras', 'lateral_esquerda', 'cima', 'fundo']),
      extra: {
        alca: { pontos: arco(-2.5, 2.5, a, 2.6, 0), espessura: 0.5, cor: '#e7e2da' },
        laco: { em: [-1.9, 9.7, 0.3], tamanho: 2.2 },
        pedra: { em: [0, 5.8, p / 2 + 0.1], tamanho: 0.8 },
      },
    },
  }
}

/**
 * Sacola (papel, sanfona lateral). Tira: frente | lateral_direita | tras | lateral_esquerda | cola;
 * todas em pé (rot 0). Barra de reforço dobrada para dentro no alto (furos espelhados p/ o cordão),
 * vinco central + diagonais de sanfona nas laterais, fundo em 4 abas (frente/trás sobrepõem).
 */
function sacola(id: string, nome: string, L: number, P: number, A: number, barra: number, dh: number, rFuro: number, folha: [number, number]): MoldeCaixaDef {
  const Wt = 2 * L + 2 * P, hy = barra / 2
  const m = new Prancheta()
  const xs = [0, L, L + P, 2 * L + P, Wt]
  m.linha([0, -barra], [0, A], 'c')
  m.linha([0, -barra], [Wt, -barra], 'c')
  m.linha([0, 0], [Wt, 0], 'v')
  m.linha([Wt, -barra], [Wt, A], 'v')
  m.aba([Wt, -barra], [Wt, A], 12, 4, 4, [Wt - L / 2, A / 2], true)
  for (const x of xs.slice(1, 4)) m.linha([x, -barra], [x, A], 'v')
  for (let i = 0; i < 4; i++) {
    const x = xs[i], w = xs[i + 1] - xs[i], lateral = i % 2 === 1
    m.linha([x + w, A], [x, A], 'v')
    if (lateral) {
      m.aba([x + w, A], [x, A], P / 2, P / 2 - 3, P / 2 - 3, [x + w / 2, 0])
      const k: Pt = [x + P / 2, A - P / 2]
      m.linha([x + P / 2, -barra], [x + P / 2, A], 'v')
      m.linha([x, A], k, 'v')
      m.linha([x + P, A], k, 'v')
    } else {
      m.aba([x + w, A], [x, A], P / 2 + 10, 3, 3, [x + w / 2, 0], i === 2)
      for (const sx of [-dh, dh]) {
        m.circulo([x + L / 2 + sx, hy], rFuro)
        m.circulo([x + L / 2 + sx, -hy], rFuro)
      }
    }
  }
  m.face('frente', 'frente', 0, 0, L, A, 0)
  m.face('lateral_direita', 'lateral_direita', L, 0, P, A, 0)
  m.face('tras', 'tras', L + P, 0, L, A, 0)
  m.face('lateral_esquerda', 'lateral_esquerda', 2 * L + P, 0, P, A, 0)
  const { svg, faces } = m.fechar(folha[0], folha[1])
  const l = L / 10, p = P / 10, a = A / 10, yF = r2(a - hy / 10), zF = r2(p / 2 + 0.05)
  return {
    id, nome, categoria: 'sacola', larguraMm: folha[0], alturaMm: folha[1], svg, faces,
    montagem: {
      dims: { l, p, a },
      faces: paredes(l, p, a, ['frente', 'lateral_direita', 'tras', 'lateral_esquerda']),
      extra: {
        alca: { pontos: arco(-dh / 10, dh / 10, yF, r2(a * 0.42), zF), espessura: 0.25, cor: '#b08968' },
        laco: { em: [r2(dh / 10), yF, r2(p / 2 + 0.15)], tamanho: r2(l * 0.22) },
        pedra: { em: [0, r2(a * 0.72), r2(p / 2 + 0.1)], tamanho: 0.8 },
      },
    },
  }
}

export const ACERVO_CAIXAS: MoldeCaixaDef[] = [
  milk(),
  cubo(),
  trianguloLove(),
  piramide(),
  maletaCoracao(),
  maletaAlca(),
  sacola('sacola-g', 'Sacola G', 120, 60, 150, 20, 25, 2.2, [420, 297]),
  sacola('sacola-p', 'Sacola P', 80, 40, 100, 15, 16, 1.8, [297, 210]),
]

export const acervoCaixa = (id: string): MoldeCaixaDef | undefined => ACERVO_CAIXAS.find((c) => c.id === id)
