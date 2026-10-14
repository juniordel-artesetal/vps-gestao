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

// ── Lote 13 (P0): 176 idade como texto · 177 nomes dos arquivos · 175 fundo branco atrás da marca ──
import { idadeLimpa } from '@/lib/mae/texto/variaveis'
import { camposDoPedido, variaveis, alertasDaLinha } from '@/lib/mae/pedidos/pedidos'
import { nomeTemaPronto, sufixoQuantidade, temaCurto } from '@/lib/mae/exportar/nomes'
import { quadradosDaMarca, avisoMR, PREFIXO_AVISO_MR } from '@/lib/mae/exportar/marca'

describe('176 — idade que vem como texto', () => {
  it('só o número ("1 ANO", "2 años", "2 aninhos", "3anos", "1 ano")', () => {
    for (const [e, s] of [['1 ANO', '1'], ['2 años', '2'], ['2 aninhos', '2'], ['3anos', '3'], ['1 ano', '1'], ['5', '5'], ['8 meses', '8 meses']] as const) expect(idadeLimpa(e).valor).toBe(s)
    expect(idadeLimpa('um ano')).toEqual({ valor: 'um ano', revisar: true })
  })
  it('Liz Gabriele "1 ANO" → IDADE "1", hashtag #LizGabrielefaz1 (uma linha); "um ano" → revisar idade', () => {
    const c = camposDoPedido({ Nome: 'Liz Gabriele', Idade: '1 ANO', Tema: 'MOANA BABY' })
    expect(c.IDADE).toBe('1')
    const v = variaveis(c)
    expect(v.IDADE).toBe('1'); expect(v.HASHTAG).toBe('#LizGabrielefaz1')
    expect(alertasDaLinha(camposDoPedido({ Nome: 'Ana', Idade: 'um ano', Tema: 'X' }), { themeId: 't' } as never)).toContain('revisar idade ("um ano")')
  })
})

describe('177 — nomes dos arquivos', () => {
  const d = new Date(2026, 9, 13)
  it('pedido único: Liz-Gabriele_1ano_Moana-Baby_84un.pdf (sem o anúncio da Shopee)', () => {
    expect(nomeTemaPronto({ nome: 'Liz Gabriele', idade: '1 ANO', tema: 'MOANA BABY_KIT FESTA', data: d, extensao: 'pdf', sufixo: sufixoQuantidade('', 84) })).toBe('Liz-Gabriele_1ano_Moana-Baby_84un.pdf')
    expect(nomeTemaPronto({ nome: 'Valentina', idade: '5', tema: 'Moana', data: d, extensao: 'pdf', sufixo: sufixoQuantidade('', 24) })).toBe('Valentina_5anos_Moana_24un.pdf')
  })
  it('sem idade o trecho some; "(v3)" e "(cópia)" saem do tema', () => {
    expect(nomeTemaPronto({ nome: 'Davi', idade: '', tema: 'Ursinhos carinhosos TRADICIONAL (v3)', data: d, extensao: 'pdf' })).toBe('Davi_Ursinhos-carinhosos-TRADICIONAL.pdf')
    expect(temaCurto('CINDERELA_KIT FESTA (v7)')).toBe('Cinderela')
  })
  it('longo demais: corta o TEMA, nunca o nome da criança', () => {
    const n = nomeTemaPronto({ nome: 'Maria Eduarda Beatriz Fernanda', idade: '2', tema: 'O MAIOR PINTOR DO MUNDO MENINA COM ARCO-ÍRIS E PALHAÇOS_KIT FESTA', caixa: 'MALETA ALÇA', data: d, extensao: 'pdf', sufixo: '84un' })
    expect(n.startsWith('Maria-Eduarda-Beatriz-Fernanda_2anos_')).toBe(true)
    expect(n.length).toBeLessThanOrEqual(104)
  })
})

describe('175 — fundo branco atrás da marca', () => {
  it('quadrado = zona + folga, preso na folha', () => {
    const q = quadradosDaMarca([{ x: 0.5, y: 10, w: 5, h: 5 }], 1, 297, 210)[0] as unknown as { color: string; xMm: number; yMm: number; wMm: number; hMm: number }
    expect(q.color).toBe('#ffffff')
    expect([q.xMm, q.yMm, q.wMm, q.hMm]).toEqual([0, 9, 6.5, 7])
  })
  it('desligado: aviso em UMA linha com os detalhes', () => {
    const a = avisoMR([{ nome: 'MILK', n: 7 }, { nome: 'CUBO', n: 2 }])
    expect(a.startsWith(`${PREFIXO_AVISO_MR} em 2 pranchetas`)).toBe(true)
    expect(a).toMatch(/Detalhes: MILK \(7\), CUBO \(2\)/)
  })
})
