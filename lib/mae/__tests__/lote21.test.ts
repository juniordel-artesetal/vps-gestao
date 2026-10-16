// Lote 21 (itens 249–253) — dia da live: travar pelo botão direito (Ctrl+L, o clique passa para o de baixo), brilho
// interno com engasgar/técnica (padrão idêntico ao de antes), acento falso da fonte e "montar sempre", transição com
// cor (cor para cor) e com elemento.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { montarBaseDeMedidas } from '@/lib/mae/medidas/pecas'
import { novoTema, criarTransicaoCor, criarTransicaoElemento, ajustarTransicao, acharCamadaTema } from '@/lib/mae/vinculo/tema'
import { pilhaNoPonto } from '@/lib/mae/vinculo/pilha'
import { quadroDaFace } from '@/lib/mae/vinculo/enquadramento'
import { geoElementoTransicao } from '@/lib/mae/vinculo/transicao'
import { atalhoDoEvento } from '@/lib/mae/editor/atalhos'
import { Efeito } from '@/lib/mae/schema/efeitos'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'
import { diagramar, acentoFalso, letrasSemGlifo, letrasMontaveis, letrasComAcentoFalso } from '@/lib/mae/texto/diagramar'
import type { DocTema } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'

function cenario() {
  const d = novoDocumento('A4')
  montarBaseDeMedidas(d, [{ nome: 'Milk', medida: { forma: 'retangulo', larguraMm: 90, alturaMm: 50 } }])
  const faceId = d.molds[0].faces[0].id
  d.textSlots = [{ id: 'ts1', variable: 'NOME', faceId, box: { x: 0.1, y: 0.15, w: 0.8, h: 0.7 }, single: { lines: 1, sizePt: 28 } } as never]
  const t = novoTema({ nome: 'T', baseId: d.id, baseVersion: 1 }) as DocTema
  return { d, t, faceId, parte: d.parts[0].id }
}

describe('253 — travar pelo botão direito', () => {
  it('o clique pula o travado (passa para o de baixo); o botão direito o enxerga, marcado como travado', () => {
    const { d, t, faceId, parte } = cenario()
    t.partContent[parte] = [{ id: 'f1', type: 'shape', kind: 'rect', params: { radius: 0, sides: 4, inner: 0.5 }, fill: '#ff0000', stroke: null, aspect: 1, anchor: 'face', transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 }, locked: true } as never]
    const f = d.molds[0].faces[0]
    const q = quadroDaFace(f.polygonMm as never, undefined, d.parts[0].referenceAspect ?? 1)!
    const centro = (f.polygonMm as Pt[]).reduce((s, p) => [s[0] + p[0] / f.polygonMm.length, s[1] + p[1] / f.polygonMm.length], [0, 0]) as Pt
    const pilha = (comTravados?: boolean) => pilhaNoPonto({ doc: d as never, tema: t, faceId, poligono: f.polygonMm as Pt[], local: centro, quadro: q, valores: {}, comTravados })
    expect(pilha().map(x => x.id)).not.toContain('f1')
    const p2 = pilha(true)
    expect(p2.find(x => x.id === 'f1')?.travado).toBe(true)
    // texto travado: idem
    t.textSlotAdjust = { ts1: { locked: true } }
    expect(pilha().some(x => x.tipo === 'texto')).toBe(false)
    expect(pilha(true).find(x => x.tipo === 'texto')?.travado).toBe(true)
  })
  it('Ctrl+L trava/destrava (Ctrl+/ continua valendo)', () => {
    expect(atalhoDoEvento({ key: 'l', code: 'KeyL', ctrlKey: true } as never)).toBe('cadeado')
    expect(atalhoDoEvento({ key: '/', code: 'Slash', ctrlKey: true } as never)).toBe('cadeado')
  })
})

describe('252 — brilho interno: engasgar e técnica (sem eles, igual a antes)', () => {
  it('aceita choke 0–1 e técnica suave/precisa; tema antigo continua válido sem os campos', () => {
    expect(Efeito.parse({ type: 'innerGlow', color: '#ffffff', sizeMm: 30, choke: 0.5, tecnica: 'precisa' })).toMatchObject({ choke: 0.5, tecnica: 'precisa', sizeMm: 30 })
    const antigo = Efeito.parse({ type: 'innerGlow', color: '#ffffff', sizeMm: 1 }) as { choke?: number; tecnica?: string }
    expect(antigo.choke).toBeUndefined(); expect(antigo.tecnica).toBeUndefined()
    expect(() => Efeito.parse({ type: 'innerGlow', color: '#ffffff', sizeMm: 1, choke: 2 })).toThrow()
  })
})

describe('249 — acento falso da fonte', () => {
  let real: FonteHB, falso: FonteHB
  beforeAll(async () => {
    real = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf')))
    // a "fonte de festa": declara o ú e o Ú, mas desenha igual ao u/U (sem acento)
    const mapa: Record<number, number> = { 0xfa: 0x75, 0xda: 0x55 }
    falso = { ...real, font: { ...real.font, glyph: (cp: number) => real.font.glyph(mapa[cp] ?? cp) } } as FonteHB
  })
  const caixa = { w: 200, h: 60 }, cfg = { single: { lines: 1 as const, sizePt: 72 } }
  const topo = (f: FonteHB, t: string, e = {}) => diagramar(f, t, e, caixa, cfg).bbox[1]
  it('detecta: o ú desenhado como u é acento falso (o í de verdade não)', () => {
    expect(acentoFalso(falso, 0xfa)).toBe(true)
    expect(acentoFalso(falso, 0xed)).toBe(false)
    expect(acentoFalso(real, 0xfa)).toBe(false)
    expect(letrasComAcentoFalso(falso, 'Maria Júlia Lívia')).toEqual(['ú'])
    // entra como letra que falta, mas dá para montar (o acento solto existe na fonte)
    expect(letrasSemGlifo(falso, 'Júlia')).toEqual(['ú'])
    expect(letrasMontaveis(falso, 'Júlia')).toEqual(['ú'])
  })
  it('"Júlia" sai COM acento montado (antes saía igual a "Julia")', () => {
    expect(topo(falso, 'ú')).toBeLessThan(topo(falso, 'u') - 2)        // tem acento por cima
    expect(diagramar(falso, 'Júlia', {}, caixa, cfg).glifos.some(g => (g as { acento?: boolean }).acento)).toBe(true)
    // (desligado, quem desenha é o HarfBuzz com o arquivo da fonte — a fonte simulada aqui só é "falsa" na detecção)
    expect(diagramar(falso, 'Júlia', { acentos: { ligado: false } }, caixa, cfg).glifos.some(g => (g as { acento?: boolean }).acento)).toBe(false)
  })
  it('"Montar sempre": a letra marcada é montada mesmo que a fonte diga ter (e a lista vale no aviso)', () => {
    expect(letrasSemGlifo(real, 'Lívia', ['í'])).toEqual(['í'])
    const montado = diagramar(real, 'Lívia', { acentos: { sempre: ['í'] } }, caixa, cfg)
    expect(montado.glifos.some(g => (g as { acento?: boolean }).acento)).toBe(true)
    expect(diagramar(real, 'Lívia', {}, caixa, cfg).glifos.some(g => (g as { acento?: boolean }).acento)).toBe(false)
  })
})

describe('250 — transição com cor e com elemento', () => {
  it('cor: uma cor lisa entra POR CIMA do papel com o degradê; cor para cor troca o fundo pela cor de baixo', () => {
    const { t, parte } = cenario()
    t.partContent[parte] = [{ id: 'p1', type: 'image', anchor: 'paper', path: 'Papéis/ancora.png', transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } } as never]
    const id = criarTransicaoCor(t, { partId: parte }, '#1e3a8a', { dir: 'cima', pos: 0.4, soft: 0.3 })
    const lista = t.partContent[parte]
    expect(lista.map(c => c.id)).toEqual(['p1', id])                     // o papel fica; a cor por cima
    const c = acharCamadaTema(t, id)!.c as { type: string; color?: string; mask?: { gradient?: unknown }; transition?: unknown }
    expect(c.type).toBe('solid'); expect(c.color).toBe('#1e3a8a'); expect(c.mask?.gradient).toBeTruthy(); expect(c.transition).toMatchObject({ dir: 'cima', pos: 0.4 })
    const t2 = cenario()
    t2.t.partContent[t2.parte] = [{ id: 'p1', type: 'image', anchor: 'paper', path: 'Papéis/x.png', transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } } as never]
    criarTransicaoCor(t2.t, { partId: t2.parte }, '#ffffff', { dir: 'baixo', pos: 0.5, soft: 0.3 }, '#ff0000')
    const l2 = t2.t.partContent[t2.parte] as { type: string; color?: string }[]
    expect(l2.map(c => `${c.type}:${c.color ?? ''}`)).toEqual(['solid:#ff0000', 'solid:#ffffff'])   // sem papel: cor para cor
  })
  it('elemento: preso ao lado de onde a transição vem (ondas no fundo), largura da face, borda suave na posição', () => {
    // ondas 4:1 numa face 90×50 (A = 1,8) vindo DE BAIXO até 40%: altura natural 0,45 da face → largura toda (scale 1)
    const g = geoElementoTransicao({ dir: 'cima', pos: 0.3, soft: 0.2 }, 4, 1.8)
    expect(g.transform.scale).toBe(1)
    const hf = 1.8 / 4
    expect(g.transform.y).toBeCloseTo(1 - hf / 2, 3)                    // encostado no fundo da caixa
    // o degradê (no quadrado do elemento) começa em face y = 0,8 e termina em 0,6
    const topo = 1 - hf
    expect(g.gradient).toMatchObject({ type: 'linear', x0: 0.5, x1: 0.5 })
    expect((g.gradient as { y0: number }).y0).toBeCloseTo((0.8 - topo) / hf, 3)
    expect((g.gradient as { y1: number }).y1).toBeCloseTo((0.6 - topo) / hf, 3)
    // indo mais alto que o elemento alcança: cresce sem deformar (scale > 1)
    expect(geoElementoTransicao({ dir: 'cima', pos: 0.8, soft: 0.2 }, 4, 1.8).transform.scale).toBeGreaterThan(1)
    // de lado: altura toda da face, encostado na esquerda
    const lado = geoElementoTransicao({ dir: 'direita', pos: 0.3, soft: 0.2 }, 0.5, 1.8)
    expect(lado.transform.x).toBeCloseTo(lado.transform.scale / 2, 3)
  })
  it('criar e ajustar: o elemento entra na parte e acompanha a posição da transição', () => {
    const { t, parte } = cenario()
    const id = criarTransicaoElemento(t, { partId: parte }, { path: 'Elementos/ondas.png', sha256: 'a'.repeat(64), aspect: 4, nome: 'ondas' } as never, { dir: 'cima', pos: 0.3, soft: 0.2 }, 1.8)
    const c = acharCamadaTema(t, id)!.c as { anchor?: string; transform: { y: number }; transition?: { elemA?: number } }
    expect(c.anchor).toBe('face'); expect(c.transition?.elemA).toBe(1.8)
    const y0 = c.transform.y
    ajustarTransicao(t, id, { dir: 'baixo' })
    expect((acharCamadaTema(t, id)!.c as { transform: { y: number } }).transform.y).toBeLessThan(y0)   // foi para cima
  })
})
