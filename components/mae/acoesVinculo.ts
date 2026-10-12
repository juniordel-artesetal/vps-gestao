'use client'
// Ações da base (Sprint 5) e do tema (Sprint 6) disparadas pela tela — sempre pelo histórico.
import type { Draft } from 'immer'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { atribuirFace, desatribuirFace, parteDaFace, acharFace } from '@/lib/mae/vinculo/partes'
import { colocarElemento, colocarNaFace, colocarPapel, editarNaParte, ajustarSoNaFace, acharCamadaTema, criarTransicao, ajustarTransicao, colocarCor, criarMoldura, type ArquivoImagem, liberarPapeisDasCaixas, duplicarCamadaTema, colarCamadaTema, removerCamadaTema } from '@/lib/mae/vinculo/tema'
import type { ParamsMoldura } from '@/lib/mae/vinculo/moldura'
import type { Transicao } from '@/lib/mae/vinculo/transicao'
import { quadroDaFace } from '@/lib/mae/vinculo/enquadramento'
import { aplicar, inversa } from '@/lib/mae/vinculo/matriz'
import { efetiva, ajustesDaFace, matrizDaCamada, posicaoEfetiva, type AjusteLocal, type Transf } from '@/lib/mae/vinculo/resolver'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'
import { arteDaFace } from '@/lib/mae/vinculo/cenario'
import { criarGrupoTema, desagruparTema, gruposDo, transformarGrupoNaFace, type OperacaoGrupo } from '@/lib/mae/vinculo/gruposTema'
import { comEscopo, useEditor, type Escopo } from './estado'
import { estiloDaVariavel } from '@/lib/mae/texto/noTexto'
import { copiarDeCamada, copiarDeTexto, colarEmCamada, colarEmTexto, categoriasCompativeis, type CategoriaEstilo } from '@/lib/mae/editor/estiloCopiado'

type Doc = DocTrabalho
const base = () => useMaeDoc.getState().hist.atual
const tema = () => useMaeTema.getState().hist?.atual ?? null
const aplicarBase = (label: string, f: (d: Draft<Doc>) => void, juntar?: string) => useMaeDoc.getState().aplicar(label, f, juntar)
const aplicarTema = (label: string, f: (t: Draft<DocTema>) => void, juntar?: string) => useMaeTema.getState().aplicar(label, f, juntar)
export const nomeDaParte = (partId: string | null | undefined) => base().parts.find(p => p.id === partId)?.name ?? 'PARTE'

// ── base: partes ─────────────────────────────────────────────────────────────────────────────────
/** Clique numa face no passo "Partes": marca na parte ativa (ou desmarca, se já era dela). */
export function alternarFaceNaParte(faceId: string) {
  const partId = useEditor.getState().parteAtiva
  if (!partId) return
  const atual = parteDaFace(base(), faceId)
  if (atual?.id === partId) aplicarBase(`Tirar face de ${nomeDaParte(partId)}`, d => desatribuirFace(d as Doc, faceId))
  else aplicarBase(`Face → ${nomeDaParte(partId)}`, d => atribuirFace(d as Doc, partId, faceId))
}
export function aceitarSugestoes(partId: string, faces: string[]) {
  if (faces.length) aplicarBase(`Aceitar ${faces.length} sugestões (${nomeDaParte(partId)})`, d => { for (const f of faces) atribuirFace(d as Doc, partId, f) })
}

/**
 * Lote 5 (item 69): onde a próxima ação da parte vai valer — para os botões dizerem ("em todas as 2 FRENTE" /
 * "só na MILK").
 */
export function useRotuloAlvo(partId: string | null | undefined): string {
  const escopo = useEditor(s => s.escopo), face = useEditor(s => s.face)
  const d = useMaeDoc(s => s.hist.atual)
  if (!partId) return ''
  const parte = d.parts.find(p => p.id === partId)
  if (escopo === 'face' && face && parteDaFace(d, face)?.id === partId) return `só na ${d.molds.find(m => m.faces.some(f => f.id === face))?.name ?? 'caixa'}`
  const n = parte?.instances.length ?? 0
  return n === 1 ? `na ${parte?.name ?? ''}` : `em todas as ${n} ${parte?.name ?? ''}`
}

// ── tema: arquivos soltos ────────────────────────────────────────────────────────────────────────
const ehPapel = (a: ArquivoImagem) => /^Papéis\//i.test(a.path)

/** Com "Só nesta caixa" escolhido, o que se solta vai só para a caixa de contexto (se for desta parte). */
function caixaDoEscopo(partId: string): string | null {
  const st = useEditor.getState()
  return st.escopo === 'face' && st.face && parteDaFace(base(), st.face)?.id === partId ? st.face : null
}

/**
 * Lote 3 (item 34): com VÁRIAS partes selecionadas (e a parte da ação entre elas), a ação vale para todas —
 * num passo só do Ctrl+Z. Cada parte recebe a sua própria camada (continua editável sozinha depois).
 */
export function partesMulti(partId: string): string[] | null {
  const s = useEditor.getState().partesSel
  return s.length > 1 && s.includes(partId) ? s : null
}
const nomesDas = (ids: string[]) => `${ids.length} partes`

/** Lote 4 (item 51): MÁSCARA DE CORTE — a camada passa a aparecer só dentro da camada de baixo (ou volta). */
export function alternarMascaraDeCorte(layerId: string): void {
  const t = useMaeTema.getState().hist?.atual
  if (!t) return
  const a = acharCamadaTema(t as DocTema, layerId)
  if (!a) return
  const ligada = !!(a.c as { recortada?: boolean }).recortada
  aplicarTema(ligada ? 'Soltar máscara de corte' : 'Criar máscara de corte', tt => {
    const x = acharCamadaTema(tt as DocTema, layerId)
    if (!x) return
    if (ligada) delete (x.c as { recortada?: boolean }).recortada
    else (x.c as { recortada?: boolean }).recortada = true
  })
}

/** Soltou um arquivo numa PARTE (miniatura do painel): papel preenche, elemento entra vinculado. */
export function soltarNaParte(partId: string, a: ArquivoImagem, empilhar = false) {
  const varias = partesMulti(partId)
  if (varias) {
    aplicarTema(ehPapel(a) ? `Papel em ${nomesDas(varias)}` : `Elemento em ${nomesDas(varias)}`, t => {
      let id = ''
      for (const p of varias) id = ehPapel(a) ? colocarPapel(t as DocTema, p, a, empilhar) : colocarElemento(t as DocTema, p, a)
      useEditor.getState().set({ camada: id })
    })
    return
  }
  const nome = nomeDaParte(partId)
  const caixa = caixaDoEscopo(partId)
  if (caixa) {
    aplicarTema(`Só nesta caixa: ${ehPapel(a) ? 'papel' : 'elemento'}`, t => {
      const id = colocarNaFace(t as DocTema, caixa, a, ehPapel(a) ? 'paper' : 'face', undefined, empilhar)
      useEditor.getState().set({ camada: id })
    })
    return
  }
  aplicarTema(ehPapel(a) ? `Papel em ${nome}` : `Elemento em ${nome}`, t => {
    const id = ehPapel(a) ? colocarPapel(t as DocTema, partId, a, empilhar) : colocarElemento(t as DocTema, partId, a)
    // Lote 6 (item 84): papel na PARTE preenche todas as faces dela (o papel "só desta caixa" saía por cima)
    if (ehPapel(a) && !empilhar) liberarPapeisDasCaixas(t as DocTema, base().parts.find(p => p.id === partId)?.instances.map(i => i.faceId) ?? [])
    useEditor.getState().set({ camada: id })
  })
}

/**
 * Soltou um arquivo numa FACE do palco: vai para a PARTE toda (todas as faces dela), a não ser com Alt
 * ou com "Só nesta caixa" escolhido — aí só para aquela face. Com Shift, o papel entra POR CIMA do que
 * já existe (para a transição com máscara) em vez de trocar o papel de fundo. Elemento entra onde foi solto.
 */
export function soltarNaFace(faceClicada: string, pontoMolde: Pt | null, a: ArquivoImagem, alt: boolean, empilhar = false) {
  if (useEditor.getState().escopo === 'face') alt = true
  const d = base()
  const af = acharFace(d, faceClicada)
  // Lote 9 (item 136): no cenário contínuo o elemento vai para a face LÍDER (onde a arte é desenhada) e a posição é
  // a do quadro das faces juntas — antes ia para a face clicada, numa lista que nunca era desenhada ("sumiu")
  const arte = af ? arteDaFace(d, tema(), af.molde, faceClicada) : null
  const faceId = arte?.faceArte ?? faceClicada
  const parte = parteDaFace(d, faceId)
  let pos: { x: number; y: number } | undefined
  if (af && parte && pontoMolde) {
    const q = arte?.quadro ?? quadroDaFace(af.face.polygonMm as Pt[], parte.instances.find(i => i.faceId === faceId)?.fit, parte.referenceAspect ?? 1)
    const [u, v] = aplicar(inversa(q.face), pontoMolde[0], pontoMolde[1])
    pos = { x: Math.round(u * 1000) / 1000, y: Math.round(v * 1000) / 1000 }
  }
  // Lote 4 (item 34): com várias partes selecionadas (e esta entre elas), o arquivo vai para todas num passo só
  if (!alt && parte && partesMulti(parte.id)) { soltarNaParte(parte.id, a, empilhar); return true }
  if (!alt && parte) {
    aplicarTema(ehPapel(a) ? `Papel em ${parte.name}` : `Elemento em ${parte.name}`, t => {
      const id = ehPapel(a) ? colocarPapel(t as DocTema, parte.id, a, empilhar) : colocarElemento(t as DocTema, parte.id, a, pos)
      useEditor.getState().set({ camada: id, face: faceId })
    })
    return true
  }
  aplicarTema(`Só nesta caixa: ${ehPapel(a) ? 'papel' : 'elemento'}`, t => {
    const id = colocarNaFace(t as DocTema, faceId, a, ehPapel(a) ? 'paper' : 'face', pos, empilhar)
    useEditor.getState().set({ camada: id, face: faceId })
  })
  return true
}

// ── tema: TRANSIÇÃO de papéis (Lote 1, item 5) ──────────────────────────────────────────────────────
/**
 * Cria a transição: o 2º papel entra por cima, com a máscara em degradê. Respeita "Todas × Só nesta caixa"
 * (com uma caixa desta parte clicada, pergunta — ou usa a escolha lembrada).
 */
export function criarTransicaoNaParte(partId: string, a: ArquivoImagem, tr: Transicao) {
  const varias = partesMulti(partId)
  if (varias) { aplicarTema(`Transição em ${nomesDas(varias)}`, t => { for (const p of varias) criarTransicao(t as DocTema, { partId: p }, a, tr) }); return }
  const face = useEditor.getState().face
  const daParte = !!face && parteDaFace(base(), face)?.id === partId
  comEscopo(nomeDaParte(partId), e => {
    const caixa = e === 'face' && daParte ? face! : null
    aplicarTema(caixa ? 'Transição (só nesta caixa)' : `Transição em ${nomeDaParte(partId)}`, t => {
      const id = criarTransicao(t as DocTema, caixa ? { faceId: caixa } : { partId }, a, tr)
      useEditor.getState().set({ camada: id })
    })
  }, daParte ? undefined : 'parte')
}
/** Alvo de um conteúdo NOVO da parte: a caixa clicada (Só nesta caixa — pergunta se precisar) ou a parte. */
function comAlvo(partId: string, f: (alvo: { partId: string } | { faceId: string }) => void) {
  const face = useEditor.getState().face
  const daParte = !!face && parteDaFace(base(), face)?.id === partId
  comEscopo(nomeDaParte(partId), e => f(e === 'face' && daParte ? { faceId: face! } : { partId }), daParte ? undefined : 'parte')
}

/** COR como preenchimento da parte (item 7): troca o papel de fundo pela cor — ou só na caixa. */
export function aplicarCorNaParte(partId: string, cor: string, empilhar = false) {
  const varias = partesMulti(partId)
  if (varias) { aplicarTema(`Cor ${cor} em ${nomesDas(varias)}`, t => { for (const p of varias) colocarCor(t as DocTema, { partId: p }, cor, empilhar) }); return }
  comAlvo(partId, alvo => aplicarTema('faceId' in alvo ? `Cor ${cor} (só nesta caixa)` : `Cor ${cor} em ${nomeDaParte(partId)}`, t => {
    const id = colocarCor(t as DocTema, alvo, cor, empilhar)
    useEditor.getState().set({ camada: id })
  }))
}

/** MOLDURINHA (item 6): na parte toda ou só na caixa. */
export function criarMolduraNaParte(partId: string, p: ParamsMoldura, nome?: string) {
  const varias = partesMulti(partId)
  if (varias) { aplicarTema(`Moldurinha em ${nomesDas(varias)}`, t => { for (const q of varias) criarMoldura(t as DocTema, { partId: q }, p, nome) }); return }
  comAlvo(partId, alvo => aplicarTema('faceId' in alvo ? 'Moldurinha (só nesta caixa)' : `Moldurinha em ${nomeDaParte(partId)}`, t => {
    const id = criarMoldura(t as DocTema, alvo, p, nome)
    useEditor.getState().set({ camada: id })
  }))
}

/** Direção/posição/suavidade da transição selecionada (deslizar junta num passo só de desfazer). */
export function mudarTransicao(layerId: string, tr: Partial<Transicao>, juntar?: string) {
  aplicarTema('Ajustar transição', t => ajustarTransicao(t as DocTema, layerId, tr), juntar)
}

// ── tema: editar camada (Todas × Só nesta caixa) ─────────────────────────────────────────────────
export interface MudancaCamada { transform?: Partial<Transf>; visible?: boolean; path?: string; sha256?: string; aspect?: number; repeat?: AjusteLocal['repeat']; opacity?: number }

/**
 * Edita a camada selecionada. Camada exclusiva da face = edita direto. Camada vinculada com uma face de
 * contexto: pergunta "Todas as FRENTES" ou "Só nesta caixa" (ou usa a escolha lembrada / forçada).
 */
export function editarCamadaTema(layerId: string, m: MudancaCamada, label: string, juntar?: string, forcar?: Escopo) {
  const t = tema()
  if (!t) return
  const a = acharCamadaTema(t, layerId)
  if (!a) return
  if (a.faceId) { aplicarTema(label, tt => editarNaParte(tt as DocTema, layerId, m), juntar); return }
  const face = useEditor.getState().face
  // face de contexto de OUTRA parte não conta: a edição vale para a parte toda
  const daParte = !!face && parteDaFace(base(), face)?.id === a.partId
  comEscopo(nomeDaParte(a.partId), e => {
    if (e === 'face' && face) aplicarTema(`${label} (só nesta caixa)`, tt => ajustarSoNaFace(tt as DocTema, face, layerId, m as AjusteLocal), juntar ? `${juntar}:f` : undefined)
    else aplicarTema(`${label} (todas: ${nomeDaParte(a.partId)})`, tt => editarNaParte(tt as DocTema, layerId, m), juntar ? `${juntar}:p` : undefined)
  }, daParte ? forcar : 'parte')
}

/** Lote 3 (item 34): opacidade de TODAS as camadas das partes selecionadas (deslizar = um passo só). */
export function opacidadeNasPartes(ids: string[], v: number, juntar?: string) {
  aplicarTema(`Opacidade em ${nomesDas(ids)}`, t => {
    for (const p of ids) for (const c of (t as DocTema).partContent[p] ?? []) { if (v >= 0.995) delete (c as { opacity?: number }).opacity; else (c as { opacity?: number }).opacity = Math.round(v * 100) / 100 }
  }, juntar)
}
/**
 * Lote 3 (item 34): os ESTILOS da camada selecionada vão para as camadas do mesmo tipo (papel, elemento, cor,
 * moldura) das outras partes selecionadas. Cada uma continua editável sozinha.
 */
export function copiarEstilosParaPartes(layerId: string, ids: string[]): number {
  const t0 = tema(); if (!t0) return 0
  const a = acharCamadaTema(t0, layerId); if (!a) return 0
  const tipo = (c: { type: string; anchor?: string }) => `${c.type}:${c.type === 'image' ? (c.anchor ?? 'face') : ''}`
  const alvo = tipo(a.c as never), efs = JSON.parse(JSON.stringify(a.c.effects ?? []))
  let n = 0
  aplicarTema(`Estilos em ${nomesDas(ids)}`, t => {
    for (const p of ids) for (const c of (t as DocTema).partContent[p] ?? []) {
      if (c.id === layerId || tipo(c as never) !== alvo) continue
      if (efs.length) (c as { effects?: unknown[] }).effects = JSON.parse(JSON.stringify(efs)); else delete (c as { effects?: unknown[] }).effects
      n++
    }
  })
  return n
}

// ── Lote 9 (itens 137, 138, 148): duplicar, espelhar, copiar/recortar/colar a camada do tema ────────────────────
const travada = (id: string): boolean => {
  const t = tema(); const a = t ? acharCamadaTema(t, id) : null
  if ((a?.c as { locked?: boolean } | undefined)?.locked) { alert('Item travado — destrave para editar.'); return true }
  return false
}

/** Duplica a camada (Ctrl+J, botão direito, painel): a cópia aparece logo acima, deslocada, já selecionada. */
export function duplicarCamada(id: string, desloc = 0.04): string | null {
  let novo: string | null = null
  aplicarTema('Duplicar camada', t => { novo = duplicarCamadaTema(t as DocTema, id, desloc) })
  if (novo) useEditor.getState().set({ camada: novo, slot: null })
  return novo
}

/** Espelha (Shift+H / Shift+V): lê o espelho EFETIVO (com o "só nesta caixa") e grava no mesmo escopo dos outros
 *  controles da direita — com caixa clicada, só nela. Antes lia o valor cru e o 2º clique não desfazia. */
export function espelharCamada(id: string, eixo: 'x' | 'y') {
  const t = tema(); if (!t || travada(id)) return
  const a = acharCamadaTema(t, id); if (!a) return
  const face = useEditor.getState().face
  const ef = a.faceId || !face ? a.c : efetiva(a.c, ajustesDaFace(t, face)[id])
  const tr = (ef as { transform?: { flipX?: boolean; flipY?: boolean } }).transform ?? {}
  const atual = eixo === 'x' ? !!tr.flipX : !!tr.flipY
  editarCamadaTema(id, { transform: eixo === 'x' ? { flipX: !atual } : { flipY: !atual } }, eixo === 'x' ? 'Espelhar ↔' : 'Espelhar ↕', undefined, face && !a.faceId ? 'face' : 'parte')
}

/** Ctrl+C: guarda a camada (e o ajuste "só nesta caixa" dela, se a caixa estiver clicada). */
export function copiarCamada(id: string): boolean {
  const t = tema(); const a = t ? acharCamadaTema(t, id) : null
  if (!t || !a) return false
  const face = useEditor.getState().face
  const aj = face ? ajustesDaFace(t, face)[id] ?? null : null
  useEditor.getState().set({ areaCamada: { camada: JSON.parse(JSON.stringify(a.c)), ajuste: aj ? JSON.parse(JSON.stringify(aj)) : null, parte: a.partId ?? (a.faceId ? parteDaFace(base(), a.faceId)?.id ?? null : null) } })
  return true
}

/** Ctrl+X: copia e exclui. */
export function recortarCamada(id: string): boolean {
  if (travada(id) || !copiarCamada(id)) return false
  aplicarTema('Recortar camada', t => removerCamadaTema(t as DocTema, id))
  useEditor.getState().set({ camada: null })
  return true
}

/** Ctrl+V: cola na parte da caixa clicada (ou na parte ativa), na mesma posição; com caixa clicada, o ajuste "só
 *  nesta caixa" copiado vai para ela. */
export function colarCamada(): string | null {
  const ed = useEditor.getState(), area = ed.areaCamada
  if (!area) return null
  const d = base()
  // destino: a parte da caixa clicada → a parte de onde a camada foi copiada → a parte ativa
  const parte = (ed.face ? parteDaFace(d, ed.face) : null) ?? d.parts.find(p => p.id === area.parte) ?? d.parts.find(p => p.id === ed.parteAtiva) ?? null
  if (!parte) return null
  let novo: string | null = null
  aplicarTema('Colar camada', t => { novo = colarCamadaTema(t as DocTema, parte.id, area.camada as never, ed.face && area.ajuste ? { faceId: ed.face, aj: area.ajuste } : null) })
  if (novo) ed.set({ camada: novo, slot: null, parteAtiva: parte.id })
  return novo
}

/** Lote 9 (item 148): Ctrl+/ — trava/destrava a camada (ou o texto) selecionado. */
export function alternarCadeado(sel: { camada?: string | null; slot?: string | null }) {
  if (sel.camada) {
    aplicarTema('Travar / destravar camada', t => { const a = acharCamadaTema(t as DocTema, sel.camada!); if (!a) return; const x = a.c as { locked?: boolean }; if (x.locked) delete x.locked; else x.locked = true })
  } else if (sel.slot) {
    const id = sel.slot
    aplicarTema('Travar / destravar texto', t => { const aj = (((t as DocTema).textSlotAdjust ??= {})[id] ??= {}) as { locked?: boolean }; if (aj.locked) delete aj.locked; else aj.locked = true })
  }
}

/** Lote 9 (item 148): Ctrl+, — oculta/mostra a camada (no mesmo escopo do olho do painel) ou o texto selecionado. */
export function alternarOlho(sel: { camada?: string | null; slot?: string | null }) {
  const t = tema(); if (!t) return
  if (sel.camada) {
    const a = acharCamadaTema(t, sel.camada); if (!a) return
    const face = useEditor.getState().face
    const ef = a.faceId || !face ? a.c : efetiva(a.c, ajustesDaFace(t, face)[sel.camada])
    const oculto = (ef as { visible?: boolean }).visible === false
    editarCamadaTema(sel.camada, { visible: oculto }, oculto ? 'Mostrar' : 'Ocultar', undefined, face && !a.faceId ? 'face' : 'parte')
  } else if (sel.slot) {
    const id = sel.slot
    aplicarTema('Ocultar / mostrar texto', tt => { const aj = (((tt as DocTema).textSlotAdjust ??= {})[id] ??= {}) as { hidden?: boolean }; if (aj.hidden) delete aj.hidden; else aj.hidden = true })
  }
}

// ── Lote 9 (item 145): COPIAR E COLAR ESTILO ─────────────────────────────────────────────────────────────────────
/** Altura (mm) da camada desenhada — na caixa clicada, ou na 1ª caixa da parte. Base para ajustar os efeitos. */
function alturaDaCamada(t: DocTema, id: string): number | null {
  const d = base(), a = acharCamadaTema(t, id); if (!a) return null
  const face = a.faceId ?? (useEditor.getState().face && parteDaFace(d, useEditor.getState().face!)?.id === a.partId ? useEditor.getState().face : null) ?? d.parts.find(p => p.id === a.partId)?.instances[0]?.faceId
  if (!face) return null
  const af = acharFace(d, face); if (!af) return null
  const arte = arteDaFace(d, t, af.molde, face); if (!arte) return null
  const M = matrizDaCamada(efetiva(a.c, a.faceId ? undefined : ajustesDaFace(t, arte.faceArte)[id]) as never, arte.quadro, arte.A)
  return Math.hypot(M[2], M[3]) || null
}
/** Altura (mm) da caixa do texto. */
function alturaDoTexto(t: DocTema, slotId: string): number | null {
  const d = base(), s = d.textSlots.find(x => x.id === slotId); if (!s) return null
  const af = acharFace(d, s.faceId); if (!af) return null
  const parte = d.parts.find(p => p.instances.some(i => i.faceId === s.faceId))
  const q = quadroDaFace(af.face.polygonMm as Pt[], parte?.instances.find(i => i.faceId === s.faceId)?.fit, parte?.referenceAspect ?? 1)
  const b = posicaoEfetiva(s, t).caixa
  const p0 = aplicar(q.face, b.x, b.y), p1 = aplicar(q.face, b.x, b.y + b.h)
  return Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || null
}
type Alvo = { tipo: 'camada' | 'texto'; id: string }
/** Os objetos selecionados (o principal + os somados com Shift/Ctrl + clique; o grupo selecionado = os membros dele). */
function selecionados(): Alvo[] {
  const ed = useEditor.getState(), t = tema(), out: Alvo[] = [...ed.multiSel]
  if (ed.camada && !out.some(x => x.tipo === 'camada' && x.id === ed.camada)) out.unshift({ tipo: 'camada', id: ed.camada })
  if (ed.slot && !out.some(x => x.tipo === 'texto' && x.id === ed.slot)) out.unshift({ tipo: 'texto', id: ed.slot })
  if (!out.length && ed.grupoSel && t) {
    const g = gruposDo(t).find(x => x.id === ed.grupoSel)
    if (g) {
      out.push(...g.camadas.map(id => ({ tipo: 'camada' as const, id })))
      const d = base(), faces = new Set(d.parts.find(p => p.id === g.parte)?.instances.map(i => i.faceId) ?? [])
      const s = d.textSlots.find(x => g.textos.includes(x.variable) && (ed.face ? x.faceId === ed.face : faces.has(x.faceId)))
      if (s) out.push({ tipo: 'texto', id: s.id })
    }
  }
  return out
}
/** Ctrl+Alt+C: copia TUDO o que foi aplicado no objeto selecionado (o de cima, se houver vários). */
export function copiarEstilo(): boolean {
  const t = tema(), alvo = selecionados()[0]
  if (!t || !alvo) return false
  if (alvo.tipo === 'camada') {
    const a = acharCamadaTema(t, alvo.id); if (!a) return false
    const face = useEditor.getState().face
    const c = a.faceId || !face ? a.c : efetiva(a.c, ajustesDaFace(t, face)[alvo.id])
    useEditor.getState().set({ estiloCopiado: copiarDeCamada(c as never, alturaDaCamada(t, alvo.id)) })
  } else {
    const s = base().textSlots.find(x => x.id === alvo.id); if (!s) return false
    useEditor.getState().set({ estiloCopiado: copiarDeTexto(estiloDaVariavel(t.textStyles, s.variable), alturaDoTexto(t, alvo.id)) })
  }
  return true
}
/** O que dá para colar nos selecionados (para a janela "Colar estilo…"). */
export function categoriasParaColar(): CategoriaEstilo[] {
  const e = useEditor.getState().estiloCopiado, t = tema()
  if (!e || !t) return []
  const todas = new Set<CategoriaEstilo>()
  for (const a of selecionados()) {
    const tipo = a.tipo === 'camada' ? acharCamadaTema(t, a.id)?.c.type : undefined
    for (const c of categoriasCompativeis(e, a.tipo, tipo)) todas.add(c)
  }
  return [...todas]
}
/** Ctrl+Alt+V: cola o estilo (tudo o que for compatível, ou só as categorias escolhidas) em todos os selecionados.
 *  Um passo só no Ctrl+Z. Os efeitos se ajustam ao tamanho de cada destino. Item travado fica de fora. */
export function colarEstilo(cats: CategoriaEstilo[] = ['efeitos', 'texto', 'preenchimento', 'opacidade', 'tamanho']): number {
  const e = useEditor.getState().estiloCopiado, t0 = tema()
  if (!e || !t0) return 0
  const d = base(), alvos = selecionados()
  const alturas = new Map(alvos.map(a => [a.id, a.tipo === 'camada' ? alturaDaCamada(t0, a.id) : alturaDoTexto(t0, a.id)]))
  let n = 0
  aplicarTema(alvos.length > 1 ? `Colar estilo em ${alvos.length} itens` : 'Colar estilo', tt => {
    const t = tt as DocTema
    const variaveis = new Set<string>()
    for (const a of alvos) {
      if (a.tipo === 'camada') {
        const x = acharCamadaTema(t, a.id); if (!x || (x.c as { locked?: boolean }).locked) continue
        colarEmCamada(x.c as never, e, cats, alturas.get(a.id) ?? null); n++
      } else {
        const s = d.textSlots.find(y => y.id === a.id); if (!s || variaveis.has(s.variable)) continue
        if ((t.textSlotAdjust?.[s.id] as { locked?: boolean } | undefined)?.locked) continue
        variaveis.add(s.variable)
        // o estilo é da VARIÁVEL (vale em todas as caixas); se ela herdava, ganha o seu agora
        const st = (t.textStyles[s.variable] ??= JSON.parse(JSON.stringify(estiloDaVariavel(t.textStyles, s.variable))))
        colarEmTexto(st as never, e, cats, alturas.get(a.id) ?? null); n++
      }
    }
  })
  return n
}

// ── Lote 9 (item 142): GRUPOS no tema ─────────────────────────────────────────────────────────────────────────────
/** Ctrl+G: agrupa a seleção (o item selecionado + os somados com Shift/Ctrl + clique). Precisa de 2 ou mais. */
export function agruparSelecao(): string | null {
  const ed = useEditor.getState(), t = tema(), d = base()
  if (!t) return null
  const itens = [...ed.multiSel]
  if (ed.camada && !itens.some(i => i.tipo === 'camada' && i.id === ed.camada)) itens.push({ tipo: 'camada', id: ed.camada })
  if (ed.slot && !itens.some(i => i.tipo === 'texto' && i.id === ed.slot)) itens.push({ tipo: 'texto', id: ed.slot })
  if (itens.length < 2) { alert('Selecione 2 ou mais itens para agrupar (Shift + clique na arte, ou Ctrl + clique no Camadas).'); return null }
  const camadas = itens.filter(i => i.tipo === 'camada').map(i => i.id)
  const textos = [...new Set(itens.filter(i => i.tipo === 'texto').map(i => d.textSlots.find(s => s.id === i.id)?.variable).filter((v): v is string => !!v))]
  // a parte do grupo: a da 1ª camada (ou a da caixa do texto)
  const c0 = camadas.length ? acharCamadaTema(t, camadas[0]) : null
  const s0 = itens.find(i => i.tipo === 'texto') ? d.textSlots.find(s => s.id === itens.find(i => i.tipo === 'texto')!.id) : null
  const parte = c0?.partId ?? (c0?.faceId ? parteDaFace(d, c0.faceId)?.id : null) ?? (s0 ? parteDaFace(d, s0.faceId)?.id : null) ?? (ed.face ? parteDaFace(d, ed.face)?.id : null)
  if (!parte) return null
  let id: string | null = null
  aplicarTema('Agrupar', tt => { id = criarGrupoTema(tt as DocTema, { parte, camadas, textos }) })
  ed.set({ grupoSel: id, multiSel: [], camada: null, slot: null })
  return id
}
/** Ctrl+Shift+G: desagrupa o grupo selecionado. */
export function desagruparSelecionado() {
  const id = useEditor.getState().grupoSel
  if (!id) return
  aplicarTema('Desagrupar', tt => desagruparTema(tt as DocTema, id))
  useEditor.getState().set({ grupoSel: null })
}
/** Move/gira/redimensiona o grupo selecionado na caixa clicada (um passo no Ctrl+Z). */
export function transformarGrupoSelecionado(op: OperacaoGrupo, label: string, valores: Record<string, string> = {}) {
  const ed = useEditor.getState(), t = tema(), d = base()
  const g = gruposDo(t).find(x => x.id === ed.grupoSel)
  if (!t || !g || !ed.face) return
  if (g.locked) { alert('Grupo travado — destrave para editar.'); return }
  const af = acharFace(d, ed.face); if (!af) return
  aplicarTema(label, tt => { const gg = gruposDo(tt as DocTema).find(x => x.id === g.id); if (gg) transformarGrupoNaFace(d, tt as DocTema, gg, af.molde, ed.face!, op, valores) })
}
/** Olho e cadeado da pasta (grupo). */
export function alternarGrupo(id: string, campo: 'visible' | 'locked') {
  aplicarTema(campo === 'visible' ? 'Ocultar / mostrar grupo' : 'Travar / destravar grupo', tt => {
    const g = gruposDo(tt as DocTema).find(x => x.id === id); if (!g) return
    if (campo === 'visible') { if (g.visible === false) delete g.visible; else g.visible = false }
    else { if (g.locked) delete g.locked; else g.locked = true }
  })
}
/** Delete com o grupo selecionado: exclui as camadas dele (os textos são da base — ficam) e desfaz o grupo. */
export function excluirGrupo(id: string) {
  const g = gruposDo(tema()).find(x => x.id === id)
  if (!g) return
  if (g.locked) { alert('Grupo travado — destrave para editar.'); return }
  aplicarTema('Excluir grupo', tt => { for (const c of g.camadas) removerCamadaTema(tt as DocTema, c); desagruparTema(tt as DocTema, id) })
  useEditor.getState().set({ grupoSel: null })
}
/** Shift + clique / Ctrl + clique: soma (ou tira) um item da seleção para agrupar. */
export function alternarNaSelecao(item: { tipo: 'camada' | 'texto'; id: string }) {
  const ed = useEditor.getState()
  const atual = [...ed.multiSel]
  // o selecionado de agora entra na lista (o próximo clique soma a ele)
  if (ed.camada && !atual.some(i => i.tipo === 'camada' && i.id === ed.camada)) atual.push({ tipo: 'camada', id: ed.camada })
  if (ed.slot && !atual.some(i => i.tipo === 'texto' && i.id === ed.slot)) atual.push({ tipo: 'texto', id: ed.slot })
  const i = atual.findIndex(x => x.tipo === item.tipo && x.id === item.id)
  if (i >= 0) atual.splice(i, 1); else atual.push(item)
  ed.set({ multiSel: atual, grupoSel: null })
}
