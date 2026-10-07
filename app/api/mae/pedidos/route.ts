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

type Linha = { id: string; numero: string; cliente: string | null; produto: string | null; status: string; camposExtras: unknown; criado: Date }

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
      if (!Object.keys(novos).length) return NextResponse.json({ error: 'Nada para gravar' }, { status: 400 })
      // merge no banco (jsonb ||): não pisa num campo que a equipe acabou de editar na tela do pedido
      await prisma.$executeRaw`UPDATE "Order" SET "camposExtras" = (COALESCE(NULLIF("camposExtras", '')::jsonb, '{}'::jsonb) || ${JSON.stringify(novos)}::jsonb)::text, "updatedAt" = NOW()
        WHERE "workspaceId" = ${c.workspaceId} AND "id" = ${id}`
      if (!b?.escalas) return NextResponse.json({ ok: true, campos: novos })
      const [l2] = await prisma.$queryRaw<{ camposExtras: unknown }[]>`SELECT o."camposExtras" FROM "Order" o WHERE o."workspaceId" = ${c.workspaceId} AND o."id" = ${id} LIMIT 1`
      ex = lerExtras(l2?.camposExtras)
    }
    const escalas = escalasDe({ _mae: { escalas: { ...escalasDe(ex), ...(b?.escalas ?? {}) } } })
    for (const k of VARS_ESCALA) if (b?.escalas && b.escalas[k] === null) delete escalas[k]
    const novo = { ...ex, _mae: { ...((ex._mae as object) ?? {}), escalas } }
    await prisma.$executeRaw`UPDATE "Order" SET "camposExtras" = ${JSON.stringify(novo)}, "updatedAt" = NOW() WHERE "workspaceId" = ${c.workspaceId} AND "id" = ${id}`
    return NextResponse.json({ ok: true, escalas })
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
          SELECT o."id", o."numero", o."destinatario" AS cliente, o."produto", o."status", o."camposExtras", o."createdAt" AS criado
          FROM "Order" o WHERE o."workspaceId" = ${c.workspaceId} AND o."id" = ${id} LIMIT 1`
      : await prisma.$queryRaw<Linha[]>`
          SELECT o."id", o."numero", o."destinatario" AS cliente, o."produto", o."status", o."camposExtras", o."createdAt" AS criado
          FROM "Order" o
          WHERE o."workspaceId" = ${c.workspaceId} AND o."status" NOT IN ('CANCELADO','ENVIADO','PRONTO','CONCLUIDO','ENTREGUE')
          ORDER BY o."createdAt" DESC LIMIT 300`
    if (id && !linhas.length) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    const ids = linhas.map(l => l.id)
    // itens: variação persistida em camposExtras.produtos[] → produto da variação
    const itensPorPedido = new Map<string, { nome: string; variacaoId: string | null }[]>()
    const variacoes = new Set<string>()
    for (const l of linhas) {
      const ex = lerExtras(l.camposExtras)
      const its = Array.isArray(ex.produtos) && ex.produtos.length
        ? (ex.produtos as { nome?: string; variacaoId?: string }[]).filter(p => p?.nome).map(p => ({ nome: String(p.nome), variacaoId: p.variacaoId || null }))
        : l.produto ? [{ nome: l.produto, variacaoId: null }] : []
      for (const i of its) if (i.variacaoId) variacoes.add(i.variacaoId)
      itensPorPedido.set(l.id, its)
    }
    // Lote 4 (itens 43/44): nome do PRODUTO e da VARIAÇÃO na linha (a arte certa é produto + tema)
    const prodDaVar = new Map<string, { produtoId: string; produto: string; variacao: string | null }>()
    if (variacoes.size) {
      const vs = await prisma.$queryRaw<{ id: string; produtoId: string; produto: string; variacao: string | null }[]>`
        SELECT v."id", v."produtoId", p."nome" AS produto, NULLIF(TRIM(COALESCE(v."nome", '')), '') AS variacao
        FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
        WHERE p."workspaceId" = ${c.workspaceId} AND v."id" = ANY(${[...variacoes]})`
      for (const v of vs) prodDaVar.set(v.id, { produtoId: v.produtoId, produto: v.produto, variacao: v.variacao })
    }
    const artes = ids.length ? await prisma.$queryRaw<{ order_id: string; theme_id: string; theme_version: number; variaveis: unknown; status: string; arquivo: string | null; criado_em: Date }[]>`
      SELECT order_id, theme_id, theme_version, variaveis, status, arquivo, criado_em FROM mae_order_arts
      WHERE workspace_id = ${c.workspaceId} AND order_id = ANY(${ids}) ORDER BY criado_em` : []
    const pedidos = linhas.map(l => ({
      id: l.id, numero: l.numero, cliente: l.cliente, status: l.status, criado: l.criado,
      campos: campos(lerExtras(l.camposExtras)),
      ajustes: { escalas: escalasDe(lerExtras(l.camposExtras)) },
      itens: (itensPorPedido.get(l.id) ?? []).map(i => {
        const pv = i.variacaoId ? prodDaVar.get(i.variacaoId) : undefined
        return { ...i, produtoId: pv?.produtoId ?? null, produto: pv?.produto ?? null, variacao: pv?.variacao ?? null }
      }),
      artes: artes.filter(a => a.order_id === l.id).map(a => ({ themeId: a.theme_id, themeVersion: a.theme_version, variaveis: a.variaveis, status: a.status, arquivo: a.arquivo, criadoEm: a.criado_em })),
    }))
    return NextResponse.json(serialize({ pedidos }))
  } catch (e) {
    console.error('[MAE PEDIDOS GET]', e)
    return NextResponse.json({ error: 'Erro ao listar os pedidos' }, { status: 500 })
  }
}
