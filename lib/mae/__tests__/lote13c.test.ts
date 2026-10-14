// Lote 13 (itens 182–185): data de envio relativa; sem nome × aguardando dados; caixa padrão em mm; lado que segura o nome.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { filtrar, presetEnvio, periodoEnvio, contarPorDia, nFiltros, diasEntre, type Filtravel } from '@/lib/mae/pedidos/filtros'
import { aguardandoDados } from '@/lib/mae/pedidos/pedidos'
import { caixaPadrao } from '@/lib/mae/editor/textosReplicar'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'
import { diagramar } from '@/lib/mae/texto/diagramar'

const base: Filtravel = { numero: '1', cliente: '', nome: 'Ana', temaSoa: '', temaMae: '', produto: '', status: '', canal: '', loja: '', dataEnvio: '', temTema: true, comObs: false, ajustado: false }
const p = (dataEnvio: string, x: Partial<Filtravel> = {}) => ({ ...base, numero: dataEnvio, dataEnvio, ...x })

describe('182 — data de envio (relativa a hoje)', () => {
  const hoje = '2026-10-14'   // quarta
  const ls = [p('2026-10-10'), p('2026-10-13'), p('2026-10-14'), p('2026-10-15'), p('2026-10-18'), p('2026-10-20'), p('')]
  const nums = (f: Parameters<typeof filtrar>[1]) => filtrar(ls, f, x => x, hoje).map(x => x.numero)
  it('presets', () => {
    expect(nums({ envio: presetEnvio('hoje', hoje) })).toEqual(['2026-10-14'])
    expect(nums({ envio: presetEnvio('amanha', hoje) })).toEqual(['2026-10-10', '2026-10-13', '2026-10-14', '2026-10-15'])
    expect(nums({ envio: presetEnvio('atrasados', hoje) })).toEqual(['2026-10-10', '2026-10-13'])
    expect(nums({ envio: presetEnvio('semana', hoje) })).toEqual(['2026-10-14', '2026-10-15', '2026-10-18'])
    expect(nums({ envio: presetEnvio('7dias', hoje) })).toEqual(['2026-10-14', '2026-10-15', '2026-10-18', '2026-10-20'])
  })
  it('o filtro salvo não vence: o mesmo período relativo amanhã anda junto', () => {
    const f = { envio: { de: diasEntre(hoje, '2026-10-15'), ate: diasEntre(hoje, '2026-10-18') } }
    expect(periodoEnvio(f.envio, hoje)).toEqual({ de: '2026-10-15', ate: '2026-10-18' })
    expect(periodoEnvio(f.envio, '2026-10-15')).toEqual({ de: '2026-10-16', ate: '2026-10-19' })
    expect(nFiltros(f)).toBe(1)
  })
  it('quantidade por dia (o calendário)', () => {
    expect(contarPorDia([p('2026-10-14'), p('2026-10-14'), p('2026-10-15'), p('')])).toEqual({ '2026-10-14': 2, '2026-10-15': 1 })
  })
})

describe('183 — sem nome × aguardando dados', () => {
  it('reconhece "aguardando dados" e variações', () => {
    for (const t of ['AGUARDANDO DADOS', 'aguardando nome', 'Aguardando os dados da cliente', 'pedi o nome', 'PEDI NOME pelo chat', 'aguardando'])
      expect(aguardandoDados([t]), t).toBe(true)
    for (const t of ['MASHA E O URSO', 'Maria Aguiar', '', null, 'Moana Baby'])
      expect(aguardandoDados([t]), String(t)).toBe(false)
  })
  it('filtros Sem nome / Aguardando dados', () => {
    const ls = [p('a', { semNome: true }), p('b', { aguardando: true }), p('c')]
    expect(filtrar(ls, { semNome: true }, x => x, '2026-10-14').map(x => x.numero)).toEqual(['a'])
    expect(filtrar(ls, { aguardando: true }, x => x, '2026-10-14').map(x => x.numero)).toEqual(['b'])
  })
})

describe('185 — a área nasce do tamanho de um nome (mm), não de 80% da página', () => {
  it('página A4 inteira: NOME ~70×16 mm, centrada no padrão', () => {
    const box = { x: 0.1, y: 0.4, w: 0.8, h: 0.2 }
    const c = caixaPadrao('NOME', box, 210, 297)
    expect(c.w * 210).toBeCloseTo(70, 0)
    expect(c.h * 297).toBeCloseTo(16, 0)
    expect(c.x + c.w / 2).toBeCloseTo(0.5, 2)
    expect(c.y + c.h / 2).toBeCloseTo(0.5, 2)
  })
  it('face pequena: nunca maior que a fração padrão', () => {
    const box = { x: 0.1, y: 0.4, w: 0.8, h: 0.2 }
    expect(caixaPadrao('NOME', box, 50, 30)).toEqual(box)
  })
})

describe('185 — qual lado da área segura o nome', () => {
  let f: FonteHB
  beforeAll(async () => { f = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf'))) })
  const cfg = { single: { lines: 1 as const, sizePt: 72 } }
  it('caixa estreita → largura; caixa baixa → altura; cabe → nada', () => {
    expect(diagramar(f, 'Maria Eduarda Beatriz', {}, { w: 100, h: 200 }, cfg).limite).toBe('largura')
    expect(diagramar(f, 'Ana', {}, { w: 2000, h: 10 }, cfg).limite).toBe('altura')
    expect(diagramar(f, 'Ana', {}, { w: 2000, h: 2000 }, cfg).limite).toBeNull()
  })
})
