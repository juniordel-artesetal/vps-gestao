// mae-editor — ESTADO do editor (Zustand). O documento só muda por `aplicar` (vai para o histórico);
// o viewport (zoom/posição) e a seleção NÃO entram no histórico.
import { create } from 'zustand'
import type { Draft } from 'immer'
import { novoDocumento, medidasFolha, type DocTrabalho, type Folha, type Orientacao } from '../schema'
import type { Viewport } from '../render/viewport'
import { aplicar as aplicarH, criarHistorico, desfazer as desfazerH, refazer as refazerH, type Historico, type Passo } from './historico'
import { anotar, esquecer, passoNovo, topoDe } from './linhaDoTempo'

/** Lote 3 (item 36): a Base e o Editor livre têm cada um o SEU documento (antes era um só, misturado). */
export type Contexto = 'base' | 'imagem'
interface Guardado { hist: Historico<DocTrabalho>; viewport: Viewport; selecao: string | null; marca: Passo | null }

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
  /** Acrescenta uma folha ao lado das que já existem (várias pranchetas na mesma base). */
  adicionarPrancheta: (folha: Folha | { widthMm: number; heightMm: number }, orientacao?: Orientacao) => void
  /** Substitui o documento inteiro (ex.: abrir um arquivo); zera o histórico. */
  carregar: (doc: DocTrabalho) => void
  setViewport: (v: Viewport) => void
  /** Documento de qual aba está aberto agora (Base/Tema usam a base; o Editor livre, o design). */
  contexto: Contexto
  /** O documento da outra aba, guardado enquanto ela está fechada. */
  guardados: Partial<Record<Contexto, Guardado>>
  trocarContexto: (c: Contexto) => void
  /** Passo do topo quando foi salvo/aberto (item 30: "Salvar as alterações em … antes de continuar?"). */
  marca: Passo | null
  marcarSalvo: () => void
}

const gid = () => `ab_${Math.random().toString(36).slice(2, 10)}`

export const useMaeDoc = create<EstadoMae>()((set, get) => ({
  hist: criarHistorico(novoDocumento('A4')),
  viewport: { escala: 1, x: 0, y: 0 },
  selecao: null,
  contexto: 'base',
  guardados: {},
  marca: null,
  aplicar: (label, receita, juntar) => {
    const antes = get().hist, depois = aplicarH(antes, label, receita, juntar)
    if (depois === antes) return
    set({ hist: depois })
    if (passoNovo(antes, depois)) anotar(get().contexto)
  },
  trocarContexto: c => {
    const s = get()
    if (s.contexto === c) return
    const guardados = { ...s.guardados, [s.contexto]: { hist: s.hist, viewport: s.viewport, selecao: s.selecao, marca: s.marca } }
    const g = guardados[c]
    if (g) set({ contexto: c, guardados, hist: g.hist, viewport: g.viewport, selecao: g.selecao, marca: g.marca })
    else {
      const d = novoDocumento('A4'); if (c === 'imagem') { d.name = 'Design sem nome'; d.artboards[0].name = 'Página 1'; d.artboards[0].layers = [] }
      set({ contexto: c, guardados, hist: criarHistorico(d), selecao: null, marca: null })
    }
  },
  marcarSalvo: () => set({ marca: topoDe(get().hist) as Passo | null }),
  setSelecao: selecao => set({ selecao }),
  desfazer: () => set({ hist: desfazerH(get().hist) }),
  refazer: () => set({ hist: refazerH(get().hist) }),
  novaPrancheta: (folha, orientacao = 'retrato') => {
    const m = typeof folha === 'string' ? medidasFolha(folha, orientacao) : folha
    const nome = typeof folha === 'string' ? `${folha} ${orientacao}` : `${m.widthMm} × ${m.heightMm} mm`
    // folha nova = começar de novo: os moldes da folha antiga saem junto (Ctrl+Z traz de volta)
    get().aplicar(`Nova prancheta ${nome}`, d => { d.artboards = [{ id: gid(), widthMm: m.widthMm, heightMm: m.heightMm }]; d.molds = [] })
  },
  adicionarPrancheta: (folha, orientacao = 'retrato') => {
    const m = typeof folha === 'string' ? medidasFolha(folha, orientacao) : folha
    get().aplicar('Adicionar prancheta', d => { d.artboards.push({ id: gid(), widthMm: m.widthMm, heightMm: m.heightMm }) })
  },
  carregar: doc => { esquecer(get().contexto); set({ hist: criarHistorico(doc), selecao: null, marca: null }) },
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
