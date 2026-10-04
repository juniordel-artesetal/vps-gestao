import { describe, expect, it } from 'vitest'
import { criarHistorico, aplicar, desfazer, refazer } from '@/lib/mae/editor/historico'
import { novoDocumento } from '@/lib/mae/schema'
import { useMaeDoc } from '@/lib/mae/editor/loja'

describe('mae-editor · histórico (Immer patches)', () => {
  it('aplicar → desfazer → refazer volta exatamente ao mesmo documento', () => {
    const inicio = novoDocumento('A4')
    let h = criarHistorico(inicio)
    h = aplicar(h, 'A5', d => { d.artboards[0].widthMm = 148; d.artboards[0].heightMm = 210 })
    const depois = h.atual
    h = desfazer(h); expect(h.atual).toEqual(inicio)
    h = refazer(h); expect(h.atual).toEqual(depois)
  })
  it('sequência longa: desfazer tudo volta ao início, refazer tudo volta ao fim', () => {
    const inicio = novoDocumento('A4')
    let h = criarHistorico(inicio)
    for (let i = 1; i <= 200; i++) h = aplicar(h, `passo ${i}`, d => { d.name = `nome ${i}`; d.artboards[0].widthMm = 100 + i })
    const fim = h.atual
    for (let i = 0; i < 200; i++) h = desfazer(h)
    expect(h.atual).toEqual(inicio)
    for (let i = 0; i < 200; i++) h = refazer(h)
    expect(h.atual).toEqual(fim)
  })
  it('nova ação depois de desfazer descarta o "refazer"; mudança vazia não cria passo', () => {
    let h = criarHistorico(novoDocumento())
    h = aplicar(h, 'a', d => { d.name = 'a' })
    h = desfazer(h)
    h = aplicar(h, 'b', d => { d.name = 'b' })
    expect(h.refazer).toHaveLength(0)
    const n = h.desfazer.length
    h = aplicar(h, 'nada', () => {})
    expect(h.desfazer).toHaveLength(n)
  })
  it('respeita o teto de passos', () => {
    let h = criarHistorico(novoDocumento(), 10)
    for (let i = 0; i < 25; i++) h = aplicar(h, `p${i}`, d => { d.name = `n${i}` })
    expect(h.desfazer).toHaveLength(10)
    expect(h.desfazer[0].label).toBe('p15')
  })
  it('store: nova prancheta entra no histórico; viewport não', () => {
    const s = useMaeDoc.getState()
    s.carregar(novoDocumento('A4'))
    useMaeDoc.getState().novaPrancheta('A5', 'paisagem')
    expect(useMaeDoc.getState().hist.atual.artboards[0]).toMatchObject({ widthMm: 210, heightMm: 148 })
    useMaeDoc.getState().setViewport({ escala: 3, x: 10, y: 20 })
    useMaeDoc.getState().desfazer()
    expect(useMaeDoc.getState().hist.atual.artboards[0]).toMatchObject({ widthMm: 210, heightMm: 297 })
    expect(useMaeDoc.getState().viewport).toEqual({ escala: 3, x: 10, y: 20 })
  })
})
