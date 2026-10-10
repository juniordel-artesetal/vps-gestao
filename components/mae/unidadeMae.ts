'use client'
// Lote 6 (item 113): a UNIDADE escolhida na engrenagem (mm · cm · px a 300 dpi) — vale para a régua, os
// controles deslizantes e os campos em mm. Fica lembrada neste navegador. A receita continua sempre em mm.
import { create } from 'zustand'
import type { Unidade } from '@/lib/mae/editor/unidades'

const CHAVE = 'mae:unidade'
function lida(): Unidade {
  try { const v = localStorage.getItem(CHAVE); return v === 'cm' || v === 'px' ? v : 'mm' } catch { return 'mm' }
}

export const useUnidade = create<{ u: Unidade; carregada: boolean }>(() => ({ u: 'mm', carregada: false }))

/** Lê a unidade guardada (uma vez, no navegador). */
export function carregarUnidade() {
  if (useUnidade.getState().carregada) return
  useUnidade.setState({ u: lida(), carregada: true })
}

export function mudarUnidade(u: Unidade) {
  useUnidade.setState({ u, carregada: true })
  try { localStorage.setItem(CHAVE, u) } catch { /* sem armazenamento: vale só nesta aba */ }
}
