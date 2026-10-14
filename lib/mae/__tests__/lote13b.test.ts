// Lote 13 (item 180): letra faltando — fonte DEMO que declara o "ê" com o glifo VAZIO; aviso na lista, filtro, montagem.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'
import { diagramar, letrasSemGlifo, letrasMontaveis, temGlifo } from '@/lib/mae/texto/diagramar'
import { filtrar } from '@/lib/mae/pedidos/filtros'

let jesica: FonteHB
const fontes = new Map<string, FonteHB>()
vi.mock('@/components/mae/fontesTexto', () => ({ fonteCarregada: (ps: string) => fontes.get(ps), carregarFonte: async () => undefined }))

beforeAll(async () => {
  const real = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf')))
  // a "Jesica Justine": o ê está na tabela de letras, mas o desenho é VAZIO (como nas fontes demo)
  const gidE = real.font.glyph(0xea)
  jesica = { ...real, contorno: (gid: number) => (gid === gidE ? [] : real.contorno(gid)) }
  fontes.set('JesicaJustineRegular', jesica)
})

describe('180 — glifo vazio = letra que falta', () => {
  it('a fonte "tem" o ê na tabela, mas o MAE agora sabe que falta', () => {
    expect(jesica.unicodes.has(0xea)).toBe(true)
    expect(temGlifo(jesica, 0xea)).toBe(false)
    expect(letrasSemGlifo(jesica, 'Maitê')).toEqual(['ê'])
  })
  it('e o 163 monta o acento (e + ^) — antes o ê sumia na arte', () => {
    expect(letrasMontaveis(jesica, 'Maitê')).toEqual(['ê'])
    const caixa = { w: 200, h: 40 }, cfg = { single: { lines: 1 as const, sizePt: 60 } }
    const r = diagramar(jesica, 'ê', {}, caixa, cfg), semAcento = diagramar(jesica, 'e', {}, caixa, cfg)
    expect(r.cmds.length).toBeGreaterThan(semAcento.cmds.length)   // desenhou alguma coisa a mais que o "e" (antes: nada)
    expect(r.bbox[1]).toBeLessThan(semAcento.bbox[1] - 1)          // o acento por cima do "e" da Jesica
  })
})

describe('180 — aviso na lista e filtro "Letra faltando"', () => {
  const tema = (extra: Record<string, unknown> = {}) => ({ textStyles: { NOME: { font: { postscriptName: 'JesicaJustineRegular', family: 'Jesica Justine', source: 'local' }, caixa: 'normal', ...extra } } }) as never
  it('acento montado (padrão) → a lista não avisa; desligado → "A fonte Jesica Justine não tem ê — Maitê"', async () => {
    const { letrasFaltandoNoPedido } = await import('@/components/mae/letrasFaltando')
    expect(letrasFaltandoNoPedido(tema(), { NOME: 'Maitê' })).toEqual([])
    expect(letrasFaltandoNoPedido(tema({ acentos: { ligado: false } }), { NOME: 'Maitê' })).toEqual([{ variavel: 'NOME', fonte: 'Jesica Justine', letras: ['ê'], texto: 'Maitê' }])
  })
  it('letra trocada no tema ou no pedido não avisa', async () => {
    const { letrasFaltandoNoPedido } = await import('@/components/mae/letrasFaltando')
    const sem = { acentos: { ligado: false } }
    expect(letrasFaltandoNoPedido(tema({ ...sem, trocas: [{ letra: 'ê', so: 'todas' }] }), { NOME: 'Maitê' })).toEqual([])
    expect(letrasFaltandoNoPedido(tema(sem), { NOME: 'Maitê', _TROCAS_NOME: JSON.stringify([{ letra: 'ê' }]) })).toEqual([])
    expect(letrasFaltandoNoPedido(tema(sem), { NOME: 'Ana' })).toEqual([])
  })
  it('filtro "Letra faltando"', () => {
    const base = { numero: '', cliente: '', nome: '', temaSoa: '', temaMae: '', produto: '', status: '', canal: '', loja: '', dataEnvio: '', temTema: true, comObs: false, ajustado: false }
    const ls = [{ id: 'a', f: { ...base, letraFaltando: true } }, { id: 'b', f: { ...base, letraFaltando: false } }]
    expect(filtrar(ls, { letraFaltando: true }, x => x.f, '2026-10-13').map(x => x.id)).toEqual(['a'])
  })
})

import { aplicarAjustes, ajustesParaTela, estilosDe } from '@/lib/mae/servidor/ajustesPedido'
import { ESTILO_PADRAO } from '@/lib/mae/texto/noTexto'

describe('178 — estilo do texto SÓ DESTE PEDIDO', () => {
  const vermelho = { ...ESTILO_PADRAO, color: '#ff0000' }
  it('servidor: guarda o estilo válido, descarta o inválido, null tira', () => {
    const mae = aplicarAjustes({}, { estilos: { NOME: vermelho, IDADE: { color: 123 } } })
    expect(Object.keys(estilosDe(mae))).toEqual(['NOME'])
    expect((ajustesParaTela(mae).estilos as Record<string, { color: string }>).NOME.color).toBe('#ff0000')
    expect(estilosDe(aplicarAjustes(mae, { estilos: { NOME: null } }))).toEqual({})
  })
})
