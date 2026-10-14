'use client'
// Lote 13 (item 178): UM lugar decide onde vai a mudança do ESTILO DO TEXTO (fonte, cor, papel, efeitos, espaçamento…):
//   • no "Ajustar" da edição em massa → SÓ NESTE PEDIDO (histórico do ajuste; "Usar este ajuste como padrão do tema" leva
//     para o tema; "Voltar ao padrão" tira);
//   • fora dele → no TEMA (todos os pedidos).
// Antes a barra de cima (cor, alinhamento, Aa) gravava no tema mesmo no Ajustar, com o tema "travado".
import type { DocTema } from '@/lib/mae/schema'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { estiloDaVariavel, type EstiloTexto } from '@/lib/mae/texto/noTexto'
import { usePedidoAberto, mudarEstiloDoPedido } from './pedidosMae'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { salvarTema } from './arquivosMae'

/** Frase, idade do bloco, sufixo e sobrenome não herdam a logo/faixa do texto principal (Lote 8, item 124). */
export const PARTES_DO_TEXTO = new Set(['FRASE', 'NOME_IDADE:IDADE', 'SUFIXO', 'SOBRENOME'])

export const emAjusteDoPedido = () => { const s = usePedidoAberto.getState(); return !!s.ajustar && !!s.pedido }

/** O estilo do pedido (`_ESTILO_<VAR>`), se houver. */
export function estiloDoPedido(valores: Record<string, string>, variavel: string): EstiloTexto | null {
  const v = valores[`_ESTILO_${variavel}`]
  if (!v) return null
  try { return JSON.parse(v) as EstiloTexto } catch { return null }
}

/** O estilo que vale agora: o deste pedido (no Ajustar) ou o do tema. */
export function estiloEfetivo(tema: DocTema, variavel: string, valores?: Record<string, string>): EstiloTexto {
  return (valores && estiloDoPedido(valores, variavel)) || estiloDaVariavel(tema.textStyles, variavel)
}

/** Muda o estilo da variável — no pedido (Ajustar) ou no tema. `juntar` = vários passos viram um Ctrl+Z. */
export function mudarEstiloTexto(variavel: string, label: string, f: (e: EstiloTexto) => void, juntar?: string) {
  const tema = useMaeTema.getState().hist?.atual as DocTema | undefined
  if (!tema) return
  if (emAjusteDoPedido()) {
    mudarEstiloDoPedido(variavel, estiloEfetivo(tema, variavel, usePedidoAberto.getState().valores), `${label} (só neste pedido)`, f, juntar)
    return
  }
  useMaeTema.getState().aplicar(label, t => {
    const tt = t as DocTema
    tt.textStyles ??= {}
    if (!tt.textStyles[variavel]) {
      const copia = JSON.parse(JSON.stringify(estiloDaVariavel(tt.textStyles, variavel)))
      if (PARTES_DO_TEXTO.has(variavel)) delete copia.fundo
      tt.textStyles[variavel] = copia
    }
    f(tt.textStyles[variavel])
  }, juntar)
}

/**
 * Lote 13 (item 179): ação de TEMA dentro do Ajustar ("Sempre usar esta fonte para o ê no tema", "Usar este ajuste como
 * padrão do tema") — o tema é SALVO NA HORA (no Ajustar o botão Salvar é o do pedido; antes essa mudança se perdia).
 */
export async function salvarTemaAgora(): Promise<boolean> {
  const raiz = useBiblioteca.getState().raiz
  if (!raiz || !useMaeTema.getState().hist) return false
  useMaeTema.getState().aplicar('Salvar tema', t => { t.version += 1 })
  await salvarTema(raiz, useMaeTema.getState().hist!.atual as DocTema)
  useMaeTema.getState().marcarSalvo()
  return true
}
