// Sprint 9 — TESTE COM ARQUIVOS REAIS: os 6 moldes da Naty + um tema com os papéis/elementos de
// docs/mae-exemplos/tema-exemplo + NOME, exportados como a usuária faria (o mesmo resolver + o mesmo motor):
//   • aprovação: JPG 150 dpi, recorte exato + contorno;  • impressão: PDF 300 dpi com sobra de 10 mm,
//     linhas em vetor, marca de registro real (girada para a folha retrato) e alertas.
// As saídas vão para a pasta `saidas-mae9` AO LADO do repositório (para o Júnior abrir e imprimir a 100%).
// Pesado (~4 min: 6 folhas a 300 dpi): só roda com  MAE_SAIDAS=1 npx vitest run exportar-reais
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas, loadImage, Path2D as P2D, type Image } from '@napi-rs/canvas'
;(globalThis as { Path2D?: unknown }).Path2D ??= P2D
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { atribuirFace, garantirPartesPadrao, sugerirParaParte } from '@/lib/mae/vinculo/partes'
import { renderizarPrancheta, tamanhoDoCanvas, pxPorMm, type CanvasLike } from '@/lib/mae/render'
import { facesParaReceita } from '@/lib/mae/editor/moldes'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema, type DocTrabalho, type NoCamada } from '@/lib/mae/schema'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'
import { linhasDaPrancheta, nosDasLinhas } from '@/lib/mae/exportar/linhas'
import { encaixeNaMarca, conflitosComMarca, zonasDaMarca, naPagina } from '@/lib/mae/exportar/marca'
import { montarPdf, tamanhoDaPagina } from '@/lib/mae/exportar/pdf'
import { comPhys } from '@/lib/mae/exportar/png'
import { abrirPdf, desenharPagina, vetoresDaPagina } from '@/lib/mae/importacao/pdf'
import { abrirMoldeReal, caixaPts, MOLDES, pdfjsNode } from './moldesReais'
import type { Pt } from '@/lib/mae/faces/geometria'

const SAIDA = join(process.cwd(), '..', 'saidas-mae9')
const TEMA_DIR = join(process.cwd(), 'docs/mae-exemplos/tema-exemplo')
const MARCAS_DIR = join(process.cwd(), 'docs/mae-exemplos/marca-registro')
const MARCA_DO_MOLDE: Record<string, string> = {
  'MILK': 'milk_marca registro.pdf', 'CUBO COM ALÇA': 'cubo_marca registro.pdf', 'MALETA COM ALÇA': 'maleta alça_marca registro.pdf',
  'MALETA CORAÇÃO': 'maleta coração_marca registro.pdf', 'PIRÂMIDE': 'piramide_marca registro.pdf', 'TRIANGULOVE': 'triagulove_marca registro.pdf',
}

let d: DocTrabalho
let tema: DocTema
let sniglet: FonteHB
let vetorMilk = { w: 0, h: 0 }
const imagens = new Map<string, Image>()
const criar = (w: number, h: number) => createCanvas(w, h) as unknown as CanvasLike

function render(abId: string, layers: NoCamada[], k: number) {
  const ab = d.artboards.find(a => a.id === abId)!
  const p = { ...ab, layers }
  const { w, h } = tamanhoDoCanvas(p, k)
  const c = createCanvas(w, h)
  renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: criar, bitmap: s => imagens.get(s) as unknown as CanvasImageSource, criarCaminho: s => new P2D(s) as unknown as Path2D })
  return c
}

beforeAll(async () => {
  if (process.env.MAE_SAIDAS !== '1') return
  mkdirSync(SAIDA, { recursive: true })
  sniglet = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf')))
  const arqs = readdirSync(TEMA_DIR).filter(f => f.endsWith('.png')).sort()
  const papeis = arqs.filter(f => f.includes('10_38_12')), elementos = arqs.filter(f => !f.includes('10_38_12'))
  for (const f of [papeis[0], papeis[1], elementos[0]]) imagens.set(f, await loadImage(readFileSync(join(TEMA_DIR, f))))
  d = novoDocumento('A4')
  d.name = 'Kit festa 6 moldes'
  d.artboards = []
  let i = 0
  for (const nome of MOLDES) {
    const m = await abrirMoldeReal(nome)
    if (nome === 'MILK.pdf') vetorMilk = caixaPts(m.vetor.flat())
    const id = `m${++i}`
    const { wMm, hMm } = m.prep.recorte
    d.artboards.push({ id: `ab${i}`, widthMm: 297, heightMm: 210, name: nome.replace('.pdf', '') })
    d.molds.push({ id, name: nome.replace('.pdf', ''), artboardId: `ab${i}`, transform: { xMm: Math.round((297 - wMm) / 2), yMm: Math.round((210 - hMm) / 2), rotationDeg: 0 },
      source: { path: `Bases/moldes/${nome}`, sha256: String(i).padEnd(64, '0'), widthMm: wMm, heightMm: hMm, kind: 'pdf', page: 1, crop: m.prep.recorte },
      faces: facesParaReceita(id, m.det.faces) })
  }
  garantirPartesPadrao(d)
  const milk = d.molds.find(m => m.name === 'MILK')!
  const area = (p: [number, number][]) => { let s = 0; for (let a = 0, b = p.length - 1; a < p.length; b = a++) s += p[b][0] * p[a][1] - p[a][0] * p[b][1]; return Math.abs(s / 2) }
  const frente = [...milk.faces].filter(f => !f.hole).sort((a, b) => area(b.polygonMm) - area(a.polygonMm))[0]
  atribuirFace(d, 'p_frente', frente.id)
  for (const s of sugerirParaParte(d, 'p_frente')) atribuirFace(d, 'p_frente', s.faceId)
  for (const p of d.parts) if (p.id === 'p_frente') p.referenceAspect = 1
  // NOME na FRENTE de cada molde
  d.textSlots = d.parts.find(p => p.id === 'p_frente')!.instances.map((x, j) => ({ id: `t${j}`, variable: 'NOME', faceId: x.faceId, box: { x: 0.1, y: 0.62, w: 0.8, h: 0.26 }, single: { lines: 1, sizePt: 30 } }))
  tema = DocTema.parse({ schemaVersion: 1, type: 'theme', id: 'tema_real', version: 1, name: 'Fazendinha', baseId: d.id, baseVersion: 1,
    overflowFill: { path: `Papéis/${papeis[1]}`, sha256: papeis[1], aspect: 1 },
    partContent: { p_frente: [
      { id: 'papel', type: 'image', anchor: 'paper', path: `Papéis/${papeis[0]}`, sha256: papeis[0], aspect: 1 },
      { id: 'el', type: 'image', anchor: 'face', path: `Elementos/${elementos[0]}`, sha256: elementos[0], aspect: 1, transform: { x: 0.5, y: 0.33, scale: 0.45, rotationDeg: 0 } },
    ] },
    sample: { NOME: 'Maria Júlia', IDADE: '1' } })
}, 180_000)

const texto = () => ({ fontes: { obter: () => undefined, substituta: sniglet }, valores: { NOME: 'Maria Júlia' } })

describe.runIf(process.env.MAE_SAIDAS === '1')('6 moldes reais: aprovação e impressão', () => {
  it('aprovação: JPG 150 dpi por prancheta (recorte exato + contorno) — nada fora das faces', () => {
    const k = pxPorMm(150)
    const folhas: ReturnType<typeof render>[] = []
    for (const ab of d.artboards) {
      const nos = [...resolverPrancheta(d, ab.id, { tema, modo: 'aprovacao', texto: texto() }), ...nosDasLinhas(linhasDaPrancheta(d, ab.id), { cor: '#1f2937', larguraMm: 0.3 })]
      const c = render(ab.id, nos, k)
      expect(c.width).toBe(Math.round(297 * k))
      writeFileSync(join(SAIDA, `Fazendinha_Maria-Julia_${ab.name}-aprovacao.jpg`), c.toBuffer('image/jpeg', 90))
      folhas.push(c)
      // canto da folha (fora de qualquer face) fica branco
      expect(Array.from(c.getContext('2d').getImageData(3, 3, 1, 1).data).slice(0, 3)).toEqual([255, 255, 255])
    }
    // folha de aprovação única (como "numa imagem só"), em escala menor para o docs/
    const s = 0.35, gap = 8 * k * s
    const W = Math.round(297 * k * s), H = Math.round(folhas.length * 210 * k * s + gap * (folhas.length - 1))
    const u = createCanvas(W, H); const g = u.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H)
    folhas.forEach((c, i) => g.drawImage(c, 0, Math.round(i * (210 * k * s + gap)), W, Math.round(210 * k * s)))
    writeFileSync(join(process.cwd(), 'docs/mae-exemplos/aprovacao-6-moldes.jpg'), u.toBuffer('image/jpeg', 80))
  }, 120_000)

  it('impressão: PDF 300 dpi por prancheta, sobra 10 mm, linhas em vetor, marca real girada; 100 mm = 100 mm', async () => {
    const k = pxPorMm(300)
    const pj = await pdfjsNode()
    const alertas: string[] = []
    const paginas = []
    for (const ab of d.artboards) {
      const nos = resolverPrancheta(d, ab.id, { tema, modo: 'impressao', sobraMm: 10, texto: texto() })
      // a FRENTE ganhou o papel ampliado por baixo (sobra)
      expect(nos.some(n => n.id.endsWith(':papel:sobra'))).toBe(true)
      const c = render(ab.id, nos, k)
      expect([c.width, c.height]).toEqual([3508, 2480])
      const png = comPhys(new Uint8Array(c.toBuffer('image/png')), 300)
      const marcaBytes = new Uint8Array(readFileSync(join(MARCAS_DIR, MARCA_DO_MOLDE[ab.name!])))
      const t = await tamanhoDaPagina(marcaBytes)
      const e = encaixeNaMarca(297, 210, t.wMm, t.hMm)
      expect(e.girar).toBe(true)
      // zonas da marca → alerta se a arte (com sobra) entra nelas
      const pdf = await abrirPdf(pj as never, marcaBytes.slice())   // o pdf.js toma posse do buffer
      const km = 4, cm = createCanvas(Math.ceil(t.wMm * km), Math.ceil(t.hMm * km)), gm = cm.getContext('2d')
      gm.fillStyle = '#fff'; gm.fillRect(0, 0, cm.width, cm.height)
      await desenharPagina(await pdf.pagina(1), gm as never, km)
      const zonas = zonasDaMarca(gm.getImageData(0, 0, cm.width, cm.height).data, cm.width, cm.height, km)
      const regs = nos.flatMap(n => n.type === 'shape' ? [n.rings[0] as Pt[]] : []).map(r => r.map(([x, y]) => naPagina(e, 210, x, y)))
      const conf = conflitosComMarca(zonas, regs)
      if (conf.length) alertas.push(`${ab.name}: arte em ${conf.length} área(s) da marca`)
      const molde = d.molds.find(m => m.artboardId === ab.id)!
      paginas.push({
        larguraMm: t.wMm, alturaMm: t.hMm, encaixe: e, marca: { bytes: marcaBytes, pagina: 1 },
        arte: { bytes: png, tipo: 'png' as const, larguraMm: 297, alturaMm: 210 },
        linhas: ab.name === 'MILK' ? null : linhasDaPrancheta(d, ab.id),
        // MILK: as linhas ORIGINAIS do PDF do molde (vetor exato), recortadas e postas no lugar
        moldesPdf: ab.name === 'MILK' ? [{ bytes: new Uint8Array(readFileSync(join(process.cwd(), 'docs/mae-exemplos/moldes/MILK.pdf'))), pagina: 1, crop: molde.source.crop, xMm: molde.transform.xMm, yMm: molde.transform.yMm }] : [],
        identidade: { qr: [{ texto: 'https://wa.me/5511999999999', xMm: 5, yMm: 170, ladoMm: 18 }] },
      })
      const um = await montarPdf([paginas[paginas.length - 1]], `Fazendinha · Maria Júlia · ${ab.name}`)
      writeFileSync(join(SAIDA, `Fazendinha_Maria-Julia_${ab.name}_impressao.pdf`), um)
      writeFileSync(join(SAIDA, `Fazendinha_Maria-Julia_${ab.name}_impressao.png`), png)
      const tp = await tamanhoDaPagina(um)
      expect(tp.wMm).toBeCloseTo(210, 1); expect(tp.hMm).toBeCloseTo(297, 1)
    }
    const tudo = await montarPdf(paginas, 'Fazendinha · Maria Júlia')
    writeFileSync(join(SAIDA, 'Fazendinha_Maria-Julia_tudo-junto_impressao.pdf'), tudo)
    expect((await tamanhoDaPagina(tudo)).paginas).toBe(6)
    // MILK com o vetor ORIGINAL: sem a marca, o contorno no PDF final mede o recorte do molde (girado 90°)
    const iMilk = d.artboards.findIndex(a => a.name === 'MILK')
    const soMolde = await montarPdf([{ ...paginas[iMilk], marca: null, identidade: {} }], 'MILK linhas')
    const v = await vetoresDaPagina(await (await abrirPdf(pj as never, soMolde.slice())).pagina(1), pj.OPS)
    const molde = d.molds.find(m => m.name === 'MILK')!
    const pts = v.linhas.flat()
    const ys = pts.map(p => p[1]), xs = pts.map(p => p[0])
    void molde
    // o vetor do PDF original (medido direto no MILK.pdf) e o do PDF exportado: mesmas medidas, girado
    expect(Math.abs(Math.max(...ys) - Math.min(...ys) - vetorMilk.w)).toBeLessThan(0.3)
    expect(Math.abs(Math.max(...xs) - Math.min(...xs) - vetorMilk.h)).toBeLessThan(0.3)
    writeFileSync(join(SAIDA, 'alertas.txt'), alertas.join('\n') || 'sem alertas')
  }, 300_000)
})
