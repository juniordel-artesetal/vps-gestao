// mae-editor — ESTADO DO TEMA aberto (Zustand), com o mesmo histórico por patches da base.
import { create } from 'zustand'
import type { Draft } from 'immer'
import type { DocTema } from '../schema'
import { aplicar as aplicarH, criarHistorico, desfazer as desfazerH, refazer as refazerH, type Historico } from './historico'

export interface EstadoTema {
  hist: Historico<DocTema> | null
  aplicar: (label: string, receita: (t: Draft<DocTema>) => void, juntar?: string) => void
  desfazer: () => void
  refazer: () => void
  carregar: (t: DocTema | null) => void
}

export const useMaeTema = create<EstadoTema>()((set, get) => ({
  hist: null,
  aplicar: (label, receita, juntar) => { const h = get().hist; if (h) set({ hist: aplicarH(h, label, receita, juntar) }) },
  desfazer: () => { const h = get().hist; if (h) set({ hist: desfazerH(h) }) },
  refazer: () => { const h = get().hist; if (h) set({ hist: refazerH(h) }) },
  carregar: t => set({ hist: t ? criarHistorico(t) : null }),
}))
