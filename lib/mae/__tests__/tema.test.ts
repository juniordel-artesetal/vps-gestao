// Sprint 6 — operações do tema: papel e elemento na parte, "Só nesta caixa", Voltar ao padrão,
// Desvincular, camada só da face; tudo passando pelo histórico (desfazer volta exato).
import { describe, it, expect } from 'vitest'
import { produce } from 'immer'
import { novoTema, colocarPapel, colocarElemento, colocarNaFace, ajustarSoNaFace, voltarAoPadrao, propriedadesAjustadas, desvincular, editarNaParte, removerCamadaTema, moverCamadaTema } from '@/lib/mae/vinculo/tema'
import { efetiva, type AjusteLocal } from '@/lib/mae/vinculo/resolver'
import { aplicar, criarHistorico, desfazer } from '@/lib/mae/editor/historico'
import { DocTema } from '@/lib/mae/schema'

const praia = { path: 'Papéis/praia.png', sha256: 'aaaa', aspect: 1.4 }
const hibisco = { path: 'Papéis/hibisco.png', sha256: 'bbbb', aspect: 1 }
const angel = { path: 'Elementos/angel.png', sha256: 'cccc', aspect: 0.6, nome: 'Angel' }

describe('tema', () => {
  it('novo tema é válido e aponta para a versão da base', () => {
    const t = novoTema({ nome: 'Stitch Angel', baseId: 'base_1', baseVersion: 3 })
    expect(DocTema.safeParse(t).success).toBe(true)
    expect(t).toMatchObject({ baseId: 'base_1', baseVersion: 3, version: 1 })
  })
  it('papel vai para o fundo; arrastar outro papel TROCA a imagem (não empilha)', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    const e = colocarElemento(t, 'p_frente', angel)
    const p1 = colocarPapel(t, 'p_frente', praia)
    const p2 = colocarPapel(t, 'p_frente', hibisco)
    expect(p2).toBe(p1)
    expect(t.partContent.p_frente.map(c => c.id)).toEqual([p1, e])
    expect(t.partContent.p_frente[0]).toMatchObject({ anchor: 'paper', path: 'Papéis/hibisco.png' })
    expect(t.partContent.p_frente[1]).toMatchObject({ anchor: 'face', transform: { x: 0.5, y: 0.5, scale: 0.5 } })
  })
  it('"Só nesta caixa" grava só o que mudou; Voltar ao padrão por propriedade', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    const e = colocarElemento(t, 'p_frente', angel)
    ajustarSoNaFace(t, 'f_milk_15', e, { transform: { y: 0.3 } })
    ajustarSoNaFace(t, 'f_milk_15', e, { transform: { scale: 0.4 }, visible: false })
    expect(propriedadesAjustadas(t, 'f_milk_15', e).sort()).toEqual(['transform.scale', 'transform.y', 'visible'])
    const ef = efetiva(t.partContent.p_frente[0], (t.localOverrides.f_milk_15 as Record<string, AjusteLocal>)[e])
    expect(ef.transform).toMatchObject({ x: 0.5, y: 0.3, scale: 0.4 })
    voltarAoPadrao(t, 'f_milk_15', e, 'transform.y')
    expect(propriedadesAjustadas(t, 'f_milk_15', e).sort()).toEqual(['transform.scale', 'visible'])
    voltarAoPadrao(t, 'f_milk_15', e)
    expect(t.localOverrides).toEqual({})
  })
  it('editar vinculado muda para todas (a camada da parte)', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    const e = colocarElemento(t, 'p_frente', angel)
    editarNaParte(t, e, { transform: { x: 0.2 } })
    expect(t.partContent.p_frente[0].transform).toMatchObject({ x: 0.2, y: 0.5 })
  })
  it('Desvincular: vira exclusiva da face com os ajustes dela; some do vínculo só ali', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    const e = colocarElemento(t, 'p_frente', angel)
    ajustarSoNaFace(t, 'f1', e, { transform: { x: 0.8 } })
    const ef = efetiva(t.partContent.p_frente[0], (t.localOverrides.f1 as Record<string, AjusteLocal>)[e])
    const id = desvincular(t, 'f1', e, ef as never)
    expect(t.faceContent.f1[0]).toMatchObject({ id, transform: { x: 0.8 } })
    expect((t.localOverrides.f1 as Record<string, AjusteLocal>)[e]).toEqual({ visible: false })
  })
  it('camada só da face (Alt), ordem e remover (leva junto os ajustes)', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    colocarNaFace(t, 'f2', angel, 'face')
    expect(t.faceContent.f2.length).toBe(1)
    const a = colocarElemento(t, 'p_frente', angel), b = colocarElemento(t, 'p_frente', hibisco)
    moverCamadaTema(t, b, -1)
    expect(t.partContent.p_frente.map(c => c.id)).toEqual([b, a])
    ajustarSoNaFace(t, 'f9', a, { visible: false })
    removerCamadaTema(t, a)
    expect(t.partContent.p_frente.map(c => c.id)).toEqual([b])
    expect((t.localOverrides.f9 as Record<string, unknown>)[a]).toBeUndefined()
  })
  it('pelo histórico: aplicar e desfazer voltam exato', () => {
    const t0 = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    let h = criarHistorico(t0)
    h = aplicar(h, 'Papel na FRENTE', d => { colocarPapel(d as never, 'p_frente', praia) })
    h = aplicar(h, 'Só nesta caixa', d => { ajustarSoNaFace(d as never, 'f1', (d.partContent.p_frente[0]).id, { transform: { scale: 2 } }) })
    expect(produce(h.atual, () => {}).localOverrides).not.toEqual({})
    h = desfazer(desfazer(h))
    expect(h.atual).toEqual(t0)
  })
})
