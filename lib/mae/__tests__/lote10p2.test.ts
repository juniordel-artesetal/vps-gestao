// Lote 10 — P2: arquivo alterado no disco + mensagens em português (162), acentos montados (163), área do nome (164).
import { describe, it, expect } from 'vitest'
import { mensagemDeErro, ArquivoMudou } from '@/lib/mae/erros'
import { ler } from '@/lib/mae/biblioteca/arquivos'

const erro = (name: string, message = 'x') => Object.assign(new Error(message), { name })

describe('162 — mensagens em português', () => {
  it('erros do navegador viram frases em português', () => {
    expect(mensagemDeErro(erro('NotReadableError', 'The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.'))).toMatch(/mudou no disco/)
    expect(mensagemDeErro(erro('NotAllowedError'))).toMatch(/permissão/)
    expect(mensagemDeErro(erro('QuotaExceededError'))).toMatch(/espaço/)
    expect(mensagemDeErro(erro('NotFoundError'))).toMatch(/não encontrado/)
    expect(mensagemDeErro(new TypeError('Failed to fetch'))).toMatch(/Sem conexão/)
    expect(mensagemDeErro(new Error('Failed to fetch dynamically imported module: /_next/x.js'))).toMatch(/versão nova/)
    expect(mensagemDeErro(new SyntaxError('Unexpected token < in JSON at position 0'))).toMatch(/conteúdo inválido/)
    expect(mensagemDeErro(new RangeError('Array buffer allocation failed'))).toMatch(/memória/)
  })
  it('erro do próprio MAE (em português) passa como está; vazio ganha frase', () => {
    expect(mensagemDeErro(new Error('Pedido sem itens'))).toBe('Pedido sem itens')
    expect(mensagemDeErro(new Error(''))).toMatch(/Algo deu errado/)
    expect(mensagemDeErro(null)).toMatch(/Algo deu errado/)
    expect(mensagemDeErro(Object.assign(new Error('x'), { status: 401 }))).toMatch(/sessão expirou/)
  })
})

/** Pasta falsa: o arquivo "a.png" falha `vezes` com NotReadableError ao ler o conteúdo, depois lê. */
function pasta(vezes: number) {
  let n = 0
  const arquivo = { getFile: async () => ({ name: 'a.png', type: 'image/png', lastModified: 1, arrayBuffer: async () => { if (n++ < vezes) throw erro('NotReadableError'); return new Uint8Array([1, 2, 3]).buffer } }) }
  const raiz: Record<string, unknown> = { getFileHandle: async () => arquivo }
  raiz.getDirectoryHandle = async () => raiz
  return { raiz: raiz as unknown as FileSystemDirectoryHandle, lidas: () => n }
}

describe('162 — arquivo que mudou no disco (Drive/OneDrive)', () => {
  it('falhou 1× com NotReadableError → relê sozinho e segue', async () => {
    const p = pasta(1)
    const f = await ler(p.raiz, 'a.png')
    expect(new Uint8Array(await f.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    expect(p.lidas()).toBe(2)
  })
  it('continua falhando → erro em português ("mudou desde que foi escolhido")', async () => {
    const p = pasta(9)
    const e = await ler(p.raiz, 'Elementos/a.png').catch(x => x)
    expect(e).toBeInstanceOf(ArquivoMudou)
    expect(mensagemDeErro(e)).toMatch(/"a.png" mudou desde que foi escolhido/)
    expect(p.lidas()).toBe(3)
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll } from 'vitest'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'
import { diagramar, letrasSemGlifo, letrasMontaveis } from '@/lib/mae/texto/diagramar'

describe('163 — fonte sem acento: montar o acento', () => {
  let real: FonteHB, sem: FonteHB
  beforeAll(async () => {
    real = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf')))
    // a "fonte de festa" sem as letras acentuadas nem os acentos combinantes (só os acentos soltos do teclado)
    const tirar = new Set([...'úÚíçÇãÃ'].map(c => c.codePointAt(0)!).concat([0x0301, 0x0303, 0x0327]))
    sem = { ...real, unicodes: new Set([...real.unicodes].filter(cp => !tirar.has(cp))) }
  })
  const caixa = { w: 200, h: 60 }, cfg = { single: { lines: 1 as const, sizePt: 72 } }
  const bb = (f: FonteHB, t: string, e = {}) => diagramar(f, t, e, caixa, cfg).bbox
  it('aviso: lista as letras que a fonte não tem; e as que dá para montar', () => {
    expect(letrasSemGlifo(sem, 'Júlia Conceição')).toEqual(['ú', 'ç', 'ã'])
    // esta fonte não tem cedilha solta (só dentro do "ç"): o ç não dá para montar sem a "fonte dos acentos"
    expect(letrasMontaveis(sem, 'Júlia Conceição')).toEqual(['ú', 'ã'])
    expect(letrasSemGlifo(real, 'Júlia Conceição')).toEqual([])
  })
  it('"ú" sai montado: o acento centrado em cima do "u", sem mudar a largura', () => {
    const [ux0, uy0, ux1] = bb(sem, 'u'), [ax0, ay0, ax1] = bb(sem, 'ú')
    expect(ay0).toBeLessThan(uy0 - 3)                                       // tem acento por cima
    expect(Math.abs((ax0 + ax1) / 2 - (ux0 + ux1) / 2)).toBeLessThan(0.6)   // centrado
    const w = (b: number[]) => b[2] - b[0]
    expect(Math.abs(w(bb(sem, 'Júlia')) - w(bb(sem, 'Julia')))).toBeLessThan(0.3)   // o acento não empurra as letras
    // perto do "ú" de verdade da fonte (altura do topo)
    expect(Math.abs(ay0 - bb(real, 'ú')[1])).toBeLessThan(3)
  })
  it('cedilha vai embaixo (com a fonte dos acentos); til em cima; desligar volta ao de antes', () => {
    // sem cedilha em lugar nenhum: sai o "c" (nunca o quadradinho do glifo que falta)
    expect(bb(sem, 'ç')).toEqual(bb(sem, 'c'))
    // com uma "fonte dos acentos" que tenha a cedilha solta, ela vai embaixo do c
    const comCedilha = { ...real, unicodes: new Set([...real.unicodes, 0xb8]), font: { ...real.font, glyph: (cp: number) => cp === 0xb8 ? real.font.glyph(0x2c) : real.font.glyph(cp) } } as FonteHB
    const r = diagramar(sem, 'ç', { acentos: { fonte: { postscriptName: 'X' } } }, caixa, cfg, () => comCedilha)
    expect(r.bbox[3]).toBeGreaterThan(bb(sem, 'c')[3] + 1)
    expect(bb(sem, 'ã')[1]).toBeLessThan(bb(sem, 'a')[1] - 3)
    const desligado = diagramar(sem, 'ú', { acentos: { ligado: false } }, caixa, cfg)
    expect(desligado.bbox).toEqual(diagramar(real, 'ú', {}, caixa, cfg).bbox)    // HarfBuzz desenha o que a fonte tiver
  })
  it('ajuste do acento: subir e tamanho', () => {
    const y0 = bb(sem, 'ú')[1]
    expect(bb(sem, 'ú', { acentos: { alturaMm: 2 } })[1]).toBeCloseTo(y0 - 2, 1)
    const h = (b: number[]) => b[3] - b[1]
    expect(h(bb(sem, 'ú', { acentos: { escala: 1.5 } }))).toBeGreaterThan(h(bb(sem, 'ú')))
  })
  it('fonte com tudo: nada muda (mesmo resultado com e sem a opção)', () => {
    expect(diagramar(real, 'Júlia Conceição', {}, caixa, cfg).cmds).toEqual(diagramar(real, 'Júlia Conceição', { acentos: { ligado: false } }, caixa, cfg).cmds)
  })
})

import { posicaoEfetiva, areaPassaDaFace } from '@/lib/mae/vinculo/resolver'

describe('164 — área do nome × tamanho do nome', () => {
  const slot = { id: 's1', variable: 'NOME', faceId: 'f', box: { x: 0.1, y: 0.4, w: 0.8, h: 0.2 }, single: { lines: 1, sizePt: 28 }, compound: { lines: 2, sizePt: 22, lineHeight: 0.9 }, autoFit: { minScale: 0.7 } } as never
  const tema = (aj: Record<string, unknown>) => ({ textStyles: {}, sample: { NOME: 'Ana' }, textSlotAdjust: { s1: aj } }) as never
  it('sem área: como antes (a caixa cresce junto com o tamanho)', () => {
    const p = posicaoEfetiva(slot, tema({ scale: 1.5 }))
    expect(p.caixa.w).toBeCloseTo(1.2, 6); expect(p.cfg.single!.sizePt).toBeCloseTo(42, 6); expect(p.cfg.autoFit?.minScale).toBe(0.7)
  })
  it('com área: aumentar o TAMANHO não muda a área', () => {
    const a = posicaoEfetiva(slot, tema({ area: { w: 0.6, h: 0.2 } })), b = posicaoEfetiva(slot, tema({ area: { w: 0.6, h: 0.2 }, scale: 1.5 }))
    expect(b.caixa).toEqual(a.caixa)
    expect(b.cfg.single!.sizePt).toBeCloseTo(a.cfg.single!.sizePt * 1.5, 6)
  })
  it('com área: diminuir a ÁREA não muda a letra', () => {
    const a = posicaoEfetiva(slot, tema({ area: { w: 0.6, h: 0.2 } })), b = posicaoEfetiva(slot, tema({ area: { w: 0.3, h: 0.1 } }))
    expect(b.cfg.single!.sizePt).toBe(a.cfg.single!.sizePt)
    expect(b.caixa.w).toBeCloseTo(0.3, 6); expect(b.caixa.x + b.caixa.w / 2).toBeCloseTo(a.caixa.x + a.caixa.w / 2, 6)   // mesmo centro
  })
  it('nome longo encolhe até caber e NUNCA passa da área (antes parava em 70% e passava)', async () => {
    const f = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf')))
    const faceMm = { w: 60, h: 40 }
    for (const aj of [{ area: { w: 0.5, h: 0.2 } }, { area: { w: 0.5, h: 0.2 }, scale: 2 }]) {
      const p = posicaoEfetiva(slot, tema(aj))
      const caixa = { w: p.caixa.w * faceMm.w, h: p.caixa.h * faceMm.h }
      const r = diagramar(f, 'Maria Eduarda Beatriz', {}, caixa, p.cfg as never)
      expect(r.bbox[2] - r.bbox[0]).toBeLessThanOrEqual(caixa.w + 0.01)
      expect(r.revisar).toBe(false)
    }
    // sem área (tema antigo): o comportamento antigo continua (pode pedir revisão)
    const p0 = posicaoEfetiva(slot, tema({}))
    const r0 = diagramar(f, 'Maria Eduarda Beatriz', {}, { w: p0.caixa.w * 20, h: p0.caixa.h * 40 }, p0.cfg as never)
    expect(r0.escala).toBeGreaterThanOrEqual(0.5)
  })
  it('aviso: a área passa da face', () => {
    expect(areaPassaDaFace({ x: 0.1, y: 0.4, w: 0.8, h: 0.2 })).toBe(false)
    expect(areaPassaDaFace({ x: -0.1, y: 0.4, w: 1.2, h: 0.2 })).toBe(true)
  })
})
