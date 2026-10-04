// mae-editor — ESTADO do editor (Zustand). O documento só muda por `aplicar` (vai para o histórico);
// o viewport (zoom/posição) e a seleção NÃO entram no histórico.
import { create } from 'zustand'
import type { Draft } from 'immer'
import { novoDocumento, medidasFolha, type DocTrabalho, type Folha, type Orientacao } from '../schema'
import type { Viewport } from '../render/viewport'
import { aplicar as aplicarH, criarHistorico, desfazer as desfazerH, refazer as refazerH, type Historico } from './historico'

export interface EstadoMae {
  hist: Historico<DocTrabalho>
  viewport: Viewport
  aplicar: (label: string, receita: (d: Draft<DocTrabalho>) => void) => void
  desfazer: () => void
  refazer: () => void
  /** Troca a folha do documento por uma prancheta vazia (entra no histórico). */
  novaPrancheta: (folha: Folha | { widthMm: number; heightMm: number }, orientacao?: Orientacao) => void
  /** Substitui o documento inteiro (ex.: abrir um arquivo); zera o histórico. */
  carregar: (doc: DocTrabalho) => void
  setViewport: (v: Viewport) => void
}

const gid = () => `ab_${Math.random().toString(36).slice(2, 10)}`

export const useMaeDoc = create<EstadoMae>()((set, get) => ({
  hist: criarHistorico(novoDocumento('A4')),
  viewport: { escala: 1, x: 0, y: 0 },
  aplicar: (label, receita) => set({ hist: aplicarH(get().hist, label, receita) }),
  desfazer: () => set({ hist: desfazerH(get().hist) }),
  refazer: () => set({ hist: refazerH(get().hist) }),
  novaPrancheta: (folha, orientacao = 'retrato') => {
    const m = typeof folha === 'string' ? medidasFolha(folha, orientacao) : folha
    const nome = typeof folha === 'string' ? `${folha} ${orientacao}` : `${m.widthMm} × ${m.heightMm} mm`
    get().aplicar(`Nova prancheta ${nome}`, d => { d.artboards = [{ id: gid(), widthMm: m.widthMm, heightMm: m.heightMm }] })
  },
  carregar: doc => set({ hist: criarHistorico(doc) }),
  setViewport: viewport => set({ viewport }),
}))
