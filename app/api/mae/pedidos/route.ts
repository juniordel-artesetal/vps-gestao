// Método MAE — PEDIDOS para "Gerar arte" e "Edição em massa" (Sprint 12). Devolve, por pedido: os campos
// personalizados achatados (TEMA, NOME, IDADE… como estão em camposExtras), os itens com variação e
// produto (para o vínculo produto ↔ tema) e o histórico das artes geradas (mae_order_arts).
// ?id=<pedido> → só ele (card do pedido). Sem id → os pedidos em aberto (lista da edição em massa,
// que exige o add-on "Edição em massa").
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { contaMae } from '@/lib/mae/servidor/acesso'

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
    const prodDaVar = new Map<string, string>()
    if (variacoes.size) {
      const vs = await prisma.$queryRaw<{ id: string; produtoId: string }[]>`
        SELECT v."id", v."produtoId" FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
        WHERE p."workspaceId" = ${c.workspaceId} AND v."id" = ANY(${[...variacoes]})`
      for (const v of vs) prodDaVar.set(v.id, v.produtoId)
    }
    const artes = ids.length ? await prisma.$queryRaw<{ order_id: string; theme_id: string; theme_version: number; variaveis: unknown; status: string; arquivo: string | null; criado_em: Date }[]>`
      SELECT order_id, theme_id, theme_version, variaveis, status, arquivo, criado_em FROM mae_order_arts
      WHERE workspace_id = ${c.workspaceId} AND order_id = ANY(${ids}) ORDER BY criado_em` : []
    const pedidos = linhas.map(l => ({
      id: l.id, numero: l.numero, cliente: l.cliente, status: l.status, criado: l.criado,
      campos: campos(lerExtras(l.camposExtras)),
      itens: (itensPorPedido.get(l.id) ?? []).map(i => ({ ...i, produtoId: i.variacaoId ? prodDaVar.get(i.variacaoId) ?? null : null })),
      artes: artes.filter(a => a.order_id === l.id).map(a => ({ themeId: a.theme_id, themeVersion: a.theme_version, variaveis: a.variaveis, status: a.status, arquivo: a.arquivo, criadoEm: a.criado_em })),
    }))
    return NextResponse.json(serialize({ pedidos }))
  } catch (e) {
    console.error('[MAE PEDIDOS GET]', e)
    return NextResponse.json({ error: 'Erro ao listar os pedidos' }, { status: 500 })
  }
}
