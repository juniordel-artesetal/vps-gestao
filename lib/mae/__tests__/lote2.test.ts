// Lote 2 (teste da Naty, 05/10/2026) — Etapa 1: marca de registro e exportação (itens 23, 22, 19, 17, 21).
import { describe, it, expect } from 'vitest'
import { createCanvas, Path2D as P2D } from '@napi-rs/canvas'
import { PDFDocument } from 'pdf-lib'
import { marcaNaFolha, zonasNaFolha } from '@/lib/mae/exportar/marca'
import { montarPdf } from '@/lib/mae/exportar/pdf'
import { marcaDaPrancheta, encaixeDaMarca } from '@/components/mae/marcasMae'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { atribuirFace, garantirPartesPadrao } from '@/lib/mae/vinculo/partes'
import { colocarElemento, colocarPapel, novoTema } from '@/lib/mae/vinculo/tema'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from '@/lib/mae/render'
import { facesParaReceita } from '@/lib/mae/editor/moldes'
import { novoDocumento } from '@/lib/mae/schema/documento'
import type { DocTrabalho } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'

const PT = 72 / 25.4
async function pdfDeMarca(wMm: number, hMm: number): Promise<Uint8Array> {
  const d = await PDFDocument.create(); const pg = d.addPage([wMm * PT, hMm * PT]); pg.drawRectangle({ x: 10, y: 10, width: 20, height: 20 }); return d.save()
}
const pngBranco = (w: number, h: number) => new Uint8Array(createCanvas(w, h).toBuffer('image/png'))
const marca = (id: string, sha: string, w = 210, h = 297) => ({ id, nome: id, path: `Marcas de registro/${id}.pdf`, sha256: sha.padEnd(64, '0'), wMm: w, hMm: h, pagina: 1, zonas: [] })

describe('19/22 · a página tem a orientação da PRANCHETA; quem gira é a marca', () => {
  it('marca retrato em prancheta paisagem: a MARCA gira (a arte não); zonas giradas junto', () => {
    expect(marcaNaFolha(297, 210, 210, 297)).toEqual({ girar: true, diferente: false, dx: 0, dy: 0 })
    expect(marcaNaFolha(210, 297, 210, 297)).toEqual({ girar: false, diferente: false, dx: 0, dy: 0 })
    const e = marcaNaFolha(297, 210, 210, 297)
    // zona no canto de cima/esquerda da marca retrato (10×10 em 5,5) → canto de cima/DIREITA da folha paisagem
    expect(zonasNaFolha([{ x: 5, y: 5, w: 10, h: 10 }], e, 297)).toEqual([{ x: 282, y: 5, w: 10, h: 10 }])
    const dif = marcaNaFolha(200, 200, 210, 297)
    expect(dif.diferente).toBe(true)
  })
  it('PDF "tudo junto" de base mista: cada página na orientação da sua prancheta, com a sua marca', async () => {
    const retrato = await pdfDeMarca(210, 297)
    const paginas = [
      { larguraMm: 297, alturaMm: 210, arte: { bytes: pngBranco(40, 28), tipo: 'png' as const, larguraMm: 297, alturaMm: 210 }, marca: { bytes: retrato, pagina: 1, ...marcaNaFolha(297, 210, 210, 297) } },
      { larguraMm: 210, alturaMm: 297, arte: { bytes: pngBranco(28, 40), tipo: 'png' as const, larguraMm: 210, alturaMm: 297 }, marca: { bytes: retrato, pagina: 1, ...marcaNaFolha(210, 297, 210, 297) } },
    ]
    const d = await PDFDocument.load(await montarPdf(paginas, 't'))
    const tam = d.getPages().map(p => p.getSize()).map(s => [Math.round(s.width / PT), Math.round(s.height / PT)])
    expect(tam).toEqual([[297, 210], [210, 297]])
  })
  it('arte em JPG dentro do PDF: bem menor que PNG', async () => {
    // textura de "foto" (como os papéis de verdade): PNG não comprime, JPG sim
    const c = createCanvas(1200, 900), g = c.getContext('2d'), id = g.createImageData(1200, 900)
    let sem = 7; const rnd = () => (sem = (sem * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < id.data.length; i += 4) { const x = (i / 4) % 1200; id.data[i] = 200 + rnd() * 40; id.data[i + 1] = 120 + (x % 50) + rnd() * 30; id.data[i + 2] = 160 + rnd() * 50; id.data[i + 3] = 255 }
    g.putImageData(id, 0, 0)
    const png = new Uint8Array(c.toBuffer('image/png')), jpg = new Uint8Array(c.toBuffer('image/jpeg', 92))
    const a = await montarPdf([{ larguraMm: 297, alturaMm: 210, arte: { bytes: png, tipo: 'png', larguraMm: 297, alturaMm: 210 } }], 't')
    const b = await montarPdf([{ larguraMm: 297, alturaMm: 210, arte: { bytes: jpg, tipo: 'jpg', larguraMm: 297, alturaMm: 210 } }], 't')
    expect(b.length).toBeLessThan(a.length / 2)
  })
})

describe('23/17 · o vínculo da marca não se perde', () => {
  it('acha pelo código e, se ele mudar (marca cadastrada de novo), pela impressão digital do arquivo', () => {
    const lista = [marca('mr_novo', 'abc')]
    expect(marcaDaPrancheta({ registrationPresetId: 'mr_novo' }, lista)?.id).toBe('mr_novo')
    expect(marcaDaPrancheta({ registrationPresetId: 'mr_antigo', registrationPresetSha: 'abc'.padEnd(64, '0') }, lista)?.id).toBe('mr_novo')
    expect(marcaDaPrancheta({ registrationPresetId: 'mr_antigo' }, lista)).toBeNull()       // a tela mostra "⚠️ não encontrada"
    expect(marcaDaPrancheta({}, lista)).toBeNull()
  })
  it('✓ quando tamanho e orientação batem; ⚠️ girada ou diferente', () => {
    expect(encaixeDaMarca({ widthMm: 210, heightMm: 297 }, { wMm: 210, hMm: 297 })).toBe('ok')
    expect(encaixeDaMarca({ widthMm: 297, heightMm: 210 }, { wMm: 210, hMm: 297 })).toBe('girada')
    expect(encaixeDaMarca({ widthMm: 200, heightMm: 200 }, { wMm: 210, hMm: 297 })).toBe('diferente')
  })
})

// ── 21: na impressão, só papel/cor vazam até a sobra; elemento fica no contorno da face ──────────
const ret = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
function base(): DocTrabalho {
  const d = novoDocumento('A4'); d.artboards[0] = { id: 'ab_1', widthMm: 210, heightMm: 297 }
  d.molds = [{ id: 'a', name: 'MILK', artboardId: 'ab_1', transform: { xMm: 50, yMm: 50, rotationDeg: 0 }, source: { path: 'Bases/moldes/a.pdf', sha256: 'a'.padEnd(64, '0'), widthMm: 100, heightMm: 100 },
    faces: facesParaReceita('a', [{ poligono: ret(0, 0, 100, 100), tipos: ['cut', 'cut', 'cut', 'cut'], furo: false }]) }] as never
  garantirPartesPadrao(d); atribuirFace(d, 'p_frente', 'f_a_1')
  return d
}
describe('21 · elementos não vazam com a arte inteligente', () => {
  const cor = (hex: string) => { const x = createCanvas(16, 16), g = x.getContext('2d'); g.fillStyle = hex; g.fillRect(0, 0, 16, 16); return x }
  const desenhar = (bleed: boolean) => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    colocarPapel(t, 'p_frente', { path: 'Papéis/rosa.png', sha256: 'rrrr', aspect: 1 })
    const id = colocarElemento(t, 'p_frente', { path: 'Elementos/urso.png', sha256: 'uuuu', aspect: 1 }, { x: 0.02, y: 0.5 })   // na borda esquerda
    const c0 = t.partContent.p_frente.find(c => c.id === id)!
    c0.transform = { x: 0.02, y: 0.5, scale: 0.4, rotationDeg: 0 }
    if (bleed) (c0 as { bleed?: boolean }).bleed = true
    const k = 2, layers = resolverPrancheta(base(), 'ab_1', { tema: t, modo: 'impressao', sobraMm: 20 })
    const p = { id: 'ab_1', widthMm: 210, heightMm: 297, layers }
    const { w, h } = tamanhoDoCanvas(p, k), c = createCanvas(w, h)
    const imgs: Record<string, unknown> = { rrrr: cor('#ff00ff'), uuuu: cor('#0000ff') }
    renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: (a, b) => createCanvas(a, b) as unknown as CanvasLike, bitmap: s => imgs[s] as CanvasImageSource, criarCaminho: d => new P2D(d) as unknown as Path2D })
    return (x: number, y: number) => Array.from(c.getContext('2d').getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data).slice(0, 3)
  }
  it('papel vaza até a sobra; o elemento da borda fica recortado na face', () => {
    const px = desenhar(false)
    expect(px(40, 100)).toEqual([255, 0, 255])     // 10 mm fora da face: o PAPEL vazou (sobra 20 mm)
    expect(px(55, 100)).toEqual([0, 0, 255])        // dentro da face: o urso
    expect(px(45, 100)).toEqual([255, 0, 255])     // fora da face, onde o urso estaria: só papel (recortado)
  })
  it('"Pode vazar da face" ligado: o elemento vaza junto', () => {
    expect(desenhar(true)(45, 100)).toEqual([0, 0, 255])
  })
})

// ── 26: temas prontos ─────────────────────────────────────────────────────────────────────────────
import { montarTemaPronto, lerApelidos, lembrarApelido, nomeDoArquivo } from '@/lib/mae/temasProntos/montar'
import { acharTema } from '@/lib/mae/pedidos/pedidos'
import { nomeTemaPronto } from '@/lib/mae/exportar/nomes'
import { DocBase, DocTema } from '@/lib/mae/schema'

describe('26 · temas prontos', () => {
  const montar = () => montarTemaPronto({ nome: 'Fazendinha', arquivo: { path: 'Temas/Fazendinha.pdf', sha256: 'f'.repeat(64), kind: 'pdf' }, paginas: [
    { nome: 'CAIXA MILK', wMm: 210, hMm: 297, imagem: { path: 'Temas/paginas/Fazendinha/pagina-1.jpg', sha256: 'a'.repeat(64), aspect: 210 / 297 } },
    { nome: 'TOPO', wMm: 297, hMm: 210, imagem: { path: 'Temas/paginas/Fazendinha/pagina-2.jpg', sha256: 'b'.repeat(64), aspect: 297 / 210 } },
  ] })
  it('cada página vira prancheta (no tamanho e orientação dela) + parte; a página é o papel; textos na 1ª', () => {
    const { base, tema } = montar()
    expect(DocBase.safeParse(base).success).toBe(true)
    expect(DocTema.safeParse(tema).success).toBe(true)
    expect(base.pronto?.path).toBe('Temas/Fazendinha.pdf')
    expect(base.artboards.map(a => [a.name, a.widthMm, a.heightMm])).toEqual([['CAIXA MILK', 210, 297], ['TOPO', 297, 210]])
    expect(base.parts.map(p => p.name)).toEqual(['CAIXA MILK', 'TOPO'])
    expect(base.textSlots.map(t => t.variable)).toEqual(['NOME', 'IDADE', 'HASHTAG'])
    expect(base.textSlots.every(t => t.faceId === base.molds[0].faces[0].id)).toBe(true)
    expect(tema.baseId).toBe(base.id)
    expect(base.parts.map(p => tema.partContent[p.id]?.[0]?.type === 'image' && (tema.partContent[p.id][0] as { path: string }).path)).toEqual(['Temas/paginas/Fazendinha/pagina-1.jpg', 'Temas/paginas/Fazendinha/pagina-2.jpg'])
    expect(nomeDoArquivo('Temas/Fazendinha Rosa.pdf')).toBe('Fazendinha Rosa')
  })
  it('a página preenche a prancheta inteira (papel = página), sem sobra', () => {
    const { base, tema } = montar()
    const k = 1, ab = base.artboards[1]
    const p = { ...ab, layers: resolverPrancheta(base, ab.id, { tema, modo: 'impressao', sobraMm: 0 }) }
    const { w, h } = tamanhoDoCanvas(p, k), c = createCanvas(w, h)
    const verde = createCanvas(30, 21); verde.getContext('2d').fillStyle = '#00ff00'; verde.getContext('2d').fillRect(0, 0, 30, 21)
    renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: (a, b) => createCanvas(a, b) as unknown as CanvasLike, bitmap: () => verde as unknown as CanvasImageSource, criarCaminho: d => new P2D(d) as unknown as Path2D })
    const px = (x: number, y: number) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data).slice(0, 3)
    expect(px(2, 2)).toEqual([0, 255, 0]); expect(px(294, 207)).toEqual([0, 255, 0]); expect(px(148, 105)).toEqual([0, 255, 0])
  })
  it('TEMA do pedido acha o tema ignorando maiúsculas, acentos e espaços; senão, o apelido guardado', () => {
    const temas = [{ id: 't1', name: 'Fazendinha', version: 1 }, { id: 't2', name: 'Fundo do Mar', version: 1 }]
    expect(acharTema([], [], temas, ' fazen DINHA ')?.themeId).toBe('t1')
    expect(acharTema([], [], temas, 'fundodomar')?.themeId).toBe('t2')
    expect(acharTema([], [], temas, 'Fazenda')).toBeNull()                                  // "tema não encontrado"
    const ap = lembrarApelido(lerApelidos('{}'), 'Fazenda ', 't1')
    expect(acharTema([], [], temas, 'FAZENDA', ap)).toEqual({ themeId: 't1', origem: 'manual' })
    expect(lerApelidos('lixo')).toEqual({})
    // vínculo com o produto continua vencendo o campo
    expect(acharTema([{ produtoId: 'p1' }], [{ produtoId: 'p1', variacaoId: null, themeId: 't2' }], temas, 'Fazendinha')?.themeId).toBe('t2')
  })
  it('nome do arquivo: {Nome}_{Idade}anos_{Tema}_{data}; por caixa com a CAIXA; repetido ganha o pedido', () => {
    const d = new Date(2026, 9, 5)
    expect(nomeTemaPronto({ nome: 'Maria Júlia', idade: '2', tema: 'Fazendinha', data: d, extensao: 'pdf' })).toBe('Maria-Julia_2anos_Fazendinha_2026-10-05.pdf')
    expect(nomeTemaPronto({ nome: 'Maria Júlia', idade: '2', tema: 'Fazendinha', caixa: 'CAIXA MILK', data: d, extensao: 'pdf' })).toBe('Maria-Julia_2anos_Fazendinha_CAIXA-MILK_2026-10-05.pdf')
    const ex = new Set(['Maria-Julia_2anos_Fazendinha_2026-10-05.pdf'])
    expect(nomeTemaPronto({ nome: 'Maria Júlia', idade: '2', tema: 'Fazendinha', data: d, extensao: 'pdf', pedido: '1234', existentes: ex })).toBe('Maria-Julia_2anos_Fazendinha_2026-10-05_ped1234.pdf')
  })
})

// ── 15: posição dos moldes na prancheta ──────────────────────────────────────────────────────────
import { areaUtil, alinhar, centralizarGrupo, distribuir } from '@/lib/mae/editor/alinhamento'

describe('15 · centralizar, alinhar e distribuir os moldes', () => {
  it('área útil tira as áreas da marca (cantos e réguas)', () => {
    expect(areaUtil(210, 297)).toEqual({ x: 0, y: 0, w: 210, h: 297 })
    // quadrado no canto de cima/esquerda (10..25) e régua embaixo (y 280..290)
    const a = areaUtil(210, 297, [{ x: 10, y: 10, w: 15, h: 15 }, { x: 20, y: 280, w: 170, h: 10 }])
    expect(a).toEqual({ x: 25, y: 25, w: 185, h: 255 })
  })
  it('centraliza o grupo na área útil sem mudar as distâncias', () => {
    const cs = [{ x: 0, y: 0, w: 50, h: 40 }, { x: 60, y: 0, w: 50, h: 40 }]
    expect(centralizarGrupo(cs, { x: 0, y: 0, w: 210, h: 297 })).toEqual({ dx: 50, dy: 128.5 })
  })
  it('alinhar à prancheta move o bloco; entre os selecionados alinha cada um', () => {
    const cs = [{ x: 20, y: 30, w: 50, h: 40 }, { x: 100, y: 80, w: 30, h: 60 }]
    const area = { x: 10, y: 10, w: 190, h: 277 }
    expect(alinhar(cs, 'esquerda', 'prancheta', area)).toEqual([{ dx: -10, dy: 0 }, { dx: -10, dy: 0 }])
    expect(alinhar(cs, 'base', 'prancheta', area)).toEqual([{ dx: 0, dy: 147 }, { dx: 0, dy: 147 }])
    expect(alinhar(cs, 'topo', 'selecao', area)).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: -50 }])
    expect(alinhar(cs, 'direita', 'selecao', area)).toEqual([{ dx: 60, dy: 0 }, { dx: 0, dy: 0 }])
    expect(alinhar(cs, 'centro', 'selecao', area)).toEqual([{ dx: 30, dy: 0 }, { dx: -40, dy: 0 }])
  })
  it('distribuir: espaço igual entre os moldes, as pontas ficam', () => {
    const cs = [{ x: 0, y: 0, w: 20, h: 10 }, { x: 25, y: 0, w: 20, h: 10 }, { x: 100, y: 0, w: 20, h: 10 }]
    expect(distribuir(cs, 'h')).toEqual([{ dx: 0, dy: 0 }, { dx: 25, dy: 0 }, { dx: 0, dy: 0 }])   // gap 30: 0–20, 50–70, 100–120
  })
})
