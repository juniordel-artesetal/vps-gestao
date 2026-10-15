// mae-pedidos — LOTE DE IMPRESSÃO (Lote 7, itens 117/118). Puro:
//  • ordem das páginas: POR PEDIDO (o kit de cada cliente junto) ou POR MODELO (todas as milks, depois os cubos…);
//  • "Intercalar temas iguais" (por modelo): dois pedidos do mesmo tema não ficam colados; as cópias do MESMO pedido
//    continuam juntas. Se não der (todos do mesmo tema), fica a ordem normal — sem erro e sem aviso;
//  • divisão em arquivos (não travar o navegador nem a impressora) e o nome do arquivo;
//  • lugar do "#123 · Naty" na página, fora da linha de corte e da sangria.

export interface BlocoLote {
  /** Pedido (id) e tema dele — o tema é o que se intercala. */
  pedido: string; tema: string
  /** Modelo da página (MILK, CUBO…): o nome da folha ou dos moldes nela. */
  modelo: string
  /** Ordem da página dentro do pedido. */
  indice: number
}
export type OrdemLote = 'pedido' | 'modelo'

/** Por pedido: na ordem em que os pedidos chegaram, cada um com as suas páginas em ordem. */
function porPedido<T extends BlocoLote>(blocos: T[]): T[] {
  const ordemPedido = new Map<string, number>()
  blocos.forEach(b => { if (!ordemPedido.has(b.pedido)) ordemPedido.set(b.pedido, ordemPedido.size) })
  return blocos.map((b, i) => ({ b, i })).sort((x, y) => ordemPedido.get(x.b.pedido)! - ordemPedido.get(y.b.pedido)! || x.b.indice - y.b.indice || x.i - y.i).map(x => x.b)
}

/**
 * Intercala unidades (cada uma = as páginas de UM pedido naquele modelo) para que o mesmo tema não se repita em
 * seguida: a cada passo, entre os temas diferentes do último, o que ainda tem mais unidades (empate: o que aparece
 * primeiro); sem tema diferente disponível, a próxima na ordem.
 */
export function intercalar<U extends { tema: string }>(unidades: U[]): U[] {
  const resto = unidades.map((u, i) => ({ u, i }))
  const out: U[] = []
  let ultimo: string | null = null
  while (resto.length) {
    const conta = new Map<string, number>()
    for (const r of resto) conta.set(r.u.tema, (conta.get(r.u.tema) ?? 0) + 1)
    let k = -1
    for (let j = 0; j < resto.length; j++) {
      const t = resto[j].u.tema
      if (t === ultimo) continue
      if (k < 0 || conta.get(t)! > conta.get(resto[k].u.tema)!) k = j
    }
    if (k < 0) k = 0
    const [esc] = resto.splice(k, 1)
    out.push(esc.u); ultimo = esc.u.tema
  }
  return out
}

/** Ordena as páginas do lote. */
export function ordenarLote<T extends BlocoLote>(blocos: T[], ordem: OrdemLote, intercalarTemas = true): T[] {
  const pp = porPedido(blocos)
  if (ordem === 'pedido') return pp
  // por modelo: modelos na ordem em que aparecem; dentro do modelo, uma unidade por pedido (cópias juntas)
  const modelos: string[] = []
  for (const b of pp) if (!modelos.includes(b.modelo)) modelos.push(b.modelo)
  const out: T[] = []
  for (const m of modelos) {
    const unidades: { tema: string; blocos: T[] }[] = []
    for (const b of pp.filter(x => x.modelo === m)) {
      const u = unidades.find(x => x.blocos[0].pedido === b.pedido)
      if (u) u.blocos.push(b); else unidades.push({ tema: b.tema, blocos: [b] })
    }
    for (const u of intercalarTemas ? intercalar(unidades) : unidades) out.push(...u.blocos)
  }
  return out
}

/** Divide os pedidos em partes de até `max` pedidos (sugestão da Naty: 10). */
export function dividirEmPartes<T>(itens: T[], max: number): T[][] {
  const n = Math.max(1, Math.floor(max) || 10)
  const out: T[][] = []
  for (let i = 0; i < itens.length; i += n) out.push(itens.slice(i, i + n))
  return out
}

const limpar = (s: string, n: number) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n) || 'Pedidos'
/**
 * Lote 11 (item 165): `LOTE_13-10_10h_2pedidos_36pag` (sem extensão). O nome NUNCA leva o tema/anúncio de um pedido
 * só (o lote mistura temas); com "Separar por papel", o papel entra (`LOTE_13-10_10h_Tags_5pedidos_10pag`). Uma parte
 * só → sem o "1de1".
 */
export function nomeDoLote(o: { data: Date; papel?: string; pedidos: number; parte: number; partes: number; paginas: number }): string {
  const d = `${String(o.data.getDate()).padStart(2, '0')}-${String(o.data.getMonth() + 1).padStart(2, '0')}_${String(o.data.getHours()).padStart(2, '0')}h`
  const papel = o.papel ? `_${limpar(o.papel, 30)}` : ''
  return `LOTE_${d}${papel}_${o.pedidos}pedido${o.pedidos === 1 ? '' : 's'}${o.partes > 1 ? `_${o.parte}de${o.partes}` : ''}_${o.paginas}pag`
}

/** Lote 11 (item 165): chave do "Separar por papel" — o PRODUTO DA BASE (grupo: Kit Festa × Tag), nunca o anúncio. */
export const papelDoItem = (grupoDaBase: string | null | undefined): string => (grupoDaBase ?? '').trim()

/**
 * Lote 19 (item 235): o TIPO DE PRODUTO do lote é a BASE (as mesmas caixas) — nunca o título do anúncio (cada anúncio
 * tem um título, às vezes com o tema, e cada pedido virava um "tipo"). O nome curto sai do grupo do produto na base
 * ("Pegue e monte") ou do começo do nome da base ("kit festa_spidey…_editavel v4" → "kit festa"; "Rótulo Nutella -
 * ARTE PRONTA" → "Rótulo Nutella").
 */
export function tipoDeProduto(nomeBase: string | null | undefined, grupo?: string | null): string {
  const g = (grupo ?? '').trim()
  if (g) return g.slice(0, 40)
  const n = (nomeBase ?? '').replace(/\s*[-–]\s*(arte pronta|editavel|editável).*$/i, '').split(/_| [-–] /)[0].replace(/\b(mr|molde|editavel|editável|v\d+)\b/gi, '').replace(/\s+/g, ' ').trim()
  return (n || (nomeBase ?? '').trim() || 'Produto').slice(0, 40)
}

/**
 * Onde vai o "#123 · Naty" na página: na MARGEM ESQUERDA (de pé, lido de baixo para cima — sempre no mesmo lugar,
 * fácil de achar na pilha) quando há espaço fora das caixas (já com a sangria); senão, no lado com mais espaço.
 * Sem 4 mm livres em nenhum lado → null (não imprime, para não cair na arte).
 */
export function lugarDoRotulo(pagW: number, pagH: number, caixas: { x: number; y: number; w: number; h: number }[], minMm = 4): { xMm: number; yMm: number; vertical: boolean } | null {
  if (!caixas.length) return { xMm: 1.5, yMm: pagH / 2, vertical: true }
  const x0 = Math.min(...caixas.map(c => c.x)), x1 = Math.max(...caixas.map(c => c.x + c.w))
  const y0 = Math.min(...caixas.map(c => c.y)), y1 = Math.max(...caixas.map(c => c.y + c.h))
  const lados = [
    { livre: x0, r: { xMm: Math.max(0.5, x0 / 2 - 1.1), yMm: pagH * 0.62, vertical: true } },
    { livre: pagW - x1, r: { xMm: x1 + (pagW - x1) / 2 - 1.1, yMm: pagH * 0.62, vertical: true } },
    { livre: pagH - y1, r: { xMm: pagW * 0.3, yMm: y1 + (pagH - y1) / 2 + 1, vertical: false } },
    { livre: y0, r: { xMm: pagW * 0.3, yMm: y0 / 2 + 1, vertical: false } },
  ]
  if (lados[0].livre >= minMm) return lados[0].r
  const melhor = [...lados].sort((a, b) => b.livre - a.livre)[0]
  return melhor.livre >= minMm ? melhor.r : null
}
