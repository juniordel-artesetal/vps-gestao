'use client'
// Estado da TELA do Método MAE (fora do histórico): modo (base / tema / imagem), passo do assistente,
// parte ativa, face de contexto, camada do tema selecionada e a escolha "Todas × Só nesta caixa".
import { create } from 'zustand'
import type { Identidade } from './arquivosMae'
import type { InfoTexto } from '@/lib/mae/texto/noTexto'

export type ModoEditor = 'base' | 'tema' | 'imagem'
export const PASSOS = ['Moldes', 'Pranchetas', 'Faces', 'Partes', 'Enquadramento', 'Nome e textos', 'Identidade', 'Arte inteligente', 'Salvar'] as const
export type Escopo = 'parte' | 'face'

export interface EstadoEditor {
  modo: ModoEditor
  /** Passo do assistente da base (1 a 9). */
  passo: number
  parteAtiva: string | null
  /** Face clicada (contexto de "Só nesta caixa" e do enquadramento). */
  face: string | null
  /** Camada do tema selecionada. */
  camada: string | null
  /** Escolha "Todas as FRENTES" × "Só nesta caixa" (null = perguntar). */
  escopo: Escopo | null
  lembrarEscopo: boolean
  /** Ação esperando a resposta "Todas × Só nesta caixa". */
  pergunta: { aplicar: (e: Escopo) => void; parte: string } | null
  /** Papel quadriculado de teste nas faces das partes (modo base). */
  grade: boolean
  /** Passo 6 e 7: o que o próximo clique numa face/molde posiciona. */
  posicionar: { tipo: 'texto'; variavel: string } | { tipo: 'logo' | 'qr' } | null
  slot: string | null
  /** Lote 1: logo ou QR selecionado no passo Identidade (caixa de transformação). */
  identSel: { moldeId: string; k: 'logo' | 'qr' } | null
  /** Lote 1: prancheta selecionada (menu rápido: girar, redimensionar, duplicar, excluir). */
  prancheta: string | null
  /** Lote 2 (item 16): menu do botão direito sobre um elemento do tema (posição na tela + camada). */
  menuCamada: { x: number; y: number; camada: string } | null
  /** Lote 2 (item 24): função aberta na barra de ícones da esquerda (null = painel fechado). */
  funcao: string | null
  /** Última prévia: quanto levou (ms) desde a mudança e quando terminou (performance.now()). */
  previa: { ms: number; em: number; folhas: number } | null
  /** Identidade do Ateliê lida da Biblioteca (logo, QR, @). */
  identidade: Identidade
  /** Resultado da última diagramação dos textos (avisos do auto-ajuste, fonte substituta). */
  textos: InfoTexto[]
  /** Editor de imagem (Sprint 13): página (prancheta) em edição; null = a primeira. */
  pagina: string | null
  set: (p: Partial<EstadoEditor>) => void
}

const lembrado = (): Escopo | null => { try { const v = localStorage.getItem('mae:escopo'); return v === 'parte' || v === 'face' ? v : null } catch { return null } }

export const useEditor = create<EstadoEditor>()(set => ({
  modo: 'base', passo: 1, parteAtiva: null, face: null, camada: null,
  escopo: lembrado(), lembrarEscopo: lembrado() !== null, pergunta: null,
  grade: true, posicionar: null, slot: null, identSel: null, prancheta: null, menuCamada: null, funcao: null, previa: null, identidade: {}, textos: [], pagina: null,
  set: p => set(p),
}))

/** Executa uma edição vinculada respeitando a escolha (pergunta se ainda não houver). */
export function comEscopo(nomeParte: string, aplicar: (e: Escopo) => void, forcar?: Escopo) {
  const st = useEditor.getState()
  if (forcar) return aplicar(forcar)
  if (!st.face) return aplicar('parte')
  if (st.escopo) return aplicar(st.escopo)
  st.set({ pergunta: { aplicar, parte: nomeParte } })
}

export function responderEscopo(e: Escopo, lembrar: boolean) {
  const st = useEditor.getState()
  const p = st.pergunta
  st.set({ pergunta: null, escopo: lembrar ? e : st.escopo, lembrarEscopo: lembrar })
  try { if (lembrar) localStorage.setItem('mae:escopo', e) } catch { /* sem armazenamento */ }
  p?.aplicar(e)
}
