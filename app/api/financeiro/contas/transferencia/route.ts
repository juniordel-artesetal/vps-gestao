// Transferência entre contas — move saldo (origem − / destino +). NÃO é receita/despesa.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureContasBancarias } from '@/lib/finConta'

export const dynamic = 'force-dynamic'
const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  await ensureContasBancarias()
  const { contaOrigemId, contaDestinoId, valor, data, descricao } = await req.json().catch(() => ({}))

  const v = Number(valor)
  if (!contaOrigemId || !contaDestinoId) return NextResponse.json({ error: 'Escolha as contas de origem e destino' }, { status: 400 })
  if (contaOrigemId === contaDestinoId) return NextResponse.json({ error: 'Origem e destino precisam ser diferentes' }, { status: 400 })
  if (!(v > 0)) return NextResponse.json({ error: 'Informe um valor válido' }, { status: 400 })

  // Ambas as contas precisam ser do workspace.
  const contas = await prisma.$queryRaw`
    SELECT "id" FROM "FinConta" WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${[contaOrigemId, contaDestinoId]}::text[])
  ` as { id: string }[]
  if (contas.length < 2) return NextResponse.json({ error: 'Conta inválida' }, { status: 400 })

  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "FinTransferencia" ("id","workspaceId","contaOrigemId","contaDestinoId","valor","data","descricao")
    VALUES (${id}, ${workspaceId}, ${contaOrigemId}, ${contaDestinoId}, ${v}, ${data || new Date().toISOString().slice(0, 10)}::date, ${descricao || null})
  `
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
