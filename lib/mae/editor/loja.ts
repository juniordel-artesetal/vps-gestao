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
  /** Camada selecionada (fora do histórico). */
  selecao: string | null
  aplicar: (label: string, receita: (d: Draft<DocTrabalho>) => void, juntar?: string) => void
  setSelecao: (id: string | null) => void
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
  selecao: null,
  aplicar: (label, receita, juntar) => set({ hist: aplicarH(get().hist, label, receita, juntar) }),
  setSelecao: selecao => set({ selecao }),
  desfazer: () => set({ hist: desfazerH(get().hist) }),
  refazer: () => set({ hist: refazerH(get().hist) }),
  novaPrancheta: (folha, orientacao = 'retrato') => {
    const m = typeof folha === 'string' ? medidasFolha(folha, orientacao) : folha
    const nome = typeof folha === 'string' ? `${folha} ${orientacao}` : `${m.widthMm} × ${m.heightMm} mm`
    get().aplicar(`Nova prancheta ${nome}`, d => { d.artboards = [{ id: gid(), widthMm: m.widthMm, heightMm: m.heightMm }] })
  },
  carregar: doc => set({ hist: criarHistorico(doc), selecao: null }),
  setViewport: viewport => set({ viewport }),
}))

/** A pasta Biblioteca MAE aberta nesta sessão (compartilhada entre os painéis). */
export interface EstadoBiblioteca {
  raiz: FileSystemDirectoryHandle | null
  liberada: boolean
  setRaiz: (raiz: FileSystemDirectoryHandle | null, liberada: boolean) => void
  /** Arquivos (sha256) que a receita usa e não estão na pasta — a camada mostra "arquivo não encontrado". */
  faltando: string[]
  setFaltando: (f: string[]) => void
  /** Sobe quando a pasta muda/reconecta: a prévia tenta carregar de novo os arquivos que faltavam. */
  versao: number
}
export const useBiblioteca = create<EstadoBiblioteca>()(set => ({
  raiz: null, liberada: false, faltando: [], versao: 0,
  setRaiz: (raiz, liberada) => set(s => ({ raiz, liberada, versao: s.versao + 1 })),
  setFaltando: faltando => set(s => (s.faltando.join() === faltando.join() ? s : { faltando })),
}))
