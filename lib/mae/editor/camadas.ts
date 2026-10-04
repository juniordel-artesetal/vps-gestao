// mae-editor — OPERAÇÕES DE CAMADA (puras; rodam dentro da receita do Immer, mutando o rascunho).
// A lista vai de BAIXO para CIMA (índice 0 = fundo). "Subir" = índice maior.
// Atalhos no padrão Photoshop: Ctrl+G agrupar, Shift+Ctrl+G desagrupar, Ctrl+J duplicar,
// Alt+Ctrl+G máscara de recorte, Ctrl+] / Ctrl+[ subir/descer, Delete excluir.
import type { NoCamada, NoGrupo, NoImagem, NoSolida } from '../schema'

export const novoIdCamada = () => `ly_${Math.random().toString(36).slice(2, 10)}`

const COMUM = { visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal' as const, clip: false }

export function novaSolida(o: { color: string; xMm: number; yMm: number; wMm: number; hMm: number; name?: string }): NoSolida {
  return { ...COMUM, id: novoIdCamada(), type: 'solid', name: o.name ?? 'Cor sólida', color: o.color, xMm: o.xMm, yMm: o.yMm, wMm: o.wMm, hMm: o.hMm }
}
export function novaImagem(o: { path: string; sha256: string; xMm: number; yMm: number; wMm: number; hMm: number; name?: string }): NoImagem {
  return { ...COMUM, id: novoIdCamada(), type: 'image', name: o.name ?? 'Imagem', src: { path: o.path, sha256: o.sha256 },
    xMm: o.xMm, yMm: o.yMm, wMm: o.wMm, hMm: o.hMm, rotationDeg: 0 }
}

export interface Local { lista: NoCamada[]; indice: number; no: NoCamada; pai: NoGrupo | null }

/** Acha uma camada (em qualquer nível) pelo id. */
export function acharCamada(lista: NoCamada[], id: string, pai: NoGrupo | null = null): Local | null {
  for (let i = 0; i < lista.length; i++) {
    const no = lista[i]
    if (no.id === id) return { lista, indice: i, no, pai }
    if (no.type === 'group') { const r = acharCamada(no.children, id, no); if (r) return r }
  }
  return null
}

/** Insere acima da camada `acimaDe` (mesmo nível) ou no topo da lista. */
export function inserirCamada(lista: NoCamada[], no: NoCamada, acimaDe?: string | null): void {
  const l = acimaDe ? acharCamada(lista, acimaDe) : null
  if (l) l.lista.splice(l.indice + 1, 0, no)
  else lista.push(no)
}

export function removerCamada(lista: NoCamada[], id: string): NoCamada | null {
  const l = acharCamada(lista, id)
  if (!l) return null
  l.lista.splice(l.indice, 1)
  return l.no
}

/** Sobe (+1) ou desce (−1) uma posição dentro do mesmo nível. Devolve se mexeu. */
export function moverCamada(lista: NoCamada[], id: string, direcao: 1 | -1): boolean {
  const l = acharCamada(lista, id)
  if (!l) return false
  const j = l.indice + direcao
  if (j < 0 || j >= l.lista.length) return false
  const [no] = l.lista.splice(l.indice, 1)
  l.lista.splice(j, 0, no)
  return true
}

/** Põe a camada dentro de um grupo novo, no mesmo lugar. Devolve o id do grupo. */
export function agruparCamada(lista: NoCamada[], id: string, nome = 'Grupo'): string | null {
  const l = acharCamada(lista, id)
  if (!l) return null
  const grupo: NoGrupo = { ...COMUM, id: novoIdCamada(), type: 'group', name: nome, passThrough: true, children: [{ ...l.no, clip: false }] }
  l.lista.splice(l.indice, 1, grupo)
  return grupo.id
}

/** Desfaz o grupo: os filhos voltam para o nível do grupo, no mesmo lugar. */
export function desagruparCamada(lista: NoCamada[], id: string): boolean {
  const l = acharCamada(lista, id)
  if (!l || l.no.type !== 'group') return false
  l.lista.splice(l.indice, 1, ...l.no.children)
  return true
}

/**
 * Cópia profunda com ids novos (grupos inclusive). JSON e não structuredClone: dentro da receita o nó
 * é um rascunho do Immer (Proxy), que o structuredClone não aceita — e a receita é só dado puro.
 */
export function clonarComIdsNovos<T extends NoCamada>(no: T): T {
  const c = JSON.parse(JSON.stringify(no)) as NoCamada
  const renovar = (n: NoCamada) => { n.id = novoIdCamada(); if (n.type === 'group') n.children.forEach(renovar) }
  renovar(c)
  return c as T
}

/** Duplica logo acima (como Ctrl+J). Devolve o id da cópia. */
export function duplicarCamada(lista: NoCamada[], id: string): string | null {
  const l = acharCamada(lista, id)
  if (!l) return null
  const copia = clonarComIdsNovos(l.no)
  copia.name = `${l.no.name} cópia`
  l.lista.splice(l.indice + 1, 0, copia)
  return copia.id
}

/** Lista "achatada" para o painel: de CIMA para BAIXO, com a profundidade de cada camada. */
export function listaDoPainel(lista: NoCamada[], profundidade = 0): { no: NoCamada; profundidade: number }[] {
  const out: { no: NoCamada; profundidade: number }[] = []
  for (let i = lista.length - 1; i >= 0; i--) {
    const no = lista[i]
    out.push({ no, profundidade })
    if (no.type === 'group') out.push(...listaDoPainel(no.children, profundidade + 1))
  }
  return out
}

/** Todos os arquivos (sha256 → caminho) usados pela árvore. */
export function arquivosDaArvore(lista: NoCamada[], out = new Map<string, string>()): Map<string, string> {
  for (const no of lista) {
    for (const e of no.effects ?? []) if (e.type === 'patternOverlay') out.set(e.src.sha256, e.src.path)
    if (no.type === 'image') out.set(no.src.sha256, no.src.path)
    else if (no.type === 'group') arquivosDaArvore(no.children, out)
  }
  return out
}
