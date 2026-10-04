// Método MAE — VÍNCULO PRODUTO/VARIAÇÃO ↔ TEMA (mae_product_theme_links), o jeito preferido de achar o
// tema do pedido (Sprint 12). Um vínculo por produto+variação (variação nula = vale para o produto todo).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { contaMae, lerJson } from '@/lib/mae/servidor/acesso'

const Vinculo = z.object({ produtoId: z.string().min(1).max(64), variacaoId: z.string().min(1).max(64).nullable().default(null), themeId: z.string().min(1).max(64) })
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export async function GET() {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  try {
    const ls = await prisma.$queryRaw<{ id: string; produto_id: string; variacao_id: string | null; theme_id: string; produto: string | null; variacao: string | null }[]>`
      SELECT l.id, l.produto_id, l.variacao_id, l.theme_id, p."nome" AS produto, v."nome" AS variacao
      FROM mae_product_theme_links l
      LEFT JOIN "PrecProduto" p ON p."id" = l.produto_id
      LEFT JOIN "PrecVariacao" v ON v."id" = l.variacao_id
      WHERE l.workspace_id = ${c.workspaceId} ORDER BY l.criado_em`
    return NextResponse.json(serialize({ vinculos: ls.map(l => ({ id: l.id, produtoId: l.produto_id, variacaoId: l.variacao_id, themeId: l.theme_id, produto: l.produto, variacao: l.variacao })) }))
  } catch (e) {
    console.error('[MAE VINCULOS GET]', e)
    return NextResponse.json({ error: 'Erro ao listar os vínculos' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  let v
  try {
    const r = Vinculo.safeParse(await lerJson(req, 10_000))
    if (!r.success) return NextResponse.json({ error: 'Vínculo inválido' }, { status: 400 })
    v = r.data
  } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  try {
    const [p] = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "PrecProduto" WHERE "id" = ${v.produtoId} AND "workspaceId" = ${c.workspaceId} LIMIT 1`
    if (!p) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    const id = gid()
    await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM mae_product_theme_links WHERE workspace_id = ${c.workspaceId} AND produto_id = ${v.produtoId} AND variacao_id IS NOT DISTINCT FROM ${v.variacaoId}`,
      prisma.$executeRaw`INSERT INTO mae_product_theme_links (id, workspace_id, produto_id, variacao_id, theme_id) VALUES (${id}, ${c.workspaceId}, ${v.produtoId}, ${v.variacaoId}, ${v.themeId})`,
    ])
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    console.error('[MAE VINCULOS PUT]', e)
    return NextResponse.json({ error: 'Erro ao salvar o vínculo' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  try {
    await prisma.$executeRaw`DELETE FROM mae_product_theme_links WHERE id = ${id} AND workspace_id = ${c.workspaceId}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[MAE VINCULOS DELETE]', e)
    return NextResponse.json({ error: 'Erro ao excluir o vínculo' }, { status: 500 })
  }
}
