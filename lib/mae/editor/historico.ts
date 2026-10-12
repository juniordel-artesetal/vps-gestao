// mae-editor — HISTÓRICO (desfazer/refazer) por PATCHES do Immer: cada ação guarda só o que mudou
// (patches + patches inversos), não cópias do documento inteiro. Desfazer/refazer "ilimitado", com
// teto de passos para proteger a memória. Puro: sem React, testável no Node.
import { enablePatches, produceWithPatches, applyPatches, type Patch, type Draft } from 'immer'

enablePatches()

export interface Passo { label: string; patches: Patch[]; inversos: Patch[]; juntar?: string; /** quando foi a última mudança deste passo (ms) */ em?: number }

/**
 * Lote 8 (item 122): a mesma chave `juntar` só funde se a mudança anterior foi há MENOS que isto. Uma rajada de
 * setinhas, um arraste de controle ou uma digitação contínua = 1 passo; parou e voltou = passo novo (antes, a chave
 * fixa — ex.: `setas:<slot>` — fundia para sempre e o Ctrl+Z desfazia tudo de uma vez ou parecia não funcionar).
 */
export const JANELA_JUNTAR_MS = 700
export interface Historico<T> { atual: T; desfazer: Passo[]; refazer: Passo[]; limite: number }

export const LIMITE_PADRAO = 500

export function criarHistorico<T>(inicial: T, limite = LIMITE_PADRAO): Historico<T> {
  return { atual: inicial, desfazer: [], refazer: [], limite }
}

/**
 * Aplica uma mudança (receita do Immer). Sem mudança real → não cria passo.
 * `juntar`: mudanças seguidas com a mesma chave viram UM passo só (arrastar um controle deslizante
 * de opacidade = 1 desfazer, não 100).
 */
export function aplicar<T>(h: Historico<T>, label: string, receita: (rascunho: Draft<T>) => void, juntar?: string, agora: number = Date.now()): Historico<T> {
  const [proximo, patches, inversos] = produceWithPatches(h.atual, receita)
  if (!patches.length) return h
  const ultimo = h.desfazer[h.desfazer.length - 1]
  if (juntar && ultimo?.juntar === juntar && !h.refazer.length && agora - (ultimo.em ?? agora) < JANELA_JUNTAR_MS) {
    const unido = { label, juntar, em: agora, patches: [...ultimo.patches, ...patches], inversos: [...inversos, ...ultimo.inversos] }
    return { ...h, atual: proximo as T, desfazer: [...h.desfazer.slice(0, -1), unido] }
  }
  const desfazer = [...h.desfazer, { label, patches, inversos, em: agora, ...(juntar ? { juntar } : {}) }]
  if (desfazer.length > h.limite) desfazer.splice(0, desfazer.length - h.limite)
  return { ...h, atual: proximo as T, desfazer, refazer: [] }
}

export function desfazer<T>(h: Historico<T>): Historico<T> {
  const passo = h.desfazer[h.desfazer.length - 1]
  if (!passo) return h
  return { ...h, atual: applyPatches(h.atual as object, passo.inversos) as T, desfazer: h.desfazer.slice(0, -1), refazer: [...h.refazer, passo] }
}

export function refazer<T>(h: Historico<T>): Historico<T> {
  const passo = h.refazer[h.refazer.length - 1]
  if (!passo) return h
  return { ...h, atual: applyPatches(h.atual as object, passo.patches) as T, refazer: h.refazer.slice(0, -1), desfazer: [...h.desfazer, passo] }
}
