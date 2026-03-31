import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const { ids, acao } = await req.json()

  if (!Array.isArray(ids) || ids.length === 0 || !acao)
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const statusValidos = ['PENDENTE', 'EM_PRODUCAO', 'PRODUZIDO', 'PAGO']
  if (!statusValidos.includes(acao))
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })

  const dataPag = acao === 'PAGO' ? new Date() : null

  for (const id of ids) {
    await prisma.$executeRaw`
      UPDATE "Demanda"
      SET "status" = ${acao},
          "dataPagamento" = ${dataPag},
          "updatedAt" = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  }

  return NextResponse.json({ ok: true, atualizadas: ids.length })
}
