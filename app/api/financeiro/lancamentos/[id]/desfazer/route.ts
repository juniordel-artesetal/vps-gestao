// DESFAZER um pagamento/recebimento sem excluir o lançamento (Fase 3).
// O que existia era só o estorno EM MASSA, que zerava tudo. Aqui dá pra desfazer o valor exato
// (ex.: lancei R$ 50 a mais) ou o pagamento inteiro — e fica registrado no histórico.
//
// POST body: { valor?: number }  — sem valor = desfaz tudo (volta a PENDENTE)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { estornarPagamento } from '@/lib/finPagamento'
import { registrarHistorico } from '@/lib/finHistorico'

export const dynamic = 'force-dynamic'

const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const body = await req.json().catch(() => ({}))
  const valorPedido = body?.valor == null ? null : Number(body.valor)
  if (valorPedido != null && (!isFinite(valorPedido) || valorPedido <= 0))
    return NextResponse.json({ error: 'Valor a desfazer inválido' }, { status: 400 })

  const [row] = await prisma.$queryRaw`
    SELECT "id", "descricao", "tipo", "valor"::float AS "valor",
           "valorRealizado"::float AS "valorRealizado", "status"
    FROM "FinLancamento"
    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    LIMIT 1
  ` as { id: string; descricao: string; tipo: string; valor: number; valorRealizado: number | null; status: string }[]
  if (!row) return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })

  if (!row.valorRealizado || row.valorRealizado <= 0)
    return NextResponse.json({ error: 'Este lançamento não tem pagamento para desfazer' }, { status: 400 })

  const r = estornarPagamento(row.valor, row.valorRealizado, valorPedido)
  if (r.estornado <= 0)
    return NextResponse.json({ error: 'Nada a desfazer' }, { status: 400 })

  if (r.valorRealizado > 0) {
    // Ainda sobrou pagamento: mantém a dataRealizada (o dinheiro que ficou continua realizado).
    await prisma.$executeRaw`
      UPDATE "FinLancamento" SET "status" = ${r.status}, "valorRealizado" = ${r.valorRealizado}
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  } else {
    // Desfeito por inteiro: volta a ser só previsão, sem data de realização.
    await prisma.$executeRaw`
      UPDATE "FinLancamento" SET "status" = 'PENDENTE', "valorRealizado" = NULL, "dataRealizada" = NULL
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  }

  const verbo = row.tipo === 'RECEITA' ? 'recebimento' : 'pagamento'
  await registrarHistorico({
    lancamentoId: id, workspaceId, acao: 'ESTORNO',
    descricao: `Desfeito ${brl(r.estornado)} do ${verbo} — de ${brl(row.valorRealizado)} para ${brl(r.valorRealizado)}`,
    valorAntes: row.valorRealizado, valorDepois: r.valorRealizado,
    statusAntes: row.status, statusDepois: r.status,
    usuarioNome: session.user.name ?? session.user.email ?? null,
    usuarioId: (session.user as any).id ?? null,
  })

  return NextResponse.json({ ok: true, ...r })
}
