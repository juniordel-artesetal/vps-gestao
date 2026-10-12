// Lote 8 (item 122) — Ctrl+Z UNIVERSAL: percorre as ações principais pelos stores reais (base e tema) e pela linha
// do tempo global; cada ação é desfeita (volta EXATAMENTE ao documento anterior) e refeita. Também: gestos separados
// do mesmo controle = passos separados; rajada de setinhas = 1 passo; ação composta (base + tema) = 1 Ctrl+Z.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { registrarFonte, desfazerGlobal, refazerGlobal, juntarUltimos, useLinha } from '@/lib/mae/editor/linhaDoTempo'
import { JANELA_JUNTAR_MS } from '@/lib/mae/editor/historico'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { montarBaseDeMedidas } from '@/lib/mae/medidas/pecas'
import { novoTema, colocarPapel, colocarCor, colocarElemento, editarNaParte, removerCamadaTema, criarMoldura } from '@/lib/mae/vinculo/tema'
import { reordenarCamada } from '@/lib/mae/vinculo/pilha'
import { girarPrancheta, redimensionarPrancheta, duplicarPrancheta } from '@/lib/mae/editor/pranchetas'
import type { DocTema } from '@/lib/mae/schema'

registrarFonte('base', { hist: () => useMaeDoc.getState().hist as never, desfazer: () => useMaeDoc.getState().desfazer(), refazer: () => useMaeDoc.getState().refazer(), ativa: () => true })
registrarFonte('tema', { hist: () => useMaeTema.getState().hist as never, desfazer: () => useMaeTema.getState().desfazer(), refazer: () => useMaeTema.getState().refazer(), ativa: () => !!useMaeTema.getState().hist })

let agora = 1_000_000
vi.spyOn(Date, 'now').mockImplementation(() => agora)
const passa = (ms: number) => { agora += ms }
const arq = (n: string) => ({ path: `Papéis/${n}.png`, sha256: n.padEnd(64, '0').slice(0, 64), aspect: 1 })
const foto = () => JSON.stringify([useMaeDoc.getState().hist.atual, useMaeTema.getState().hist?.atual])
const base = () => useMaeDoc.getState().aplicar
const tema = (label: string, f: (t: DocTema) => void, j?: string) => useMaeTema.getState().aplicar(label, t => f(t as DocTema), j)

/** Faz a ação, confere que mudou, Ctrl+Z volta ao exato anterior, Ctrl+Y refaz ao exato depois. */
function confere(nome: string, acao: () => void) {
  passa(5000)
  const antes = foto()
  acao()
  const depois = foto()
  expect(depois, `${nome}: mudou`).not.toBe(antes)
  expect(desfazerGlobal(), `${nome}: tem o que desfazer`).toBe(true)
  expect(foto(), `${nome}: Ctrl+Z volta exato`).toBe(antes)
  expect(refazerGlobal(), `${nome}: tem o que refazer`).toBe(true)
  expect(foto(), `${nome}: Ctrl+Y refaz exato`).toBe(depois)
}

describe('Ctrl+Z universal', () => {
  let parte = '', papel = '', elemento = '', slot = ''
  beforeEach(() => {
    useLinha.setState({ feitos: [], desfeitos: [] })
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Livros', medida: { forma: 'retangulo', larguraMm: 90, alturaMm: 50 } }, { nome: 'Tag', medida: { forma: 'circulo', larguraMm: 40, alturaMm: 40 } }])
    d.textSlots = [{ id: 'ts1', variable: 'NOME', faceId: d.molds[0].faces[0].id, box: { x: 0.2, y: 0.3, w: 0.6, h: 0.3 }, single: { lines: 1, sizePt: 24 } } as never]
    useMaeDoc.getState().carregar(d as never)
    const t = novoTema({ nome: 'T', baseId: d.id, baseVersion: 1 })
    parte = d.parts[0].id; slot = 'ts1'
    papel = colocarPapel(t, parte, arq('azul'))
    elemento = colocarElemento(t, parte, arq('estrela'))
    useMaeTema.getState().carregar(t)
    useLinha.setState({ feitos: [], desfeitos: [] })
  })

  it('camadas do tema: mover, escala, giro, opacidade, olho, cadeado, ordem, excluir', () => {
    confere('mover', () => tema('Mover', t => editarNaParte(t, elemento, { transform: { x: 0.7, y: 0.2 } })))
    confere('escala', () => tema('Escala', t => editarNaParte(t, elemento, { transform: { scale: 0.6 } })))
    confere('giro', () => tema('Girar', t => editarNaParte(t, elemento, { transform: { rotationDeg: 30 } })))
    confere('opacidade', () => tema('Opacidade', t => editarNaParte(t, elemento, { opacity: 0.4 }), 'op:x'))
    confere('olho', () => tema('Ocultar', t => editarNaParte(t, elemento, { visible: false })))
    confere('cadeado', () => tema('Travar', t => { const c = t.partContent[parte].find(x => x.id === elemento) as { locked?: boolean }; c.locked = true }))
    confere('ordem', () => tema('Trazer para frente', t => { reordenarCamada(t as never, papel, 'topo') }))
    confere('excluir', () => tema('Excluir', t => removerCamadaTema(t, elemento)))
  })
  it('papel, cor, moldurinha, forma e papel na forma, efeitos/preset, logo, frase e texto', () => {
    confere('papel', () => tema('Papel', t => { colocarPapel(t, parte, arq('rosa')) }))
    confere('cor', () => tema('Cor', t => { colocarCor(t, { partId: parte }, '#ff0000') }))
    confere('moldura', () => tema('Moldura', t => { criarMoldura(t, { partId: parte }, { offsetMm: 2, widthMm: 1, dash: null, cornerMm: 0, color: '#000000' }) }))
    confere('forma', () => tema('Forma', t => { t.partContent[parte].push({ id: 'sh1', type: 'shape', kind: 'ellipse', name: 'Elipse', visible: true, anchor: 'face', color: '#f472b6', aspect: 1, params: {}, transform: { x: 0.5, y: 0.5, scale: 0.3, rotationDeg: 0 } } as never) }))
    confere('papel na forma', () => tema('Papel na forma', t => { t.partContent[parte].push({ id: 'pf', type: 'image', name: 'x (na forma)', path: 'Papéis/x.png', sha256: 'a'.repeat(64), aspect: 1, anchor: 'face', recortada: true, transform: { x: 0.5, y: 0.5, scale: 0.3, rotationDeg: 0 } } as never) }))
    confere('efeitos', () => tema('Preset', t => { t.textStyles = { NOME: { ...(t.textStyles?.NOME ?? {}), effects: [{ type: 'stroke', sizeMm: 0.5, color: '#ffffff', position: 'outside', enabled: true, opacity: 1 }] } as never } }))
    confere('logo', () => tema('Logo', t => { const e = (t.textStyles ??= {}); (e.NOME ??= {} as never); (e.NOME as unknown as { fundo: unknown }).fundo = { tipo: 'imagem', imagem: { path: 'Logos/l.png', aspect: 2, area: { x: 0.2, y: 0.3, w: 0.6, h: 0.4 } } } }))
    confere('frase', () => tema('Frase padrão', t => { t.sample = { ...t.sample, FRASE: 'A Pequena' } }, 'amostra:FRASE'))
    confere('texto nesta caixa', () => tema('Mover texto', t => { t.textSlotAdjust = { ...(t.textSlotAdjust ?? {}), [slot]: { dx: 0.1 } } }))
  })
  it('base: pranchetas e moldes', () => {
    const ab = useMaeDoc.getState().hist.atual.artboards[0].id
    confere('girar prancheta', () => base()('Girar prancheta', d => girarPrancheta(d as never, ab, { comMoldes: true })))
    confere('redimensionar', () => base()('Redimensionar', d => redimensionarPrancheta(d as never, ab, 148, 210)))
    confere('duplicar prancheta', () => base()('Duplicar', d => { duplicarPrancheta(d as never, ab) }))
    confere('mover molde', () => base()('Mover molde', d => { d.molds[0].transform.xMm += 10 }))
    confere('girar molde', () => base()('Girar molde', d => { d.molds[0].transform.rotationDeg = ((d.molds[0].transform.rotationDeg ?? 0) + 90) % 360 }))
  })
  it('controle deslizante: 2 gestos = 2 passos; rajada de setinhas = 1 passo; pausa = passo novo', () => {
    const op = (v: number, j: string) => tema('Opacidade', t => editarNaParte(t, elemento, { opacity: v }), j)
    const opa = () => (useMaeTema.getState().hist!.atual.partContent[parte].find(c => c.id === elemento) as { opacity?: number }).opacity
    passa(5000); op(0.9, 'op:1'); passa(10); op(0.8, 'op:1'); passa(10); op(0.7, 'op:1')
    passa(5000); op(0.5, 'op:2'); passa(10); op(0.4, 'op:2')
    desfazerGlobal(); expect(opa()).toBe(0.7)
    desfazerGlobal(); expect(opa()).toBeUndefined()
    // setinhas: mesma chave; rajada (< janela) = 1; pausa (> janela) = passo novo
    const seta = () => tema('Mover texto (setas)', t => { const a = ((t.textSlotAdjust ??= {})[slot] ??= {}); a.dx = Math.round(((a.dx ?? 0) + 0.005) * 1000) / 1000 }, `setas:${slot}`)
    const dx = () => useMaeTema.getState().hist!.atual.textSlotAdjust?.[slot]?.dx
    passa(5000); seta(); passa(100); seta(); passa(100); seta()
    passa(JANELA_JUNTAR_MS + 50); seta()
    expect(dx()).toBe(0.02)
    desfazerGlobal(); expect(dx()).toBe(0.015)
    desfazerGlobal(); expect(dx()).toBeUndefined()
  })
  it('a ordem entre base e tema é a ordem em que aconteceram; ação composta = 1 Ctrl+Z', () => {
    passa(5000); tema('T1', t => editarNaParte(t, elemento, { opacity: 0.3 }))
    passa(5000); base()('B1', d => { d.molds[0].transform.xMm += 5 })
    passa(5000); tema('T2', t => editarNaParte(t, elemento, { opacity: 0.6 }))
    const x0 = useMaeDoc.getState().hist.atual.molds[0].transform.xMm
    desfazerGlobal()   // T2
    expect((useMaeTema.getState().hist!.atual.partContent[parte].find(c => c.id === elemento) as { opacity?: number }).opacity).toBe(0.3)
    expect(useMaeDoc.getState().hist.atual.molds[0].transform.xMm).toBe(x0)
    desfazerGlobal()   // B1
    expect(useMaeDoc.getState().hist.atual.molds[0].transform.xMm).toBe(x0 - 5)
    // excluir texto no Tema: base (posição) + tema (ajuste) = 1 Ctrl+Z
    passa(5000); tema('Ajuste', t => { t.textSlotAdjust = { [slot]: { dx: 0.2 } } })
    const antes = foto()
    passa(5000)
    base()('Excluir NOME desta caixa', d => { d.textSlots = d.textSlots.filter(s => s.id !== slot) })
    tema('Excluir ajuste do texto', t => { delete t.textSlotAdjust?.[slot] })
    juntarUltimos(2)
    desfazerGlobal()
    expect(foto()).toBe(antes)
  })
})
