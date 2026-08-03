// Vincula uma categoria/subcategoria a VÁRIOS lançamentos de uma vez (edição em massa).
// Respeita o tipo: só aplica aos lançamentos do MESMO tipo da categoria (entrada→RECEITA,
// saída→DESPESA). Idempotente. Prisma raw; escopo por workspaceId; sem SELECT *.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId

  const body = await req.json().catch(() => ({}))
  const { ids, categoriaId, contaId } = body
  const idsArr = Array.isArray(ids) ? ids.map(String).filter(Boolean) : []
  if (idsArr.length === 0) return NextResponse.json({ error: 'Nenhum lançamento selecionado' }, { status: 400 })

  // ── Vincular CONTA em massa (banco/carteira). Sem restrição de tipo — uma conta guarda
  // tanto receita quanto despesa. contaId pode vir null para desvincular. ──
  if (contaId !== undefined && categoriaId === undefined) {
    if (contaId) {
      const [c] = await prisma.$queryRaw`SELECT "id" FROM "FinConta" WHERE "id" = ${contaId} AND "workspaceId" = ${workspaceId} LIMIT 1` as { id: string }[]
      if (!c) return NextResponse.json({ error: 'Conta inválida' }, { status: 400 })
    }
    const atual = await prisma.$executeRaw`
      UPDATE "FinLancamento" SET "contaId" = ${contaId || null}
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsArr}::text[])
    `
    return NextResponse.json({ ok: true, atualizados: Number(atual), ignorados: 0 })
  }

  if (!categoriaId) return NextResponse.json({ error: 'Escolha uma categoria' }, { status: 400 })

  // Categoria precisa existir no workspace; o tipo dela define quais lançamentos recebem.
  const [cat] = await prisma.$queryRaw`
    SELECT "tipo" FROM "FinCategoria" WHERE "id" = ${categoriaId} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as { tipo: string }[]
  if (!cat) return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 })

  // Aplica só aos lançamentos do MESMO tipo (RECEITA/DESPESA) — nunca vincula despesa a conta de receita.
  const atualizados = await prisma.$executeRaw`
    UPDATE "FinLancamento" SET "categoriaId" = ${categoriaId}
    WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsArr}::text[]) AND "tipo" = ${cat.tipo}
  `
  return NextResponse.json({ ok: true, atualizados: Number(atualizados), ignorados: idsArr.length - Number(atualizados), tipo: cat.tipo })
}
