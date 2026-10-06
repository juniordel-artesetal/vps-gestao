// mae-editor — LINHA DO TEMPO GLOBAL (Lote 3, item 31): um Ctrl+Z só, igual à setinha de voltar. A base, o
// tema e o design têm cada um o seu histórico (patches); aqui fica a ORDEM em que os passos aconteceram,
// para "desfazer" voltar exatamente o último passo — venha de onde vier. Ex.: no Tema, criar/mover uma
// prancheta mexe na base; o Ctrl+Z desfaz isso (antes desfazia o tema). Refazer: Ctrl+Shift+Z ou Ctrl+Y.
// Também guarda a MARCA de "salvo" de cada histórico (item 30: perguntar se quer salvar).
import { create } from 'zustand'
import type { Historico, Passo } from './historico'

export type Fonte = 'base' | 'imagem' | 'tema'

interface EstadoLinha { feitos: Fonte[]; desfeitos: Fonte[] }
export const useLinha = create<EstadoLinha>()(() => ({ feitos: [], desfeitos: [] }))

/** Uma fonte de histórico: o que ela sabe fazer e se está "à vista" agora (aba atual). */
export interface FonteHist { hist: () => Historico<unknown> | null; desfazer: () => void; refazer: () => void; ativa: () => boolean }
const fontes: Partial<Record<Fonte, FonteHist>> = {}
export function registrarFonte(f: Fonte, h: FonteHist) { fontes[f] = h }

/** Passo novo (não juntado ao anterior)? Compara o histórico antes e depois do `aplicar`. */
export function passoNovo(antes: Historico<unknown>, depois: Historico<unknown>): boolean {
  const a = antes.desfazer[antes.desfazer.length - 1], d = depois.desfazer[depois.desfazer.length - 1]
  if (!d || a === d) return false
  return !(d.juntar && a?.juntar === d.juntar && antes.desfazer.length === depois.desfazer.length)
}
export function anotar(f: Fonte) {
  useLinha.setState(s => ({ feitos: [...s.feitos, f].slice(-2000), desfeitos: [] }))
}
/** O documento da fonte foi trocado (abrir/novo): os passos dela saem da linha do tempo. */
export function esquecer(f: Fonte) {
  useLinha.setState(s => ({ feitos: s.feitos.filter(x => x !== f), desfeitos: s.desfeitos.filter(x => x !== f) }))
}

const pode = (f: Fonte, lado: 'desfazer' | 'refazer') => { const x = fontes[f]; const h = x?.hist(); return !!x && x.ativa() && !!h && h[lado].length > 0 }

function proximo(lista: Fonte[], lado: 'desfazer' | 'refazer'): number {
  for (let i = lista.length - 1; i >= 0; i--) if (pode(lista[i], lado)) return i
  return -1
}

export function desfazerGlobal(): boolean {
  const { feitos, desfeitos } = useLinha.getState()
  const i = proximo(feitos, 'desfazer')
  if (i < 0) return false
  const f = feitos[i]
  fontes[f]!.desfazer()
  useLinha.setState({ feitos: [...feitos.slice(0, i), ...feitos.slice(i + 1)], desfeitos: [...desfeitos, f] })
  return true
}
export function refazerGlobal(): boolean {
  const { feitos, desfeitos } = useLinha.getState()
  const i = proximo(desfeitos, 'refazer')
  if (i < 0) return false
  const f = desfeitos[i]
  fontes[f]!.refazer()
  useLinha.setState({ desfeitos: [...desfeitos.slice(0, i), ...desfeitos.slice(i + 1)], feitos: [...feitos, f] })
  return true
}
/** Nome do passo que o Ctrl+Z / Ctrl+Shift+Z vai desfazer/refazer agora (para a dica das setinhas). */
export function rotulo(lado: 'desfazer' | 'refazer'): string | null {
  const { feitos, desfeitos } = useLinha.getState()
  const lista = lado === 'desfazer' ? feitos : desfeitos
  const i = proximo(lista, lado)
  if (i < 0) return null
  const h = fontes[lista[i]]!.hist()!
  return h[lado][h[lado].length - 1]?.label ?? null
}

// ── "salvo" (item 30) ──────────────────────────────────────────────────────────────────────────────
/** Passos que são só VISTA (arrumar as pranchetas na tela) — não contam como alteração (Lote 3, item 10). */
export const ehSoVista = (label: string) => label === 'Mover prancheta' || label.startsWith('Organizar pranchetas')

/** Tem alteração desde a marca de "salvo"? `marca` = o passo que estava no topo quando salvou (null = vazio). */
export function alteradoDesde(h: Historico<unknown> | null, marca: Passo | null): boolean {
  if (!h) return false
  const topo = h.desfazer[h.desfazer.length - 1] ?? null
  if (topo === marca) return false
  if (!marca) return !h.desfazer.every(p => ehSoVista(p.label))
  const i = h.desfazer.indexOf(marca)
  if (i >= 0) return !h.desfazer.slice(i + 1).every(p => ehSoVista(p.label))
  // desfez para antes do "salvo": os passos desfeitos desde a marca (inclusive) estão no refazer
  const j = h.refazer.indexOf(marca)
  if (j < 0) return true
  return !h.refazer.slice(j).every(p => ehSoVista(p.label))
}
export const topoDe = (h: Historico<unknown> | null): Passo | null => h?.desfazer[h.desfazer.length - 1] ?? null
