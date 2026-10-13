// MAE — ORDEM DA CAIXA (Lote 10, item 151). Fonte única para o resolvedor (tela e arquivo), o painel Camadas e o
// clique na arte. Antes "trazer para frente / enviar para trás" só mexia DENTRO da lista da camada (da parte OU só
// desta caixa): um elemento sozinho no conteúdo da caixa não tinha com quem trocar e nada acontecia; e os textos
// ficavam sempre por cima. Agora `tema.ordemFace[face]` (opcional) guarda a ordem de baixo para cima dos ids da
// caixa — camadas da parte, camadas só desta caixa e textos (`t:<slot>`). Sem ela, vale a ordem de sempre.
// Regra dos textos: os textos da caixa são desenhados juntos (por cima das faces); uma camada posta ACIMA de um texto
// da caixa sobe para cima dos textos dela (continua recortada na face).
export const idTexto = (slotId: string) => `t:${slotId}`

/**
 * Aplica a ordem guardada a uma lista (de baixo para cima). Quem está na ordem fica na posição dela; quem não está
 * (camada nova, por exemplo) fica logo acima do MAIS ALTO dos que vêm antes dela e estão na ordem — uma camada nova
 * empurrada para o topo da lista continua no topo.
 */
export function aplicarOrdem<T>(itens: T[], idDe: (x: T) => string, ordem?: string[] | null): T[] {
  if (!ordem?.length || itens.length < 2) return itens
  const pos = new Map(ordem.map((id, i) => [id, i]))
  let ultimo = -1
  const chaves = itens.map((x, i) => {
    const p = pos.get(idDe(x))
    if (p !== undefined) { ultimo = Math.max(ultimo, p); return p }
    return ultimo + 0.5 + i / 1e6
  })
  return itens.map((x, i) => ({ x, k: chaves[i], i })).sort((a, b) => a.k - b.k || a.i - b.i).map(o => o.x)
}

/**
 * A ordem da caixa: camadas (de baixo para cima), quais delas ficam ACIMA dos textos e a ordem dos textos.
 * `camadas` = ids na ordem de sempre; `textos` = ids dos slots desta caixa na ordem de sempre.
 */
export function ordemDaCaixa(camadas: string[], textos: string[], ordem?: string[] | null): { camadas: string[]; acimaDosTextos: Set<string>; textos: string[] } {
  if (!ordem?.length) return { camadas, acimaDosTextos: new Set(), textos }
  const cs = aplicarOrdem(camadas, x => x, ordem)
  const ts = aplicarOrdem(textos, x => idTexto(x), ordem)
  const pos = new Map(ordem.map((id, i) => [id, i]))
  const posTextos = textos.map(t => pos.get(idTexto(t))).filter((p): p is number => p !== undefined)
  const acima = new Set<string>()
  if (posTextos.length) {
    const primeiroTexto = Math.min(...posTextos)
    for (const c of cs) { const p = pos.get(c); if (p !== undefined && p > primeiroTexto) acima.add(c) }
  }
  return { camadas: cs, acimaDosTextos: acima, textos: ts }
}

/**
 * Move um item (camada ou `t:<slot>`) na ordem da caixa. `atual` = a ordem visível hoje (de baixo para cima).
 * `para`: 'frente' / 'tras' (1 passo), 'topo' / 'fundo', ou o índice de destino. Devolve a ordem nova (ou null).
 */
export function moverNaOrdem(atual: string[], id: string, para: 'frente' | 'tras' | 'topo' | 'fundo' | number): string[] | null {
  const i = atual.indexOf(id)
  if (i < 0) return null
  const n = atual.length
  const j = typeof para === 'number' ? Math.max(0, Math.min(n - 1, para))
    : para === 'frente' ? Math.min(n - 1, i + 1) : para === 'tras' ? Math.max(0, i - 1) : para === 'topo' ? n - 1 : 0
  if (j === i) return null
  const nova = [...atual]
  nova.splice(i, 1)
  nova.splice(j, 0, id)
  return nova
}
