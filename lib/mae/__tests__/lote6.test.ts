// Lote 6 — ajustes da Naty (10/10/2026): seleção e camadas (81), peças por medida (90–95), herança de estilo (82),
// papel × cor (83), transição (87), furo de fita (89), textos no aplique (86), tema por pedido (88).
import { describe, it, expect } from 'vitest'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocBase, DocTema, type DocTrabalho } from '@/lib/mae/schema'
import { area, type Pt } from '@/lib/mae/faces/geometria'
import { CATALOGO_MEDIDAS } from '@/lib/mae/medidas/catalogo'
import { contornoDaMedida, novaPeca, aplicarEstrutura, montarBaseDeMedidas, pedacosDaPeca, ESTRUTURAS_PRONTAS, unidadesPorFolha, vagasDasUnidades, type Estrutura } from '@/lib/mae/medidas/pecas'
import { linhasDoMoldeNaFolha } from '@/lib/mae/exportar/linhas'
import { resolverPrancheta, matrizDaCamada } from '@/lib/mae/vinculo/resolver'
import { quadroDaFace } from '@/lib/mae/vinculo/enquadramento'
import { aplicar } from '@/lib/mae/vinculo/matriz'
import { liderDoCenario, nomeDaFaceNoMolde } from '@/lib/mae/vinculo/cenario'
import { escalarEfeitos, fatorDoPreset, REF_ALTURA_PADRAO_MM } from '@/lib/mae/efeitos/presets'
import { lerMedidaMm, emUnidade, deUnidade } from '@/lib/mae/editor/unidades'
import { redimensionarPrancheta, moldesForaDaPrancheta } from '@/lib/mae/editor/pranchetas'

const tema0 = (extra: Partial<DocTema> = {}) => DocTema.parse({ schemaVersion: 1, type: 'theme', id: 'th', version: 1, baseId: 'b', baseVersion: 1, partContent: {}, ...extra })

describe('itens 90/91 — peças por medida e estrutura', () => {
  it('catálogo: etiqueta de livro 90×50, tag Ø40 com furo; Pringles/Nutella conferidas pela Naty', () => {
    const livro = CATALOGO_MEDIDAS.find(m => m.id === 'esc-livros')!, tag = CATALOGO_MEDIDAS.find(m => m.id === 'tag-cofrinho')!
    expect([livro.larguraMm, livro.alturaMm]).toEqual([90, 50]); expect(tag.forma).toBe('circulo'); expect(tag.larguraMm).toBe(40); expect(tag.furo).toBeTruthy()
    expect(CATALOGO_MEDIDAS.filter(m => m.conferida).length).toBe(4)
  })
  it('forma: retângulo, cantos arredondados e círculo com a área certa', () => {
    expect(area(contornoDaMedida({ forma: 'retangulo', larguraMm: 90, alturaMm: 50 }))).toBeCloseTo(4500, 0)
    expect(area(contornoDaMedida({ forma: 'arredondado', larguraMm: 90, alturaMm: 50, raioMm: 5 }))).toBeCloseTo(4500 - (4 - Math.PI) * 25, 0)
    expect(area(contornoDaMedida({ forma: 'circulo', larguraMm: 40, alturaMm: 40 }))).toBeCloseTo(Math.PI * 400, -1)
  })
  it('base de medidas: peças sem arquivo, 1 parte FUNDO para todas, sobra pequena (2 mm), furo da tag; valida no schema', () => {
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Livros', medida: { forma: 'arredondado', larguraMm: 90, alturaMm: 50, raioMm: 3 } }, { nome: 'Tag', medida: { forma: 'circulo', larguraMm: 40, alturaMm: 40, furo: { x: 0.5, y: 0.14, diametroMm: 3.5 } } }])
    expect(d.molds.length).toBe(2); expect(d.parts.map(p => p.name)).toEqual(['FUNDO']); expect(d.parts[0].instances.length).toBe(2)
    expect(d.smartArt?.overflowMm).toBe(2)
    expect(d.molds[1].faces.filter(f => f.hole).length).toBe(1)
    expect(DocBase.safeParse(d).success).toBe(true)
  })
  it('estrutura "Fundo + base + faixa": 3 pedaços → 3 partes iguais em todas as medidas; a faixa tem a espessura dada', () => {
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Livros', medida: { forma: 'retangulo', larguraMm: 90, alturaMm: 50 } }, { nome: 'Caderno', medida: { forma: 'retangulo', larguraMm: 70, alturaMm: 30 } }])
    aplicarEstrutura(d, ESTRUTURAS_PRONTAS[1])
    expect(d.parts.map(p => p.name)).toEqual(['FUNDO', 'FAIXA', 'BASE'])
    for (const p of d.parts) expect(p.instances.length).toBe(2)
    const livro = d.molds[0]
    const areas = livro.faces.filter(f => !f.hole).map(f => area(f.polygonMm as Pt[]))
    expect(areas.reduce((s, a) => s + a, 0)).toBeCloseTo(4500, -1)
    expect(areas[1]).toBeCloseTo(90 * 2.5, -0.5)   // faixa de 2,5 mm
    // o corte é só o contorno da peça (as divisórias são arte, não linha)
    const l = linhasDoMoldeNaFolha(livro)
    expect(l.corte.length).toBe(1); expect(l.dobra.length).toBe(0)
  })
  it('transição suave: os pedaços se sobrepõem e o de depois some em degradê (grupo com máscara)', () => {
    const p = pedacosDaPeca({ forma: 'retangulo', larguraMm: 90, alturaMm: 50 }, ESTRUTURAS_PRONTAS[2])
    expect(p.map(x => x.nome)).toEqual(['LATERAL ESQ', 'LATERAL DIR'])
    expect(area(p[0].poligono) + area(p[1].poligono)).toBeGreaterThan(4500 + 90)   // sobreposição de 8 mm
    expect(p[1].fade).toBeTruthy(); expect(p[0].fade).toBeUndefined()
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Livros', medida: { forma: 'retangulo', larguraMm: 90, alturaMm: 50 } }])
    aplicarEstrutura(d, ESTRUTURAS_PRONTAS[2])
    const t = tema0({ partContent: Object.fromEntries(d.parts.map((pt, i) => [pt.id, [{ id: `c${i}`, type: 'solid', anchor: 'paper', color: i ? '#ff0000' : '#0000ff' }]])) as never })
    const nos = resolverPrancheta(d, d.artboards[0].id, { tema: t })
    const g = nos.find(n => n.id.endsWith(':degrade'))
    expect(g?.type).toBe('group'); expect((g as { mask?: { gradient?: unknown } }).mask?.gradient).toBeTruthy()
  })
  it('divisória arrastável: mudar a posição muda o tamanho dos pedaços', () => {
    const e: Estrutura = { ...ESTRUTURAS_PRONTAS[1], divisorias: [{ ...ESTRUTURAS_PRONTAS[1].divisorias[0], pos: 0.5 }] }
    const p = pedacosDaPeca({ forma: 'retangulo', larguraMm: 90, alturaMm: 50 }, e)
    expect(area(p[0].poligono)).toBeCloseTo(90 * (25 - 1.25), -0.5)
  })
})

describe('item 92 — adaptar para as outras medidas (recompor, não esticar)', () => {
  it('camada presa à ESQUERDA: tamanho pela altura, encostada no mesmo lado em 9×5 e 5×2,6', () => {
    const q9 = quadroDaFace([[0, 0], [90, 0], [90, 50], [0, 50]], { mode: 'cover' } as never, 1)
    const q5 = quadroDaFace([[0, 0], [50, 0], [50, 26], [0, 26]], { mode: 'cover' } as never, 1)
    const c = { anchor: 'face' as const, aspect: 1, transform: { x: 0.2, y: 0.5, scale: 0.4, rotationDeg: 0 }, presa: { h: 'esq' as const, v: 'meio' as const, refW: 90, refH: 50 } }
    const larg = (m: number[]) => Math.hypot(m[0], m[1])
    const m9 = matrizDaCamada(c, q9, 1), m5 = matrizDaCamada(c, q5, 1)
    expect(larg(m9)).toBeCloseTo(36, 1)                    // 0,4 × 90
    expect(larg(m5)).toBeCloseTo(36 * 26 / 50, 1)          // pela ALTURA (não pela largura)
    expect(aplicar(m5, 0.5, 0.5)[0]).toBeCloseTo(18 * 26 / 50, 1)   // a 18 mm × k da esquerda
    const dir = { ...c, transform: { ...c.transform, x: 0.85 }, presa: { ...c.presa, h: 'dir' as const } }
    expect(50 - aplicar(matrizDaCamada(dir, q5, 1), 0.5, 0.5)[0]).toBeCloseTo(13.5 * 26 / 50, 1)   // encostada à direita
  })
})

describe('item 94 — composição por unidade', () => {
  const vagas = [...Array(10)].map((_, i) => ({ indice: i, moldeId: i < 5 ? 'corpo' : 'tampa' }))
  it('Nutella: 1 corpo + 1 tampa — cabem 5 unidades; nunca sai corpo sem a tampa', () => {
    expect(unidadesPorFolha(vagas, [{ moldeId: 'corpo', qtd: 1 }, { moldeId: 'tampa', qtd: 1 }])).toBe(5)
    const v = vagasDasUnidades(vagas, [{ moldeId: 'corpo', qtd: 1 }, { moldeId: 'tampa', qtd: 1 }], [0, 0, 1])
    expect(v.slice(0, 5)).toEqual([0, 0, 1, -1, -1]); expect(v.slice(5)).toEqual([0, 0, 1, -1, -1])
  })
  it('encadernação: 2 guardas por unidade', () => {
    const vs = [...Array(6)].map((_, i) => ({ indice: i, moldeId: i < 2 ? 'capa' : 'guarda' }))
    expect(unidadesPorFolha(vs, [{ moldeId: 'capa', qtd: 1 }, { moldeId: 'guarda', qtd: 2 }])).toBe(2)
    expect(vagasDasUnidades(vs, [{ moldeId: 'capa', qtd: 1 }, { moldeId: 'guarda', qtd: 2 }], [3, 4])).toEqual([3, 4, 3, 3, 4, 4])
  })
})

describe('item 89 — a medida da peça e o furo de fita', () => {
  it('peça por medida: o molde inteiro é a peça (sem margem)', () => {
    const d: DocTrabalho = novoDocumento('A4')
    d.molds.push(novaPeca('Tag', { forma: 'circulo', larguraMm: 40, alturaMm: 40 }, d.artboards[0].id))
    expect(d.molds[0].source.widthMm).toBe(40)
  })
})

import { comNomeDividido } from '@/lib/mae/texto/variaveis'
describe('item 93 — nome completo dividido', () => {
  it('"Benício Dettoni de Azevedo" → NOME Benício + SOBRENOME o resto; divisão do pedido e sem sobrenome', () => {
    expect(comNomeDividido({ NOME: 'Benício Dettoni de Azevedo' }, true)).toMatchObject({ NOME: 'Benício', SOBRENOME: 'Dettoni de Azevedo' })
    expect(comNomeDividido({ NOME: 'João Arthur Silva', _DIVISAO_NOME: '2' }, true)).toMatchObject({ NOME: 'João Arthur', SOBRENOME: 'Silva' })
    expect(comNomeDividido({ NOME: 'Ana Júlia', _DIVISAO_NOME: '0' }, true)).toMatchObject({ NOME: 'Ana Júlia', SOBRENOME: '' })
    expect(comNomeDividido({ NOME: 'Laura Marques' }, false)).toEqual({ NOME: 'Laura Marques' })                 // arte sem sobrenome: não mexe
    expect(comNomeDividido({ NOME: 'Maria Júlia', SOBRENOME: 'Marques' }, true, {})).toMatchObject({ SOBRENOME: 'Marques' })   // tela sem pedido: o exemplo do tema
    expect(comNomeDividido({ NOME: 'Laura', SOBRENOME: 'Marques' }, true, { NOME: 'Laura' })).toMatchObject({ NOME: 'Laura', SOBRENOME: '' })   // pedido só com o nome: sem sobrenome (some)
    expect(comNomeDividido({ NOME: 'Laura Marques', SOBRENOME: 'X' }, true, { NOME: 'Laura Marques' })).toMatchObject({ NOME: 'Laura', SOBRENOME: 'Marques' })
  })
})

import { sugerirGabarito, vagasDoGabarito, sobraNaFolha, docDaFolha, distribuirLote, docDoLote, lugaresDasVagas } from '@/lib/mae/editor/folhaMontada'
import { detectarFaces } from '@/lib/mae/faces/detectar'
describe('item 95 — folha com gabarito fixo', () => {
  const base = () => { const d = novoDocumento('A4'); d.molds.push(novaPeca('Tag', { forma: 'circulo', larguraMm: 40, alturaMm: 40, furo: { x: 0.5, y: 0.14, diametroMm: 3.5 } }, d.artboards[0].id)); return d }
  it('META da Naty: tag 4×4 em A4 paisagem, em grade = 24 (e a paisagem ganha da retrato)', () => {
    const d = base()
    const s = sugerirGabarito({ widthMm: 210, heightMm: 297, espacoMm: 3, margemMm: 5 }, d.molds[0].id, d.molds, () => [])
    const pais = s.opcoes.find(o => o.orientacao === 'paisagem' && o.modo === 'grade')!
    expect(pais.pecas.length).toBe(24)
    expect(s.melhor.pecas.length).toBeGreaterThanOrEqual(24)
  })
  it('gabarito importado da plotter: as vagas ficam nas posições EXATAS do arquivo; marcas ficam de fora', () => {
    const d = base()
    const contornos = [{ x: 20, y: 15, w: 40, h: 40 }, { x: 64, y: 15, w: 40.2, h: 39.9 }, { x: 5, y: 5, w: 6, h: 6 }]
    const r = vagasDoGabarito(contornos, d.molds)
    expect(r.pecas.map(p => [p.xMm, p.yMm])).toEqual([[20, 15], [64, 15]]); expect(r.ignorados).toBe(1)
  })
  it('a sangria nunca passa da metade do espaço até a vizinha', () => {
    expect(sobraNaFolha({ smartArt: { overflowMm: 10 } } as never, { espacoMm: 3 })).toBe(1.5)
    expect(sobraNaFolha({ smartArt: { overflowMm: 2 } } as never, { espacoMm: 6 })).toBe(2)
    const d = base()
    const f = { id: 'f', nome: 'Tags', widthMm: 297, heightMm: 210, espacoMm: 3, margemMm: 5, pecas: [{ moldeId: d.molds[0].id, xMm: 10, yMm: 10, rot: 0 as const }] }
    expect(docDaFolha(d, tema0(), f).doc.smartArt?.overflowMm).toBe(1.5)
  })
  it('pedido ocupa as vagas na ordem; vaga que sobra fica VAZIA (nada se mexe)', () => {
    const d = base()
    const pecas = [0, 1, 2, 3].map(i => ({ moldeId: d.molds[0].id, xMm: 10 + i * 45, yMm: 10, rot: 0 as const }))
    const f = { id: 'f', nome: 'Tags', widthMm: 297, heightMm: 210, espacoMm: 3, margemMm: 5, pecas }
    const lote = docDoLote(d, tema0(), f, distribuirLote(4, [3]), [{ rotulo: '#1 · Ana', valores: { NOME: 'Ana' } }])
    expect(lote.doc.molds.length).toBe(3)
    // as posições das peças são as das vagas (o gabarito não muda)
    expect(lote.doc.molds.map(m => m.transform.xMm)).toEqual([10, 55, 100])
    expect(lugaresDasVagas(f, [0, -1, 0, -1])).toEqual([0, -1, 0, -1])
  })
})

describe('item 89 — furo de fita reconhecido', () => {
  it('tag redonda Ø40 com furinho Ø4 no alto: 1 face + 1 furo (antes: 0 furos)', () => {
    const k = 8, W = 60, H = 60
    const m = { w: W * k, h: H * k, d: new Uint8Array(W * k * H * k) }
    const circulo = (cx: number, cy: number, r: number) => { for (let a = 0; a < Math.PI * 2; a += 0.002) { const x = Math.round((cx + r * Math.cos(a)) * k), y = Math.round((cy + r * Math.sin(a)) * k); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) m.d[(y + dy) * m.w + x + dx] = 1 } }
    circulo(30, 30, 20); circulo(30, 15, 2)
    const r = detectarFaces(m, { pxPorMm: k })
    expect(r.faces.filter(f => !f.furo).length).toBe(1)
    expect(r.faces.filter(f => f.furo).length).toBe(1)
  })
})

describe('itens 104/110/111/113/114 — cenário, efeitos, espaçamento, unidades, prancheta', () => {
  it('104: no cenário, toda face usa a arte da face LÍDER (a 1ª do grupo) e cada face tem nome distinto', () => {
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Livros', medida: { forma: 'retangulo', larguraMm: 90, alturaMm: 50 } }])
    aplicarEstrutura(d, ESTRUTURAS_PRONTAS[1])
    const fs = d.molds[0].faces.filter(f => !f.hole).map(f => f.id)
    const t = tema0({ cenarios: [[fs[0], fs[1]]] })
    const l = liderDoCenario(d, t, fs[1])!
    expect(l.faceId).toBe(fs[0])
    expect(l.parteId).toBe(d.parts.find(p => p.instances.some(i => i.faceId === fs[0]))!.id)
    expect(liderDoCenario(d, tema0(), fs[1])).toBeNull()
    expect(new Set(fs.map(f => nomeDaFaceNoMolde(d, f))).size).toBe(fs.length)
  })
  it('110: preset proporcional à altura do texto + "Escala dos efeitos"', async () => {
    const efs = [{ type: 'stroke', sizeMm: 1.6, color: '#ffffff', position: 'outside' }, { type: 'dropShadow', color: '#000000', distanceMm: 1, sizeMm: 0.8, angleDeg: 120 }]
    expect(fatorDoPreset({}, REF_ALTURA_PADRAO_MM / 2)).toBeCloseTo(0.5)
    expect(fatorDoPreset({ refAlturaMm: 6 }, 6)).toBe(1)
    expect(fatorDoPreset({}, null)).toBe(1)
    const m = escalarEfeitos(efs, 0.5) as { sizeMm: number; distanceMm?: number; angleDeg?: number }[]
    expect(m[0].sizeMm).toBe(0.8); expect(m[1].distanceMm).toBe(0.5); expect(m[1].angleDeg).toBe(120)
    expect((escalarEfeitos(efs, 100) as { sizeMm: number }[])[0].sizeMm).toBe(20)
  })
  it('113: medida com unidade em qualquer campo; px a 300 dpi', async () => {
    expect(lerMedidaMm('9cm')).toBe(90); expect(lerMedidaMm('3,5 mm')).toBe(3.5); expect(lerMedidaMm('90', 'cm')).toBe(900)
    expect(lerMedidaMm('300px')).toBeCloseTo(25.4); expect(lerMedidaMm('abc')).toBeNull()
    expect(emUnidade(25.4, 'px')).toBeCloseTo(300); expect(deUnidade(9, 'cm')).toBe(90)
  })
  it('114: prancheta menor — os moldes andam para dentro; se não couber, ficam centralizados', async () => {
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Livros', medida: { forma: 'retangulo', larguraMm: 90, alturaMm: 50 } }])
    const ab = d.molds[0].artboardId
    d.molds[0].transform.xMm = 110; d.molds[0].transform.yMm = 240
    redimensionarPrancheta(d as never, ab, 148, 210)
    expect(moldesForaDaPrancheta(d as never, ab)).toEqual([])
    redimensionarPrancheta(d as never, ab, 60, 40)
    expect(moldesForaDaPrancheta(d as never, ab).length).toBe(1)
  })
})
