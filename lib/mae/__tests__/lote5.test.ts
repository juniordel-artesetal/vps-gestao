// Lote 5 — ajustes da Naty (08–09/10/2026). Item 68 (arte inteligente) com os moldes REAIS: sobra uniforme,
// sem branco dentro do corte, sem uma face invadir a outra.
import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas, Path2D as P2D } from '@napi-rs/canvas'
;(globalThis as { Path2D?: unknown }).Path2D ??= P2D
import { inflatePathsD, unionD, intersectD, FillRule, JoinType, EndType, type PathsD } from 'clipper2-ts'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { atribuirFace, garantirPartesPadrao } from '@/lib/mae/vinculo/partes'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from '@/lib/mae/render'
import { facesParaReceita } from '@/lib/mae/editor/moldes'
import { matrizDoMolde } from '@/lib/mae/editor/giroMolde'
import { aplicar } from '@/lib/mae/vinculo/matriz'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema, type DocTrabalho, type NoCamada } from '@/lib/mae/schema'
import { regioesDeImpressao } from '@/lib/mae/exportar/sobra'
import { abrirMoldeReal } from './moldesReais'
import type { Pt } from '@/lib/mae/faces/geometria'

const SOBRA = 10, K = 4   // 4 px/mm
const VERMELHO = [225, 29, 72], ROSA = [255, 102, 170]
const D = (p: Pt[]) => p.map(([x, y]) => ({ x, y }))
const areaD = (ps: PathsD) => ps.reduce((s, p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j].x * p[i].y - p[i].x * p[j].y; return s + a / 2 }, 0)
const areaPol = (p: Pt[]) => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1]; return Math.abs(s / 2) }
function distPol(p: Pt, poly: Pt[]) {
  let d = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy
    const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L)) : 0
    d = Math.min(d, Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy))
  }
  return d
}
function dentroPol(p: Pt, poly: Pt[]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

async function montar(nome: string) {
  const d: DocTrabalho = novoDocumento('A4')
  const mol = await abrirMoldeReal(nome + '.pdf')
  const W = mol.prep.recorte.wMm + 2 * SOBRA + 30, H = (mol.prep.recorte.hMm ?? 0) + 2 * SOBRA + 30
  d.artboards = [{ id: 'ab', widthMm: W, heightMm: H }]
  d.molds = [{ id: 'm', name: nome, artboardId: 'ab', transform: { xMm: SOBRA + 15, yMm: SOBRA + 15, rotationDeg: 0 },
    source: { path: `Bases/moldes/${nome}.pdf`, sha256: 'a'.padEnd(64, '0'), widthMm: mol.prep.recorte.wMm, heightMm: mol.prep.recorte.hMm },
    faces: facesParaReceita('m', mol.det.faces) }]
  garantirPartesPadrao(d)
  const solidas = [...d.molds[0].faces].filter(f => !f.hole).sort((a, b) => areaPol(b.polygonMm as Pt[]) - areaPol(a.polygonMm as Pt[]))
  atribuirFace(d, 'p_frente', solidas[0].id)
  atribuirFace(d, 'p_fundo', solidas[1].id)
  // o resto fica SEM parte (abas e faces ainda não marcadas): têm que continuar o papel da vizinha
  const tema = DocTema.parse({ schemaVersion: 1, type: 'theme', id: 'th', version: 1, baseId: 'b', baseVersion: 1, partContent: {
    p_frente: [{ id: 'l_papel', type: 'image', anchor: 'paper', path: 'Papéis/vermelho.png', sha256: 'vvvv', aspect: 1.5 }],
    p_fundo: [{ id: 'l_cor', type: 'solid', anchor: 'paper', color: '#ff66aa' }],
  } })
  const T = matrizDoMolde(d.molds[0])
  const naFolha = (p: Pt[]) => p.map(([x, y]) => aplicar(T, x, y) as Pt)
  const faces = d.molds[0].faces.map(f => ({ id: f.id, hole: f.hole, poly: naFolha(f.polygonMm as Pt[]) }))
  return { d, tema, faces, frente: solidas[0].id, fundo: solidas[1].id }
}

function desenhar(d: DocTrabalho, nos: NoCamada[]) {
  const ab = { ...d.artboards[0], layers: nos }
  const { w, h } = tamanhoDoCanvas(ab, K)
  const cv = createCanvas(w, h)
  const papel = createCanvas(60, 40); const g = papel.getContext('2d'); g.fillStyle = `rgb(${VERMELHO.join(',')})`; g.fillRect(0, 0, 60, 40)
  renderizarPrancheta(cv as unknown as CanvasLike, ab, { pxPorMm: K, fundo: '#ffffff', criarCanvas: (a, b) => createCanvas(a, b) as unknown as CanvasLike, bitmap: () => papel as unknown as CanvasImageSource })
  const dados = cv.getContext('2d').getImageData(0, 0, w, h).data
  return (x: number, y: number) => { const i = (Math.round(y * K) * w + Math.round(x * K)) * 4; return [dados[i], dados[i + 1], dados[i + 2]] }
}
const branco = (c: number[]) => c[0] > 245 && c[1] > 245 && c[2] > 245
const cor = (c: number[], alvo: number[]) => c.every((v, i) => Math.abs(v - alvo[i]) < 12)

describe.each(['MILK', 'MALETA COM ALÇA'])('item 68 — arte inteligente com o molde real %s', nome => {
  let m: Awaited<ReturnType<typeof montar>>
  let px: (x: number, y: number) => number[]
  let contorno: PathsD
  beforeAll(async () => {
    m = await montar(nome)
    px = desenhar(m.d, resolverPrancheta(m.d, 'ab', { tema: m.tema, modo: 'impressao', sobraMm: SOBRA }))
    const solidas = m.faces.filter(f => !f.hole)
    contorno = inflatePathsD(unionD(inflatePathsD(solidas.map(f => D(f.poly)), 0.05, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD, FillRule.NonZero) as PathsD, -0.05, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD
  }, 120_000)

  it('regiões das faces não se sobrepõem e juntas cobrem o contorno + sobra', () => {
    const reg = regioesDeImpressao(m.faces, SOBRA)
    const ids = [...reg.keys()], lista = [...reg.values()]
    const poly = (id: string) => [D(m.faces.find(f => f.id === id)!.poly)]
    for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
      const inter = Math.abs(areaD(intersectD(lista[i].map(D), lista[j].map(D), FillRule.EvenOdd, 3) as PathsD))
      // a sobreposição que já vem das próprias faces detectadas (dobra) não conta — a sobra não acrescenta nada
      const jaVinha = Math.abs(areaD(intersectD(poly(ids[i]), poly(ids[j]), FillRule.EvenOdd, 3) as PathsD))
      expect(inter - jaVinha).toBeLessThan(0.5)   // mm²
    }
    const total = lista.reduce((s, r) => s + Math.abs(areaD(r.map(D))), 0)
    const limite = Math.abs(areaD(inflatePathsD(contorno, SOBRA, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD))
    const furos = m.faces.filter(f => f.hole).reduce((s, f) => s + areaPol(f.poly), 0)
    expect(total).toBeGreaterThan((limite - furos) * 0.985)
    expect(total).toBeLessThan(limite * 1.005)
  })

  it('nenhum branco dentro da linha de corte (abas e vãos inclusive)', () => {
    const furos = m.faces.filter(f => f.hole).map(f => f.poly)
    let amostras = 0, brancos = 0
    for (const p of contorno) {
      const pol = p.map(q => [q.x, q.y] as Pt)
      const xs = pol.map(q => q[0]), ys = pol.map(q => q[1])
      for (let x = Math.min(...xs) + 0.3; x < Math.max(...xs); x += 1.5) for (let y = Math.min(...ys) + 0.3; y < Math.max(...ys); y += 1.5) {
        const q: Pt = [x, y]
        if (!dentroPol(q, pol) || distPol(q, pol) < 0.6) continue
        if (furos.some(h => dentroPol(q, h) || distPol(q, h) < 1.5)) continue
        amostras++
        if (branco(px(x, y))) brancos++
      }
    }
    expect(amostras).toBeGreaterThan(500)
    expect(brancos).toBe(0)
  })

  it('a sobra tem a medida certa em toda a volta: coberta até 9 mm, branca depois de 11 mm', () => {
    const meios = (dist: number) => (inflatePathsD(contorno, dist, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD).flatMap(p =>
      p.map((a, i) => { const b = p[(i + 1) % p.length]; return [(a.x + b.x) / 2, (a.y + b.y) / 2] as Pt }))
    const dentro9 = meios(9).filter(q => !branco(px(...q)))
    expect(dentro9.length / meios(9).length).toBeGreaterThan(0.99)
    const fora11 = meios(11.5).filter(q => branco(px(...q)))
    expect(fora11.length / meios(11.5).length).toBeGreaterThan(0.99)
  })

  it('na faixa da sobra, cada ponto tem o papel da face mais próxima (a cor do FUNDO não invade a FRENTE)', () => {
    const fr = m.faces.find(f => f.id === m.frente)!.poly, fu = m.faces.find(f => f.id === m.fundo)!.poly
    const outras = m.faces.filter(f => !f.hole && f.id !== m.frente && f.id !== m.fundo).map(f => f.poly)
    let checados = 0, errados = 0
    const pontos: Pt[] = []
    for (const p of inflatePathsD(contorno, 5, JoinType.Round, EndType.Polygon, 2, 3) as PathsD) p.forEach((a, i) => {
      const b = p[(i + 1) % p.length], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)))
      for (let k = 0; k < n; k++) pontos.push([a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n])
    })
    for (const q of pontos) {
      const dFr = distPol(q, fr), dFu = distPol(q, fu), dOu = Math.min(...outras.map(o => distPol(q, o)))
      const alvo = dFr + 1.5 < Math.min(dFu, dOu) ? VERMELHO : dFu + 1.5 < Math.min(dFr, dOu) ? ROSA : null
      if (!alvo) continue
      checados++
      if (!cor(px(...q), alvo)) errados++
    }
    expect(checados).toBeGreaterThan(20)
    expect(errados).toBe(0)
  })
})

import { colocarPapel, colocarCor, colocarNaFace } from '@/lib/mae/vinculo/tema'
describe('item 71 — papel arrastado numa parte com cor sólida', () => {
  const novo = () => DocTema.parse({ schemaVersion: 1, type: 'theme', id: 't', version: 1, baseId: 'b', baseVersion: 1, partContent: {} })
  const arq = { path: 'Papéis/poa.png', sha256: 'p'.repeat(64), aspect: 1 }
  it('na parte: o papel SUBSTITUI a cor (1 camada, imagem)', () => {
    const t = novo()
    colocarCor(t, { partId: 'p_fundo' }, '#ff66aa')
    colocarPapel(t, 'p_fundo', arq)
    expect(t.partContent.p_fundo.length).toBe(1)
    expect(t.partContent.p_fundo[0].type).toBe('image')
  })
  it('com Shift (empilhar) o papel entra POR CIMA da cor', () => {
    const t = novo()
    colocarCor(t, { partId: 'p_fundo' }, '#ff66aa')
    colocarPapel(t, 'p_fundo', arq, true)
    expect(t.partContent.p_fundo.map(c => c.type)).toEqual(['solid', 'image'])
  })
  it('só nesta caixa: o papel troca o papel/cor da caixa', () => {
    const t = novo()
    colocarCor(t, { faceId: 'f1' }, '#ff66aa')
    colocarNaFace(t, 'f1', arq, 'paper')
    expect(t.faceContent!.f1.map(c => c.type)).toEqual(['image'])
  })
})
