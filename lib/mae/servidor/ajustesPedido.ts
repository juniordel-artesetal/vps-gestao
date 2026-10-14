// Método MAE — AJUSTES SÓ DO PEDIDO (_mae), iguais para qualquer FONTE de pedidos (Lote 7, item 120): o pedido do
// SOA guarda em "Order".camposExtras._mae; o do MAE avulso, em mae_orders.ajustes. Leitura saneada + aplicação do
// PATCH (null tira). Puro (sem banco). Antes vivia dentro de app/api/mae/pedidos/route.ts.
import { EstiloTexto } from '@/lib/mae/schema/tema'

export function lerExtras(x: unknown): Record<string, unknown> {
  if (typeof x === 'string') { try { return JSON.parse(x) || {} } catch { return {} } }
  return (x as Record<string, unknown>) || {}
}
/** Só valores simples; ignora internos (_freelancers…) e a lista de produtos. */
export function camposSimples(extras: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(extras)) {
    if (k.startsWith('_') || k === 'produtos' || v === null || v === undefined || typeof v === 'object') continue
    const s = String(v).trim()
    if (s) out[k] = s
  }
  return out
}

export const VARS_ESCALA = ['NOME', 'IDADE', 'HASHTAG', 'ARROBA'] as const
/** Tamanho do texto só deste pedido (Lote 1): _mae.escalas = { NOME: 1.2, … }. */
export function escalasDe(mae: Record<string, unknown>): Record<string, number> {
  const e = (mae.escalas as Record<string, unknown> | undefined) ?? {}
  const out: Record<string, number> = {}
  for (const k of VARS_ESCALA) { const v = Number(e[k]); if (Number.isFinite(v) && v >= 0.2 && v <= 4) out[k] = Math.round(v * 100) / 100 }
  return out
}
/** Lote 4 (item 50): nome composto em 1 ou 2 linhas SÓ neste pedido: _mae.linhas = { NOME: '1' | '2' }. */
export function linhasDe(mae: Record<string, unknown>): Record<string, '1' | '2'> {
  const e = (mae.linhas as Record<string, unknown> | undefined) ?? {}
  const out: Record<string, '1' | '2'> = {}
  for (const k of VARS_ESCALA) { const v = String(e[k] ?? ''); if (v === '1' || v === '2') out[k] = v }
  return out
}
/** Lote 5 (item 79): quantidade de cada CAIXA (prancheta) por produto do pedido: _mae.quantidades[produto][prancheta]. */
export type Quantidades = Record<string, Record<string, number>>
export function quantidadesDe(mae: Record<string, unknown>): Quantidades {
  const q = mae.quantidades
  const out: Quantidades = {}
  if (!q || typeof q !== 'object') return out
  for (const [prod, porCaixa] of Object.entries(q as Record<string, unknown>)) {
    if (!porCaixa || typeof porCaixa !== 'object') continue
    const m: Record<string, number> = {}
    for (const [ab, n] of Object.entries(porCaixa as Record<string, unknown>)) { const v = Math.round(Number(n)); if (Number.isFinite(v) && v >= 0 && v <= 999) m[ab.slice(0, 120)] = v }
    out[prod.slice(0, 200)] = m
  }
  return out
}
/** Lote 5 (item 59): posição de texto ajustada SÓ neste pedido (botão Ajustar): _mae.posicoes[slot] = {dx,dy,scale,rotationDeg}. */
export type Posicao = { dx?: number; dy?: number; scale?: number; rotationDeg?: number; lines?: 1 | 2 }
export function posicoesDe(mae: Record<string, unknown>): Record<string, Posicao> {
  const p = mae.posicoes
  const out: Record<string, Posicao> = {}
  if (!p || typeof p !== 'object') return out
  const lim = (v: unknown, a: number, b: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : undefined }
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const x: Posicao = {}
    const dx = lim(o.dx, -1, 1), dy = lim(o.dy, -1, 1), sc = lim(o.scale, 0.2, 4), rt = lim(o.rotationDeg, -360, 360)
    if (dx !== undefined) x.dx = dx; if (dy !== undefined) x.dy = dy; if (sc !== undefined) x.scale = sc; if (rt !== undefined) x.rotationDeg = rt
    if (o.lines === 1 || o.lines === 2) x.lines = o.lines
    if (Object.keys(x).length) out[k.slice(0, 120)] = x
  }
  return out
}
/** Lote 5 (item 75): trocas de letra por variável: _mae.trocas[VAR] = [{ letra, so, fonte?, gid?, escala?, baselineMm?, espacoMm? }]. */
export type Troca = { letra: string; so?: 'inicial' | 'todas'; fonte?: { postscriptName: string; family?: string; source?: string; url?: string }; gid?: number; escala?: number; baselineMm?: number; espacoMm?: number }
export function trocasDe(mae: Record<string, unknown>): Record<string, Troca[]> {
  const t = mae.trocas
  const out: Record<string, Troca[]> = {}
  if (!t || typeof t !== 'object') return out
  const num = (v: unknown, a: number, b: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : undefined }
  for (const [k, l] of Object.entries(t as Record<string, unknown>)) {
    if (!Array.isArray(l)) continue
    const lista = l.slice(0, 10).filter(x => x && typeof x === 'object' && typeof (x as Troca).letra === 'string' && (x as Troca).letra.length <= 2).map(x => {
      const o = x as Troca
      const f = o.fonte && typeof o.fonte.postscriptName === 'string' ? { postscriptName: o.fonte.postscriptName.slice(0, 120), family: String(o.fonte.family ?? '').slice(0, 120) || undefined, source: o.fonte.source === 'google' ? 'google' : 'local', url: typeof o.fonte.url === 'string' && /^https:\/\//.test(o.fonte.url) ? o.fonte.url.slice(0, 300) : undefined } : undefined
      return { letra: o.letra, so: o.so === 'inicial' ? 'inicial' as const : 'todas' as const, ...(f ? { fonte: f } : {}), ...(Number.isInteger(o.gid) && (o.gid as number) > 0 ? { gid: o.gid } : {}),
        escala: num(o.escala, 0.3, 3), baselineMm: num(o.baselineMm, -20, 20), espacoMm: num(o.espacoMm, -10, 10) }
    })
    if (lista.length) out[k.slice(0, 40)] = lista
  }
  return out
}
/** Lote 13 (item 178): estilo do texto SÓ DESTE PEDIDO: _mae.estilos[VAR] = o estilo inteiro (validado). */
export function estilosDe(mae: Record<string, unknown>): Record<string, unknown> {
  const e = mae.estilos
  const out: Record<string, unknown> = {}
  if (!e || typeof e !== 'object') return out
  for (const [k, v] of Object.entries(e as Record<string, unknown>).slice(0, 12)) {
    const r = EstiloTexto.safeParse(v)
    if (r.success && k.length <= 40) out[k] = r.data
  }
  return out
}
export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const ID_TEMA = /^[A-Za-z0-9_-]{1,80}$/

/** Os ajustes como a tela recebe (PedidoApi.ajustes). */
export function ajustesParaTela(mae: Record<string, unknown>) {
  return {
    escalas: escalasDe(mae), linhas: linhasDe(mae), quantidades: quantidadesDe(mae), posicoes: posicoesDe(mae),
    formatoIdade: typeof mae.formatoIdade === 'string' ? mae.formatoIdade : null, trocas: trocasDe(mae), estilos: estilosDe(mae),
    temaId: typeof mae.temaId === 'string' ? mae.temaId : null,
    divisaoNome: Number.isInteger(mae.divisaoNome) ? (mae.divisaoNome as number) : null,
  }
}

/** Há algum ajuste no corpo do PATCH (além dos campos)? */
export const temAjuste = (b: Record<string, unknown>) =>
  !!(b.escalas || b.linhas || b.quantidades || b.posicoes || b.trocas || b.estilos) || b.formatoIdade !== undefined || b.temaId !== undefined || b.divisaoNome !== undefined

/** Aplica o PATCH sobre o _mae atual (null tira; "posicoes: {'*': null}" tira todas). Devolve o _mae novo. */
export function aplicarAjustes(mae0: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const bE = (b.escalas ?? {}) as Record<string, unknown>, bL = (b.linhas ?? {}) as Record<string, unknown>
  const escalas = escalasDe({ escalas: { ...escalasDe(mae0), ...bE } })
  for (const k of VARS_ESCALA) if (bE[k] === null) delete escalas[k]
  const linhas = linhasDe({ linhas: { ...linhasDe(mae0), ...bL } })
  for (const k of VARS_ESCALA) if (bL[k] === null) delete linhas[k]
  let quantidades = quantidadesDe(mae0)
  if (b.quantidades && typeof b.quantidades === 'object') {
    quantidades = quantidadesDe({ quantidades: { ...quantidades, ...(b.quantidades as object) } })
    for (const [k, v] of Object.entries(b.quantidades as Record<string, unknown>)) if (v === null) delete quantidades[k]
  }
  let posicoes = posicoesDe(mae0)
  if (b.posicoes && typeof b.posicoes === 'object') {
    if ((b.posicoes as Record<string, unknown>)['*'] === null) posicoes = {}
    posicoes = posicoesDe({ posicoes: { ...posicoes, ...(b.posicoes as object) } })
    for (const [k, v] of Object.entries(b.posicoes as Record<string, unknown>)) if (v === null) delete posicoes[k]
  }
  let formatoIdade = ['anos', 'aninhos', 'numero'].includes(String(mae0.formatoIdade)) ? String(mae0.formatoIdade) : undefined
  if (b.formatoIdade !== undefined) formatoIdade = ['anos', 'aninhos', 'numero'].includes(String(b.formatoIdade)) ? String(b.formatoIdade) : undefined
  const trocas = trocasDe(mae0)
  if (b.trocas && typeof b.trocas === 'object') for (const [k, v] of Object.entries(b.trocas as Record<string, unknown>)) { if (v === null) delete trocas[k]; else { const t = trocasDe({ trocas: { [k]: v } })[k]; if (t) trocas[k] = t } }
  const estilos = estilosDe(mae0)
  if (b.estilos && typeof b.estilos === 'object') for (const [k, v] of Object.entries(b.estilos as Record<string, unknown>)) { if (v === null) delete estilos[k]; else { const e = estilosDe({ estilos: { [k]: v } })[k]; if (e) estilos[k] = e } }
  let temaId = typeof mae0.temaId === 'string' ? mae0.temaId : undefined
  if (b.temaId !== undefined) temaId = typeof b.temaId === 'string' && ID_TEMA.test(b.temaId) ? b.temaId : undefined
  let divisaoNome = Number.isInteger(mae0.divisaoNome) ? (mae0.divisaoNome as number) : undefined
  if (b.divisaoNome !== undefined) divisaoNome = Number.isInteger(b.divisaoNome) && (b.divisaoNome as number) >= 0 && (b.divisaoNome as number) <= 6 ? (b.divisaoNome as number) : undefined
  const novo: Record<string, unknown> = { ...mae0, escalas, linhas, quantidades, posicoes, formatoIdade, trocas, estilos, temaId, divisaoNome }
  if (!temaId) delete novo.temaId
  if (divisaoNome === undefined) delete novo.divisaoNome
  if (formatoIdade === undefined) delete novo.formatoIdade
  return novo
}

/** Lote 7 (item 116): tema válido para o "vincular em massa" (null = volta ao automático). */
export const temaValido = (t: unknown): string | null | undefined => (t === null ? null : typeof t === 'string' && ID_TEMA.test(t) ? t : undefined)
