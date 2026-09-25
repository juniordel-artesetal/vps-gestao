// SOA Edition — "tema pronto" no pedido → arte automática. Módulo PURO (sem banco/navegador):
// usado pela rota que grava o tema no pedido e pelo gerador automático no cliente.
import type { Linha } from './tipos'
import { mapearAuto } from './dados'

/** Chaves no camposExtras do pedido. Sem "_" de propósito: a tela do pedido regrava o camposExtras
 *  inteiro e descarta chaves internas; estas sobrevivem e ainda aparecem para a produção. */
export const CHAVES_TEMA = { tema: 'Tema', nome: 'Nome', idade: 'Idade' } as const

export interface TemaPronto { id: string; temaNome: string; nome: string; preview: string | null }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Acha o template pronto do tema escrito no pedido (sem diferenciar acento/maiúscula). */
export function temaDoPedido(campos: Record<string, string>, temas: TemaPronto[]): TemaPronto | null {
  const t = campos[CHAVES_TEMA.tema]
  if (!t?.trim()) return null
  return temas.find(x => norm(x.temaNome) === norm(t)) ?? null
}

/** "Maria; João" ou um por linha → ["Maria", "João"]. */
export const separar = (s: string | undefined) => (s || '').split(/\n|;/).map(x => x.trim()).filter(Boolean)

/**
 * Linhas do lote automático: uma arte por NOME do pedido. Idade: se vier uma por nome (mesma
 * quantidade), pareia; senão a mesma idade vale para todos. Todos os campos do pedido vão junto
 * e cada {variável} do template é ligada à coluna mais parecida (nome → Nome, idade → Idade…).
 */
export function linhasDoTema(
  campos: Record<string, string>, base: Record<string, string>, variaveis: string[],
): Linha[] {
  const nomes = separar(campos[CHAVES_TEMA.nome])
  const idades = separar(campos[CHAVES_TEMA.idade])
  const lista = nomes.length ? nomes : ['']
  return lista.map((nome, i) => {
    const l: Linha = { ...base, ...campos, [CHAVES_TEMA.nome]: nome, [CHAVES_TEMA.idade]: idades.length === lista.length ? idades[i] : (idades[0] || '') }
    const mapa = mapearAuto(variaveis, Object.keys(l))
    for (const [v, col] of Object.entries(mapa)) l[v] = l[col] ?? ''
    return l
  })
}
