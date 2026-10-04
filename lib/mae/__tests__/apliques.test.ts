// Sprint 11 — APLIQUES 3D: silhueta (alfa → buracos → offset Clipper2 redondo → suavizar), bordinha,
// MaxRects com as zonas da marca, achar os apliques no tema, e as DUAS folhas (impressos com rótulo do
// molde; silhuetas em preto na mesma posição) com um elemento REAL da Naty e a marca real.
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas, loadImage, Path2D as P2D } from '@napi-rs/canvas'
;(globalThis as { Path2D?: unknown }).Path2D ??= P2D
import { contornoDoAlfa, deslocar, silhueta, caixaDosAneis } from '@/lib/mae/apliques/silhueta'
import { organizar } from '@/lib/mae/apliques/empacotar'
import { acharApliques, montarFolhas, rotuloEmCaminho, type PecaAplique } from '@/lib/mae/apliques/folhas'
import { zonasDaMarca, soTinta } from '@/lib/mae/exportar/marca'
import { abrirPdf, desenharPagina } from '@/lib/mae/importacao/pdf'
import { abrirFonte } from '@/lib/mae/texto/fonte'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from '@/lib/mae/render'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema, type NoCamada } from '@/lib/mae/schema'
import { area, distBorda, type Pt } from '@/lib/mae/faces/geometria'
import { comPhys } from '@/lib/mae/exportar/png'
import { pdfjsNode } from './moldesReais'

const areaT = (rs: Pt[][]) => rs.reduce((s, r) => s + area(r), 0)
const criar = (w: number, h: number) => createCanvas(w, h) as unknown as CanvasLike
function alfaDe(w: number, h: number, f: (x: number, y: number) => boolean) {
  const a = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = f(x + 0.5, y + 0.5) ? 255 : 0
  return a
}

describe('silhueta', () => {
  it('contorno pelo alfa com o BURACO preenchido (anel → disco)', () => {
    const k = 10, R = 20, r = 8   // 40 px = 4 mm de diâmetro a 10 px/mm; furo de 1,6 mm
    const a = alfaDe(50, 50, (x, y) => { const d = Math.hypot(x - 25, y - 25); return d <= R && d > r })
    const c = contornoDoAlfa(a, 50, 50, k, { areaMinMm2: 0.1 })
    expect(c.length).toBe(1)
    expect(areaT(c)).toBeCloseTo(Math.PI * 2 * 2, 0)   // o furo não aparece
  })
  it('deslocamento externo com canto REDONDO (quadrado 10 + 3 mm)', () => {
    const d = deslocar([[[0, 0], [10, 0], [10, 10], [0, 10]]], 3)
    expect(d.length).toBe(1)
    expect(areaT(d)).toBeCloseTo(16 * 16 - (4 - Math.PI) * 9, 0)
    expect(caixaDosAneis(d)).toEqual({ x0: -3, y0: -3, x1: 13, y1: 13 })
  })
  it('silhueta cheia: dois pedaços próximos viram UMA peça, sem anéis internos', () => {
    const k = 10
    const a = alfaDe(300, 100, (x, y) => (x > 20 && x < 120 && y > 20 && y < 80) || (x > 160 && x < 280 && y > 20 && y < 80))
    const s = silhueta(a, 300, 100, k, 3)
    expect(s.length).toBe(1)   // 4 mm de vão < 2 × 3 mm → uma silhueta só
    const sep = silhueta(a, 300, 100, k, 1)
    expect(sep.length).toBe(2)
  })
  it('poeira (pedaço minúsculo) é ignorada', () => {
    const a = alfaDe(100, 100, (x, y) => (x > 10 && x < 90 && y > 10 && y < 90) || Math.hypot(x - 95, y - 95) < 1.5)
    expect(contornoDoAlfa(a, 100, 100, 10).length).toBe(1)
  })
})

describe('organizar na folha (MaxRects)', () => {
  it('peças sem sobrepor, com 2 mm de espaço, fora das zonas da marca e dentro da margem', () => {
    const pecas = Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, w: 30 + (i % 4) * 8, h: 25 + (i % 3) * 10 }))
    const obst = [{ x: 0, y: 0, w: 25, h: 25 }, { x: 185, y: 0, w: 25, h: 25 }, { x: 0, y: 272, w: 25, h: 25 }, { x: 80, y: 270, w: 60, h: 27 }]
    const r = organizar(pecas, 210, 297, { espacoMm: 2, margemMm: 5, obstaculos: obst })
    expect(r.sobraram).toEqual([])
    for (const a of r.colocadas) {
      expect(a.x).toBeGreaterThanOrEqual(5 - 1e-6); expect(a.y).toBeGreaterThanOrEqual(5 - 1e-6)
      expect(a.x + a.w).toBeLessThanOrEqual(205 + 1e-6); expect(a.y + a.h).toBeLessThanOrEqual(292 + 1e-6)
      for (const z of obst) expect(a.x >= z.x + z.w || a.x + a.w <= z.x || a.y >= z.y + z.h || a.y + a.h <= z.y).toBe(true)
      for (const b of r.colocadas) if (a !== b) {
        const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))
        expect(Math.max(gx, gy)).toBeGreaterThanOrEqual(2 - 1e-6)
      }
    }
    expect(organizar(pecas, 210, 297, { obstaculos: obst })).toEqual(r)   // determinístico
  })
  it('peça maior que a folha sobra (avisa)', () => {
    expect(organizar([{ id: 'g', w: 300, h: 10 }], 210, 297).sobraram).toEqual(['g'])
  })
})

describe('apliques do tema', () => {
  it('ativados POR TEMA; camada marcada vira um aplique por face (ligado ao molde), no tamanho da arte', () => {
    const d = novoDocumento('A4')
    d.artboards = [{ id: 'ab', widthMm: 297, heightMm: 210 }]
    for (const [id, x] of [['m1', 0], ['m2', 150]] as const) d.molds.push({ id, name: id === 'm1' ? 'MILK' : 'CUBO', artboardId: 'ab', transform: { xMm: x, yMm: 0, rotationDeg: 0 }, source: { path: 'x.pdf', sha256: '0'.repeat(64), widthMm: 100 }, faces: [{ id: `${id}_f`, polygonMm: [[0, 0], [100, 0], [100, 80], [0, 80]] }] })
    d.parts.push({ id: 'p', name: 'FRENTE', referenceAspect: 1.25, instances: d.molds.map(m => ({ faceId: m.faces[0].id, fit: { mode: 'cover' as const, scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 } })) })
    const tema = DocTema.parse({ schemaVersion: 1, type: 'theme', id: 't', version: 1, baseId: d.id, baseVersion: 1,
      partContent: { p: [{ id: 'urso', type: 'image', anchor: 'face', path: 'Elementos/urso.png', sha256: 'uuuu', aspect: 1, transform: { x: 0.5, y: 0.5, scale: 0.4, rotationDeg: 0 }, applique: { enabled: true } }] } })
    expect(acharApliques(d, tema)).toEqual([])   // tema sem apliques ligados
    tema.appliques = { enabled: true, borderMm: 1.5, borderColor: '#ffffff', silhouetteMm: 3 }
    const a = acharApliques(d, tema)
    expect(a.map(x => x.moldeNome)).toEqual(['MILK', 'CUBO'])
    expect(a[0].wMm).toBeCloseTo(40, 6); expect(a[0].hMm).toBeCloseTo(40, 6)
    expect(a[0].cfg).toEqual({ borderMm: 1.5, borderColor: '#ffffff', silhouetteMm: 3 })
  })
})

describe('folhas com um elemento REAL e a marca real', () => {
  it('impressos (bordinha + rótulo do molde) e silhuetas (preto, 3 mm) na mesma posição; PNG transparente', async () => {
    const dir = join(process.cwd(), 'docs/mae-exemplos/tema-exemplo')
    const arqs = readdirSync(dir).filter(f => f.includes('09_4')).sort()
    const fonte = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf')))
    // marca real → zonas (obstáculos)
    const pj = await pdfjsNode()
    const pdf = await abrirPdf(pj as never, new Uint8Array(readFileSync(join(process.cwd(), 'docs/mae-exemplos/marca-registro/milk_marca registro.pdf'))))
    const km = 4, cm = createCanvas(840, 1188), gm = cm.getContext('2d'); gm.fillStyle = '#fff'; gm.fillRect(0, 0, 840, 1188)
    await desenharPagina(await pdf.pagina(1), gm as never, km)
    const zonas = zonasDaMarca(gm.getImageData(0, 0, 840, 1188).data, 840, 1188, km)
    const tinta = createCanvas(840, 1188); { const id = gm.getImageData(0, 0, 840, 1188); soTinta(id.data); tinta.getContext('2d').putImageData(id, 0, 0) }
    // 6 apliques (3 elementos × 2 moldes), 45 mm de largura cada
    const imgs = new Map<string, unknown>()
    const pecas: PecaAplique[] = []
    for (const [i, f] of arqs.slice(0, 3).entries()) {
      const im = await loadImage(readFileSync(join(dir, f)))
      imgs.set(f, im)
      const w = 45, h = (45 * im.height) / im.width, k = 12
      const c = createCanvas(Math.round(w * k), Math.round(h * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
      const rgba = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      const alfa = new Uint8Array(c.width * c.height); for (let p = 0; p < alfa.length; p++) alfa[p] = rgba[p * 4 + 3]
      const base = contornoDoAlfa(alfa, c.width, c.height, k)
      const sil = silhueta(alfa, c.width, c.height, k, 3)
      const borda = deslocar(base, 1.5)
      // a silhueta fica ~3 mm fora do desenho
      const ds = sil[0].filter((_, j) => j % 7 === 0).map(p => Math.min(...base.map(b => distBorda(p, b))))
      expect(Math.min(...ds)).toBeGreaterThan(2.4); expect(Math.max(...ds)).toBeLessThan(3.6)
      expect(areaT(sil)).toBeGreaterThan(areaT(base))
      for (const molde of ['MILK', 'CUBO']) pecas.push({ id: `${molde}:${i}`, layerId: `l${i}`, faceId: `f${molde}`, moldeId: molde, moldeNome: molde, src: { path: f, sha256: f }, wMm: w, hMm: h, cfg: { borderMm: 1.5, borderColor: '#ffffff', silhouetteMm: 3 }, borda, silhueta: sil })
    }
    const f = montarFolhas(pecas, { wMm: 210, hMm: 297 }, { obstaculos: zonas, fonte })
    expect(f.sobraram).toEqual([])
    expect(f.colocadas.length).toBe(6)
    expect(f.impressos.filter(n => n.id.endsWith(':rotulo')).length).toBe(6)
    expect(f.silhuetas.every(n => n.type === 'path' && n.color === '#000000')).toBe(true)
    // mesma posição: a silhueta da peça envolve a imagem impressa
    for (const c of f.colocadas) {
      const img = f.impressos.find(n => n.id === `apl:${c.id}:img`) as Extract<NoCamada, { type: 'image' }>
      const sil = f.silhuetas.find(n => n.id === `apl:${c.id}:sil`) as Extract<NoCamada, { type: 'path' }>
      expect(img.matrix![4]).toBe(c.x); expect(sil.bboxMm[0]).toBeLessThan(c.x); expect(sil.bboxMm[0] + sil.bboxMm[2]).toBeGreaterThan(c.x + img.matrix![0])
    }
    // render (fundo transparente) — impressos e silhuetas a 300 dpi → para o teste manual na Silhouette
    const k = 300 / 25.4
    const out = join(process.cwd(), '..', 'saidas-mae11'); mkdirSync(out, { recursive: true })
    for (const [nome, layers] of [['impressos', f.impressos], ['silhuetas', f.silhuetas]] as const) {
      const p = { id: nome, widthMm: 210, heightMm: 297, layers }
      const { w, h } = tamanhoDoCanvas(p, k)
      const c = createCanvas(w, h)
      renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: k, fundo: null, criarCanvas: criar, bitmap: s => imgs.get(s) as CanvasImageSource, criarCaminho: d => new P2D(d) as unknown as Path2D })
      const g = c.getContext('2d')
      g.drawImage(tinta, 0, 0, w, h)   // a marca (só a tinta) por cima, como na exportação
      expect(g.getImageData(2, 2, 1, 1).data[3]).toBe(0)
      writeFileSync(join(out, `apliques_${nome}_300dpi.png`), comPhys(new Uint8Array(c.toBuffer('image/png')), 300))
      const pv = createCanvas(Math.round(w / 4), Math.round(h / 4)); const gp = pv.getContext('2d'); gp.fillStyle = '#fff'; gp.fillRect(0, 0, pv.width, pv.height); gp.drawImage(c, 0, 0, pv.width, pv.height)
      writeFileSync(join(process.cwd(), `docs/mae-exemplos/apliques-${nome}.png`), pv.toBuffer('image/png'))
    }
    // silhueta: cada peça é UM recorte (sem buraco), e o preto cobre a peça impressa inteira
    const c = createCanvas(210 * 4, 297 * 4)
    renderizarPrancheta(c as unknown as CanvasLike, { id: 's', widthMm: 210, heightMm: 297, layers: f.silhuetas }, { pxPorMm: 4, fundo: null, criarCanvas: criar, bitmap: () => undefined, criarCaminho: d => new P2D(d) as unknown as Path2D })
    const im0 = f.colocadas[0], pa = c.getContext('2d').getImageData(Math.round((im0.x + 20) * 4), Math.round((im0.y + 5) * 4), 1, 1).data
    expect([pa[0], pa[3]]).toEqual([0, 255])
  }, 120_000)
  it('rótulo do molde em vetor (HarfBuzz) com a altura pedida', async () => {
    const fonte = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf')))
    const r = rotuloEmCaminho(fonte, 'MILK', 10, 20, 3.2)
    expect(r.d.length).toBeGreaterThan(50); expect(r.largura).toBeGreaterThan(4); expect(r.largura).toBeLessThan(15)
  })
})
