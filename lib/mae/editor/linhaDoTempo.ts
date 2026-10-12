// mae-editor — LINHA DO TEMPO GLOBAL (Lote 3, item 31): um Ctrl+Z só, igual à setinha de voltar. A base, o
// tema e o design têm cada um o seu histórico (patches); aqui fica a ORDEM em que os passos aconteceram,
// para "desfazer" voltar exatamente o último passo — venha de onde vier. Ex.: no Tema, criar/mover uma
// prancheta mexe na base; o Ctrl+Z desfaz isso (antes desfazia o tema). Refazer: Ctrl+Shift+Z ou Ctrl+Y.
// Também guarda a MARCA de "salvo" de cada histórico (item 30: perguntar se quer salvar).
import { create } from 'zustand'
import type { Historico, Passo } from './historico'

export type Fonte = 'base' | 'imagem' | 'tema' | 'pedido'

/** Uma entrada da linha do tempo: uma fonte, ou VÁRIAS que mudaram juntas numa ação só (Lote 8, item 122 — ex.:
 *  excluir um texto no Tema mexe na base E no tema; um Ctrl+Z desfaz as duas). */
type Entrada = Fonte | Fonte[]
interface EstadoLinha { feitos: Entrada[]; desfeitos: Entrada[] }
export const useLinha = create<EstadoLinha>()(() => ({ feitos: [], desfeitos: [] }))

/** Uma fonte de histórico: o que ela sabe fazer e se está "à vista" agora (aba atual). */
export interface FonteHist { hist: () => Historico<unknown> | null; desfazer: () => void; refazer: () => void; ativa: () => boolean }
const fontes: Partial<Record<Fonte, FonteHist>> = {}
export function registrarFonte(f: Fonte, h: FonteHist) { fontes[f] = h }

/** Passo novo (não juntado ao anterior)? Compara o histórico antes e depois do `aplicar`. */
export function passoNovo(antes: Historico<unknown>, depois: Historico<unknown>): boolean {
  const a = antes.desfazer[antes.desfazer.length - 1], d = depois.desfazer[depois.desfazer.length - 1]
  if (!d || a === d) return false
  return depois.desfazer.length !== antes.desfazer.length || !(d.juntar && a?.juntar === d.juntar)
}
/** As últimas `n` entradas viram UMA (um Ctrl+Z desfaz todas). */
export function juntarUltimos(n: number) {
  useLinha.setState(s => {
    if (n < 2 || s.feitos.length < n) return s
    const ult = s.feitos.slice(-n).flatMap(e => (Array.isArray(e) ? e : [e]))
    return { feitos: [...s.feitos.slice(0, -n), ult], desfeitos: [] }
  })
}
export function anotar(f: Fonte) {
  useLinha.setState(s => ({ feitos: [...s.feitos, f].slice(-2000), desfeitos: [] }))
}
/** O documento da fonte foi trocado (abrir/novo): os passos dela saem da linha do tempo. */
export function esquecer(f: Fonte) {
  const tira = (l: Entrada[]) => l.map(e => (Array.isArray(e) ? e.filter(x => x !== f) : e)).filter(e => (Array.isArray(e) ? e.length > 0 : e !== f))
  useLinha.setState(s => ({ feitos: tira(s.feitos), desfeitos: tira(s.desfeitos) }))
}

const pode1 = (f: Fonte, lado: 'desfazer' | 'refazer') => { const x = fontes[f]; const h = x?.hist(); return !!x && x.ativa() && !!h && h[lado].length > 0 }
const pode = (e: Entrada, lado: 'desfazer' | 'refazer') => (Array.isArray(e) ? e.some(f => pode1(f, lado)) : pode1(e, lado))
const nomes = (e: Entrada): Fonte[] => (Array.isArray(e) ? e : [e])

function proximo(lista: Entrada[], lado: 'desfazer' | 'refazer'): number {
  for (let i = lista.length - 1; i >= 0; i--) if (pode(lista[i], lado)) return i
  return -1
}

export function desfazerGlobal(): boolean {
  const { feitos, desfeitos } = useLinha.getState()
  const i = proximo(feitos, 'desfazer')
  if (i < 0) return false
  const e = feitos[i]
  // ação composta: desfaz da última fonte para a primeira
  for (const f of [...nomes(e)].reverse()) if (pode1(f, 'desfazer')) fontes[f]!.desfazer()
  useLinha.setState({ feitos: [...feitos.slice(0, i), ...feitos.slice(i + 1)], desfeitos: [...desfeitos, e] })
  return true
}
export function refazerGlobal(): boolean {
  const { feitos, desfeitos } = useLinha.getState()
  const i = proximo(desfeitos, 'refazer')
  if (i < 0) return false
  const e = desfeitos[i]
  for (const f of nomes(e)) if (pode1(f, 'refazer')) fontes[f]!.refazer()
  useLinha.setState({ desfeitos: [...desfeitos.slice(0, i), ...desfeitos.slice(i + 1)], feitos: [...feitos, e] })
  return true
}
/** Nome do passo que o Ctrl+Z / Ctrl+Shift+Z vai desfazer/refazer agora (para a dica das setinhas). */
export function rotulo(lado: 'desfazer' | 'refazer'): string | null {
  const { feitos, desfeitos } = useLinha.getState()
  const lista = lado === 'desfazer' ? feitos : desfeitos
  const i = proximo(lista, lado)
  if (i < 0) return null
  const f = [...nomes(lista[i])].reverse().find(x => pode1(x, lado))!
  const h = fontes[f]!.hist()!
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
