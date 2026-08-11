// Receitas PREVISTAS dos canais (geradas ao concluir o pedido quando canaisLancaFinanceiro
// está ON): listar e CONFIRMAR EM MASSA (marca PAGO, dataRealizada=data prevista, valorRealizado=valor).
// Só mexe nas [saldo-auto] previstas do próprio workspace. Idempotente (confirmar 2x não muda nada).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

async function ws(): Promise<string | null> {
  const s = await getServerSession(authOptions)
  return s?.user?.workspaceId ?? null
}

// GET — receitas previstas (PENDENTE) automáticas, para revisão/confirmação.
export async function GET() {
  const workspaceId = await ws()
  if (!workspaceId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const previstas = await prisma.$queryRaw`
    SELECT "id", "descricao", "valor"::float AS "valor", TO_CHAR("data", 'YYYY-MM-DD') AS "data",
           "canal", "referencia", "observacoes"
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId} AND "tipo" = 'RECEITA' AND "status" = 'PENDENTE'
      AND "descricao" LIKE '[saldo-auto]%'
    ORDER BY "data" ASC
  ` as { id: string; descricao: string; valor: number; data: string; canal: string | null; referencia: string | null; observacoes: string | null }[]
  const [{ total }] = await prisma.$queryRaw`
    SELECT COALESCE(SUM("valor"),0)::float AS total FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId} AND "tipo" = 'RECEITA' AND "status" = 'PENDENTE' AND "descricao" LIKE '[saldo-auto]%'
  ` as { total: number }[]
  return NextResponse.json(serialize({ previstas, total }))
}

// POST { ids?: string[], todos?: boolean } — confirma recebimento (PENDENTE → PAGO).
export async function POST(req: NextRequest) {
  const workspaceId = await ws()
  if (!workspaceId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(b.ids) ? b.ids.filter((x: unknown) => typeof x === 'string') : []
  if (!b.todos && ids.length === 0) return NextResponse.json({ error: 'Selecione ao menos uma receita.' }, { status: 400 })

  // dataRealizada = a data prevista (o dia em que caiu); valorRealizado = o valor previsto.
  const n = b.todos
    ? await prisma.$executeRaw`
        UPDATE "FinLancamento" SET "status" = 'PAGO', "dataRealizada" = "data", "valorRealizado" = "valor"
        WHERE "workspaceId" = ${workspaceId} AND "tipo" = 'RECEITA' AND "status" = 'PENDENTE' AND "descricao" LIKE '[saldo-auto]%'`
    : await prisma.$executeRaw`
        UPDATE "FinLancamento" SET "status" = 'PAGO', "dataRealizada" = "data", "valorRealizado" = "valor"
        WHERE "workspaceId" = ${workspaceId} AND "tipo" = 'RECEITA' AND "status" = 'PENDENTE'
          AND "descricao" LIKE '[saldo-auto]%' AND "id" = ANY(${ids}::text[])`
  return NextResponse.json({ ok: true, confirmadas: n })
}
