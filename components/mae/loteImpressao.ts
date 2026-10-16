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
import { nomeFolhaPng, semExtensao } from '@/lib/mae/exportar/nomesPng'
import { ordenarLote, unificarModelos, dividirEmPartes, nomeDoLote, lugarDoRotulo, type OrdemLote } from '@/lib/mae/pedidos/ordemLote'
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
  /** Lote 14 (item 190): kit de folhas com vários pedidos juntos (Aproveitar folhas) — quantos pedidos este item leva. */
  nPedidos?: number
  /** Lote 14 (item 187): o texto de cada posição (kit de folhas) e o "#123 · Naty" já no lugar (margem da folha). */
  valoresPorSlot?: Record<string, Record<string, string>>
  rotulos?: Record<string, { xMm: number; yMm: number; texto: string; vertical?: boolean }[]>
}
export interface OpcoesLote {
  ordem: OrdemLote; intercalar: boolean; identificacao: boolean
  maxPedidos: number; separarPorProduto: boolean
  linhas: boolean; apliques: boolean
  /** Lote 13 (item 175): fundo branco atrás das marcas (padrão: ligado) e folga em mm. */
  fundoMarca?: boolean; folgaMarcaMm?: number
  /** Lote 11 (item 165): a pasta ÚNICA dos lotes (Exportações/hoje/LOTES), fora das pastas de produto. */
  pasta: string
  /** Lote 22 (item 262): o lote em PNG (300 dpi, uma imagem por folha, num .zip). */
  saidaPng?: { transparente: boolean }
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
  // Lote 14 (item 199): "Um PDF por tipo de produto" separa pelo PRODUTO e o nome de TODOS os arquivos diz qual é;
  // desligado, tudo num PDF só (o PDF aceita páginas de tamanhos diferentes)
  for (const it of itens) { const k = o.separarPorProduto ? it.papel : ''; grupos.set(k, [...(grupos.get(k) ?? []), it]) }
  const hoje = new Date()
  const out: ResultadoLote[] = []
  let feitos = 0
  for (const [produto, lista] of grupos) {
    const partes = dividirEmPartes(lista, o.maxPedidos)
    for (const [ip, parte] of partes.entries()) {
      if (cb.cancelado?.()) return out
      type Bloco = { pedido: string; tema: string; modelo: string; caixa?: string; indice: number; pagina: PaginaPdf; copias: number }
      const blocos: Bloco[] = []
      const porItem: ResultadoLote[] = []
      for (const it of parte) {
        if (cb.cancelado?.()) return out
        cb.aoProgredir?.(feitos, itens.length, `Lote${produto ? ` ${produto}` : ''}${partes.length > 1 ? ` (${ip + 1} de ${partes.length})` : ''} · pedido ${it.numero}`)
        try {
          const r = await exportar({ raiz: ctx.raiz, doc: it.doc, tema: it.tema, identidade: ctx.identidade, marcas: ctx.marcas }, {
            ...opcoesDoPedido({ agrupar: 'tudo', linhas: o.linhas, apliques: o.apliques, fundoMarca: o.fundoMarca, folgaMarcaMm: o.folgaMarcaMm }, it.valores, o.pasta),
            pedido: it.numero, copias: it.copias, soPaginas: true, ...(o.saidaPng ? { saidaPng: o.saidaPng } : {}),
            ...(it.valoresPorSlot ? { valoresPorSlot: it.valoresPorSlot } : {}),
            ...(it.rotulos ? { rotulos: it.rotulos } : o.identificacao ? { rotulos: rotulosDoPedido(it.doc, `#${it.numero}${it.nome ? ` · ${it.nome}` : ''}`) } : {}),
          })
          ;(r.paginas ?? []).forEach((p, k) => blocos.push({ pedido: it.id, tema: it.temaNome, modelo: p.modelo, caixa: p.caixa, indice: k, pagina: p.pagina, copias: p.copias }))
          porItem.push({ id: it.id, arquivo: null, lote: null, revisar: r.revisar, alertas: r.alertas.filter(a => !/girada 90°|MARCA foi girada/.test(a)) })
        } catch (e) { porItem.push({ id: it.id, arquivo: null, lote: null, revisar: false, alertas: [], erro: mensagemDeErro(e) }) }
        feitos++
      }
      // a ordem escolhida; cada página repetida nas suas cópias (o MESMO objeto → a imagem entra 1× no PDF)
      // Lote 22 (item 260): tema pronto sem marca entra na mesma caixa; marcas diferentes de verdade → aviso no resumo
      const un = unificarModelos(blocos, id => { const it = parte.find(x => x.id === id); return it ? `${it.nome || `#${it.numero}`} (${it.temaNome})` : id })
      if (un.avisos.length && porItem[0]) porItem[0].alertas.push(...un.avisos)
      const paginas = ordenarLote(un.blocos, o.ordem, o.intercalar).flatMap(b => Array.from({ length: b.copias }, () => b.pagina))
      if (!paginas.length) { out.push(...porItem.map(r => ({ ...r, erro: r.erro ?? 'nenhuma página para imprimir' }))); continue }
      const { montarPdf } = await import('@/lib/mae/exportar/pdf')
      const pasta = o.pasta
      const existentes = new Set((await listar(ctx.raiz, pasta).catch(() => [])).map(e => e.nome))
      const nPed = parte.reduce((s, it) => s + (it.nPedidos ?? 1), 0)
      const nome = nomeDoLote({ data: hoje, papel: produto || undefined, pedidos: nPed, parte: ip + 1, partes: partes.length, paginas: paginas.length })
      const pdfBytes = await montarPdf(paginas, `Lote${produto ? ` ${produto}` : ''} · ${nPed} pedidos`)
      let arquivo: string
      if (o.saidaPng) {
        // Lote 22 (item 262): cada folha do lote vira um PNG de 300 dpi (a mesma página do PDF) — tudo num .zip
        cb.aoProgredir?.(feitos, itens.length, `Lote${produto ? ` ${produto}` : ''} · gerando os PNG…`)
        const { pdfComoPngs, zipDosPngs } = await import('@/lib/mae/importacao/navegador')
        const pngs = await pdfComoPngs(pdfBytes, 300, o.saidaPng.transparente, (n, t) => cb.aoProgredir?.(feitos, itens.length, `Lote · PNG ${n} de ${t}`))
        const base = semExtensao(nomeLivre(`${nome}.zip`, existentes))
        arquivo = `${pasta}/${base}.zip`
        await gravar(ctx.raiz, arquivo, await zipDosPngs(pngs.map((b, i) => ({ nome: nomeFolhaPng(base, i, pngs.length), blob: b }))))
      } else {
        arquivo = `${pasta}/${nomeLivre(`${nome}.pdf`, existentes)}`
        await gravar(ctx.raiz, arquivo, new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }))
      }
      out.push(...porItem.map(r => (r.erro ? r : { ...r, arquivo, lote: nome })))
    }
  }
  return out
}
