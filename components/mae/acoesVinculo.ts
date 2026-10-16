'use client'
// Ações da base (Sprint 5) e do tema (Sprint 6) disparadas pela tela — sempre pelo histórico.
import type { Draft } from 'immer'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { atribuirFace, desatribuirFace, parteDaFace, acharFace } from '@/lib/mae/vinculo/partes'
import { colocarElemento, colocarNaFace, colocarPapel, editarNaParte, ajustarSoNaFace, acharCamadaTema, criarTransicao, criarTransicaoCor, criarTransicaoElemento, ajustarTransicao, colocarCor, criarMoldura, type ArquivoImagem, liberarPapeisDasCaixas, duplicarCamadaTema, colarCamadaTema, removerCamadaTema } from '@/lib/mae/vinculo/tema'
import type { ParamsMoldura } from '@/lib/mae/vinculo/moldura'
import type { Transicao } from '@/lib/mae/vinculo/transicao'
import { quadroDaFace } from '@/lib/mae/vinculo/enquadramento'
import { aplicar, inversa } from '@/lib/mae/vinculo/matriz'
import { ehAplique, efetiva, ajustesDaFace, matrizDaCamada, posicaoEfetiva, type AjusteLocal, type Transf } from '@/lib/mae/vinculo/resolver'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'
import { arteDaFace } from '@/lib/mae/vinculo/cenario'
import { criarGrupoTema, desagruparTema, gruposDo, transformarGrupoNaFace, membrosNaFace, type OperacaoGrupo, type GrupoTema } from '@/lib/mae/vinculo/gruposTema'
import { comEscopo, useEditor, type Escopo } from './estado'
import { reordenarNaFace, idsNaOrdem } from '@/lib/mae/vinculo/pilha'
import type { TipoObjeto } from '@/lib/mae/editor/atalhos'
import { duplicarPosicao } from '@/lib/mae/editor/textosReplicar'
import { juntarUltimos } from '@/lib/mae/editor/linhaDoTempo'
import { estiloDaVariavel } from '@/lib/mae/texto/noTexto'
import { copiarDeCamada, copiarDeTexto, colarEmCamada, colarEmTexto, categoriasCompativeis, type CategoriaEstilo } from '@/lib/mae/editor/estiloCopiado'
import { docVisivel, temaAbertoId, idsDosTextos } from './textosDoTemaUi'
import { marcarDono } from '@/lib/mae/vinculo/textosDoTema'

type Doc = DocTrabalho
// Lote 18 (itens 215/222): a leitura vê só os textos que valem no tema aberto
const base = () => docVisivel()
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
/** Lote 21 (item 250): transição com COR (ou cor para cor) e com ELEMENTO — mesmas regras da de papel (várias partes,
 *  Só nesta caixa). */
export function criarTransicaoCorNaParte(partId: string, cor: string, tr: Transicao, corDeBaixo?: string) {
  const varias = partesMulti(partId)
  if (varias) { aplicarTema(`Transição de cor em ${nomesDas(varias)}`, t => { for (const p of varias) criarTransicaoCor(t as DocTema, { partId: p }, cor, tr, corDeBaixo) }); return }
  const face = useEditor.getState().face
  const daParte = !!face && parteDaFace(base(), face)?.id === partId
  comEscopo(nomeDaParte(partId), e => {
    const caixa = e === 'face' && daParte ? face! : null
    aplicarTema(caixa ? 'Transição de cor (só nesta caixa)' : `Transição de cor em ${nomeDaParte(partId)}`, t => {
      const id = criarTransicaoCor(t as DocTema, caixa ? { faceId: caixa } : { partId }, cor, tr, corDeBaixo)
      useEditor.getState().set({ camada: id })
    })
  }, daParte ? undefined : 'parte')
}
export function criarTransicaoElementoNaParte(partId: string, a: ArquivoImagem, tr: Transicao) {
  const A = (p: string) => base().parts.find(x => x.id === p)?.referenceAspect ?? 1
  const varias = partesMulti(partId)
  if (varias) { aplicarTema(`Transição com elemento em ${nomesDas(varias)}`, t => { for (const p of varias) criarTransicaoElemento(t as DocTema, { partId: p }, a, tr, A(p)) }); return }
  const face = useEditor.getState().face
  const daParte = !!face && parteDaFace(base(), face)?.id === partId
  comEscopo(nomeDaParte(partId), e => {
    const caixa = e === 'face' && daParte ? face! : null
    aplicarTema(caixa ? 'Transição com elemento (só nesta caixa)' : `Transição com elemento em ${nomeDaParte(partId)}`, t => {
      const id = criarTransicaoElemento(t as DocTema, caixa ? { faceId: caixa } : { partId }, a, tr, A(partId))
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
export function criarMolduraNaParte(partId: string, p: ParamsMoldura, nome?: string, extras?: { effects?: unknown[]; porFace?: boolean }) {
  const varias = partesMulti(partId)
  if (varias) { aplicarTema(`Moldurinha em ${nomesDas(varias)}`, t => { for (const q of varias) criarMoldura(t as DocTema, { partId: q }, p, nome, extras) }); return }
  comAlvo(partId, alvo => aplicarTema('faceId' in alvo ? 'Moldurinha (só nesta caixa)' : `Moldurinha em ${nomeDaParte(partId)}`, t => {
    const id = criarMoldura(t as DocTema, alvo, p, nome, extras)
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

// ── Lote 10 (item 155): MÁSCARA com a forma da face ─────────────────────────────────────────────────────────────
/** "Usar a forma da face": a camada só aparece dentro do contorno da caixa clicada (vale também no aplique 3D: a
 *  impressão, a bordinha e a silhueta seguem o recorte). "Remover máscara" volta ao original — nada se perde. */
export function mascaraDaFace(layerId: string): boolean {
  const t = tema(), d = base(), ed = useEditor.getState()
  if (!t || travada(layerId)) return false
  const a = acharCamadaTema(t, layerId); if (!a) return false
  const faceId = a.faceId ?? ed.face ?? d.parts.find(p => p.id === a.partId)?.instances[0]?.faceId
  if (!faceId) return false
  const af = acharFace(d, faceId); if (!af) return false
  const arte = arteDaFace(d, t, af.molde, faceId); if (!arte) return false
  const c = a.faceId ? a.c : efetiva(a.c, ajustesDaFace(t, arte.faceArte)[layerId])
  const inv = inversa(matrizDaCamada(c as never, arte.quadro, arte.A))
  const anel = (af.face.polygonMm as Pt[]).map(([x, y]) => { const [u, v] = aplicar(inv, x, y); return [Math.round(u * 1e4) / 1e4, Math.round(v * 1e4) / 1e4] as [number, number] })
  aplicarTema('Máscara: forma da face', tt => {
    const x = acharCamadaTema(tt as DocTema, layerId); if (!x) return
    const cc = x.c as { mask?: Record<string, unknown> }
    cc.mask = { enabled: true, invert: false, featherMm: 0, ...(cc.mask ?? {}), forma: { aneis: [anel] } }
  })
  return true
}

// ── Lote 10 (item 153): o TIPO do objeto selecionado (para a tabela de capacidade dos atalhos e do menu) ──────────
export function tipoDaCamada(t: DocTema | null, c: { type: string; anchor?: string }): TipoObjeto {
  if (c.type === 'frame') return 'moldurinha'
  if (c.type === 'solid') return 'cor'
  if (c.type === 'shape') return ehAplique(t, c as never) ? 'aplique' : 'forma'
  if (c.type === 'conjunto') return 'aplique'
  if (c.type === 'image') return (c.anchor ?? 'face') === 'paper' ? 'papel' : ehAplique(t, c as never) ? 'aplique' : 'elemento'
  return 'elemento'
}
export function tipoSelecionado(): TipoObjeto | null {
  const ed = useEditor.getState(), t = tema()
  if (!t) return null
  if (ed.grupoSel) return 'grupo'
  if (ed.camada) { const a = acharCamadaTema(t, ed.camada); return a ? tipoDaCamada(t, a.c) : null }
  if (ed.slot) return 'texto'
  return null
}

// ── Lote 10 (itens 151/152): ORDEM na caixa (entre listas e com textos) e DUPLICAR TEXTO ────────────────────────
/** As caixas de um item (camada da parte → todas as caixas dela; só desta caixa → ela; `t:<slot>` → a do texto). */
function facesDoItem(id: string): string[] {
  const d = base(), t = tema(); if (!t) return []
  if (id.startsWith('t:')) { const s = d.textSlots.find(x => x.id === id.slice(2)); return s ? [s.faceId] : [] }
  const a = acharCamadaTema(t, id); if (!a) return []
  if (a.faceId) return [a.faceId]
  return d.parts.find(p => p.id === a.partId)?.instances.map(i => i.faceId) ?? []
}
const itemTravado = (id: string): boolean => {
  if (!id.startsWith('t:')) return travada(id)
  if (tema()?.textSlotAdjust?.[id.slice(2)]?.locked) { alert('Item travado — destrave para editar.'); return true }
  return false
}
/**
 * Frente / trás / topo / fundo (menu, Ctrl+] / Ctrl+[). `id` = camada ou `t:<slot>`. Com a caixa clicada vale SÓ nela;
 * sem caixa, em todas as caixas da parte (como o resto do painel). Um passo no Ctrl+Z.
 */
export function reordenar(id: string, para: 'frente' | 'tras' | 'topo' | 'fundo', label: string): boolean {
  const t = tema(); if (!t || itemTravado(id)) return false
  const ed = useEditor.getState(), d = base()
  const faces = ed.face ? [ed.face] : facesDoItem(id)
  let mudou = false
  aplicarTema(label, tt => { for (const f of faces) if (reordenarNaFace(d, tt as DocTema, f, id, para)) mudou = true })
  return mudou
}
/** Arrastar em Camadas: põe `de` na posição de `alvo` (na caixa do painel; sem caixa, em todas as da parte). */
export function soltarNaOrdem(de: string, alvo: string, faceId: string | null): void {
  if (de === alvo || !tema() || itemTravado(de)) return
  const d = base()
  const faces = faceId ? [faceId] : facesDoItem(alvo)
  aplicarTema('Ordem das camadas', tt => {
    for (const f of faces) { const { ids } = idsNaOrdem(d, tt as DocTema, f); const j = ids.indexOf(alvo); if (j >= 0) reordenarNaFace(d, tt as DocTema, f, de, j) }
  })
}
/** Ctrl+J / menu num TEXTO do tema: nova posição na mesma caixa (um pouco abaixo) com os ajustes da original. */
export function duplicarTexto(slotId: string): string | null {
  const t = tema(); if (!t || itemTravado(`t:${slotId}`)) return null
  let id: string | null = null
  const antes = idsDosTextos(), dono = temaAbertoId()
  useMaeDoc.getState().aplicar('Duplicar texto', x => { id = duplicarPosicao(x as never, slotId); marcarDono(x as never, antes, dono) })
  if (!id) return null
  const aj = t.textSlotAdjust?.[slotId]
  if (aj) {
    aplicarTema('Duplicar texto (ajustes)', tt => { const c = JSON.parse(JSON.stringify(aj)) as { locked?: boolean }; delete c.locked; ((tt as DocTema).textSlotAdjust ??= {})[id!] = c as never })
    juntarUltimos(2)
  }
  useEditor.getState().set({ slot: id, camada: null })
  return id
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
/** Shift + clique / Ctrl + clique: soma (ou tira) um item da seleção. Lote 14 (item 196): com 2 ou mais, a seleção
 *  vira uma SELEÇÃO MÚLTIPLA (mexe em todos de uma vez) — o objeto único deixa de ter as alças dele. */
export function alternarNaSelecao(item: { tipo: 'camada' | 'texto'; id: string }) {
  const ed = useEditor.getState()
  const atual = [...ed.multiSel]
  // o selecionado de agora entra na lista (o próximo clique soma a ele)
  if (ed.camada && !atual.some(i => i.tipo === 'camada' && i.id === ed.camada)) atual.push({ tipo: 'camada', id: ed.camada })
  if (ed.slot && !atual.some(i => i.tipo === 'texto' && i.id === ed.slot)) atual.push({ tipo: 'texto', id: ed.slot })
  const i = atual.findIndex(x => x.tipo === item.tipo && x.id === item.id)
  if (i >= 0) atual.splice(i, 1); else atual.push(item)
  if (atual.length >= 2) ed.set({ multiSel: atual, grupoSel: null, camada: null, slot: null })
  else ed.set({ multiSel: [], grupoSel: null, camada: atual[0]?.tipo === 'camada' ? atual[0].id : null, slot: atual[0]?.tipo === 'texto' ? atual[0].id : null })
}

// ── Lote 14 (item 196): SELEÇÃO MÚLTIPLA — mexer em vários objetos de uma vez (um Ctrl+Z para tudo) ─────────────────
/** A seleção como um grupo TEMPORÁRIO (não fica salvo): as camadas e os textos somados com Shift + clique. */
export function grupoDaSelecao(): GrupoTema | null {
  const ed = useEditor.getState(), t = tema(), d = base()
  if (!t || ed.multiSel.length < 2) return null
  const camadas = ed.multiSel.filter(i => i.tipo === 'camada').map(i => i.id)
  const textos = [...new Set(ed.multiSel.filter(i => i.tipo === 'texto').map(i => d.textSlots.find(s => s.id === i.id)?.variable).filter((v): v is string => !!v))]
  const c0 = camadas.length ? acharCamadaTema(t, camadas[0]) : null
  const parte = c0?.partId ?? (ed.face ? parteDaFace(d, ed.face)?.id : null) ?? ''
  return { id: '__selecao', nome: `${ed.multiSel.length} itens`, parte, camadas, textos }
}
/** Move/redimensiona/gira a seleção na caixa clicada (um passo no Ctrl+Z). */
export function transformarSelecao(op: OperacaoGrupo, label: string, valores: Record<string, string> = {}) {
  const ed = useEditor.getState(), d = base(), g = grupoDaSelecao()
  if (!g || !ed.face) return
  const af = acharFace(d, ed.face); if (!af) return
  aplicarTema(label, tt => transformarGrupoNaFace(d, tt as DocTema, g, af.molde, ed.face!, op, valores))
}
/** Alinhar (esquerda, centro, direita, topo, meio, base) ou distribuir (h, v) a seleção na caixa clicada. */
export function alinharSelecao(como: 'esq' | 'centro' | 'dir' | 'topo' | 'meio' | 'base' | 'dist-h' | 'dist-v', valores: Record<string, string> = {}) {
  const ed = useEditor.getState(), d = base(), t = tema(), g = grupoDaSelecao()
  if (!g || !t || !ed.face) return
  const af = acharFace(d, ed.face); if (!af) return
  const ms = membrosNaFace(d, t, g, af.molde, ed.face, valores)
  if (ms.length < 2) return
  const cx = (m: typeof ms[number]) => m.cantos.map(c => c[0]), cy = (m: typeof ms[number]) => m.cantos.map(c => c[1])
  const x0 = Math.min(...ms.flatMap(cx)), x1 = Math.max(...ms.flatMap(cx)), y0 = Math.min(...ms.flatMap(cy)), y1 = Math.max(...ms.flatMap(cy))
  const desl = new Map<string, [number, number]>()
  if (como === 'dist-h' || como === 'dist-v') {
    const h = como === 'dist-h', ord = [...ms].sort((a, b) => (h ? a.centro[0] - b.centro[0] : a.centro[1] - b.centro[1]))
    const ini = h ? ord[0].centro[0] : ord[0].centro[1], fim = h ? ord[ord.length - 1].centro[0] : ord[ord.length - 1].centro[1]
    ord.forEach((m, i) => { const alvo = ini + ((fim - ini) * i) / (ord.length - 1); desl.set(m.id, h ? [alvo - m.centro[0], 0] : [0, alvo - m.centro[1]]) })
  } else for (const m of ms) {
    const mx0 = Math.min(...cx(m)), mx1 = Math.max(...cx(m)), my0 = Math.min(...cy(m)), my1 = Math.max(...cy(m))
    desl.set(m.id, como === 'esq' ? [x0 - mx0, 0] : como === 'dir' ? [x1 - mx1, 0] : como === 'centro' ? [(x0 + x1) / 2 - (mx0 + mx1) / 2, 0]
      : como === 'topo' ? [0, y0 - my0] : como === 'base' ? [0, y1 - my1] : [0, (y0 + y1) / 2 - (my0 + my1) / 2])
  }
  const nomes: Record<string, string> = { esq: 'Alinhar à esquerda', centro: 'Centralizar', dir: 'Alinhar à direita', topo: 'Alinhar no topo', meio: 'Alinhar no meio', base: 'Alinhar na base', 'dist-h': 'Distribuir na horizontal', 'dist-v': 'Distribuir na vertical' }
  aplicarTema(nomes[como], tt => {
    for (const m of ms) {
      const [dx, dy] = desl.get(m.id) ?? [0, 0]
      if (Math.abs(dx) + Math.abs(dy) < 0.01) continue
      const s = m.tipo === 'texto' ? d.textSlots.find(x => x.id === m.id) : null
      const um: GrupoTema = { id: '__um', nome: '', parte: g.parte, camadas: m.tipo === 'camada' ? [m.id] : [], textos: s ? [s.variable] : [] }
      transformarGrupoNaFace(d, tt as DocTema, um, af.molde, ed.face!, { dx, dy }, valores)
    }
  })
}
/** Opacidade, ocultar e excluir em todas as CAMADAS selecionadas (os textos são da base: o olho deles é por caixa). */
export function editarSelecao(o: { opacidade?: number; visivel?: boolean; excluir?: boolean }, juntar?: string) {
  const ed = useEditor.getState(), d = base(), camadas = ed.multiSel.filter(i => i.tipo === 'camada').map(i => i.id)
  const textos = ed.multiSel.filter(i => i.tipo === 'texto').map(i => i.id)
  const label = o.excluir ? `Excluir ${camadas.length} camada(s)` : o.visivel !== undefined ? (o.visivel ? 'Mostrar a seleção' : 'Ocultar a seleção') : 'Opacidade da seleção'
  aplicarTema(label, tt => {
    const t = tt as DocTema
    for (const id of camadas) {
      const a = acharCamadaTema(t, id); if (!a || (a.c as { locked?: boolean }).locked) continue
      if (o.excluir) { removerCamadaTema(t, id); continue }
      if (o.opacidade !== undefined) (a.c as { opacity?: number }).opacity = Math.max(0, Math.min(1, o.opacidade))
      if (o.visivel !== undefined) { if (o.visivel) delete (a.c as { visible?: boolean }).visible; else (a.c as { visible?: boolean }).visible = false }
    }
    if (o.visivel !== undefined) for (const id of textos) {
      if (!d.textSlots.some(s => s.id === id)) continue
      const aj = ((t.textSlotAdjust ??= {})[id] ??= {}) as { hidden?: boolean }
      if (o.visivel) delete aj.hidden; else aj.hidden = true
    }
  }, juntar)
  if (o.excluir) ed.set({ multiSel: ed.multiSel.filter(i => i.tipo === 'texto') })
}
/** Estilos (efeitos) iguais em todas as camadas e textos da seleção — um passo só. */
export function estilosNaSelecao(efeitos: unknown[], label: string, juntar?: string) {
  const ed = useEditor.getState(), d = base()
  aplicarTema(label, tt => {
    const t = tt as DocTema
    for (const i of ed.multiSel) {
      if (i.tipo === 'camada') { const a = acharCamadaTema(t, i.id); if (a && !(a.c as { locked?: boolean }).locked) a.c.effects = JSON.parse(JSON.stringify(efeitos)) as never; continue }
      const s = d.textSlots.find(x => x.id === i.id); if (!s) continue
      const st = (t.textStyles[s.variable] ??= JSON.parse(JSON.stringify(estiloDaVariavel(t.textStyles, s.variable))))
      ;(st as { effects: unknown[] }).effects = JSON.parse(JSON.stringify(efeitos))
    }
  }, juntar)
}
/**
 * Caixa de seleção (Shift + arrastar numa área vazia): os objetos da arte (camadas e textos) com o centro dentro do
 * retângulo (mm da área de trabalho). `posPrancheta` = canto de cada prancheta na área de trabalho.
 */
export function selecionarObjetosNoRetangulo(r: { ax: number; ay: number; bx: number; by: number }, posPrancheta: (abId: string) => { xMm: number; yMm: number } | null, valores: Record<string, string> = {}): number {
  const d = base(), t = tema(), ed = useEditor.getState()
  if (!t) return 0
  const achados: { tipo: 'camada' | 'texto'; id: string }[] = [], porFace = new Map<string, number>()
  for (const m of d.molds) {
    const p = posPrancheta(m.artboardId); if (!p) continue
    for (const f of m.faces) {
      if (f.hole) continue
      const parte = parteDaFace(d, f.id)
      const camadas = [...(parte ? (t.partContent[parte.id] ?? []) : []), ...((t.faceContent ?? {})[f.id] ?? [])].map(c => c.id)
      const g: GrupoTema = { id: '__ret', nome: '', parte: parte?.id ?? '', camadas, textos: [...new Set(d.textSlots.filter(s => s.faceId === f.id).map(s => s.variable))] }
      for (const mb of membrosNaFace(d, t, g, m, f.id, valores)) {
        const [x, y] = [mb.centro[0] + p.xMm, mb.centro[1] + p.yMm]
        if (x < r.ax || x > r.bx || y < r.ay || y > r.by) continue
        if (!achados.some(a => a.tipo === mb.tipo && a.id === mb.id)) achados.push({ tipo: mb.tipo, id: mb.id })
        porFace.set(f.id, (porFace.get(f.id) ?? 0) + 1)
      }
    }
  }
  if (!achados.length) return 0
  const face = [...porFace].sort((a, b) => b[1] - a[1])[0][0]
  if (achados.length === 1) ed.set({ face, multiSel: [], grupoSel: null, camada: achados[0].tipo === 'camada' ? achados[0].id : null, slot: achados[0].tipo === 'texto' ? achados[0].id : null })
  else ed.set({ face, multiSel: achados, grupoSel: null, camada: null, slot: null })
  return achados.length
}
