// Lote 8 — ajustes do teste da Naty (12/10/2026): logo única no bloco (124), olho e cadeado no texto (123), grupo com
// nome digitado (125). (O Ctrl+Z universal, item 122, está em lote8-undo.test.ts.)
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { montarBaseDeMedidas } from '@/lib/mae/medidas/pecas'
import { novoTema } from '@/lib/mae/vinculo/tema'
import { resolverPrancheta, posicaoEfetiva } from '@/lib/mae/vinculo/resolver'
import { pilhaNoPonto } from '@/lib/mae/vinculo/pilha'
import { quadroDaFace } from '@/lib/mae/vinculo/enquadramento'
import { grupoDoItem, criarGrupo, ligarProduto } from '@/lib/mae/editor/grupos'
import { ESTILO_PADRAO } from '@/lib/mae/texto/noTexto'
import type { DocTema, NoCamada } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'
import { mesclarInternos } from '@/lib/pedidos/camposExtras'
import { alturaDeUmaLinha, fatorDoPreset, escalarEfeitos } from '@/lib/mae/efeitos/presets'
import { folgaMm } from '@/lib/mae/render/efeitos'
import { camposDoDoc, camposFaltando, valorDoCampo, alinharCampos, chaveCampo } from '@/lib/mae/pedidos/camposDaBase'

let sn: FonteHB
beforeAll(async () => { sn = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf'))) })
const fontes = () => ({ obter: () => sn, substituta: sn })
const todos = (ns: NoCamada[]): NoCamada[] => ns.flatMap(n => [n, ...(n.type === 'group' ? todos((n as unknown as { children: NoCamada[] }).children) : [])])

function cenario(variavel: string, extra: Record<string, unknown> = {}) {
  const d = novoDocumento('A4')
  montarBaseDeMedidas(d, [{ nome: 'Livros', medida: { forma: 'retangulo', larguraMm: 90, alturaMm: 50 } }])
  const faceId = d.molds[0].faces[0].id
  d.textSlots = [{ id: 'ts1', variable: variavel, faceId, box: { x: 0.1, y: 0.15, w: 0.8, h: 0.7 }, single: { lines: 1, sizePt: 28 }, compound: { lines: 2, sizePt: 22 }, ...extra } as never]
  const t = novoTema({ nome: 'T', baseId: d.id, baseVersion: 1 }) as DocTema
  return { d, t, faceId }
}
const logo = { tipo: 'imagem', cor: '#dc2626', raioMm: 0, sobraMm: 3, alturaPct: 1.5, textoAcima: 0.05, effects: [], imagem: { path: 'Logos/l.png', aspect: 2, area: { x: 0.2, y: 0.25, w: 0.6, h: 0.5 } } }

describe('124 — logo atrás do nome: UMA para o bloco', () => {
  it('Nome + idade (empilhado) + frase em cima = 1 logo só, por baixo dos textos', () => {
    const { d, t } = cenario('NOME_IDADE', { frase: { posicao: 'acima', tamanhoPct: 0.5, espaco: 0.05 }, bloco: { arranjo: 'empilhado', idadePct: 0.6, espaco: 0.05 } })
    t.textStyles = { NOME_IDADE: { ...ESTILO_PADRAO, fundo: logo } as never, FRASE: { ...ESTILO_PADRAO, fundo: logo } as never }
    const ns = todos(resolverPrancheta(d as never, d.artboards[0].id, { tema: t, texto: { fontes: fontes(), valores: { NOME: 'Ana', IDADE: '5', FRASE: 'A Pequena' } } }))
    const fundos = ns.filter(n => n.id.endsWith(':fundo'))
    expect(fundos.length).toBe(1)
    const textos = ns.filter(n => n.type === 'path' && /:frase$|:idade$|^ts1$/.test(n.id.replace(/:texto$/, '')))
    expect(textos.length).toBe(3)
    expect(ns.indexOf(fundos[0])).toBeLessThan(ns.indexOf(textos[0]))
  })
  it('texto simples continua com a logo dele (do tamanho do nome)', () => {
    const { d, t } = cenario('NOME')
    t.textStyles = { NOME: { ...ESTILO_PADRAO, fundo: logo } as never }
    const ns = todos(resolverPrancheta(d as never, d.artboards[0].id, { tema: t, texto: { fontes: fontes(), valores: { NOME: 'Ana' } } }))
    expect(ns.filter(n => n.id.endsWith(':fundo')).length).toBe(1)
  })
})

describe('123 — olho e cadeado no texto', () => {
  it('oculto não sai na arte; travado e oculto não se selecionam na arte', () => {
    const { d, t, faceId } = cenario('NOME')
    const valores = { NOME: 'Ana' }
    const conta = () => todos(resolverPrancheta(d as never, d.artboards[0].id, { tema: t, texto: { fontes: fontes(), valores } })).filter(n => n.id.startsWith('ts1')).length
    expect(conta()).toBeGreaterThan(0)
    const f = d.molds[0].faces[0]
    const q = quadroDaFace(f.polygonMm as never, undefined, d.parts[0].referenceAspect ?? 1)!
    const centro = (f.polygonMm as Pt[]).reduce((s, p) => [s[0] + p[0] / f.polygonMm.length, s[1] + p[1] / f.polygonMm.length], [0, 0]) as Pt
    const pilha = () => pilhaNoPonto({ doc: d as never, tema: t, faceId, poligono: f.polygonMm as Pt[], local: centro, quadro: q, valores }).filter(x => x.tipo === 'texto').length
    expect(pilha()).toBe(1)
    t.textSlotAdjust = { ts1: { locked: true } }
    expect(pilha()).toBe(0); expect(conta()).toBeGreaterThan(0)
    t.textSlotAdjust = { ts1: { hidden: true } }
    expect(pilha()).toBe(0); expect(conta()).toBe(0)
  })
})

describe('125 — grupo ligado a um nome digitado', () => {
  it('casa pelo nome exato e pelo nome contido no produto do pedido', () => {
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Livros', medida: { forma: 'retangulo', larguraMm: 90, alturaMm: 50 } }])
    const g = criarGrupo(d as never, 'Grupo 1', [d.molds[0].id])
    ligarProduto(d as never, g, { produtoId: null, variacaoId: null, produtoNome: 'Kit Escolar' })
    expect(grupoDoItem(d as never, { nome: 'Kit Escolar' } as never)?.id).toBe(g)
    expect(grupoDoItem(d as never, { nome: 'KIT ESCOLAR MINNIE ROSA' } as never)?.id).toBe(g)
    expect(grupoDoItem(d as never, { nome: 'Agenda' } as never)).toBeNull()
  })
})

describe('126 — tamanho/giro do conjunto valem para quem herda o estilo', () => {
  it('NOME_IDADE herda sizeScale e rotationDeg do NOME', () => {
    const { d, t } = cenario('NOME_IDADE')
    t.textStyles = { NOME: { ...ESTILO_PADRAO, sizeScale: 1.5, rotationDeg: 10 } as never }
    const ef = posicaoEfetiva(d.textSlots[0] as never, t, { NOME: 'Ana' })
    expect(ef.escala).toBeCloseTo(1.5)
    expect(ef.rotacaoDeg).toBeCloseTo(10)
  })
})

describe('127 — salvar o pedido no SOA não apaga o _mae', () => {
  it('preserva chaves internas que o formulário não mandou (objeto e string)', () => {
    const atual = { Tema: 'Bosque', _mae: { themeId: 't1' }, _freelancers: [1] }
    expect(mesclarInternos({ Tema: 'Jardim', _freelancers: [] }, atual)).toEqual({ Tema: 'Jardim', _freelancers: [], _mae: { themeId: 't1' } })
    expect(JSON.parse(mesclarInternos(JSON.stringify({ Tema: 'Jardim' }), JSON.stringify(atual)) as string)._mae).toEqual({ themeId: 't1' })
    expect(mesclarInternos({ Tema: 'X' }, null)).toEqual({ Tema: 'X' })
  })
})

describe('128 — campos do pedido vêm da base', () => {
  it('campos = variáveis da arte sem as de coluna própria; FRASE presa entra', () => {
    const doc = { textSlots: [{ variable: 'NOME_IDADE', frase: {} }, { variable: 'SÉRIE' }, { variable: 'PROFESSORA' }, { variable: 'HASHTAG' }] }
    expect(camposDoDoc(doc)).toEqual(['FRASE', 'SÉRIE', 'PROFESSORA'])
  })
  it('biblioteca compartilhada: "Série" do SOA vale como SÉRIE; falta só o que está vazio', () => {
    expect(chaveCampo('Série')).toBe(chaveCampo('SERIE'))
    const campos = { 'Série': '3º ano', PROFESSORA: '' }
    expect(valorDoCampo(campos, 'SÉRIE')).toBe('3º ano')
    expect(camposFaltando(['FRASE', 'SÉRIE', 'PROFESSORA'], campos)).toEqual(['PROFESSORA'])
    expect(alinharCampos({ 'Série': '3º ano' }, ['SÉRIE'])).toEqual({ 'Série': '3º ano', 'SÉRIE': '3º ano' })
  })
})

describe('130 — preset proporcional à altura de UMA linha', () => {
  const caixa = (h: number): [number, number][] => [[0, 0], [40, 0], [40, h], [0, h]]
  it('acha a linha do bloco (NOME / :frase) e divide pelas linhas', () => {
    const infos = [
      { slotId: 'ts1', variavel: 'NOME', linhas: ['Ana', 'Clara'], cantosMm: caixa(10) },
      { slotId: 'ts1:frase', variavel: 'FRASE', linhas: ['A Pequena'], cantosMm: caixa(3) },
    ]
    expect(alturaDeUmaLinha(infos, 'NOME_IDADE', ['ts1'], 'ts1')).toBeCloseTo(5)
    expect(alturaDeUmaLinha(infos, 'FRASE', ['ts1'], null)).toBeCloseTo(3)
    expect(alturaDeUmaLinha(infos, 'HASHTAG', [], null)).toBeNull()
  })
  it('traço de 1,6 mm (preset de 15 mm) num nome de 5 mm sai com 0,53 mm', () => {
    const k = fatorDoPreset({}, 5)
    const [tr] = escalarEfeitos([{ type: 'stroke', sizeMm: 1.6, color: '#000000', position: 'outside', enabled: true, opacity: 1 }], k) as { sizeMm: number }[]
    expect(tr.sizeMm).toBeCloseTo(0.53, 2)
  })
})

describe('131 — formas', () => {
  it('a folga do buffer conta brilho interno, sombra interna e chanfro', () => {
    expect(folgaMm([{ type: 'innerGlow', sizeMm: 2, enabled: true } as never])).toBeGreaterThanOrEqual(4)
    expect(folgaMm([{ type: 'innerShadow', sizeMm: 1, distanceMm: 1, enabled: true } as never])).toBeGreaterThanOrEqual(3)
    expect(folgaMm([{ type: 'bevel', sizeMm: 1, enabled: true } as never])).toBeGreaterThanOrEqual(2)
  })
  it('opacidade do preenchimento vai no fill do nó; a da camada no grupo', () => {
    const { d, t } = cenario('NOME')
    const parte = d.parts[0].id
    t.partContent[parte] = [{ id: 'f1', type: 'shape', kind: 'rect', params: { radius: 0, sides: 4, inner: 0.5 }, fill: '#ff0000', stroke: null, aspect: 1, anchor: 'face', transform: { x: 0.5, y: 0.5, scale: 0.5, rotationDeg: 0 }, opacity: 0.5, fillOpacity: 0.2 } as never]
    const ns = todos(resolverPrancheta(d as never, d.artboards[0].id, { tema: t }))
    const f = ns.find(n => n.id.endsWith(':f1'))!
    expect(f.opacity).toBeCloseTo(0.5); expect(f.fill).toBeCloseTo(0.2)
  })
})

describe('132 — Alt + clique pula a camada travada', () => {
  it('camada com cadeado não entra na pilha', () => {
    const { d, t, faceId } = cenario('NOME')
    const parte = d.parts[0].id
    t.partContent[parte] = [{ id: 'f1', type: 'shape', kind: 'rect', params: { radius: 0, sides: 4, inner: 0.5 }, fill: '#ff0000', stroke: null, aspect: 1, anchor: 'face', transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } } as never]
    const f = d.molds[0].faces[0]
    const q = quadroDaFace(f.polygonMm as never, undefined, d.parts[0].referenceAspect ?? 1)!
    const centro = (f.polygonMm as Pt[]).reduce((s, p) => [s[0] + p[0] / f.polygonMm.length, s[1] + p[1] / f.polygonMm.length], [0, 0]) as Pt
    const camadas = () => pilhaNoPonto({ doc: d as never, tema: t, faceId, poligono: f.polygonMm as Pt[], local: centro, quadro: q, valores: {} }).filter(x => x.tipo === 'camada').map(x => x.id)
    expect(camadas()).toContain('f1')
    ;(t.partContent[parte][0] as { locked?: boolean }).locked = true
    expect(camadas()).not.toContain('f1')
  })
})
