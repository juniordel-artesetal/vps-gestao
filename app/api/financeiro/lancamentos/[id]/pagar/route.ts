// app/api/financeiro/lancamentos/[id]/pagar/route.ts
// Registra um PAGAMENTO (parcial ou quitação) num lançamento, acumulando o
// valorRealizado e recalculando o status (PENDENTE→PARCIAL→PAGO) sem drift de
// centavos. "Quitar" = enviar o saldo restante. Idempotente por acúmulo.
//
// POST body: { valor: number (o quanto está sendo pago AGORA), data?: 'YYYY-MM-DD', contaId?: string }
// Segurança: sessão ADMIN; Prisma raw; escopo por workspaceId; sem SELECT *.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { aplicarPagamento } from '@/lib/finPagamento'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const body = await req.json().catch(() => ({}))

  const valorPago = Number(body.valor)
  if (!isFinite(valorPago) || valorPago <= 0)
    return NextResponse.json({ error: 'Valor de pagamento inválido' }, { status: 400 })
  const dataPg = typeof body.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.data) ? body.data : null
  const contaId = body.contaId ? String(body.contaId) : undefined

  const [row] = await prisma.$queryRaw`
    SELECT "id", "valor"::float AS "valor", "valorRealizado"::float AS "valorRealizado", "status"
    FROM "FinLancamento"
    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    LIMIT 1
  ` as { id: string; valor: number; valorRealizado: number | null; status: string }[]
  if (!row) return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })

  const r = aplicarPagamento(row.valor, row.valorRealizado, valorPago)

  await prisma.$executeRaw`
    UPDATE "FinLancamento"
    SET "status" = ${r.status},
        "valorRealizado" = ${r.valorRealizado},
        "dataRealizada" = COALESCE(${dataPg}::date, "dataRealizada", CURRENT_DATE)
    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
  `
  // Vínculo de conta é opcional e à parte (não força re-escrever quando ausente).
  if (contaId) {
    await prisma.$executeRaw`UPDATE "FinLancamento" SET "contaId" = ${contaId} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  }

  return NextResponse.json({ ok: true, status: r.status, valorRealizado: r.valorRealizado, saldo: r.saldo })
}
