// app/api/precificacao/produtos/lote/route.ts — Ações em massa sobre produtos — VPS-20260630-NQA8
// ADITIVO. Exclusão = soft (ativo=false) por causa das variações/vínculos.
// Ajuste de % mexe SÓ no precoVenda das variações (não no custo — regressão J7RX).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { ids, acao, categoria, pct } = await req.json()
  const idsValidos: string[] = Array.isArray(ids) ? ids.filter((x: any) => typeof x === 'string') : []
  if (idsValidos.length === 0) return NextResponse.json({ error: 'Nenhum produto selecionado' }, { status: 400 })

  if (acao === 'ativar' || acao === 'inativar') {
    const ativo = acao === 'ativar'
    const res = await prisma.$executeRaw`
      UPDATE "PrecProduto" SET "ativo" = ${ativo}, "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsValidos}::text[])`
    return NextResponse.json({ atualizados: Number(res) })
  }

  if (acao === 'excluir') {
    // HARD delete (igual ao excluir individual): cascade em variações + filhos.
    const vars = await prisma.$queryRaw`
      SELECT v."id" FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
      WHERE p."workspaceId" = ${workspaceId} AND p."id" = ANY(${idsValidos}::text[])
    ` as { id: string }[]
    const vids = vars.map(v => v.id)
    if (vids.length) {
      await prisma.$executeRaw`DELETE FROM "PrecMaterialItem"      WHERE "variacaoId" = ANY(${vids}::text[])`
      await prisma.$executeRaw`DELETE FROM "PrecKitItem"           WHERE "variacaoId" = ANY(${vids}::text[])`
      await prisma.$executeRaw`DELETE FROM "PrecComboItem"         WHERE "variacaoId" = ANY(${vids}::text[])`
      await prisma.$executeRaw`DELETE FROM "PrecVariacaoHistorico" WHERE "variacaoId" = ANY(${vids}::text[])`
    }
    await prisma.$executeRaw`
      DELETE FROM "PrecVariacao"
      WHERE "produtoId" IN (SELECT "id" FROM "PrecProduto" WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsValidos}::text[]))`
    const res = await prisma.$executeRaw`
      DELETE FROM "PrecProduto" WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsValidos}::text[])`
    return NextResponse.json({ excluidos: Number(res) })
  }

  if (acao === 'editar') {
    const res = await prisma.$executeRaw`
      UPDATE "PrecProduto" SET "categoria" = ${categoria || null}, "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsValidos}::text[])`
    return NextResponse.json({ atualizados: Number(res) })
  }

  if (acao === 'ajustePreco') {
    const fator = 1 + Number(pct || 0) / 100
    if (!isFinite(fator) || fator < 0) return NextResponse.json({ error: 'Percentual inválido' }, { status: 400 })
    // Só o preço de venda das variações dos produtos selecionados (isolamento via subselect)
    const res = await prisma.$executeRaw`
      UPDATE "PrecVariacao" SET "precoVenda" = "precoVenda" * ${fator}, "updatedAt" = NOW()
      WHERE "produtoId" IN (
        SELECT "id" FROM "PrecProduto"
        WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsValidos}::text[])
      )`
    return NextResponse.json({ variacoesAtualizadas: Number(res) })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
