// Sprints 5 + 6 — enquadramento (referência → face), resolução do vínculo, "Só nesta caixa",
// partes e sugestão automática de equivalentes (com os moldes reais), e o motor desenhando o tema.
import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { aplicar, compor, inversa, girar, transladar, type M } from '@/lib/mae/vinculo/matriz'
import { quadroDaFace, retanguloGirado, proporcaoDaFace } from '@/lib/mae/vinculo/enquadramento'
import { efetiva, resolverPrancheta, matrizDaCamada, type CamadaImagemTema } from '@/lib/mae/vinculo/resolver'
import { atribuirFace, desatribuirFace, garantirPartesPadrao, sugerirParaParte, PARTES_PADRAO, novaParte, excluirParte } from '@/lib/mae/vinculo/partes'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from '@/lib/mae/render'
import { facesParaReceita } from '@/lib/mae/editor/moldes'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocBase, DocTema, type DocTrabalho, type NoCamada } from '@/lib/mae/schema'
import { abrirMoldeReal, MOLDES } from './moldesReais'
import type { Pt } from '@/lib/mae/faces/geometria'

const perto = (a: number[], b: number[], tol = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) <= tol)
const ret = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]

describe('matrizes', () => {
  it('compor e inverter', () => {
    const m = compor(transladar(10, 5), girar(90))
    expect(perto(aplicar(m, 1, 0), [10, 6])).toBe(true)
    expect(perto(aplicar(compor(inversa(m), m), 3, 4), [3, 4])).toBe(true)
  })
})

describe('enquadramento referência → face', () => {
  const face = ret(10, 20, 100, 50)
  it('preencher (cover) com a mesma proporção: os cantos batem', () => {
    const q = quadroDaFace(face, { mode: 'cover' }, 2)
    expect(perto(aplicar(q.papel, 0, 0), [10, 20])).toBe(true)
    expect(perto(aplicar(q.papel, 2, 1), [110, 70])).toBe(true)
  })
  it('caber (contain) quadrado numa face 2:1 = 50 × 50 no centro', () => {
    const q = quadroDaFace(face, { mode: 'contain' }, 1)
    expect(perto(aplicar(q.papel, 0, 0), [35, 20])).toBe(true)
    expect(perto(aplicar(q.papel, 1, 1), [85, 70])).toBe(true)
  })
  it('preencher quadrado numa face 2:1 = 100 × 100 (vaza em cima e embaixo)', () => {
    const q = quadroDaFace(face, { mode: 'cover' }, 1)
    expect(perto(aplicar(q.papel, 0, 0), [10, -5])).toBe(true)
  })
  it('esticar', () => {
    const q = quadroDaFace(face, { mode: 'stretch' }, 1)
    expect(perto(aplicar(q.papel, 1, 1), [110, 70])).toBe(true)
  })
  it('girar 180° (fecho de ponta-cabeça) e espelhar', () => {
    expect(perto(aplicar(quadroDaFace(face, { mode: 'cover', rotationDeg: 180 }, 2).papel, 0, 0), [110, 70])).toBe(true)
    expect(perto(aplicar(quadroDaFace(face, { mode: 'cover', mirror: true }, 2).papel, 0, 0), [110, 20])).toBe(true)
  })
  it('manual: escala e deslocamento (em fração da face)', () => {
    const q = quadroDaFace(face, { mode: 'manual', scale: 0.5, offsetX: 0.1 }, 2)
    expect(perto(aplicar(q.papel, 1, 0.5), [60 + 10, 45])).toBe(true)   // centro deslocado 10 mm
    expect(perto(aplicar(q.papel, 0, 0.5), [70 - 25, 45])).toBe(true)  // meia largura = 25 mm
  })
  it('quadro da face (âncora face) não espelha', () => {
    const q = quadroDaFace(face, { mode: 'cover', mirror: true }, 2)
    expect(perto(aplicar(q.face, 0, 0), [10, 20])).toBe(true)
  })
  it('retângulo girado e proporção', () => {
    const r = retanguloGirado(face, 90)
    expect(r.w).toBeCloseTo(50); expect(r.h).toBeCloseTo(100)
    expect(proporcaoDaFace(face)).toBe(2)
  })
})

// ── base sintética: 2 moldes com uma face cada na FRENTE + uma aba ────────────────────────────────
function baseSintetica(): DocTrabalho {
  const d = novoDocumento('A4')
  d.artboards[0] = { id: 'ab_1', widthMm: 210, heightMm: 297 }
  const molde = (id: string, x: number, faces: Pt[][]) => ({
    id, name: id, artboardId: 'ab_1', transform: { xMm: x, yMm: 10, rotationDeg: 0 },
    source: { path: `Bases/moldes/${id}.pdf`, sha256: id.padEnd(64, '0'), widthMm: 90, heightMm: 120 },
    faces: facesParaReceita(id, faces.map(p => ({ poligono: p, tipos: p.map(() => 'cut' as const), furo: false }))),
  })
  d.molds = [molde('a', 10, [ret(5, 5, 60, 80), ret(65, 5, 20, 80)]), molde('b', 110, [ret(5, 5, 80, 100)])]
  return d
}
const temaCom = (camadas: CamadaImagemTema[], extra: Partial<DocTema> = {}): DocTema =>
  DocTema.parse({ schemaVersion: 1, type: 'theme', id: 'th', version: 1, baseId: 'b', baseVersion: 1, partContent: { p_frente: camadas }, ...extra })

describe('partes da base', () => {
  it('lista pronta, marcar, desmarcar, criar e excluir', () => {
    const d = baseSintetica()
    garantirPartesPadrao(d)
    expect(d.parts.map(p => p.name)).toEqual([...PARTES_PADRAO])
    atribuirFace(d, 'p_frente', 'f_a_1')
    expect(d.parts[0].instances.length).toBe(1)
    expect(d.parts[0].referenceAspect).toBe(0.75)   // 60 × 80
    atribuirFace(d, 'p_verso', 'f_a_1')            // passar para outra parte tira da primeira
    expect(d.parts[0].instances.length).toBe(0)
    desatribuirFace(d, 'f_a_1')
    expect(d.molds[0].faces[0].partId).toBeUndefined()
    const id = novaParte(d, 'Etiqueta')
    expect(d.parts.at(-1)).toMatchObject({ id: 'p_etiqueta', name: 'Etiqueta' })
    excluirParte(d, id)
    expect(DocBase.safeParse(d).success).toBe(true)
  })
})

describe('vínculo MAE (resolução)', () => {
  const papel: CamadaImagemTema = { id: 'l_papel', type: 'image', anchor: 'paper', path: 'Papéis/praia.png', sha256: 'aaaa', aspect: 1 }
  const elem: CamadaImagemTema = { id: 'l_angel', type: 'image', anchor: 'face', path: 'Elementos/angel.png', sha256: 'bbbb', aspect: 0.5, transform: { x: 0.5, y: 0.45, scale: 0.6, rotationDeg: 0 } }
  const prep = () => { const d = baseSintetica(); garantirPartesPadrao(d); atribuirFace(d, 'p_frente', 'f_a_1'); atribuirFace(d, 'p_frente', 'f_b_1'); return d }

  it('papel na FRENTE aparece em TODAS as frentes, recortado pela forma da face', () => {
    const d = prep()
    const nos = resolverPrancheta(d, 'ab_1', { tema: temaCom([papel]) })
    const formas = nos.filter(n => n.type === 'shape'), imgs = nos.filter(n => n.type === 'image')
    expect(formas.length).toBe(2); expect(imgs.length).toBe(2)
    expect(imgs.every(n => n.clip && n.type === 'image' && n.src.path === 'Papéis/praia.png')).toBe(true)
    // a face sem parte (aba) fica sem nada (não há papel das abas)
    expect(nos.some(n => n.id.startsWith('f_a_2'))).toBe(false)
  })

  it('elemento com âncora "face": mesma posição relativa em faces de tamanhos diferentes', () => {
    const d = prep()
    const nos = resolverPrancheta(d, 'ab_1', { tema: temaCom([elem]) }) as Extract<NoCamada, { type: 'image' }>[]
    const centros = nos.filter(n => n.type === 'image').map(n => aplicar(n.matrix as M, 0.5, 0.5))
    // face A: x 15..75 (molde em 10), y 15..95 → centro (45, 15 + 0.45·80 = 51)
    expect(perto(centros[0], [45, 51], 1e-3)).toBe(true)
    // face B: x 115..195, y 15..115 → (155, 60)
    expect(perto(centros[1], [155, 60], 1e-3)).toBe(true)
  })

  it('"Só nesta caixa": ajuste local mexe só naquela face; o resto segue o vínculo', () => {
    const d = prep()
    const tema = temaCom([elem, papel], { localOverrides: { f_b_1: { l_angel: { transform: { y: 0.3 } }, l_papel: { visible: false } } } })
    const nos = resolverPrancheta(d, 'ab_1', { tema }) as Extract<NoCamada, { type: 'image' }>[]
    const a = nos.filter(n => n.id.startsWith('f_a_1:') && n.type === 'image'), b = nos.filter(n => n.id.startsWith('f_b_1:') && n.type === 'image')
    expect(a.length).toBe(2); expect(b.length).toBe(1)                          // papel oculto só na B
    expect(aplicar(b[0].matrix as M, 0.5, 0.5)[1]).toBeCloseTo(15 + 0.3 * 100)   // y sobrescrito
    expect(aplicar(a[0].matrix as M, 0.5, 0.5)[1]).toBeCloseTo(51)               // A continua no padrão
  })

  it('efetiva(): só o que foi sobrescrito muda; troca de imagem por face', () => {
    const e = efetiva(elem, { transform: { scale: 0.3 }, path: 'Elementos/outro.png', sha256: 'cccc', aspect: 2 })
    expect(e.transform).toMatchObject({ x: 0.5, y: 0.45, scale: 0.3 })
    expect(e).toMatchObject({ path: 'Elementos/outro.png', aspect: 2 })
    expect(efetiva(elem, undefined)).toBe(elem)
  })

  it('camada exclusiva da face (desvincular / Alt) só aparece nela', () => {
    const d = prep()
    const nos = resolverPrancheta(d, 'ab_1', { tema: temaCom([papel], { faceContent: { f_a_1: [elem] } }) })
    expect(nos.filter(n => n.id.startsWith('f_a_1:x:')).length).toBe(1)
    expect(nos.filter(n => n.id.startsWith('f_b_1:x:')).length).toBe(0)
  })

  it('aba (face sem parte) recebe o papel das abas; o do tema vence o da base', () => {
    const d = prep()
    d.smartArt = { overflowMm: 10, flapFill: { path: 'Papéis/base.png', sha256: 'dddd', aspect: 1 } }
    const daBase = resolverPrancheta(d, 'ab_1', { tema: temaCom([papel]) }).find(n => n.id === 'f_a_2:abas')
    expect(daBase && daBase.type === 'image' && daBase.src.path).toBe('Papéis/base.png')
    const doTema = resolverPrancheta(d, 'ab_1', { tema: temaCom([papel], { overflowFill: { path: 'Papéis/tema.png', sha256: 'eeee' } }) }).find(n => n.id === 'f_a_2:abas')
    expect(doTema && doTema.type === 'image' && doTema.src.path).toBe('Papéis/tema.png')
  })

  it('modo base: papel quadriculado de teste em todas as faces da parte', () => {
    const d = prep()
    const nos = resolverPrancheta(d, 'ab_1', { gradeDaParte: (id, A) => ({ path: `grade/${id}`, sha256: `grade-${A}`, aspect: A }) })
    expect(nos.filter(n => n.id.endsWith(':grade')).length).toBe(2)
  })

  it('furo dentro da face entra como anel (o conteúdo não cobre o furo)', () => {
    const d = prep()
    d.molds[1].faces.push({ id: 'f_b_furo', polygonMm: ret(20, 20, 10, 10), hole: true })
    const forma = resolverPrancheta(d, 'ab_1', { tema: temaCom([papel]) }).find(n => n.id === 'f_b_1:forma')!
    expect(forma.type === 'shape' && forma.rings.length).toBe(2)
  })

  it('matriz da camada "papel" com tamanho padrão cobre a referência', () => {
    const q = quadroDaFace(ret(0, 0, 100, 50), { mode: 'stretch' }, 2)
    const m = matrizDaCamada({ ...papel, aspect: 2 }, q, 2)
    expect(perto(aplicar(m, 0, 0), [0, 0], 1e-9)).toBe(true)
    expect(perto(aplicar(m, 1, 1), [100, 50], 1e-9)).toBe(true)
  })
})

describe('motor desenha o tema (forma com furo + imagem com matriz)', () => {
  const criar = (w: number, h: number) => createCanvas(w, h) as unknown as CanvasLike
  it('forma recorta a imagem; furo fica vazio; espelhar troca os lados', () => {
    const img = createCanvas(2, 1); const g = img.getContext('2d')
    g.fillStyle = '#ff0000'; g.fillRect(0, 0, 1, 1); g.fillStyle = '#0000ff'; g.fillRect(1, 0, 1, 1)
    const base = { visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal' as const }
    const nos: NoCamada[] = [
      { ...base, id: 's', name: 's', clip: false, type: 'shape', color: '#ffffff', rings: [ret(0, 0, 20, 10), ret(8, 3, 4, 4)] },
      { ...base, id: 'i', name: 'i', clip: true, type: 'image', src: { path: 'x', sha256: 'x' }, xMm: 0, yMm: 0, wMm: 1, hMm: 1, rotationDeg: 0, matrix: [-20, 0, 0, 10, 20, 0] },
    ]
    const p = { id: 'p', widthMm: 20, heightMm: 12, layers: nos }
    const { w, h } = tamanhoDoCanvas(p, 2)
    const c = createCanvas(w, h)
    renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: 2, fundo: '#00ff00', criarCanvas: criar, bitmap: () => img as unknown as CanvasImageSource })
    const px = (x: number, y: number) => Array.from(c.getContext('2d').getImageData(x * 2, y * 2, 1, 1).data).slice(0, 3)
    expect(px(2, 5)).toEqual([0, 0, 255])    // espelhado: à esquerda fica o azul
    expect(px(17, 5)).toEqual([255, 0, 0])
    expect(px(10, 5)).toEqual([0, 255, 0])   // furo: aparece o fundo
    expect(px(10, 11)).toEqual([0, 255, 0])  // fora da forma
  })
})

// ── moldes reais: sugestão automática + tempo de "arrastar papel na FRENTE" ─────────────────────
describe('moldes reais', () => {
  let d: DocTrabalho
  beforeAll(async () => {
    d = novoDocumento('A4')
    d.artboards = []
    let i = 0
    for (const nome of MOLDES) {
      const m = await abrirMoldeReal(nome)
      const id = `m${++i}`
      d.artboards.push({ id: `ab${i}`, widthMm: 297, heightMm: 210 })
      d.molds.push({ id, name: nome.replace('.pdf', ''), artboardId: `ab${i}`, transform: { xMm: 2, yMm: 2, rotationDeg: 0 },
        source: { path: `Bases/moldes/${nome}`, sha256: String(i).padEnd(64, '0'), widthMm: m.prep.recorte.wMm, heightMm: m.prep.recorte.hMm },
        faces: facesParaReceita(id, m.det.faces) })
    }
    garantirPartesPadrao(d)
  }, 120_000)

  it('marcou a FRENTE do MILK → sugere 1 face grande em cada um dos outros 5 moldes', () => {
    const milk = d.molds.find(m => m.name === 'MILK')!
    const maior = [...milk.faces].filter(f => !f.hole).sort((a, b) => areaPol(b.polygonMm) - areaPol(a.polygonMm))[0]
    atribuirFace(d, 'p_frente', maior.id)
    const s = sugerirParaParte(d, 'p_frente')
    expect(s.length).toBe(5)
    for (const x of s) {
      const m = d.molds.find(mm => mm.id === x.moldeId)!
      const maiorDoMolde = Math.max(...m.faces.filter(f => !f.hole).map(f => areaPol(f.polygonMm)))
      expect(areaPol(m.faces.find(f => f.id === x.faceId)!.polygonMm)).toBeGreaterThan(0.45 * maiorDoMolde)
    }
    for (const x of s) atribuirFace(d, 'p_frente', x.faceId)   // "confirmar com 1 clique"
    expect(d.parts.find(p => p.id === 'p_frente')!.instances.length).toBe(6)
    expect(sugerirParaParte(d, 'p_frente')).toEqual([])        // todos os moldes já têm FRENTE
  })

  it('papel na FRENTE: resolver + desenhar as 6 folhas (prévia) em < 0,3 s', () => {
    const tema = temaCom([{ id: 'l_papel', type: 'image', anchor: 'paper', path: 'Papéis/papel.png', sha256: 'pppp', aspect: 1.5 }])
    const papelImg = createCanvas(600, 400); const g = papelImg.getContext('2d'); g.fillStyle = '#e11d48'; g.fillRect(0, 0, 600, 400)
    const k = 2   // ~50 dpi: a prévia de 6 folhas inteiras na tela
    const t0 = performance.now()
    let desenhadas = 0
    for (const ab of d.artboards) {
      const layers = resolverPrancheta(d, ab.id, { tema })
      const p = { ...ab, layers }
      const { w, h } = tamanhoDoCanvas(p, k)
      renderizarPrancheta(createCanvas(w, h) as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: (w2, h2) => createCanvas(w2, h2) as unknown as CanvasLike, bitmap: () => papelImg as unknown as CanvasImageSource })
      desenhadas += layers.filter(l => l.type === 'image').length
    }
    const ms = performance.now() - t0
    expect(desenhadas).toBe(6)
    expect(ms).toBeLessThan(300)
  })
})

function areaPol(p: [number, number][]) { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1]; return Math.abs(s / 2) }
