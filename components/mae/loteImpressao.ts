'use client'
// LOTE DE IMPRESSÃO (Lote 7, itens 117/118): vários pedidos num PDF só, já nas quantidades de cada caixa (item 79).
//  • cada arte diferente é renderizada UMA vez (exportar com `soPaginas`) e a MESMA página serve para todas as cópias
//    — o peso é o nº de artes diferentes (pedidos × caixas), não o de cópias;
//  • Lote 11 (item 165): UM PDF com todos os pedidos (temas diferentes juntos), na pasta Exportações/hoje/LOTES;
//    "Separar por papel" só separa kit × tag (produto da base), nunca pedido/tema/anúncio;
//  • divisão automática em partes de até N pedidos (LOTE_2026-10-11_Kit-Festa_1de3_48pag.pdf) — cada parte é montada
//    e gravada antes da próxima começar (não trava o navegador nem a impressora);
//  • ordem por pedido ou por modelo (com "intercalar temas iguais") e o "#123 · Naty" na margem, fora do corte.
// Produtos de FOLHA MONTADA não passam por aqui: seguem o gabarito fixo e o "Aproveitar folhas" (item 95).
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { PaginaPdf } from '@/lib/mae/exportar/pdf'
import { caixaDoMolde } from '@/lib/mae/exportar/linhas'
import { nomeLivre } from '@/lib/mae/exportar/nomes'
import { gravar, listar } from '@/lib/mae/biblioteca/arquivos'
import { ordenarLote, dividirEmPartes, nomeDoLote, lugarDoRotulo, type OrdemLote } from '@/lib/mae/pedidos/ordemLote'
import { exportar } from './exportarMae'
import { opcoesDoPedido } from './pedidosMae'
import type { Identidade } from './arquivosMae'
import type { MarcaRegistro } from './sincronia'
import { mensagemDeErro } from '@/lib/mae/erros'

export interface ItemLote {
  /** id da fila (pedido ou pedido#2 quando o pedido tem vários produtos) e o pedido de verdade. */
  id: string; pedidoId: string; numero: string; nome: string
  temaNome: string; tema: DocTema; doc: DocTrabalho
  valores: Record<string, string>
  /** Cópias por caixa (quantidades do pedido); undefined = 1 de cada. */
  copias?: Record<string, number>
  /** Produto (anúncio/grupo) — só para os avisos. */
  produto: string
  /** Lote 11 (item 165): o PAPEL (produto da base de portfólio: Kit Festa × Tag) — a única coisa que separa lotes. */
  papel: string
}
export interface OpcoesLote {
  ordem: OrdemLote; intercalar: boolean; identificacao: boolean
  maxPedidos: number; separarPorProduto: boolean
  linhas: boolean; apliques: boolean
  /** Lote 11 (item 165): a pasta ÚNICA dos lotes (Exportações/hoje/LOTES), fora das pastas de produto. */
  pasta: string
}
export interface ResultadoLote { id: string; arquivo: string | null; lote: string | null; revisar: boolean; alertas: string[]; erro?: string }

/** "#123 · Naty" em cada caixa do pedido, na margem (fora da linha de corte e da sangria). */
function rotulosDoPedido(doc: DocTrabalho, texto: string): Record<string, { xMm: number; yMm: number; texto: string; vertical?: boolean }[]> {
  const sobra = doc.pronto ? 0 : doc.smartArt?.overflowMm ?? 10
  const out: Record<string, { xMm: number; yMm: number; texto: string; vertical?: boolean }[]> = {}
  for (const ab of doc.artboards) {
    const caixas = doc.molds.filter(m => m.artboardId === ab.id && m.faces.length).map(m => caixaDoMolde(doc, m.id, sobra)).filter((c): c is NonNullable<typeof c> => !!c)
    if (!caixas.length) continue
    const l = lugarDoRotulo(ab.widthMm, ab.heightMm, caixas)
    if (l) out[ab.id] = [{ ...l, texto }]
  }
  return out
}

export async function gerarLotesImpressao(
  ctx: { raiz: FileSystemDirectoryHandle; identidade: Identidade; marcas: MarcaRegistro[] },
  itens: ItemLote[], o: OpcoesLote,
  cb: { aoProgredir?: (feitos: number, total: number, atual: string) => void; cancelado?: () => boolean } = {},
): Promise<ResultadoLote[]> {
  // Lote 11 (item 165): UM PDF com todos os pedidos (temas diferentes juntos); "Separar por papel" só separa kit × tag
  // (antes a chave era o anúncio da Shopee, que leva o tema → saía um arquivo por pedido, cada um na pasta do produto)
  const grupos = new Map<string, ItemLote[]>()
  for (const it of itens) { const k = o.separarPorProduto ? it.papel : ''; grupos.set(k, [...(grupos.get(k) ?? []), it]) }
  const variosPapeis = grupos.size > 1
  const hoje = new Date()
  const out: ResultadoLote[] = []
  let feitos = 0
  for (const [produto, lista] of grupos) {
    const partes = dividirEmPartes(lista, o.maxPedidos)
    for (const [ip, parte] of partes.entries()) {
      if (cb.cancelado?.()) return out
      type Bloco = { pedido: string; tema: string; modelo: string; indice: number; pagina: PaginaPdf; copias: number }
      const blocos: Bloco[] = []
      const porItem: ResultadoLote[] = []
      for (const it of parte) {
        if (cb.cancelado?.()) return out
        cb.aoProgredir?.(feitos, itens.length, `Lote${produto ? ` ${produto}` : ''}${partes.length > 1 ? ` (${ip + 1} de ${partes.length})` : ''} · pedido ${it.numero}`)
        try {
          const r = await exportar({ raiz: ctx.raiz, doc: it.doc, tema: it.tema, identidade: ctx.identidade, marcas: ctx.marcas }, {
            ...opcoesDoPedido({ agrupar: 'tudo', linhas: o.linhas, apliques: o.apliques }, it.valores, o.pasta),
            pedido: it.numero, copias: it.copias, soPaginas: true,
            ...(o.identificacao ? { rotulos: rotulosDoPedido(it.doc, `#${it.numero}${it.nome ? ` · ${it.nome}` : ''}`) } : {}),
          })
          ;(r.paginas ?? []).forEach((p, k) => blocos.push({ pedido: it.id, tema: it.temaNome, modelo: p.modelo, indice: k, pagina: p.pagina, copias: p.copias }))
          porItem.push({ id: it.id, arquivo: null, lote: null, revisar: r.revisar, alertas: r.alertas.filter(a => !/girada 90°|MARCA foi girada/.test(a)) })
        } catch (e) { porItem.push({ id: it.id, arquivo: null, lote: null, revisar: false, alertas: [], erro: mensagemDeErro(e) }) }
        feitos++
      }
      // a ordem escolhida; cada página repetida nas suas cópias (o MESMO objeto → a imagem entra 1× no PDF)
      const paginas = ordenarLote(blocos, o.ordem, o.intercalar).flatMap(b => Array.from({ length: b.copias }, () => b.pagina))
      if (!paginas.length) { out.push(...porItem.map(r => ({ ...r, erro: r.erro ?? 'nenhuma página para imprimir' }))); continue }
      const { montarPdf } = await import('@/lib/mae/exportar/pdf')
      const pasta = o.pasta
      const existentes = new Set((await listar(ctx.raiz, pasta).catch(() => [])).map(e => e.nome))
      const nome = nomeDoLote({ data: hoje, papel: variosPapeis ? produto : undefined, pedidos: parte.length, parte: ip + 1, partes: partes.length, paginas: paginas.length })
      const arquivo = `${pasta}/${nomeLivre(`${nome}.pdf`, existentes)}`
      await gravar(ctx.raiz, arquivo, new Blob([await montarPdf(paginas, `Lote${produto ? ` ${produto}` : ''} · ${parte.length} pedidos`) as BlobPart], { type: 'application/pdf' }))
      out.push(...porItem.map(r => (r.erro ? r : { ...r, arquivo, lote: nome })))
    }
  }
  return out
}
