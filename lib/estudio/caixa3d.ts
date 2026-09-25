// SOA Edition — CAIXA 3D INTERATIVA (WebGL/three.js): monta a caixa de verdade a partir da mesma
// montagem 3D (Face3D em cm) e do mesmo mapa de faces do Método Mãe. Cada face vira um polígono com a
// face EM PÉ (faceEmPe) como textura; o que a montagem não lista (fundo, paredes de cuboide) é fechado
// aqui. Só navegador. O three NÃO é importado aqui (só tipos): quem chama passa o módulo já carregado
// (import dinâmico) → o three nunca entra em outros bundles.
//
// Convenções (caixasTipos): quad [topo-esq, topo-dir, base-dir, base-esq] visto de FORA (horário);
// triângulo [ponta, base-dir, base-esq]. Normal para FORA = cross(c3−c0, c1−c0) / cross(c2−c0, c1−c0).
// No three a face da frente é anti-horária → triângulos (TL, BL, BR) + (TL, BR, TR) e (ponta, BL, BR).
//
// Fechamento (o que dá para fechar):
// - FUNDO: se nenhuma face da montagem está no plano mais baixo, gera o polígono do chão = envoltória
//   convexa dos cantos com y≈mínimo (cuboide → retângulo l×p). Textura = face de papel 'fundo' do molde
//   se houver; senão a cor base. Se a base é uma aresta/ponto (ex.: ponta da Maleta Coração), não há fundo.
// - PAREDES: só em montagem 100% CUBOIDE (toda face num plano da caixa-limite) — a parede que faltar
//   (x±, z±) é criada com a face de papel do mesmo papel (se houver) ou a cor base.
// - TAMPA: nunca é inventada (sacola e caixa sem tampa são abertas de propósito); o avesso de todas as
//   faces é pintado com a cor de "papel por dentro", então por cima vê-se o interior, não o vazio.
// - Formas não convexas fora de cuboide (ex.: lado faltando numa pirâmide) NÃO são fechadas.
import type * as T from 'three'
import type { Face3D, FaceMolde, FaceRole, MoldeCaixaDef } from './caixasTipos'
import { caminhoForma, faceEmPe } from './montada'
import { desenharLaco, desenharPedra } from './cenasAcervo'

type Three = typeof import('three')
type V3 = [number, number, number]
type Montagem = MoldeCaixaDef['montagem']

export type FundoCena3D = { tipo: 'cor'; cor: string } | { tipo: 'canvas'; canvas: HTMLCanvasElement }

export interface ParamsCena3D {
  montagem: Montagem
  faces: FaceMolde[]
  /** Arte de impressão (molde aberto preenchido) AW×AH; null = caixa lisa. */
  arte: CanvasImageSource | null
  AW: number
  AH: number
  corBase?: string
  laco?: { cor: string } | null
  pedra?: { cor: string } | null
  corAlca?: string | null
  fundo: FundoCena3D
  /** Lado máximo (px) de cada textura de face. */
  resolucao?: number
}

export interface Cena3D {
  /** Tudo da caixa (faces, fundo gerado, alça, laço, pedra) + sombra de contato. */
  grupo: T.Group
  /** Fundo da cena (scene.background). */
  fundo: T.Color | T.Texture
  /** Sombra de contato (some no snapshot transparente). */
  sombra: T.Mesh
  /** Limites da caixa (sem a sombra). */
  limites: T.Box3
  /** O que não deu para fechar / avisos de montagem. */
  avisos: string[]
  dispose(): void
}

// ── vetores ──────────────────────────────────────────────────────────────────────────────────────
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V3): V3 => { const n = Math.hypot(...a) || 1; return [a[0] / n, a[1] / n, a[2] / n] }
const media = (ps: V3[]): V3 => mul(ps.reduce((s, x) => add(s, x), [0, 0, 0] as V3), 1 / ps.length)

/** Normal para FORA de uma Face3D (convenção do acervo). */
export function normalFace(c: V3[]): V3 {
  return norm(c.length === 3 ? cross(sub(c[2], c[0]), sub(c[1], c[0])) : cross(sub(c[3], c[0]), sub(c[1], c[0])))
}

function escurecer(cor: string, k: number): string {
  const m = /^#?([\da-f]{6})$/i.exec(cor.trim())
  if (!m) return '#e9e4dc'
  const n = parseInt(m[1], 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v * k))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** Maior face de papel de um papel (role). */
const maiorDoPapel = (faces: FaceMolde[], role: FaceRole) =>
  faces.filter(f => f.role === role).sort((a, b) => b.w * b.h - a.w * a.h)[0] || null

// ── cena ─────────────────────────────────────────────────────────────────────────────────────────

export function montarCena3D(THREE: Three, p: ParamsCena3D): Cena3D {
  const lixo: { dispose(): void }[] = []
  const guarda = <X extends { dispose(): void }>(x: X): X => { lixo.push(x); return x }
  const corBase = p.corBase || '#ffffff'
  const res = p.resolucao || 1024
  const avisos: string[] = []
  const grupo = new THREE.Group(); grupo.name = 'caixa3d'
  const porId = new Map(p.faces.map(f => [f.id, f]))
  const texturas = new Map<string, T.CanvasTexture>()
  const mascaras = new Map<string, T.CanvasTexture>()

  const texDaFace = (f: FaceMolde, mascara: boolean): T.CanvasTexture => {
    const chave = mascara ? f.id : `${f.id}:sem-mascara`
    let t = texturas.get(chave)
    if (!t) {
      t = guarda(new THREE.CanvasTexture(faceEmPe(p.arte, p.AW, p.AH, mascara ? f : { ...f, forma: 'retangulo' }, res, corBase)))
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
      texturas.set(chave, t)
    }
    return t
  }
  // máscara (branco = face) para o AVESSO de faces com forma — senão o avesso aparece fora do contorno
  const mascaraDa = (f: FaceMolde): T.CanvasTexture => {
    const chave = `${f.forma}:${f.topo ?? ''}`
    let t = mascaras.get(chave)
    if (!t) {
      const c = document.createElement('canvas'); c.width = c.height = 256
      const g = c.getContext('2d')!
      g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256)
      g.beginPath(); caminhoForma(g, f, 256, 256); g.fillStyle = '#fff'; g.fill()
      t = guarda(new THREE.CanvasTexture(c)); mascaras.set(chave, t)
    }
    return t
  }

  const corDentro = escurecer(corBase, 0.86)
  const matDentro = guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(corDentro), side: THREE.BackSide, roughness: 0.95, metalness: 0 }))
  const matLisa = guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(corBase), side: THREE.FrontSide, roughness: 0.85, metalness: 0 }))
  const matsDentroForma = new Map<string, T.MeshStandardMaterial>()

  /** Um polígono (posições + UVs + índices já no sentido do three) com a face por fora e o avesso por dentro. */
  const addPoligono = (nome: string, pos: V3[], uv: [number, number][], idx: number[], f: FaceMolde | null, mascara = true) => {
    const geo = guarda(new THREE.BufferGeometry())
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos.flat(), 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv.flat(), 2))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const forma = !!f && mascara && f.forma !== 'retangulo'
    let mat: T.Material = matLisa
    if (f) {
      mat = guarda(new THREE.MeshStandardMaterial({
        map: texDaFace(f, mascara), side: THREE.FrontSide, roughness: 0.82, metalness: 0,
        transparent: forma, alphaTest: forma ? 0.5 : 0,
      }))
    }
    const fora = new THREE.Mesh(geo, mat); fora.name = nome
    grupo.add(fora)
    let md: T.Material = matDentro
    if (forma && f) {
      const k = `${f.forma}:${f.topo ?? ''}`
      let m = matsDentroForma.get(k)
      if (!m) {
        m = guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(corDentro), side: THREE.BackSide, roughness: 0.95, alphaMap: mascaraDa(f), alphaTest: 0.5, transparent: true }))
        matsDentroForma.set(k, m)
      }
      md = m
    }
    const dentro = new THREE.Mesh(geo, md); dentro.name = `${nome}:dentro`
    grupo.add(dentro)
  }

  const QUAD_UV: [number, number][] = [[0, 1], [1, 1], [1, 0], [0, 0]]
  const QUAD_IDX = [0, 3, 2, 0, 2, 1]
  const TRI_UV: [number, number][] = [[0.5, 1], [1, 0], [0, 0]]
  const TRI_IDX = [0, 2, 1]

  const facesMont = (p.montagem?.faces || []).filter(f3 => Array.isArray(f3.cantos) && (f3.cantos.length === 3 || f3.cantos.length === 4))
  // cantos que de fato existem na caixa (o retângulo-limite de uma face em coração não é chão nem parede)
  const todos: V3[] = []
  for (const f3 of facesMont) {
    const c = f3.cantos as V3[]
    const f = porId.get(f3.faceId) || null
    if (c.length === 4 && f?.forma === 'coracao') {
      // coração: se as outras faces fecham um contorno neste plano (a cinta da maleta), a face vira esse
      // polígono (sem máscara) → veda a caixa sem frestas entre o contorno desenhado e a cinta
      const sel = selar(c, facesMont.filter(x => x !== f3).map(x => x.cantos as V3[]))
      if (sel) { addPoligono(f3.faceId, sel.pos, sel.uv, sel.idx, f, false); todos.push(...sel.pos); continue }
      addPoligono(f3.faceId, c, QUAD_UV, QUAD_IDX, f)
      continue
    }
    if (c.length === 4) addPoligono(f3.faceId, c, QUAD_UV, QUAD_IDX, f)
    else addPoligono(f3.faceId, c, TRI_UV, TRI_IDX, f)
    todos.push(...c)
  }
  if (!todos.length) avisos.push('A montagem não tem faces 3D.')

  // ── fechamento ──
  if (todos.length) {
    const mn: V3 = [Infinity, Infinity, Infinity], mx: V3 = [-Infinity, -Infinity, -Infinity]
    for (const v of todos) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], v[i]); mx[i] = Math.max(mx[i], v[i]) }
    const tam = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1
    const eps = tam * 1e-3
    const noPlano = (c: V3[], eixo: number, v: number) => c.every(x => Math.abs(x[eixo] - v) <= eps)

    // paredes que faltam (só cuboide puro)
    const planos: { eixo: number; v: number }[] = [0, 1, 2].flatMap(e => [{ eixo: e, v: mn[e] }, { eixo: e, v: mx[e] }])
    const cuboide = facesMont.every(f3 => f3.cantos.length === 4 && planos.some(pl => noPlano(f3.cantos as V3[], pl.eixo, pl.v)))
    if (cuboide) {
      const [x0, , z0] = mn, [x1, a, z1] = mx, y0 = mn[1]
      const paredes: { role: FaceRole; eixo: number; v: number; c: V3[] }[] = [
        { role: 'frente', eixo: 2, v: z1, c: [[x0, a, z1], [x1, a, z1], [x1, y0, z1], [x0, y0, z1]] },
        { role: 'tras', eixo: 2, v: z0, c: [[x1, a, z0], [x0, a, z0], [x0, y0, z0], [x1, y0, z0]] },
        { role: 'lateral_direita', eixo: 0, v: x1, c: [[x1, a, z1], [x1, a, z0], [x1, y0, z0], [x1, y0, z1]] },
        { role: 'lateral_esquerda', eixo: 0, v: x0, c: [[x0, a, z0], [x0, a, z1], [x0, y0, z1], [x0, y0, z0]] },
      ]
      for (const pa of paredes) {
        if (facesMont.some(f3 => noPlano(f3.cantos as V3[], pa.eixo, pa.v))) continue
        addPoligono(`gerada:${pa.role}`, pa.c, QUAD_UV, QUAD_IDX, maiorDoPapel(p.faces, pa.role))
        avisos.push(`Parede "${pa.role}" fechada automaticamente.`)
      }
    } else {
      const soltas = p.faces.filter(f => !facesMont.some(f3 => f3.faceId === f.id)).map(f => f.id)
      if (soltas.length) avisos.push(`Faces sem lugar no 3D (não aparecem): ${soltas.join(', ')}.`)
    }

    // fundo (chão) — se nada da montagem está no plano mais baixo
    if (!facesMont.some(f3 => noPlano(f3.cantos as V3[], 1, mn[1]))) {
      const base = todos.filter(v => Math.abs(v[1] - mn[1]) <= eps)
      const casco = envoltoria(base.map(v => [v[0], v[2]] as [number, number]))
      const area = Math.abs(casco.reduce((s, q, i) => { const r = casco[(i + 1) % casco.length]; return s + q[0] * r[1] - r[0] * q[1] }, 0)) / 2
      if (casco.length >= 3 && area > tam * tam * 1e-3) {
        const bx0 = Math.min(...casco.map(q => q[0])), bx1 = Math.max(...casco.map(q => q[0]))
        const bz0 = Math.min(...casco.map(q => q[1])), bz1 = Math.max(...casco.map(q => q[1]))
        const pos: V3[] = casco.map(q => [q[0], mn[1], q[1]])
        // "em pé" do fundo = visto de baixo com a frente (z+) no topo: u ao longo de x, v ao longo de z
        const uv = casco.map(q => [(q[0] - bx0) / (bx1 - bx0 || 1), (q[1] - bz0) / (bz1 - bz0 || 1)] as [number, number])
        const idx: number[] = []
        for (let i = 1; i + 1 < pos.length; i++) {
          const n = cross(sub(pos[i], pos[0]), sub(pos[i + 1], pos[0]))
          if (n[1] < 0) idx.push(0, i, i + 1); else idx.push(0, i + 1, i)
        }
        addPoligono('gerada:fundo', pos, uv, idx, maiorDoPapel(p.faces, 'fundo'))
      } else avisos.push('A base é uma aresta/ponto — sem fundo para fechar.')
    }
  }

  // ── alça ──
  const alca = p.montagem?.extra?.alca
  if (alca && alca.pontos.length > 1) {
    const curva = new THREE.CatmullRomCurve3(alca.pontos.map(q => new THREE.Vector3(q[0], q[1], q[2])))
    const geo = guarda(new THREE.TubeGeometry(curva, 96, Math.max(0.02, alca.espessura / 2), 14, false))
    const mat = guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(p.corAlca || alca.cor), roughness: 0.7, metalness: 0 }))
    const m = new THREE.Mesh(geo, mat); m.name = 'alca'; grupo.add(m)
  }

  // ── laço (sprite: sempre de frente para a câmera) ──
  const ex = p.montagem?.extra
  if (p.laco && ex?.laco) {
    const c = document.createElement('canvas'); c.width = c.height = 512
    desenharLaco(c.getContext('2d')!, 256, 236, 512 * 0.9, p.laco.cor)
    const t = guarda(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace
    const mat = guarda(new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.05 }))
    const s = new THREE.Sprite(mat); s.name = 'laco'
    const k = ex.laco.tamanho / 0.9
    s.scale.set(k, k, 1)
    s.center.set(0.5, 1 - 236 / 512)
    s.position.set(...(ex.laco.em as V3))
    grupo.add(s)
  }

  // ── pedra (plaquinha colada na face mais próxima) ──
  if (p.pedra && ex?.pedra) {
    const em = ex.pedra.em as V3
    let melhor: { n: V3; up: V3; d: number } | null = null
    for (const f3 of facesMont) {
      const c = f3.cantos as V3[], n = normalFace(c)
      const d = Math.abs(dot(sub(em, c[0]), n)) + 0.05 * Math.hypot(...sub(em, media(c)))
      if (!melhor || d < melhor.d) {
        const topo = c.length === 3 ? sub(c[0], mul(add(c[1], c[2]), 0.5)) : sub(c[0], c[3])
        melhor = { n, up: norm(topo), d }
      }
    }
    const c = document.createElement('canvas'); c.width = c.height = 256
    desenharPedra(c.getContext('2d')!, 128, 128, 230, p.pedra.cor)
    const t = guarda(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace
    const geo = guarda(new THREE.PlaneGeometry(ex.pedra.tamanho, ex.pedra.tamanho))
    const mat = guarda(new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.1, roughness: 0.25, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 }))
    const m = new THREE.Mesh(geo, mat); m.name = 'pedra'
    if (melhor) {
      const n = new THREE.Vector3(...melhor.n), up = new THREE.Vector3(...melhor.up)
      const x = new THREE.Vector3().crossVectors(up, n).normalize(), y = new THREE.Vector3().crossVectors(n, x)
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n))
      m.position.set(...add(em, mul(melhor.n, 0.03)))
    } else m.position.set(...em)
    grupo.add(m)
  }

  const limites = new THREE.Box3().setFromObject(grupo)
  if (limites.isEmpty()) limites.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1))

  // ── sombra de contato ──
  const sc = document.createElement('canvas'); sc.width = sc.height = 256
  const sg = sc.getContext('2d')!
  const gr = sg.createRadialGradient(128, 128, 0, 128, 128, 128)
  gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
  sg.fillStyle = gr; sg.fillRect(0, 0, 256, 256)
  const st = guarda(new THREE.CanvasTexture(sc))
  const sgeo = guarda(new THREE.PlaneGeometry(1, 1))
  const smat = guarda(new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, side: THREE.FrontSide }))
  const sombra = new THREE.Mesh(sgeo, smat); sombra.name = 'sombra'
  sombra.rotation.x = -Math.PI / 2
  const tx = limites.max.x - limites.min.x, tz = limites.max.z - limites.min.z
  sombra.scale.set(Math.max(tx, 0.3) * 1.9, Math.max(tz, 0.3) * 1.9, 1)
  sombra.position.set((limites.min.x + limites.max.x) / 2, limites.min.y - 0.01, (limites.min.z + limites.max.z) / 2)
  sombra.renderOrder = -1
  grupo.add(sombra)

  // ── fundo da cena ──
  let fundo: T.Color | T.Texture
  if (p.fundo.tipo === 'canvas') {
    const t = guarda(new THREE.CanvasTexture(p.fundo.canvas)); t.colorSpace = THREE.SRGBColorSpace
    fundo = t
  } else fundo = new THREE.Color(p.fundo.cor)

  return {
    grupo, fundo, sombra, limites, avisos,
    dispose() { for (const x of lixo) x.dispose(); lixo.length = 0; grupo.clear() },
  }
}

/**
 * Contorno fechado que as OUTRAS faces desenham no plano do quad `c` (arestas com as duas pontas no
 * plano, encadeadas). Devolve o polígono triangulado com UV do quadro em pé do quad, ou null.
 */
function selar(c: V3[], outras: V3[][]): { pos: V3[]; uv: [number, number][]; idx: number[] } | null {
  const n = normalFace(c)
  const tam = Math.max(...c.flatMap((a) => c.map((b) => Math.hypot(...sub(a, b))))) || 1
  const eps = tam * 1e-3
  const noPlano = (v: V3) => Math.abs(dot(sub(v, c[0]), n)) <= eps
  const chave = (v: V3) => v.map((x) => Math.round(x / eps)).join(',')
  const pts = new Map<string, V3>(), viz = new Map<string, Set<string>>()
  for (const o of outras) for (let i = 0; i < o.length; i++) {
    const a = o[i], b = o[(i + 1) % o.length]
    if (!noPlano(a) || !noPlano(b)) continue
    const ka = chave(a), kb = chave(b)
    if (ka === kb) continue
    pts.set(ka, a); pts.set(kb, b)
    if (!viz.has(ka)) viz.set(ka, new Set()); if (!viz.has(kb)) viz.set(kb, new Set())
    viz.get(ka)!.add(kb); viz.get(kb)!.add(ka)
  }
  if (pts.size < 3 || [...viz.values()].some((s) => s.size !== 2)) return null
  const inicio = viz.keys().next().value as string
  const laco: string[] = [inicio]
  let ant = '', cur = inicio
  for (;;) {
    const prox = [...viz.get(cur)!].find((k) => k !== ant)!
    if (prox === inicio) break
    if (laco.length > pts.size) return null
    laco.push(prox); ant = cur; cur = prox
  }
  if (laco.length !== pts.size) return null
  const pos = laco.map((k) => pts.get(k)!)
  // quadro em pé do quad: origem = base-esq, u → base-dir, v → topo-esq
  const o = c[3], ux = sub(c[2], c[3]), vy = sub(c[0], c[3])
  const uv = pos.map((v) => [dot(sub(v, o), ux) / dot(ux, ux), dot(sub(v, o), vy) / dot(vy, vy)] as [number, number])
  if (uv.some(([u, v]) => u < -0.05 || u > 1.05 || v < -0.05 || v > 1.05)) return null
  const tris = triangular(uv)
  if (!tris.length) return null
  const idx: number[] = []
  for (const [a, b, d] of tris) {
    const nn = cross(sub(pos[b], pos[a]), sub(pos[d], pos[a]))
    if (dot(nn, n) >= 0) idx.push(a, b, d); else idx.push(a, d, b)
  }
  return { pos, uv, idx }
}

/** Triangulação por orelhas de um polígono simples 2D (índices). */
function triangular(p: [number, number][]): [number, number, number][] {
  const area = p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1] }, 0)
  const ids = p.map((_, i) => i)
  if (area < 0) ids.reverse()
  const cr = (a: [number, number], b: [number, number], c: [number, number]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const dentro = (q: [number, number], a: [number, number], b: [number, number], c: [number, number]) => cr(a, b, q) >= 0 && cr(b, c, q) >= 0 && cr(c, a, q) >= 0
  const out: [number, number, number][] = []
  let guarda = 0
  while (ids.length > 3 && guarda++ < 10000) {
    let cortou = false
    for (let i = 0; i < ids.length; i++) {
      const ia = ids[(i + ids.length - 1) % ids.length], ib = ids[i], ic = ids[(i + 1) % ids.length]
      if (cr(p[ia], p[ib], p[ic]) <= 1e-12) continue
      if (ids.some((k) => k !== ia && k !== ib && k !== ic && dentro(p[k], p[ia], p[ib], p[ic]))) continue
      out.push([ia, ib, ic]); ids.splice(i, 1); cortou = true; break
    }
    if (!cortou) break
  }
  if (ids.length === 3) out.push([ids[0], ids[1], ids[2]])
  return out
}

/** Envoltória convexa (monotone chain) no plano. */
function envoltoria(pts: [number, number][]): [number, number][] {
  const ps = [...new Map(pts.map(q => [`${q[0].toFixed(4)},${q[1].toFixed(4)}`, q])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (ps.length < 3) return ps
  const cr = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lo: [number, number][] = [], hi: [number, number][] = []
  for (const q of ps) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q) }
  for (const q of [...ps].reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q) }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)]
}

// ── GLB opcional (modelo 3D próprio) ─────────────────────────────────────────────────────────────

/** Ajuste de UV por papel (coluna faceUV): offset/repeat/giro aplicados à textura da face no GLB. */
export type FaceUV = Partial<Record<FaceRole, { offset?: [number, number]; repeat?: [number, number]; rot?: number }>>

const PAPEIS_POR_TAMANHO: FaceRole[] = ['lateral_esquerda', 'lateral_direita', 'frente', 'tras', 'cima', 'fundo']
const papelDoNome = (nome: string): FaceRole | null => {
  const n = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s-]+/g, '_')
  return PAPEIS_POR_TAMANHO.find(r => n === r || n.startsWith(`${r}_`) || n.startsWith(`${r}.`) || (r === 'tras' && n.startsWith('tras'))) || null
}

/**
 * Texturiza um modelo GLB carregado: malhas cujo nome começa com um papel (frente, lateral_esquerda,
 * lateral_direita, tras, cima, fundo) recebem a face em pé daquele papel, com as UVs do próprio modelo.
 * Centraliza em x/z, apoia no chão (y=0) e escala para a altura da montagem (se houver).
 */
export function aplicarArteGLB(THREE: Three, raiz: T.Object3D, p: Omit<ParamsCena3D, 'montagem' | 'fundo'> & { alturaCm?: number | null; faceUV?: FaceUV | null }): { dispose(): void; texturizadas: string[] } {
  const lixo: { dispose(): void }[] = []
  const texturizadas: string[] = []
  const cache = new Map<string, T.CanvasTexture>()
  raiz.traverse(o => {
    const m = o as T.Mesh
    if (!m.isMesh) return
    const role = papelDoNome(m.name || '')
    const f = role ? maiorDoPapel(p.faces, role) : null
    if (!role || !f) return
    let t = cache.get(role)
    if (!t) {
      t = new THREE.CanvasTexture(faceEmPe(p.arte, p.AW, p.AH, f, p.resolucao || 1024, p.corBase || '#ffffff'))
      t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8
      const uv = p.faceUV?.[role]
      if (uv?.offset) t.offset.set(uv.offset[0], uv.offset[1])
      if (uv?.repeat) t.repeat.set(uv.repeat[0], uv.repeat[1])
      if (uv?.rot) { t.center.set(0.5, 0.5); t.rotation = (uv.rot * Math.PI) / 180 }
      cache.set(role, t); lixo.push(t)
    }
    const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.82, metalness: 0, transparent: f.forma !== 'retangulo', alphaTest: f.forma !== 'retangulo' ? 0.5 : 0 })
    lixo.push(mat)
    const velhos = Array.isArray(m.material) ? m.material : [m.material]
    for (const v of velhos) v?.dispose?.()
    m.material = mat
    texturizadas.push(m.name)
  })
  // enquadra: centro x/z, chão y=0, altura da montagem
  const bb = new THREE.Box3().setFromObject(raiz)
  if (!bb.isEmpty()) {
    const h = bb.max.y - bb.min.y
    const k = p.alturaCm && h > 0 ? p.alturaCm / h : 1
    raiz.scale.multiplyScalar(k)
    raiz.updateMatrixWorld(true)
    const b2 = new THREE.Box3().setFromObject(raiz)
    raiz.position.x -= (b2.min.x + b2.max.x) / 2
    raiz.position.z -= (b2.min.z + b2.max.z) / 2
    raiz.position.y -= b2.min.y
  }
  return {
    texturizadas,
    dispose() {
      for (const x of lixo) x.dispose()
      raiz.traverse(o => { const m = o as T.Mesh; if (m.isMesh) m.geometry?.dispose() })
    },
  }
}

// ── molde próprio: reaproveitar a forma de um modelo do acervo ───────────────────────────────────

/**
 * Montagem 3D de um molde PRÓPRIO usando a forma de um modelo do acervo: para cada face 3D do acervo,
 * pega o papel (role) da face do acervo e escolhe a face da artesã com o mesmo papel (mesma forma
 * primeiro, depois a maior ainda não usada; se acabar, repete a maior). Papel sem face dela = pula.
 * `dims` (cm, opcional) reescala x/y/z pelas razões l/a/p do modelo.
 */
export function montagemDoTipo(def: MoldeCaixaDef, faces: FaceMolde[], dims?: { l: number; p: number; a: number } | null): Montagem {
  const d0 = def.montagem.dims
  const sx = dims && dims.l > 0 ? dims.l / d0.l : 1
  const sy = dims && dims.a > 0 ? dims.a / d0.a : 1
  const sz = dims && dims.p > 0 ? dims.p / d0.p : 1
  const esc = (v: V3): V3 => [Math.round(v[0] * sx * 1000) / 1000, Math.round(v[1] * sy * 1000) / 1000, Math.round(v[2] * sz * 1000) / 1000]
  const usados = new Set<string>()
  const out: Face3D[] = []
  for (const f3 of def.montagem.faces) {
    const fa = def.faces.find(f => f.id === f3.faceId)
    if (!fa) continue
    const doPapel = faces.filter(f => f.role === fa.role).sort((a, b) => b.w * b.h - a.w * a.h)
    if (!doPapel.length) continue
    const livres = doPapel.filter(f => !usados.has(f.id))
    const escolhida = livres.find(f => f.forma === fa.forma) || livres[0] || doPapel[0]
    usados.add(escolhida.id)
    out.push({ faceId: escolhida.id, cantos: (f3.cantos as V3[]).map(esc) })
  }
  const ex = def.montagem.extra
  const kt = Math.sqrt(sx * sy)
  return {
    dims: { l: d0.l * sx, p: d0.p * sz, a: d0.a * sy },
    faces: out,
    extra: ex ? {
      ...(ex.alca ? { alca: { ...ex.alca, pontos: ex.alca.pontos.map(q => esc(q as V3)) } } : {}),
      ...(ex.laco ? { laco: { em: esc(ex.laco.em as V3), tamanho: ex.laco.tamanho * kt } } : {}),
      ...(ex.pedra ? { pedra: { em: esc(ex.pedra.em as V3), tamanho: ex.pedra.tamanho * kt } } : {}),
    } : undefined,
  }
}

/** Recorta um canvas transparente ao conteúdo (alfa > 8) com folga relativa. */
export function recortarAoConteudo(c: HTMLCanvasElement, folga = 0.06): HTMLCanvasElement {
  const g = c.getContext('2d', { willReadFrequently: true })!
  const { data, width: W, height: H } = g.getImageData(0, 0, c.width, c.height)
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) return c
  const m = Math.round(Math.max(x1 - x0, y1 - y0) * folga)
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(W - 1, x1 + m); y1 = Math.min(H - 1, y1 + m)
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1
  o.getContext('2d')!.drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height)
  return o
}
