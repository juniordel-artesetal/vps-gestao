// Lote 16 (P1, itens 205–207) — o rótulo Nutella da Naty: Corpo 200 × 35 (Folha 1 = 7) e Tampa Ø 57 (Folha 2 = 12);
// kit vendido = 10 rótulos (10 corpos + 10 tampas).
import { describe, it, expect } from 'vitest'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema, DocBase, type DocTrabalho, type FolhaMontada } from '@/lib/mae/schema'
import { montarBaseDeMedidas, aplicarEstrutura, estruturaDaPeca, ESTRUTURAS_PRONTAS, medidaDe } from '@/lib/mae/medidas/pecas'
import { organizarFolha, distribuirKit, docDoKit, docDaFolha, folhasDoKit, contagemDoKit, ehComposicaoPorUnidade } from '@/lib/mae/editor/folhaMontada'
import { resumoComposicao } from '@/lib/mae/editor/kitBase'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { temaProntoNasPecas, pecaComAMedida, proporcaoDiferente, rotuloDaMedida } from '@/lib/mae/temasProntos/montar'

const tema = (id: string, extra: Record<string, unknown> = {}) => DocTema.parse({ schemaVersion: 1, type: 'theme', id, version: 1, baseId: 'b', baseVersion: 1, partContent: {}, ...extra })

/** A base Rótulo Nutella: as duas peças, Folha 1 com 7 corpos e Folha 2 com 12 tampas. */
function nutella(): { d: DocTrabalho; corpo: string; tampa: string; f1: FolhaMontada; f2: FolhaMontada } {
  const d = novoDocumento('A4')
  montarBaseDeMedidas(d, [{ nome: 'Nutella · Corpo', medida: { forma: 'retangulo', larguraMm: 200, alturaMm: 35 } }, { nome: 'Nutella · Tampa', medida: { forma: 'circulo', larguraMm: 57, alturaMm: 57 } }])
  const [corpo, tampa] = d.molds.map(m => m.id)
  const fol = { widthMm: 210, heightMm: 297, espacoMm: 2, margemMm: 5 }
  const f1: FolhaMontada = { id: 'f1', nome: 'rótulo frente', ...fol, pecas: organizarFolha(fol, [{ moldeId: corpo, quantidade: 7 }], d.molds).pecas.slice(0, 7) }
  const f2: FolhaMontada = { id: 'f2', nome: 'rótulo tampa', ...fol, pecas: organizarFolha(fol, [{ moldeId: tampa, quantidade: 12 }], d.molds).pecas.slice(0, 12) }
  d.folhas = [f1, f2]
  ;(d as DocTrabalho & { tipo?: string }).tipo = 'medida'
  return { d, corpo, tampa, f1, f2 }
}

describe('207 — estrutura por peça', () => {
  it('corpo com fundo + faixa + base; tampa continua inteira; mudar a medida respeita; "Todas" limpa', () => {
    const { d, corpo, tampa } = nutella()
    expect(d.molds[0].faces.filter(f => !f.hole).length).toBe(1)
    aplicarEstrutura(d, ESTRUTURAS_PRONTAS[1], { peca: corpo })
    const fc = () => d.molds.find(m => m.id === corpo)!.faces.filter(f => !f.hole).length
    const ft = () => d.molds.find(m => m.id === tampa)!.faces.filter(f => !f.hole).length
    expect(fc()).toBe(3); expect(ft()).toBe(1)
    expect(estruturaDaPeca(d as never, corpo).id).toBe('fundo-base-faixa')
    expect(estruturaDaPeca(d as never, tampa).id).toBe('inteiro')
    expect(d.parts.map(p => p.name)).toEqual(expect.arrayContaining(['FUNDO', 'FAIXA', 'BASE']))
    // reaplicar (mudou a medida) com `manter`: cada peça com a sua
    aplicarEstrutura(d, (d as { estrutura?: never }).estrutura ?? ESTRUTURAS_PRONTAS[0], { manter: true })
    expect(fc()).toBe(3); expect(ft()).toBe(1)
    // "Todas as peças": a mesma para todas, as próprias saem
    aplicarEstrutura(d, ESTRUTURAS_PRONTAS[0])
    expect(fc()).toBe(1); expect(medidaDe(d.molds[0])?.estrutura).toBeUndefined()
  })
  it('a estrutura da peça passa no schema (salva e volta)', () => {
    const { d, corpo } = nutella()
    aplicarEstrutura(d, ESTRUTURAS_PRONTAS[1], { peca: corpo })
    const r = DocBase.safeParse(d)
    expect(r.success).toBe(true)
    if (r.success) expect((r.data.molds[0] as { medida?: { estrutura?: { id: string } } }).medida?.estrutura?.id).toBe('fundo-base-faixa')
  })
})

describe('206 — kit de N peças', () => {
  const comp = (d: DocTrabalho, c: string, t: string) => [{ moldeId: c, qtd: 10 }, { moldeId: t, qtd: 10 }]
  it('1 kit de 10 rótulos = 3 folhas (Corpo 7 + 3 · Tampa 10)', () => {
    const { d, corpo, tampa, f1, f2 } = nutella()
    const c = comp(d, corpo, tampa)
    const kit = [{ folha: f1, impressoes: 1 }, { folha: f2, impressoes: 1 }]
    const r = distribuirKit(kit, [{ kits: 1, pecas: 0 }], 'composicao', false, c)
    expect(r[0].dist.map(s => s.length)).toEqual([7, 3])
    expect(r[1].dist.map(s => s.length)).toEqual([10])
    expect(resumoComposicao([f1, f2], c, d.molds)).toBe('Este kit = 3 folhas (Corpo 7 + 3 · Tampa 10)')
    expect(contagemDoKit({ contagem: 'composicao', composicao: c }, kit)).toBe('composicao')
    expect(ehComposicaoPorUnidade({ contagem: 'composicao', composicao: c })).toBe(false)
    expect(ehComposicaoPorUnidade({ composicao: c })).toBe(true)          // o caminho antigo (Lote 6) continua
  })
  it('2 kits = 20 corpos (3 folhas) + 20 tampas (2 folhas)', () => {
    const { d, corpo, tampa, f1, f2 } = nutella()
    const r = distribuirKit([{ folha: f1, impressoes: 1 }, { folha: f2, impressoes: 1 }], [{ kits: 2, pecas: 0 }], 'composicao', false, comp(d, corpo, tampa))
    expect(r[0].dist.map(s => s.length)).toEqual([7, 7, 6]); expect(r[1].dist.map(s => s.length)).toEqual([12, 8])
  })
  it('Aproveitar folhas: 3 pedidos de 10 (Carros, Moana, Stitch) = 30 corpos → 5 folhas (e não 6)', () => {
    const { d, corpo, tampa, f1, f2 } = nutella()
    const r = distribuirKit([{ folha: f1, impressoes: 1 }, { folha: f2, impressoes: 1 }], [{ kits: 1, pecas: 0 }, { kits: 1, pecas: 0 }, { kits: 1, pecas: 0 }], 'composicao', true, comp(d, corpo, tampa))
    expect(r[0].dist.length).toBe(5); expect(r[0].dist.flat().length).toBe(30)
    expect(r[1].dist.length).toBe(3)
  })
  it('… e cada rótulo leva a arte do SEU tema (partes copiadas por tema) e o estilo dele', () => {
    const { d, corpo, tampa, f1, f2 } = nutella()
    const fundo = d.parts.find(p => p.name === 'FUNDO')!.id
    d.textSlots.push({ id: 'ts_nome', variable: 'NOME', faceId: d.molds[0].faces.find(x => !x.hole)!.id, box: { x: 0.2, y: 0.4, w: 0.6, h: 0.3 }, single: { lines: 1, sizePt: 20 }, compound: { lines: 2, sizePt: 16, lineHeight: 0.9 }, autoFit: { minScale: 0.6 } } as never)
    const papel = (path: string) => [{ id: 'l1', type: 'image', anchor: 'paper', path, sha256: 'abcd', aspect: 1, transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } }]
    const carros = tema('th_carros', { partContent: { [fundo]: papel('Papéis/carros.png') } })
    const moana = tema('th_moana', { partContent: { [fundo]: papel('Papéis/moana.png') } })
    ;(carros.textStyles as Record<string, unknown>).NOME = { fontPostScriptName: 'Carros' }
    ;(moana.textStyles as Record<string, unknown>).NOME = { fontPostScriptName: 'Moana' }
    const dist = distribuirKit([{ folha: f1, impressoes: 1 }, { folha: f2, impressoes: 1 }], [{ kits: 1, pecas: 0 }, { kits: 1, pecas: 0 }], 'composicao', true, comp(d, corpo, tampa))
    const kd = docDoKit(d, carros, dist, [{ rotulo: '#1 · Ana', valores: { NOME: 'Ana' } }, { rotulo: '#2 · Bia', valores: { NOME: 'Bia' } }], [carros, moana])
    const clone = kd.doc.parts.find(p => p.id === `${fundo}~t1`)
    expect(clone && clone.instances.length).toBe(10 + 10)   // as 20 peças (corpos + tampas) da Bia
    expect((kd.tema.partContent[`${fundo}~t1`][0] as { path: string }).path).toBe('Papéis/moana.png')
    expect((kd.tema.partContent[fundo][0] as { path: string }).path).toBe('Papéis/carros.png')
    expect(Object.values(kd.valoresPorSlot).some(v => v.NOME === 'Bia' && /Moana/.test(v._ESTILO_NOME ?? ''))).toBe(true)
  })
})

describe('205 — tema pronto numa base de peças: uma arte por peça', () => {
  it('a arte da peça vai para TODAS as cópias na folha, recortada no contorno; sem arte = nada muda', () => {
    const { d, corpo, f1 } = nutella()
    const t = temaProntoNasPecas({ nome: 'rotulo-NUTELLA_carros', base: d, pecas: [{ moldeId: corpo, imagem: { path: 'Temas/paginas/x/pagina-1.jpg', sha256: 'abcd', aspect: 200 / 35 } }] })
    expect(DocTema.safeParse(t).success).toBe(true)
    const fol = docDaFolha(d, t, f1)
    const nos = resolverPrancheta(fol.doc, fol.artboardId, { tema: fol.tema, modo: 'impressao', sobraMm: 1 })
    const artes = nos.filter(n => n.id.endsWith(':peca-pronta'))
    expect(artes.length).toBe(7)
    expect(artes.every(n => n.clip)).toBe(true)
    expect(nos.filter(n => n.id.endsWith(':peca-pronta:recorte')).every(n => (n as { clipOnly?: boolean }).clipOnly)).toBe(true)
    // "preencher": a arte cobre a peça com a sangria (202 × 37 mm) — aqui a altura manda e a largura sobra
    const m = (artes[0] as { matrix: number[] }).matrix
    const w = Math.hypot(m[0], m[1]), h = Math.hypot(m[2], m[3])
    expect(w).toBeGreaterThanOrEqual(202 - 0.01); expect(Math.round(h * 10) / 10).toBe(37)
  })
  it('a medida certa acha a base de peças (não cria base nova); proporção diferente → aviso; rótulo da medida', () => {
    const { d, tampa } = nutella()
    const b = { ...d, id: 'base_nutella', name: 'Rótulo Nutella' }
    expect(pecaComAMedida([b], 200.4, 35.2)?.pecaNome).toBe('Nutella · Corpo')
    expect(pecaComAMedida([b], 35, 200)?.pecaNome).toBe('Nutella · Corpo')      // deitada
    expect(pecaComAMedida([b], 100, 100)).toBeNull()
    const mt = d.molds.find(m => m.id === tampa)!
    expect(proporcaoDiferente(mt, 1)).toBe(false); expect(proporcaoDiferente(mt, 1.5)).toBe(true)
    expect(rotuloDaMedida(mt)).toBe('Ø 57 mm')
  })
  it('kit de folhas da base de peças: as duas folhas', () => {
    const { d } = nutella()
    expect(folhasDoKit(d, null).length).toBe(2)
  })
})
