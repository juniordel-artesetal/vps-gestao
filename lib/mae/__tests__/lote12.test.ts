// Lote 12 — produção real (13/10/2026): "Maitê" na Jesica Justine (sem "ê"). Trocar letra aplica e nunca falha em
// silêncio (171). A fonte DEMO da Naty (Jaishey) fica fora do repositório (licença): o teste usa a instalada, se houver.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'
import { diagramar, problemaDasTrocas } from '@/lib/mae/texto/diagramar'

const JAISHEY = 'C:/Users/junio/AppData/Local/Microsoft/Windows/Fonts/Jaishey_DEMO.ttf'
const caixa = { w: 200, h: 40 }, cfg = { single: { lines: 1 as const, sizePt: 60 } }
const troca = (letra: string) => ({ trocas: [{ letra, so: 'todas' as const, fonte: { postscriptName: 'Jaishey_DEMO', family: 'Jaishey' } as { postscriptName: string } }] })

describe('171 — trocar letra', () => {
  let base: FonteHB
  beforeAll(async () => { base = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf'))) })

  it('fonte da troca não carregada → revisar com aviso (antes: ignorava em silêncio)', () => {
    const r = diagramar(base, 'Maitê', troca('ê'), caixa, cfg, () => undefined)
    expect(r.revisar).toBe(true)
    expect(r.aviso).toMatch(/"ê" \(Jaishey\) não carregou/)
    expect(problemaDasTrocas('Maite', troca('ê'), () => undefined)).toBeNull()   // letra que não aparece no nome: nada a dizer
  })
  it('a outra fonte também não tem a letra → aviso para escolher outra', () => {
    const semE = { ...base, unicodes: new Set([...base.unicodes].filter(c => c !== 0xea && c !== 0x302)) } as FonteHB
    expect(problemaDasTrocas('Maitê', troca('ê'), () => semE)).toMatch(/também não tem "ê"/)
  })

  describe.skipIf(!existsSync(JAISHEY))('com a fonte real Jaishey_DEMO', () => {
    let jai: FonteHB
    beforeAll(async () => { jai = await abrirFonte(readFileSync(JAISHEY)) })
    const outra = (ps: string) => (ps === 'Jaishey_DEMO' ? jai : undefined)
    it('só o ê muda de fonte; o resto do nome continua igual; sem aviso', () => {
      const sem = diagramar(base, 'Maitê', {}, caixa, cfg)
      const com = diagramar(base, 'Maitê', troca('ê'), caixa, cfg, outra)
      expect(com.cmds).not.toEqual(sem.cmds)
      expect(com.revisar).toBe(false); expect(com.aviso).toBeNull()
      // "Mait" sozinho (sem o ê) desenha igual nas duas
      expect(diagramar(base, 'Mait', troca('ê'), caixa, cfg, outra).cmds).toEqual(diagramar(base, 'Mait', {}, caixa, cfg).cmds)
    })
    it('a letra da outra fonte fica da MESMA altura das letras do nome (topo igual)', () => {
      const h = (b: number[]) => b[3] - b[1]
      const e0 = diagramar(base, 'e', {}, caixa, cfg).bbox, e1 = diagramar(base, 'e', troca('e'), caixa, cfg, outra).bbox
      // o topo do "e" trocado = o topo do "e" do nome (a base de uma fonte script pode começar acima da linha)
      expect(Math.abs(e1[1] - e0[1])).toBeLessThan(0.3)
      const semAuto = diagramar(base, 'e', { trocas: [{ ...troca('e').trocas[0], escala: 1 }] }, caixa, cfg, outra).bbox
      expect(Math.abs(semAuto[1] - e0[1])).toBeGreaterThan(1)   // antes (tamanho "em" da outra fonte) ficava mais baixa
      // com tamanho manual, vale o manual (o automático não soma)
      const e2 = diagramar(base, 'e', { trocas: [{ ...troca('e').trocas[0], escala: 2 }] }, caixa, cfg, outra).bbox
      expect(h(e2)).toBeGreaterThan(h(e1) * 1.3)
    })
    it('Zoê e Renê também', () => {
      for (const n of ['Zoê', 'Renê']) {
        const r = diagramar(base, n, troca('ê'), caixa, cfg, outra)
        expect(r.cmds).not.toEqual(diagramar(base, n, {}, caixa, cfg).cmds); expect(r.revisar).toBe(false)
      }
    })
  })
})
