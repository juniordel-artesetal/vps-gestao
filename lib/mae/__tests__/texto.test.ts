// Sprint 7 — TEXTO: shaping HarfBuzz determinístico, swash/alternativos (fonte real Milkshake, se estiver
// no PC), nome simples × composto, quebra em 2 linhas, auto-ajuste, curva, hashtag, e o texto saindo
// pelo MESMO motor (caminho) — tela = arquivo.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas, Path2D as P2D } from '@napi-rs/canvas'
import { abrirFonte, moldar, alternativas, glifosPUA, glifosSemCodigo, type FonteHB } from '@/lib/mae/texto/fonte'
import { diagramar, hashtag, quebrarEmDuas, prepararTexto, paraSvg, MM_POR_PT } from '@/lib/mae/texto/diagramar'
import { noDoTexto, valorDaVariavel, ESTILO_PADRAO } from '@/lib/mae/texto/noTexto'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from '@/lib/mae/render'
import { DocTema, type NoCamada } from '@/lib/mae/schema'

const SNIGLET = join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf')
const FONTES_NATY = 'C:/Users/junio/OneDrive/Documentos/SOA/MÓDULO IMAGEM/SOA_ARQ_MOD_METMAE/FONTES/'
const temNaty = existsSync(FONTES_NATY + 'milkshake.otf')
let sniglet: FonteHB, milk: FonteHB | null = null
beforeAll(async () => {
  sniglet = await abrirFonte(readFileSync(SNIGLET))
  if (temNaty) milk = await abrirFonte(readFileSync(FONTES_NATY + 'milkshake.otf'))
})

const cfg = { single: { lines: 1 as const, sizePt: 28 }, compound: { lines: 2 as const, sizePt: 22, lineHeight: 0.9 }, autoFit: { minScale: 0.7 } }

describe('hashtag e variáveis', () => {
  it('# + nome sem espaços (acentos e maiúsculas como digitado) + texto do tema + idade', () => {
    expect(hashtag('Maria Júlia', 1)).toBe('#MariaJúliafaz1')
    expect(hashtag('  Ana Clara ', '7', 'comemora')).toBe('#AnaClaracomemora7')
    expect(valorDaVariavel('HASHTAG', { NOME: 'Léo', IDADE: '2' }, 'faz')).toBe('#Léofaz2')
    expect(valorDaVariavel('HASHTAG', { NOME: 'Léo', IDADE: '2', HASHTAG: '#editada' })).toBe('#editada')
  })
})

describe('shaping (HarfBuzz)', () => {
  it('é determinístico e respeita o kerning', () => {
    const a = moldar(sniglet, 'Maria Júlia'), b = moldar(sniglet, 'Maria Júlia')
    expect(a).toEqual(b)
    expect(a.length).toBe('Maria Júlia'.length)
    expect(sniglet.ps).toBe('Sniglet')
  })
  it('caixa alta/baixa', () => {
    expect(prepararTexto('maria júlia', { caixa: 'alta' })).toBe('MARIA JÚLIA')
    expect(prepararTexto('  Maria   Júlia ', {})).toBe('Maria Júlia')
  })
  it.runIf(temNaty)('Milkshake: o conjunto estilístico (swash) troca glifos de "Maria Júlia"', () => {
    const base = moldar(milk!, 'Maria Júlia').map(g => g.gid), sw = moldar(milk!, 'Maria Júlia', { features: ['ss01'] }).map(g => g.gid)
    expect(sw).not.toEqual(base)
    expect(moldar(milk!, 'Maria Júlia', { features: ['ss01'] }).map(g => g.gid)).toEqual(sw)   // determinístico
  })
  it.runIf(temNaty)('painel de glifos: alternativas por letra, PUA e escolha só naquela letra', () => {
    const alt = alternativas(milk!, 'Maria Júlia', 10)   // o "a" final
    expect(alt.length).toBeGreaterThan(0)
    expect(glifosPUA(milk!).length).toBeGreaterThan(100)
    const pad = moldar(milk!, 'Maria Júlia'), com = moldar(milk!, 'Maria Júlia', { escolhas: [{ index: 10, char: 'a', kind: 'feature', tag: alt[0].tag, value: alt[0].value }] })
    expect(com[10].gid).toBe(alt[0].gid)
    expect(com.slice(0, 10).map(g => g.gid)).toEqual(pad.slice(0, 10).map(g => g.gid))   // o resto não muda
    // escolha de glifo "sem código" (fontes sem GSUB)
    const sem = glifosSemCodigo(milk!, 5)
    if (sem.length) expect(moldar(milk!, 'Maria', { escolhas: [{ index: 0, char: 'M', kind: 'glyph', gid: sem[0] }] })[0].gid).toBe(sem[0])
  })
})

describe('nome simples × composto e auto-ajuste', () => {
  it('2 palavras = composto em 2 linhas; 1 palavra = simples', () => {
    const c = diagramar(sniglet, 'Maria Júlia', {}, { w: 60, h: 30 }, cfg)
    expect(c.composto).toBe(true); expect(c.linhas).toEqual(['Maria', 'Júlia'])
    const s = diagramar(sniglet, 'Helena', {}, { w: 60, h: 30 }, cfg)
    expect(s.composto).toBe(false); expect(s.linhas).toEqual(['Helena'])
  })
  it('quebra equilibrada com 3 palavras', () => {
    expect(quebrarEmDuas(sniglet, 'Ana Maria Clara', {}, 22 * MM_POR_PT)).toEqual(['Ana Maria', 'Clara'])
  })
  it('composto em 1 linha se a posição pedir', () => {
    expect(diagramar(sniglet, 'Maria Júlia', {}, { w: 80, h: 20 }, { ...cfg, compound: { lines: 1, sizePt: 18 } }).linhas).toEqual(['Maria Júlia'])
  })
  const natural = () => { const r = diagramar(sniglet, 'Valentina', {}, { w: 500, h: 50 }, cfg); return r.bbox[2] - r.bbox[0] }
  it('não coube: reduz o tamanho (≥ 70%) e avisa', () => {
    const W = natural() * 0.85
    const r = diagramar(sniglet, 'Valentina', {}, { w: W, h: 20 }, cfg)
    expect(r.escala).toBeLessThan(1); expect(r.escala).toBeGreaterThanOrEqual(0.7)
    expect(r.revisar).toBe(false); expect(r.aviso).toMatch(/reduzida para \d+%/)
    expect(r.bbox[2] - r.bbox[0]).toBeLessThanOrEqual(W + 0.01)
  })
  it('depois do tamanho, o tracking; se nem assim couber: "revisar"', () => {
    const r1 = diagramar(sniglet, 'Valentina', {}, { w: natural() * 0.66, h: 20 }, cfg)
    expect(r1.escala).toBe(0.7); expect(r1.trackingFinal).toBeLessThan(0); expect(r1.revisar).toBe(false)
    const r2 = diagramar(sniglet, 'Maximiliana Valentina', {}, { w: 12, h: 8 }, cfg)
    expect(r2.revisar).toBe(true); expect(r2.aviso).toMatch(/revisar/)
  })
  it('alinhamento, linha de base e curva mexem na geometria', () => {
    const c = diagramar(sniglet, 'Helena', { align: 'center' }, { w: 80, h: 20 }, cfg)
    const l = diagramar(sniglet, 'Helena', { align: 'left' }, { w: 80, h: 20 }, cfg)
    expect(l.bbox[0]).toBeLessThan(c.bbox[0])
    const b = diagramar(sniglet, 'Helena', { baselineMm: 3 }, { w: 80, h: 20 }, cfg)
    expect(b.bbox[1]).toBeCloseTo(c.bbox[1] - 3, 1)
    const curva = diagramar(sniglet, 'Helena', { curveRadiusMm: 30 }, { w: 80, h: 20 }, cfg)
    expect(curva.bbox[3] - curva.bbox[1]).toBeGreaterThan(c.bbox[3] - c.bbox[1])
  })
  it('caminho SVG estável (mesma entrada = mesma string)', () => {
    const a = paraSvg(diagramar(sniglet, 'Maria Júlia', {}, { w: 60, h: 30 }, cfg).cmds)
    expect(a).toBe(paraSvg(diagramar(sniglet, 'Maria Júlia', {}, { w: 60, h: 30 }, cfg).cmds))
    expect(a.startsWith('M')).toBe(true)
  })
})

describe('texto no motor (tela = arquivo)', () => {
  const fontes = (ok: boolean) => ({ obter: (ps: string) => (ok && ps === 'Sniglet' ? sniglet : ps === 'Milkshake' && milk ? milk : undefined), substituta: sniglet })
  const posicao = { quadro: [100, 0, 0, 60, 10, 20] as [number, number, number, number, number, number], w: 100, h: 60, caixa: { x: 0.1, y: 0.3, w: 0.8, h: 0.4 }, cfg }
  it('nó de caminho dentro da caixa da posição', () => {
    const r = noDoTexto({ slotId: 's1', variavel: 'NOME', valor: 'Maria Júlia', estilo: ESTILO_PADRAO, fontes: fontes(true), ...posicao })!
    expect(r.no.type).toBe('path'); expect(r.no.d.length).toBeGreaterThan(100)
    expect(r.no.bboxMm[0]).toBeGreaterThanOrEqual(20 - 0.01); expect(r.no.bboxMm[2]).toBeLessThanOrEqual(100 + 0.01)
    expect(r.info.substituta).toBe(false)
  })
  it('fonte não instalada: substituta + aviso', () => {
    const r = noDoTexto({ slotId: 's1', variavel: 'NOME', valor: 'Maria', estilo: { ...ESTILO_PADRAO, font: { postscriptName: 'FonteQueNaoTem', family: 'Fonte Que Não Tem', source: 'local' } }, fontes: fontes(true), ...posicao })!
    expect(r.info.substituta).toBe(true); expect(r.info.aviso).toMatch(/não instalada/)
  })
  it.runIf(temNaty)('"Maria Júlia" com swash: o MESMO caminho desenhado 2× dá os mesmos pixels (e difere do sem swash)', () => {
    const estilo = { ...ESTILO_PADRAO, font: { postscriptName: 'Milkshake', family: 'Milkshake', source: 'local' as const }, color: '#db2777', features: ['ss01'] }
    const com = noDoTexto({ slotId: 's', variavel: 'NOME', valor: 'Maria Júlia', estilo, fontes: fontes(true), ...posicao })!
    const sem = noDoTexto({ slotId: 's', variavel: 'NOME', valor: 'Maria Júlia', estilo: { ...estilo, features: [] }, fontes: fontes(true), ...posicao })!
    expect(com.no.d).not.toBe(sem.no.d)
    const px = (no: NoCamada) => {
      const p = { id: 'p', widthMm: 120, heightMm: 90, layers: [no] }
      const { w, h } = tamanhoDoCanvas(p, 6)
      const c = createCanvas(w, h)
      renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: 6, fundo: '#ffffff', criarCanvas: (a, b) => createCanvas(a, b) as unknown as CanvasLike, bitmap: () => undefined, criarCaminho: d => new P2D(d) as unknown as Path2D })
      return Buffer.from(c.getContext('2d').getImageData(0, 0, w, h).data)
    }
    expect(Buffer.compare(px(com.no), px(com.no))).toBe(0)
    expect(Buffer.compare(px(com.no), px(sem.no))).not.toBe(0)
  })
  it('estilo de texto no tema: serializa e volta (Zod)', () => {
    const t = DocTema.parse({ schemaVersion: 1, type: 'theme', id: 't', version: 1, baseId: 'b', baseVersion: 1, partContent: {},
      textStyles: { NOME: { ...ESTILO_PADRAO, features: ['ss01'], glyphChoices: [{ index: 10, char: 'a', kind: 'feature', tag: 'ss02', value: 1 }], effects: [{ type: 'stroke', sizeMm: 1, color: '#ffffff' }] } } })
    expect(JSON.parse(JSON.stringify(t)).textStyles.NOME.glyphChoices[0].tag).toBe('ss02')
    expect(t.sample.NOME).toBe('Maria Júlia')
  })
})
