'use client'
// Ações de camada do editor (painel + atalhos), sempre pelo histórico. Trabalham na 1ª prancheta
// (Sprint 2: "Editor de imagem" = uma arte por vez).
import type { Draft } from 'immer'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import {
  acharCamada, agruparCamada, desagruparCamada, duplicarCamada, inserirCamada, moverCamada, removerCamada,
} from '@/lib/mae/editor/camadas'
import type { DocTrabalho, NoCamada } from '@/lib/mae/schema'

type Rascunho = Draft<DocTrabalho>

/** Lista de camadas da prancheta ativa no rascunho (cria se não houver). */
export function camadasDe(d: Rascunho): NoCamada[] {
  const ab = d.artboards[0]
  if (!ab.layers) ab.layers = []
  return ab.layers as NoCamada[]
}

export const camadasAtuais = (): NoCamada[] => useMaeDoc.getState().hist.atual.artboards[0]?.layers ?? []
export const camadaSelecionada = (): NoCamada | null => {
  const id = useMaeDoc.getState().selecao
  return id ? acharCamada(camadasAtuais(), id)?.no ?? null : null
}

const aplicar = (label: string, receita: (d: Rascunho) => void, juntar?: string) => useMaeDoc.getState().aplicar(label, receita, juntar)
const sel = () => useMaeDoc.getState().selecao
const setSel = (id: string | null) => useMaeDoc.getState().setSelecao(id)

export function adicionarCamada(no: NoCamada, label: string) {
  const acima = sel()
  aplicar(label, d => inserirCamada(camadasDe(d), no, acima))
  setSel(no.id)
}

/** Muda campos de uma camada. `juntar` = vários ajustes seguidos viram 1 passo de desfazer. */
export function editarCamada(id: string, label: string, mudar: (no: Draft<NoCamada>) => void, juntar?: string) {
  aplicar(label, d => { const l = acharCamada(camadasDe(d), id); if (l) mudar(l.no as Draft<NoCamada>) }, juntar)
}

const travada = (id: string) => !!acharCamada(camadasAtuais(), id)?.no.locked

export const acoes = {
  alternarVisivel(id: string) { editarCamada(id, 'Mostrar/ocultar camada', n => { n.visible = !n.visible }) },
  alternarTrava(id: string) { editarCamada(id, 'Travar/destravar camada', n => { n.locked = !n.locked }) },
  renomear(id: string, nome: string) { const t = nome.trim().slice(0, 80); if (t) editarCamada(id, 'Renomear camada', n => { n.name = t }) },
  alternarRecorte(id = sel()) { if (id && !travada(id)) editarCamada(id, 'Máscara de recorte', n => { n.clip = !n.clip }) },
  subir(id = sel()) { if (id) aplicar('Subir camada', d => { moverCamada(camadasDe(d), id, 1) }) },
  descer(id = sel()) { if (id) aplicar('Descer camada', d => { moverCamada(camadasDe(d), id, -1) }) },
  agrupar(id = sel()) {
    if (!id) return
    const r = { id: null as string | null }
    aplicar('Agrupar camada', d => { r.id = agruparCamada(camadasDe(d), id) })
    if (r.id) setSel(r.id)
  },
  desagrupar(id = sel()) {
    if (!id) return
    const no = acharCamada(camadasAtuais(), id)?.no
    if (no?.type !== 'group') return
    aplicar('Desagrupar', d => { desagruparCamada(camadasDe(d), id) })
    setSel(no.children[no.children.length - 1]?.id ?? null)
  },
  duplicar(id = sel()) {
    if (!id) return
    const r = { id: null as string | null }
    aplicar('Duplicar camada', d => { r.id = duplicarCamada(camadasDe(d), id) })
    if (r.id) setSel(r.id)
  },
  excluir(id = sel()) {
    if (!id || travada(id)) return
    aplicar('Excluir camada', d => { removerCamada(camadasDe(d), id) })
    setSel(null)
  },
}
