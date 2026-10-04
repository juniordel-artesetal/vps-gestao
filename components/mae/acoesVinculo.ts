'use client'
// Ações da base (Sprint 5) e do tema (Sprint 6) disparadas pela tela — sempre pelo histórico.
import type { Draft } from 'immer'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { atribuirFace, desatribuirFace, parteDaFace, acharFace } from '@/lib/mae/vinculo/partes'
import { colocarElemento, colocarNaFace, colocarPapel, editarNaParte, ajustarSoNaFace, acharCamadaTema, type ArquivoImagem } from '@/lib/mae/vinculo/tema'
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

// ── tema: arquivos soltos ────────────────────────────────────────────────────────────────────────
const ehPapel = (a: ArquivoImagem) => /^Papéis\//i.test(a.path)

/** Soltou um arquivo numa PARTE (miniatura do painel): papel preenche, elemento entra vinculado. */
export function soltarNaParte(partId: string, a: ArquivoImagem, empilhar = false) {
  const nome = nomeDaParte(partId)
  aplicarTema(ehPapel(a) ? `Papel em ${nome}` : `Elemento em ${nome}`, t => {
    const id = ehPapel(a) ? colocarPapel(t as DocTema, partId, a, empilhar) : colocarElemento(t as DocTema, partId, a)
    useEditor.getState().set({ camada: id })
  })
}

/**
 * Soltou um arquivo numa FACE do palco: sem Alt vai para a PARTE toda (todas as faces dela);
 * com Alt, só para aquela face. Elemento entra onde foi solto (posição em % da face).
 */
export function soltarNaFace(faceId: string, pontoMolde: Pt | null, a: ArquivoImagem, alt: boolean) {
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
  if (!alt && parte) {
    aplicarTema(ehPapel(a) ? `Papel em ${parte.name}` : `Elemento em ${parte.name}`, t => {
      const id = ehPapel(a) ? colocarPapel(t as DocTema, parte.id, a) : colocarElemento(t as DocTema, parte.id, a, pos)
      useEditor.getState().set({ camada: id, face: faceId })
    })
    return true
  }
  aplicarTema(`Só nesta caixa: ${ehPapel(a) ? 'papel' : 'elemento'}`, t => {
    const id = colocarNaFace(t as DocTema, faceId, a, ehPapel(a) ? 'paper' : 'face', pos)
    useEditor.getState().set({ camada: id, face: faceId })
  })
  return true
}

// ── tema: editar camada (Todas × Só nesta caixa) ─────────────────────────────────────────────────
export interface MudancaCamada { transform?: Partial<Transf>; visible?: boolean; path?: string; sha256?: string; aspect?: number }

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
