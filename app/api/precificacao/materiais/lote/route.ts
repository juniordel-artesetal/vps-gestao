// app/api/precificacao/materiais/lote/route.ts — Ações em massa sobre materiais — VPS-20260630-NQA8
// ADITIVO. NÃO altera custoTotal de variações nem custoUnit dos vínculos existentes.
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
  const { ids, acao, fornecedor, unidade, pct } = await req.json()
  const idsValidos: string[] = Array.isArray(ids) ? ids.filter((x: any) => typeof x === 'string') : []
  if (idsValidos.length === 0) return NextResponse.json({ error: 'Nenhum material selecionado' }, { status: 400 })

  if (acao === 'ativar' || acao === 'inativar') {
    const res = await prisma.$executeRaw`
      UPDATE "PrecMaterial" SET "ativo" = ${acao === 'ativar'}, "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsValidos}::text[])`
    return NextResponse.json({ atualizados: Number(res) })
  }

  if (acao === 'excluir') {
    // Em uso (há PrecMaterialItem) → soft (ativo=false). Sem uso → exclusão real.
    const emUsoRows = await prisma.$queryRaw`
      SELECT DISTINCT "materialId" FROM "PrecMaterialItem" WHERE "materialId" = ANY(${idsValidos}::text[])
    ` as { materialId: string }[]
    const emUso = new Set(emUsoRows.map(r => r.materialId))
    const idsEmUso = idsValidos.filter(id => emUso.has(id))
    const idsLivres = idsValidos.filter(id => !emUso.has(id))
    let inativados = 0, excluidos = 0
    if (idsEmUso.length) inativados = Number(await prisma.$executeRaw`
      UPDATE "PrecMaterial" SET "ativo" = false, "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsEmUso}::text[])`)
    if (idsLivres.length) excluidos = Number(await prisma.$executeRaw`
      DELETE FROM "PrecMaterial" WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsLivres}::text[])`)
    return NextResponse.json({ inativados, excluidos })
  }

  if (acao === 'editar') {
    let n = 0
    if (fornecedor !== undefined) n = Number(await prisma.$executeRaw`
      UPDATE "PrecMaterial" SET "fornecedor" = ${fornecedor || null}, "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsValidos}::text[])`)
    if (unidade !== undefined && String(unidade).trim()) n = Number(await prisma.$executeRaw`
      UPDATE "PrecMaterial" SET "unidade" = ${String(unidade)}, "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsValidos}::text[])`)
    return NextResponse.json({ atualizados: n })
  }

  if (acao === 'ajustePreco') {
    const fator = 1 + Number(pct || 0) / 100
    if (!isFinite(fator) || fator < 0) return NextResponse.json({ error: 'Percentual inválido' }, { status: 400 })
    // Reajusta o preço do MATERIAL (não mexe em custoUnit dos vínculos já criados)
    const res = await prisma.$executeRaw`
      UPDATE "PrecMaterial"
      SET "precoPacote" = "precoPacote" * ${fator}, "precoUnidade" = "precoUnidade" * ${fator}, "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsValidos}::text[])`
    return NextResponse.json({ atualizados: Number(res) })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
