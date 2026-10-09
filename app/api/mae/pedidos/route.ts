// Método MAE — PEDIDOS para "Gerar arte" e "Edição em massa" (Sprint 12). Devolve, por pedido: os campos
// personalizados achatados (TEMA, NOME, IDADE… como estão em camposExtras), os itens com variação e
// produto (para o vínculo produto ↔ tema) e o histórico das artes geradas (mae_order_arts).
// ?id=<pedido> → só ele (card do pedido). Sem id → os pedidos em aberto (lista da edição em massa,
// que exige o add-on "Edição em massa").
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { contaMae } from '@/lib/mae/servidor/acesso'
import { campoParaGravar } from '@/lib/mae/pedidos/pedidos'

export const dynamic = 'force-dynamic'

type Linha = { id: string; numero: string; cliente: string | null; produto: string | null; status: string; camposExtras: unknown; criado: Date; observacoes: string | null; quantidade: number | null }

function lerExtras(x: unknown): Record<string, unknown> {
  if (typeof x === 'string') { try { return JSON.parse(x) || {} } catch { return {} } }
  return (x as Record<string, unknown>) || {}
}
/** Só valores simples; ignora internos (_freelancers…) e a lista de produtos. */
function campos(extras: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(extras)) {
    if (k.startsWith('_') || k === 'produtos' || v === null || v === undefined || typeof v === 'object') continue
    const s = String(v).trim()
    if (s) out[k] = s
  }
  return out
}

const VARS_ESCALA = ['NOME', 'IDADE', 'HASHTAG', 'ARROBA'] as const
/** Tamanho do texto só deste pedido (Lote 1): camposExtras._mae.escalas = { NOME: 1.2, … }. */
function escalasDe(extras: Record<string, unknown>): Record<string, number> {
  const e = (extras._mae as { escalas?: Record<string, unknown> } | undefined)?.escalas ?? {}
  const out: Record<string, number> = {}
  for (const k of VARS_ESCALA) { const v = Number(e[k]); if (Number.isFinite(v) && v >= 0.2 && v <= 4) out[k] = Math.round(v * 100) / 100 }
  return out
}

/** Lote 4 (item 50): nome composto em 1 ou 2 linhas SÓ neste pedido: camposExtras._mae.linhas = { NOME: '1' | '2' }. */
function linhasDe(extras: Record<string, unknown>): Record<string, '1' | '2'> {
  const e = (extras._mae as { linhas?: Record<string, unknown> } | undefined)?.linhas ?? {}
  const out: Record<string, '1' | '2'> = {}
  for (const k of VARS_ESCALA) { const v = String(e[k] ?? ''); if (v === '1' || v === '2') out[k] = v }
  return out
}

/** Lote 5 (item 79): quantidade de cada CAIXA (prancheta) por produto do pedido: _mae.quantidades[produto][prancheta]. */
type Quantidades = Record<string, Record<string, number>>
function quantidadesDe(extras: Record<string, unknown>): Quantidades {
  const q = (extras._mae as { quantidades?: unknown } | undefined)?.quantidades
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
type Posicao = { dx?: number; dy?: number; scale?: number; rotationDeg?: number; lines?: 1 | 2 }
function posicoesDe(extras: Record<string, unknown>): Record<string, Posicao> {
  const p = (extras._mae as { posicoes?: unknown } | undefined)?.posicoes
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
type Troca = { letra: string; so?: 'inicial' | 'todas'; fonte?: { postscriptName: string; family?: string; source?: string; url?: string }; gid?: number; escala?: number; baselineMm?: number; espacoMm?: number }
function trocasDe(extras: Record<string, unknown>): Record<string, Troca[]> {
  const t = (extras._mae as { trocas?: unknown } | undefined)?.trocas
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
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * Grava, só neste pedido: o tamanho do NOME/IDADE/HASHTAG/@ (`escalas`, não mexe no tema) e/ou — Lote 4
 * (item 43) — NOME, IDADE e TEMA preenchidos na lista da edição em massa (`campos`), no campo que o ateliê usa.
 */
export async function PATCH(req: NextRequest) {
  const c = await contaMae({}); if (c instanceof NextResponse) return c
  try {
    const b = await req.json().catch(() => ({}))
    const id = String(b?.id ?? '')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    const [l] = await prisma.$queryRaw<{ camposExtras: unknown }[]>`SELECT o."camposExtras" FROM "Order" o WHERE o."workspaceId" = ${c.workspaceId} AND o."id" = ${id} LIMIT 1`
    if (!l) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    let ex = lerExtras(l.camposExtras)
    if (b?.campos && typeof b.campos === 'object') {
      const cfg = await prisma.$queryRaw<{ nome: string }[]>`SELECT "nome" FROM "PedidoCampoConfig" WHERE "workspaceId" = ${c.workspaceId} AND "ativo" = true`
      const novos: Record<string, string> = {}
      for (const v of ['NOME', 'IDADE', 'TEMA'] as const) {
        const val = b.campos[v]
        if (typeof val !== 'string') continue
        novos[campoParaGravar(v, cfg.map(x => x.nome), Object.keys(ex))] = val.trim().slice(0, 120)
      }
      // Lote 5 (item 77): campos extras (SÉRIE/TURMA, PROFESSORA, FRASE…) — no campo do ateliê com o mesmo nome
      // (sem acento/maiúscula), ou no que já existe no pedido; senão, com o próprio nome
      for (const [v, val] of Object.entries(b.campos as Record<string, unknown>)) {
        if (['NOME', 'IDADE', 'TEMA'].includes(v) || typeof val !== 'string' || !/^[\p{L}0-9 _/-]{1,40}$/u.test(v)) continue
        const alvo = [...Object.keys(ex), ...cfg.map(x => x.nome)].find(k => semAcento(k) === semAcento(v)) ?? (v.charAt(0) + v.slice(1).toLowerCase())
        novos[alvo] = val.trim().slice(0, 200)
      }
      if (!Object.keys(novos).length) return NextResponse.json({ error: 'Nada para gravar' }, { status: 400 })
      // merge no banco (jsonb ||): não pisa num campo que a equipe acabou de editar na tela do pedido
      await prisma.$executeRaw`UPDATE "Order" SET "camposExtras" = (COALESCE(NULLIF("camposExtras", '')::jsonb, '{}'::jsonb) || ${JSON.stringify(novos)}::jsonb)::text, "updatedAt" = NOW()
        WHERE "workspaceId" = ${c.workspaceId} AND "id" = ${id}`
      if (!b?.escalas && !b?.quantidades && !b?.posicoes && !b?.trocas && b?.formatoIdade === undefined) return NextResponse.json({ ok: true, campos: novos })
      const [l2] = await prisma.$queryRaw<{ camposExtras: unknown }[]>`SELECT o."camposExtras" FROM "Order" o WHERE o."workspaceId" = ${c.workspaceId} AND o."id" = ${id} LIMIT 1`
      ex = lerExtras(l2?.camposExtras)
    }
    const escalas = escalasDe({ _mae: { escalas: { ...escalasDe(ex), ...(b?.escalas ?? {}) } } })
    for (const k of VARS_ESCALA) if (b?.escalas && b.escalas[k] === null) delete escalas[k]
    const linhas = linhasDe({ _mae: { linhas: { ...linhasDe(ex), ...(b?.linhas ?? {}) } } })
    for (const k of VARS_ESCALA) if (b?.linhas && b.linhas[k] === null) delete linhas[k]
    // Lote 5 (item 79): quantidades por caixa (por produto); null tira as de um produto
    let quantidades = quantidadesDe(ex)
    if (b?.quantidades && typeof b.quantidades === 'object') {
      quantidades = quantidadesDe({ _mae: { quantidades: { ...quantidades, ...b.quantidades } } })
      for (const [k, v] of Object.entries(b.quantidades as Record<string, unknown>)) if (v === null) delete quantidades[k]
    }
    // Lote 5 (item 59): posições ajustadas só neste pedido; null tira a de uma posição; "*": null tira todas
    let posicoes = posicoesDe(ex)
    if (b?.posicoes && typeof b.posicoes === 'object') {
      if ((b.posicoes as Record<string, unknown>)['*'] === null) posicoes = {}
      posicoes = posicoesDe({ _mae: { posicoes: { ...posicoes, ...b.posicoes } } })
      for (const [k, v] of Object.entries(b.posicoes as Record<string, unknown>)) if (v === null) delete posicoes[k]
    }
    // Lote 5 (item 62): formato da idade SÓ neste pedido (anos / aninhos / só o número); null = o do tema
    const exMae = (ex._mae as { formatoIdade?: string } | undefined) ?? {}
    let formatoIdade = ['anos', 'aninhos', 'numero'].includes(String(exMae.formatoIdade)) ? exMae.formatoIdade : undefined
    if (b?.formatoIdade !== undefined) formatoIdade = ['anos', 'aninhos', 'numero'].includes(String(b.formatoIdade)) ? String(b.formatoIdade) : undefined
    // Lote 5 (item 75): letra trocada SÓ neste pedido (botão Ajustar), por variável; null tira
    const trocas = trocasDe(ex)
    if (b?.trocas && typeof b.trocas === 'object') for (const [k, v] of Object.entries(b.trocas as Record<string, unknown>)) { if (v === null) delete trocas[k]; else { const t = trocasDe({ _mae: { trocas: { [k]: v } } })[k]; if (t) trocas[k] = t } }
    const novo = { ...ex, _mae: { ...((ex._mae as object) ?? {}), escalas, linhas, quantidades, posicoes, formatoIdade, trocas } }
    await prisma.$executeRaw`UPDATE "Order" SET "camposExtras" = ${JSON.stringify(novo)}, "updatedAt" = NOW() WHERE "workspaceId" = ${c.workspaceId} AND "id" = ${id}`
    return NextResponse.json({ ok: true, escalas, linhas, quantidades, posicoes, formatoIdade: formatoIdade ?? null, trocas })
  } catch (e) {
    console.error('[MAE PEDIDOS PATCH]', e)
    return NextResponse.json({ error: 'Erro ao salvar o ajuste' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const c = await contaMae(id ? {} : { addon: 'massa' }); if (c instanceof NextResponse) return c
  try {
    const linhas = id
      ? await prisma.$queryRaw<Linha[]>`
          SELECT o."id", o."numero", o."destinatario" AS cliente, o."produto", o."status", o."camposExtras", o."createdAt" AS criado, o."observacoes", o."quantidade"
          FROM "Order" o WHERE o."workspaceId" = ${c.workspaceId} AND o."id" = ${id} LIMIT 1`
      : await prisma.$queryRaw<Linha[]>`
          SELECT o."id", o."numero", o."destinatario" AS cliente, o."produto", o."status", o."camposExtras", o."createdAt" AS criado, o."observacoes", o."quantidade"
          FROM "Order" o
          WHERE o."workspaceId" = ${c.workspaceId} AND o."status" NOT IN ('CANCELADO','ENVIADO','PRONTO','CONCLUIDO','ENTREGUE')
          ORDER BY o."createdAt" DESC LIMIT 300`
    if (id && !linhas.length) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    const ids = linhas.map(l => l.id)
    // itens: variação persistida em camposExtras.produtos[] → produto da variação
    const itensPorPedido = new Map<string, { nome: string; variacaoId: string | null; quantidade: number | null; qtdVendida: number | null }[]>()
    const variacoes = new Set<string>()
    for (const l of linhas) {
      const ex = lerExtras(l.camposExtras)
      const its = Array.isArray(ex.produtos) && ex.produtos.length
        ? (ex.produtos as { nome?: string; variacaoId?: string; quantidade?: unknown; qtdVendida?: unknown; componenteDe?: string }[]).filter(p => p?.nome && !p.componenteDe).map(p => ({
            nome: String(p.nome), variacaoId: p.variacaoId || null,
            // Lote 5 (item 79): peças da linha e kits vendidos (quantidade do kit no nome do arquivo e por caixa)
            quantidade: Number.isFinite(Number(p.quantidade)) && Number(p.quantidade) > 0 ? Math.round(Number(p.quantidade)) : null,
            qtdVendida: Number.isFinite(Number(p.qtdVendida)) && Number(p.qtdVendida) > 0 ? Math.round(Number(p.qtdVendida)) : null,
          }))
        : l.produto ? [{ nome: l.produto, variacaoId: null, quantidade: l.quantidade ?? null, qtdVendida: null }] : []
      for (const i of its) if (i.variacaoId) variacoes.add(i.variacaoId)
      itensPorPedido.set(l.id, its)
    }
    // Lote 4 (itens 43/44): nome do PRODUTO e da VARIAÇÃO na linha (a arte certa é produto + tema)
    const prodDaVar = new Map<string, { produtoId: string; produto: string; variacao: string | null; pecasKit: number | null }>()
    if (variacoes.size) {
      const vs = await prisma.$queryRaw<{ id: string; produtoId: string; produto: string; variacao: string | null; isKit: boolean | null; qtdKit: number | null }[]>`
        SELECT v."id", v."produtoId", p."nome" AS produto, NULLIF(TRIM(COALESCE(v."nome", '')), '') AS variacao, v."isKit", v."qtdKit"
        FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
        WHERE p."workspaceId" = ${c.workspaceId} AND v."id" = ANY(${[...variacoes]})`
      for (const v of vs) prodDaVar.set(v.id, { produtoId: v.produtoId, produto: v.produto, variacao: v.variacao, pecasKit: v.isKit && Number(v.qtdKit) > 1 ? Number(v.qtdKit) : null })
    }
    const artes = ids.length ? await prisma.$queryRaw<{ order_id: string; theme_id: string; theme_version: number; variaveis: unknown; status: string; arquivo: string | null; criado_em: Date }[]>`
      SELECT order_id, theme_id, theme_version, variaveis, status, arquivo, criado_em FROM mae_order_arts
      WHERE workspace_id = ${c.workspaceId} AND order_id = ANY(${ids}) ORDER BY criado_em` : []
    const pedidos = linhas.map(l => ({
      id: l.id, numero: l.numero, cliente: l.cliente, status: l.status, criado: l.criado,
      // Lote 5 (item 78): a observação do pedido (💬 na linha) — a equipe lê sem sair da tela
      observacoes: l.observacoes?.trim() || null,
      campos: campos(lerExtras(l.camposExtras)),
      ajustes: { escalas: escalasDe(lerExtras(l.camposExtras)), linhas: linhasDe(lerExtras(l.camposExtras)), quantidades: quantidadesDe(lerExtras(l.camposExtras)), posicoes: posicoesDe(lerExtras(l.camposExtras)),
        formatoIdade: ((lerExtras(l.camposExtras)._mae as { formatoIdade?: string } | undefined)?.formatoIdade ?? null), trocas: trocasDe(lerExtras(l.camposExtras)) },
      itens: (itensPorPedido.get(l.id) ?? []).map(i => {
        const pv = i.variacaoId ? prodDaVar.get(i.variacaoId) : undefined
        return { ...i, produtoId: pv?.produtoId ?? null, produto: pv?.produto ?? null, variacao: pv?.variacao ?? null, pecasKit: pv?.pecasKit ?? null }
      }),
      artes: artes.filter(a => a.order_id === l.id).map(a => ({ themeId: a.theme_id, themeVersion: a.theme_version, variaveis: a.variaveis, status: a.status, arquivo: a.arquivo, criadoEm: a.criado_em })),
    }))
    return NextResponse.json(serialize({ pedidos }))
  } catch (e) {
    console.error('[MAE PEDIDOS GET]', e)
    return NextResponse.json({ error: 'Erro ao listar os pedidos' }, { status: 500 })
  }
}
