// mae-editor — ESTADO DO TEMA aberto (Zustand), com o mesmo histórico por patches da base.
import { create } from 'zustand'
import type { Draft } from 'immer'
import type { DocTema } from '../schema'
import { aplicar as aplicarH, criarHistorico, desfazer as desfazerH, refazer as refazerH, type Historico, type Passo } from './historico'
import { anotar, esquecer, passoNovo, topoDe } from './linhaDoTempo'
import { useMaeDoc } from './loja'
import { migrarPartesDoTema } from '../vinculo/partes'

export interface EstadoTema {
  hist: Historico<DocTema> | null
  aplicar: (label: string, receita: (t: Draft<DocTema>) => void, juntar?: string) => void
  desfazer: () => void
  refazer: () => void
  carregar: (t: DocTema | null) => void
  /** Passo do topo quando foi salvo/aberto (item 30). */
  marca: Passo | null
  marcarSalvo: () => void
}

function migrarTema(t: DocTema): DocTema {
  const s = useMaeDoc.getState(), b = (s.contexto === 'base' ? s.hist.atual : s.guardados.base?.hist.atual) as { id: string; partesDivididas?: Record<string, Record<string, string>> } | undefined
  if (!b?.partesDivididas || b.id !== t.baseId) return t
  const c = JSON.parse(JSON.stringify(t)) as DocTema
  return migrarPartesDoTema(b, c as never) ? c : t
}

export const useMaeTema = create<EstadoTema>()((set, get) => ({
  hist: null,
  marca: null,
  aplicar: (label, receita, juntar) => {
    const h = get().hist; if (!h) return
    const d = aplicarH(h, label, receita, juntar)
    if (d === h) return
    set({ hist: d })
    if (passoNovo(h, d)) anotar('tema')
  },
  marcarSalvo: () => set({ marca: topoDe(get().hist) as Passo | null }),
  desfazer: () => { const h = get().hist; if (h) set({ hist: desfazerH(h) }) },
  refazer: () => { const h = get().hist; if (h) set({ hist: refazerH(h) }) },
  // Lote 17 (item 209): tema antigo numa base de peças dividida → o conteúdo da parte de todas vai para as de cada peça
  carregar: t => { esquecer('tema'); set({ hist: t ? criarHistorico(migrarTema(t)) : null, marca: null }) },
}))
