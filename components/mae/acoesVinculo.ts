'use client'
// Ações da base (Sprint 5) e do tema (Sprint 6) disparadas pela tela — sempre pelo histórico.
import type { Draft } from 'immer'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { atribuirFace, desatribuirFace, parteDaFace, acharFace } from '@/lib/mae/vinculo/partes'
import { colocarElemento, colocarNaFace, colocarPapel, editarNaParte, ajustarSoNaFace, acharCamadaTema, criarTransicao, ajustarTransicao, colocarCor, criarMoldura, type ArquivoImagem } from '@/lib/mae/vinculo/tema'
import type { ParamsMoldura } from '@/lib/mae/vinculo/moldura'
import type { Transicao } from '@/lib/mae/vinculo/transicao'
import { quadroDaFace } from '@/lib/mae/vinculo/enquadramento'
import { aplicar, inversa } from '@/lib/mae/vinculo/matriz'
import type { AjusteLocal, Transf } from '@/lib/mae/vinculo/resolver'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'
import { comEscopo, useEditor, type Escopo } from './estado'

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
    useEditor.getState().set({ camada: id })
  })
}

/**
 * Soltou um arquivo numa FACE do palco: vai para a PARTE toda (todas as faces dela), a não ser com Alt
 * ou com "Só nesta caixa" escolhido — aí só para aquela face. Com Shift, o papel entra POR CIMA do que
 * já existe (para a transição com máscara) em vez de trocar o papel de fundo. Elemento entra onde foi solto.
 */
export function soltarNaFace(faceId: string, pontoMolde: Pt | null, a: ArquivoImagem, alt: boolean, empilhar = false) {
  if (useEditor.getState().escopo === 'face') alt = true
  const d = base()
  const parte = parteDaFace(d, faceId)
  const af = acharFace(d, faceId)
  let pos: { x: number; y: number } | undefined
  if (af && parte && pontoMolde) {
    const inst = parte.instances.find(i => i.faceId === faceId)!
    const q = quadroDaFace(af.face.polygonMm as Pt[], inst.fit, parte.referenceAspect ?? 1)
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
