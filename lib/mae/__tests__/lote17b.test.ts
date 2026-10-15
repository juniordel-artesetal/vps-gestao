// Lote 17 (P2, itens 213/214) — cor por letra (MÁRIO JR.) e o enfeite preso ao nome (o laço da Hello Kitty).
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'
import { diagramar } from '@/lib/mae/texto/diagramar'
import { noDoTexto, coresDasLetras, pontoDoEnfeite, ESTILO_PADRAO, type EstiloTexto } from '@/lib/mae/texto/noTexto'
import { EstiloTexto as EstiloTextoZ } from '@/lib/mae/schema/tema'

let f: FonteHB
beforeAll(async () => { f = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf'))) })
const CORES = ['#1d4ed8', '#facc15', '#dc2626', '#16a34a']
const est = (x: Partial<EstiloTexto> = {}): EstiloTexto => ({ ...JSON.parse(JSON.stringify(ESTILO_PADRAO)), effects: [{ type: 'stroke', enabled: true, size: 1, color: '#ffffff', position: 'outside' }], ...x })
const no = (valor: string, e: EstiloTexto, caixaW = 1) => noDoTexto({ slotId: 's', variavel: 'NOME', valor, estilo: e, fontes: { obter: () => f, substituta: f },
  quadro: [100, 0, 0, 40, 0, 0], w: 100, h: 40, caixa: { x: 0, y: 0, w: caixaW, h: 1 }, cfg: { single: { lines: 1, sizePt: 48 }, autoFit: { minScale: 0.3 } } })!

describe('213 — cor por letra', () => {
  it('a sequência se repete letra a letra; o acento vai com a letra dele; espaço não gasta cor (ou gasta, se pedir)', () => {
    const g = (s: string) => [...s].map(ch => ({ ch: ch === '´' ? '' : ch, acento: ch === '´' }))
    expect(coresDasLetras(g('MA´RIO'), 4).indices).toEqual([0, 1, 1, 2, 3, 0])
    expect(coresDasLetras(g('VALENTINA'), 4).indices).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0])
    expect(coresDasLetras(g('JOAO PEDRO'), 4).indices).toEqual([0, 1, 2, 3, null, 0, 1, 2, 3, 0])
    expect(coresDasLetras(g('JOAO PEDRO'), 4, { pularEspacos: false }).indices).toEqual([0, 1, 2, 3, null, 1, 2, 3, 0, 1])
    expect(coresDasLetras(g('ANA'), 4, { inicio: 2 }).indices).toEqual([2, 3, 0])
  })
  it('MARIO: uma camada por letra com a sua cor, recortadas no nome; os estilos (contorno) só no nome inteiro; o auto-ajuste igual', () => {
    const r = no('MARIO', est({ porLetra: { cores: CORES } }))
    expect(r.letras?.length).toBe(5)
    expect(r.letras!.map(l => (l as { color: string }).color)).toEqual([CORES[0], CORES[1], CORES[2], CORES[3], CORES[0]])
    expect(r.letras!.every(l => l.clip && !(l as { effects?: unknown[] }).effects?.length)).toBe(true)
    expect(JSON.stringify(r.no.effects)).toBe(JSON.stringify(no('MARIO', est()).no.effects))   // os estilos: os mesmos do nome de cor única
    expect(r.info.escala).toBe(no('MARIO', est()).info.escala)
  })
  it('a cor por letra passa no schema (e o papel por letra)', () => {
    expect(EstiloTextoZ.safeParse(est({ porLetra: { cores: CORES, pularEspacos: true, papeis: [{ path: 'Papéis/x.png', aspect: 1 }] }, brincando: { intensidade: 0.5 } })).success).toBe(true)
  })
  it('letras brincando: as letras giram/sobem (o desenho muda), o tamanho (auto-ajuste) não', () => {
    const a = diagramar(f, 'VALENTINA', est() as never, { w: 100, h: 40 }, { single: { lines: 1, sizePt: 36 } })
    const b = diagramar(f, 'VALENTINA', est({ brincando: { intensidade: 1 } }) as never, { w: 100, h: 40 }, { single: { lines: 1, sizePt: 36 } })
    expect(b.escala).toBe(a.escala)
    expect(JSON.stringify(b.cmds)).not.toBe(JSON.stringify(a.cmds))
    expect(b.glifos.length).toBe(a.glifos.length)
  })
})

describe('214 — enfeite preso ao nome', () => {
  const laco = (ancora: NonNullable<EstiloTexto['enfeite']>['ancora'] = 'ultima') => est({ enfeite: { imagem: { path: 'Elementos/laco.png', aspect: 1.5 }, ancora, tamanho: 0.6, dx: 0, dy: 0, giroDeg: 0 } })
  const caixaDoEnfeite = (r: ReturnType<typeof no>) => { const m = r.enfeite!.no.matrix as number[]; const xs = [m[4], m[4] + m[0], m[4] + m[2], m[4] + m[0] + m[2]], ys = [m[5], m[5] + m[1], m[5] + m[3], m[5] + m[1] + m[3]]; return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }
  it('última letra: o laço fica EM CIMA da última letra, pelo topo real dela ("Isabel": o "l" é alto, o laço sobe junto)', () => {
    const d = (s: string) => diagramar(f, s, est() as never, { w: 100, h: 40 }, { single: { lines: 1, sizePt: 48 }, autoFit: { minScale: 0.3 } })
    const luisa = pontoDoEnfeite(d('Luisa'), 'ultima')!, isabel = pontoDoEnfeite(d('Isabel'), 'ultima')!
    expect(isabel.y).toBeLessThan(luisa.y - 2)          // o topo do "l" é mais alto que o do "a"
    const r = no('Luisa', laco())
    const c = caixaDoEnfeite(r)
    expect(Math.abs(c[3] - luisa.y)).toBeLessThan(0.05)          // a base do laço encosta no topo do "a" (mm: quadro 100×40, caixa inteira)
  })
  it('acompanha o nome: em "Ana" e em "Valentina" fica sobre a última letra (mais à direita no nome comprido)', () => {
    const ana = caixaDoEnfeite(no('Ana', laco())), val = caixaDoEnfeite(no('Valentina', laco()))
    expect((val[0] + val[2]) / 2).toBeGreaterThan((ana[0] + ana[2]) / 2)
  })
  it('o auto-ajuste encolhe o nome → o laço diminui junto', () => {
    const grande = caixaDoEnfeite(no('Valentina', laco())), pequeno = caixaDoEnfeite(no('Valentina', laco(), 0.4))
    expect(pequeno[2] - pequeno[0]).toBeLessThan((grande[2] - grande[0]) * 0.8)
  })
  it('pingo do i: o ponto fica no pingo (acima do corpo do "i"); sem "i" no nome, sem enfeite', () => {
    const d = diagramar(f, 'Lis', est() as never, { w: 100, h: 40 }, { single: { lines: 1, sizePt: 36 } })
    const p = pontoDoEnfeite(d, 'pingo-i')!
    const gi = d.glifos.find(g => g.ch === 'i')!
    const ys = d.cmds.slice(gi.i0, gi.i1).flatMap(c => c.slice(1).filter((_, k) => k % 2 === 1) as number[])
    expect(p.y).toBeLessThan((Math.min(...ys) + Math.max(...ys)) / 2)
    expect(no('Ana', laco('pingo-i')).enfeite).toBeUndefined()
  })
  it('antes/depois do nome e atrás/na frente', () => {
    const r = no('Ana', laco('depois')), b = r.info.cantosMm!
    expect(caixaDoEnfeite(r)[0]).toBeGreaterThanOrEqual(Math.max(...b.map(p => p[0])) - 0.01)
    expect(no('Ana', est({ enfeite: { imagem: { path: 'x.png', aspect: 1 }, ancora: 'cima', tamanho: 0.5, dx: 0, dy: 0, giroDeg: 0, atras: true } })).enfeite!.atras).toBe(true)
  })
})
