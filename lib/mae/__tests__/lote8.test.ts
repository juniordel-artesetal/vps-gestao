// Lote 8 — ajustes do teste da Naty (12/10/2026): logo única no bloco (124), olho e cadeado no texto (123), grupo com
// nome digitado (125). (O Ctrl+Z universal, item 122, está em lote8-undo.test.ts.)
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { montarBaseDeMedidas } from '@/lib/mae/medidas/pecas'
import { novoTema } from '@/lib/mae/vinculo/tema'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { pilhaNoPonto } from '@/lib/mae/vinculo/pilha'
import { quadroDaFace } from '@/lib/mae/vinculo/enquadramento'
import { grupoDoItem, criarGrupo, ligarProduto } from '@/lib/mae/editor/grupos'
import { ESTILO_PADRAO } from '@/lib/mae/texto/noTexto'
import type { DocTema, NoCamada } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'

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
