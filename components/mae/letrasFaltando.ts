'use client'
// Lote 13 (item 180): LETRA FALTANDO na fonte — antes de gerar. Na edição em massa, a linha do pedido avisa "A fonte
// Jesica Justine não tem ê — Maitê" (com "Resolver") e o filtro "Letra faltando" acha todos; letra já trocada (tema ou
// pedido) ou montada (acento montado, item 163) não conta. As fontes do NOME/HASHTAG dos temas em uso são carregadas.
import type { DocTema } from '@/lib/mae/schema'
import { estiloDaVariavel } from '@/lib/mae/texto/noTexto'
import { letrasSemGlifo, letrasMontaveis, prepararTexto } from '@/lib/mae/texto/diagramar'
import { carregarFonte, fonteCarregada } from './fontesTexto'

export interface LetraFaltando { variavel: string; fonte: string; letras: string[]; texto: string }
const VARIAVEIS = ['NOME', 'HASHTAG'] as const

/** As letras do pedido que a fonte do tema não tem (e que nada resolve). Fonte ainda não carregada → não avisa. */
export function letrasFaltandoNoPedido(tema: DocTema | null | undefined, valores: Record<string, string>): LetraFaltando[] {
  if (!tema) return []
  const out: LetraFaltando[] = []
  for (const v of VARIAVEIS) {
    const texto = String(valores[v] ?? '').trim()
    if (!texto) continue
    let e = estiloDaVariavel(tema.textStyles, v)
    try { const p = valores[`_ESTILO_${v}`]; if (p) e = JSON.parse(p) } catch { /* estilo do pedido inválido: o do tema */ }
    const f = fonteCarregada(e.font.postscriptName)
    if (!f) continue
    let doPedido: { letra?: string }[] = []
    try { doPedido = JSON.parse(valores[`_TROCAS_${v}`] || '[]') } catch { /* sem troca */ }
    const trocadas = new Set([...(e.trocas ?? []), ...doPedido].map(t => t.letra).filter(Boolean))
    const t2 = prepararTexto(texto, e as never)
    const faltam = letrasSemGlifo(f, t2).filter(c => !trocadas.has(c))
    if (!faltam.length) continue
    const fa = e.acentos?.fonte ? fonteCarregada(e.acentos.fonte.postscriptName) : undefined
    const montadas = e.acentos?.ligado === false ? [] : letrasMontaveis(f, t2, fa)
    const ruins = faltam.filter(c => !montadas.includes(c))
    if (ruins.length) out.push({ variavel: v, fonte: e.font.family || e.font.postscriptName, letras: ruins, texto })
  }
  return out
}

/** Carrega as fontes do NOME/HASHTAG (e das trocas/acentos) dos temas em uso — o aviso aparece quando chegam. */
export async function garantirFontesDosTemas(temas: (DocTema | undefined)[], raiz: FileSystemDirectoryHandle | null): Promise<void> {
  const vistas = new Set<string>()
  for (const t of temas) {
    if (!t) continue
    for (const v of VARIAVEIS) {
      const e = estiloDaVariavel(t.textStyles, v)
      for (const f of [e.font, ...(e.trocas ?? []).map(x => x.fonte), e.acentos?.fonte]) {
        if (!f?.postscriptName || vistas.has(f.postscriptName)) continue
        vistas.add(f.postscriptName)
        await carregarFonte(f as never, raiz).catch(() => undefined)
      }
    }
  }
}
