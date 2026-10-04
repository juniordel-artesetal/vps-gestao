// Sprint 9 — EXPORTAÇÃO: sangria (Clipper2), recorte por polígono, mm↔px a 300 dpi, linhas de corte e
// dobra (vetor/SVG/DXF), PDF em mm exatos com "tamanho real" gravado, 100 mm no arquivo = 100 mm, e a
// marca de registro real (zonas, conflito, encaixe girado).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas, Path2D as P2D } from '@napi-rs/canvas'
// pdf.js desenha os glifos da marca com Path2D (no Node vem do Skia)
;(globalThis as { Path2D?: unknown }).Path2D ??= P2D
import { PDFDocument, PDFName } from 'pdf-lib'
import { expandir, regiaoDeImpressao, fatorDeSobra } from '@/lib/mae/exportar/sobra'
import { linhasDoMolde, linhasSvg, linhasDxf, caminhoDobra, nosDasLinhas } from '@/lib/mae/exportar/linhas'
import { zonasDaMarca, conflitosComMarca, encaixeNaMarca, naPagina } from '@/lib/mae/exportar/marca'
import { montarPdf, tamanhoDaPagina, colocar, caminhoQr, PT_POR_MM } from '@/lib/mae/exportar/pdf'
import { nomeExportacao, pastaExportacao, slugArquivo, nomeLivre } from '@/lib/mae/exportar/nomes'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { renderizarPrancheta, tamanhoDoCanvas, mmParaPx, tamanhoEmPx, pxPorMm, type CanvasLike } from '@/lib/mae/render'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema, type DocTrabalho, type NoCamada } from '@/lib/mae/schema'
import { abrirPdf, desenharPagina, vetoresDaPagina } from '@/lib/mae/importacao/pdf'
import { pdfjsNode } from './moldesReais'
import { area, type Pt } from '@/lib/mae/faces/geometria'

const q = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
const areaTotal = (rs: Pt[][]) => rs.reduce((s, r) => s + area(r), 0)
const criar = (w: number, h: number) => createCanvas(w, h) as unknown as CanvasLike

describe('mm ↔ px a 300 dpi', () => {
  it('A4 = 2480 × 3508 px; 100 mm = 1181,1 px', () => {
    expect(tamanhoEmPx(210, 297, 300)).toEqual({ w: 2480, h: 3508 })
    expect(mmParaPx(100, 300)).toBeCloseTo(1181.1, 1)
    expect(pxPorMm(150) * 25.4).toBeCloseTo(150, 6)
  })
})

describe('sangria (Clipper2)', () => {
  it('expandir quadrado 10 mm com 2 mm de sobra = 14 × 14 (cantos em esquadria)', () => {
    const e = expandir(q(0, 0, 10, 10), 2)
    expect(e.length).toBe(1)
    expect(areaTotal(e)).toBeCloseTo(196, 3)
  })
  it('a sobra NÃO invade a face vizinha (dobra); vaza só pelas arestas de corte', () => {
    const r = regiaoDeImpressao(q(0, 0, 10, 10), [q(10, 0, 10, 10)], 2)
    expect(areaTotal(r)).toBeCloseTo(176, 3)   // 14×14 − 2×10 do lado da vizinha
  })
  it('sem sobra = a própria face; contrair (sobra negativa) encolhe o furo', () => {
    expect(regiaoDeImpressao(q(0, 0, 10, 10), [], 0)[0]).toEqual(q(0, 0, 10, 10))
    expect(areaTotal(expandir(q(0, 0, 10, 10), -2))).toBeCloseTo(36, 3)
  })
  it('fator do papel por baixo cobre face + sobra', () => {
    const f = fatorDeSobra(100, 50, 10)
    expect(f * 100).toBeGreaterThanOrEqual(120); expect(f * 50).toBeGreaterThanOrEqual(70)
  })
})

// ── base de teste: 2 faces lado a lado (FRENTE e LATERAL) + uma aba, numa prancheta A4 paisagem ──
function docTeste(): { d: DocTrabalho; tema: DocTema } {
  const d = novoDocumento('A4')
  d.artboards = [{ id: 'ab', widthMm: 297, heightMm: 210 }]
  d.molds.push({ id: 'm', name: 'Caixa', artboardId: 'ab', transform: { xMm: 50, yMm: 50, rotationDeg: 0 },
    source: { path: 'Bases/moldes/x.pdf', sha256: '0'.repeat(64), widthMm: 120, heightMm: 60 },
    faces: [
      { id: 'f1', polygonMm: q(0, 0, 60, 60) },
      { id: 'f2', polygonMm: q(60, 0, 40, 60) },
      { id: 'aba', polygonMm: [[100, 5], [115, 10], [115, 50], [100, 55]] },
      { id: 'furo', polygonMm: q(25, 25, 10, 10), hole: true },
    ] })
  d.parts.push({ id: 'p_frente', name: 'FRENTE', referenceAspect: 1, instances: [{ faceId: 'f1', fit: { mode: 'cover', scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 } }] })
  d.parts.push({ id: 'p_lat', name: 'LATERAL', referenceAspect: 40 / 60, instances: [{ faceId: 'f2', fit: { mode: 'cover', scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 } }] })
  const tema = DocTema.parse({ schemaVersion: 1, type: 'theme', id: 't', version: 1, baseId: d.id, baseVersion: 1,
    overflowFill: { path: 'Papéis/abas.png', sha256: 'abas', aspect: 1 },
    partContent: {
      p_frente: [{ id: 'l1', type: 'image', anchor: 'paper', path: 'Papéis/vermelho.png', sha256: 'verm', aspect: 1 }],
      p_lat: [{ id: 'l2', type: 'image', anchor: 'paper', path: 'Papéis/azul.png', sha256: 'azul', aspect: 1 }],
    } })
  return { d, tema }
}
const cores: Record<string, string> = { verm: '#ff0000', azul: '#0000ff', abas: '#00ff00' }
const bitmap = (s: string) => { const c = createCanvas(50, 50); const g = c.getContext('2d'); g.fillStyle = cores[s] ?? '#000'; g.fillRect(0, 0, 50, 50); return c as unknown as CanvasImageSource }
function desenhar(layers: NoCamada[], k = 4) {
  const p = { id: 'ab', widthMm: 297, heightMm: 210, layers }
  const { w, h } = tamanhoDoCanvas(p, k)
  const c = createCanvas(w, h)
  renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: criar, bitmap })
  const g = c.getContext('2d')
  return { c, px: (x: number, y: number) => Array.from(g.getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data).slice(0, 3) }
}

describe('resolver: aprovação (recorte exato) × impressão (sobra)', () => {
  const { d, tema } = docTeste()
  it('aprovação = mesmos anéis da tela (face exata, furo vazio)', () => {
    const a = resolverPrancheta(d, 'ab', { tema, modo: 'aprovacao' }), t = resolverPrancheta(d, 'ab', { tema })
    expect(JSON.stringify(a)).toBe(JSON.stringify(t))
    const r = desenhar(a)
    expect(r.px(60, 80)).toEqual([255, 0, 0])     // dentro da FRENTE
    expect(r.px(48, 80)).toEqual([255, 255, 255]) // 2 mm fora: nada (recorte exato)
    expect(r.px(80, 80)).toEqual([255, 255, 255]) // furo
  })
  it('impressão: a arte vaza 10 mm pelas arestas de corte, sem invadir a vizinha; furo continua vazado', () => {
    const nos = resolverPrancheta(d, 'ab', { tema, modo: 'impressao', sobraMm: 10 })
    expect(nos.some(n => n.id === 'f1:l1:sobra')).toBe(true)   // papel ampliado por baixo
    const r = desenhar(nos)
    expect(r.px(42, 80)).toEqual([255, 0, 0])     // 8 mm fora da FRENTE (lado de corte): vermelho
    expect(r.px(60, 42)).toEqual([255, 0, 0])     // 8 mm acima
    expect(r.px(112, 80)).toEqual([0, 0, 255])    // dentro da LATERAL continua azul (sem invasão)
    expect(r.px(148, 80)).toEqual([0, 0, 255])    // borda da LATERAL com a aba: cada uma com o seu
    expect(r.px(160, 80)).toEqual([0, 255, 0])    // aba recebe o papel das abas, com sobra também
    expect(r.px(80, 80)).toEqual([255, 255, 255]) // furo: encolhe só 1 mm (folga do corte); continua vazado
  })
  it('impressão: dentro da face o desenho é IDÊNTICO ao da tela', () => {
    const t = desenhar(resolverPrancheta(d, 'ab', { tema })), i = desenhar(resolverPrancheta(d, 'ab', { tema, modo: 'impressao', sobraMm: 10 }))
    for (const [x, y] of [[55, 55], [100, 105], [70, 100], [130, 70]]) expect(i.px(x, y)).toEqual(t.px(x, y))
  })
})

describe('linhas de corte e dobra', () => {
  const faces = [{ polygonMm: q(0, 0, 60, 60) }, { polygonMm: q(60, 0, 40, 60) }, { polygonMm: q(20, 20, 5, 5), hole: true }]
  it('corte = contorno da união (+ furos); dobra = a aresta comum', () => {
    const l = linhasDoMolde(faces)
    expect(l.corte.length).toBe(2)
    expect(areaTotal([l.corte[0]])).toBeCloseTo(6000, 0)
    expect(l.dobra.length).toBe(1)
    const [a, b] = l.dobra[0]
    expect(a[0]).toBe(60); expect(b[0]).toBe(60); expect(Math.abs(a[1] - b[1])).toBe(60)
  })
  it('dobra tracejada picotada (2 mm traço / 1,5 mm vão)', () => {
    const d = caminhoDobra({ corte: [], dobra: [[[0, 0], [0, 7]]] })
    expect(d.match(/M/g)!.length).toBe(2)   // 0–2, 3,5–5,5 … 7 = 2 traços
  })
  it('SVG em mm reais e DXF R12 com unidade mm ($INSUNITS = 4)', () => {
    const l = linhasDoMolde(faces)
    const s = linhasSvg(l, 297, 210)
    expect(s).toContain('width="297mm"'); expect(s).toContain('viewBox="0 0 297 210"')
    const x = linhasDxf(l, 210)
    expect(x).toMatch(/\$INSUNITS\n70\n4/)
    expect((x.match(/\nPOLYLINE\n/g) ?? []).length).toBe(2)
    expect((x.match(/\nLINE\n/g) ?? []).length).toBe(1)
    expect(x.trim().endsWith('EOF')).toBe(true)
  })
  it('linhas viram camadas do motor (contorno da aprovação)', () => {
    const n = nosDasLinhas(linhasDoMolde(faces))
    expect(n.map(x => x.id)).toEqual(['linhas:corte', 'linhas:dobra'])
    expect(n.every(x => x.fillNone && x.stroke)).toBe(true)
  })
})

describe('nomes e pastas', () => {
  it('{tema}_{nome}_{molde}_{data} em Exportações/AAAA-MM-DD', () => {
    const dt = new Date(2026, 9, 4)
    expect(nomeExportacao({ tema: 'Fazendinha Rosa', nome: 'Maria Júlia', molde: 'MILK', data: dt, extensao: 'pdf' })).toBe('Fazendinha-Rosa_Maria-Julia_MILK_2026-10-04.pdf')
    expect(pastaExportacao(dt)).toBe('Exportações/2026-10-04')
    expect(slugArquivo('a/b:c*?"<>|')).toBe('a-b-c')
    expect(nomeLivre('x.pdf', new Set(['x.pdf', 'x (2).pdf']))).toBe('x (3).pdf')
  })
})

// ── PDF ─────────────────────────────────────────────────────────────────────────────────────────
function pngBranco(wMm: number, hMm: number, k = 2) {
  const c = createCanvas(Math.round(wMm * k), Math.round(hMm * k)); const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height)
  return new Uint8Array(c.toBuffer('image/png'))
}
async function vetores(bytes: Uint8Array) {
  const pj = await pdfjsNode()
  const pdf = await abrirPdf(pj as never, bytes)
  return vetoresDaPagina(await pdf.pagina(1), pj.OPS)
}

describe('PDF de impressão', () => {
  it('página em mm EXATOS, "tamanho real" gravado (PrintScaling = None)', async () => {
    const bytes = await montarPdf([{ larguraMm: 297, alturaMm: 210, arte: { bytes: pngBranco(297, 210), tipo: 'png', larguraMm: 297, alturaMm: 210 } }], 'teste')
    const t = await tamanhoDaPagina(bytes)
    expect(t.wMm).toBeCloseTo(297, 2); expect(t.hMm).toBeCloseTo(210, 2)
    const doc = await PDFDocument.load(bytes)
    const vp = doc.catalog.lookup(PDFName.of('ViewerPreferences')) as unknown as { get: (n: PDFName) => unknown }
    expect(String(vp.get(PDFName.of('PrintScaling')))).toBe('/None')
  })
  it('100 mm no arquivo = 100 mm (linha de corte vetorial medida no PDF)', async () => {
    const l = { corte: [q(20, 30, 100, 50)], dobra: [] as [Pt, Pt][] }
    const bytes = await montarPdf([{ larguraMm: 297, alturaMm: 210, arte: { bytes: pngBranco(297, 210), tipo: 'png', larguraMm: 297, alturaMm: 210 }, linhas: l }], 'teste')
    const v = await vetores(bytes)
    const pts = v.linhas.flat()
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 2)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(50, 2)
    expect(Math.min(...xs)).toBeCloseTo(20, 2); expect(Math.min(...ys)).toBeCloseTo(30, 2)
  })
  it('arte paisagem numa marca retrato: entra girada 90°, linhas acompanham', async () => {
    const e = encaixeNaMarca(297, 210, 210, 297)
    expect(e).toEqual({ girar: true, diferente: false, dx: 0, dy: 0 })
    expect(naPagina(e, 210, 0, 0)).toEqual([210, 0])          // canto sup. esq. da arte → canto sup. dir. da página
    const o = colocar(e, 210, 297, 0, 0, 297, 210)
    expect(o.x).toBeCloseTo(0, 6); expect(o.y).toBeCloseTo(297 * PT_POR_MM, 6)
    const l = { corte: [q(20, 30, 100, 50)], dobra: [] as [Pt, Pt][] }
    const bytes = await montarPdf([{ larguraMm: 210, alturaMm: 297, encaixe: e, arte: { bytes: pngBranco(297, 210), tipo: 'png', larguraMm: 297, alturaMm: 210 }, linhas: l }], 'teste')
    const pts = (await vetores(bytes)).linhas.flat()
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100, 2)   // girado: os 100 mm ficam na vertical
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(50, 2)
    expect(Math.min(...xs)).toBeCloseTo(210 - 80, 2)
  })
  it('QR em vetor (módulos) dentro do quadrado pedido', () => {
    const d = caminhoQr('https://wa.me/5511999999999', 10, 10, 20)
    const nums = (d.match(/M[\d.]+ [\d.]+/g) ?? []).map(s => s.slice(1).split(' ').map(Number))
    expect(nums.length).toBeGreaterThan(100)
    expect(Math.min(...nums.map(n => n[0]))).toBeGreaterThan(10); expect(Math.max(...nums.map(n => n[0]))).toBeLessThan(30)
  })
})

describe('marca de registro REAL (docs/mae-exemplos/marca-registro)', () => {
  const arq = join(process.cwd(), 'docs/mae-exemplos/marca-registro/milk_marca registro.pdf')
  it('folha A4 retrato; zonas escuras nos cantos; arte em cima de um canto = alerta', async () => {
    const bytes = new Uint8Array(readFileSync(arq))
    const t = await tamanhoDaPagina(bytes)
    expect(t.wMm).toBeCloseTo(210, 0); expect(t.hMm).toBeCloseTo(297, 0)
    const pj = await pdfjsNode()
    const pdf = await abrirPdf(pj as never, bytes)
    const k = 4
    const c = createCanvas(Math.ceil(210 * k), Math.ceil(297 * k))
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
    await desenharPagina(await pdf.pagina(1), g as never, k)
    const zonas = zonasDaMarca(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height, k)
    expect(zonas.length).toBeGreaterThanOrEqual(3)
    const sup = zonas.find(z => z.x < 30 && z.y < 30)
    expect(sup).toBeTruthy()
    // arte no meio da folha: sem conflito; arte cobrindo o canto superior esquerdo: conflito
    expect(conflitosComMarca(zonas, [q(60, 80, 90, 120)]).length).toBe(0)
    expect(conflitosComMarca(zonas, [q(0, 0, 60, 60)]).length).toBeGreaterThan(0)
  })
  it('prancheta de tamanho diferente da marca = alerta (centraliza)', () => {
    const e = encaixeNaMarca(200, 150, 210, 297)
    expect(e.diferente).toBe(true); expect(e.girar).toBe(true)
  })
  it('a marca entra no PDF em tamanho real (página = folha da marca)', async () => {
    const marca = new Uint8Array(readFileSync(arq))
    const bytes = await montarPdf([{ larguraMm: 210, alturaMm: 297, encaixe: encaixeNaMarca(297, 210, 210, 297), arte: { bytes: pngBranco(297, 210), tipo: 'png', larguraMm: 297, alturaMm: 210 }, marca: { bytes: marca, pagina: 1 } }], 'teste')
    const t = await tamanhoDaPagina(bytes)
    expect(t.wMm).toBeCloseTo(210, 1); expect(t.hMm).toBeCloseTo(297, 1)
    // os traços da marca (cantos) aparecem no vetor do PDF final, na mesma posição do original
    const orig = (await vetores(marca)).linhas.flat(), fim = (await vetores(bytes)).linhas.flat()
    const cx = (p: Pt[]) => [Math.min(...p.map(a => a[0])), Math.min(...p.map(a => a[1]))]
    expect(fim.length).toBeGreaterThan(0)
    expect(cx(fim)[0]).toBeCloseTo(cx(orig)[0], 1); expect(cx(fim)[1]).toBeCloseTo(cx(orig)[1], 1)
  })
})
