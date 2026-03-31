import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { variacaoId, tipo, quantidade, motivo, referencia } = await req.json()

  if (!variacaoId || !tipo || !quantidade)
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const qtd = parseInt(quantidade)
  if (isNaN(qtd) || qtd <= 0)
    return NextResponse.json({ error: 'Quantidade deve ser maior que zero' }, { status: 400 })

  if (!['ENTRADA', 'SAIDA', 'AJUSTE'].includes(tipo))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  // Busca saldo atual
  const saldoRows = await prisma.$queryRaw`
    SELECT COALESCE("saldoAtual", 0)::int AS "saldoAtual"
    FROM "EstProdutoSaldo"
    WHERE "workspaceId" = ${workspaceId}
      AND "variacaoId"  = ${variacaoId}
    LIMIT 1
  ` as any[]

  const saldoAtual = saldoRows[0] ? Number(saldoRows[0].saldoAtual) : 0

  let novoSaldo: number
  if (tipo === 'ENTRADA')     novoSaldo = saldoAtual + qtd
  else if (tipo === 'SAIDA') {
    if (saldoAtual - qtd < 0)
      return NextResponse.json({ error: 'Saldo insuficiente para esta saída' }, { status: 400 })
    novoSaldo = saldoAtual - qtd
  } else {
    novoSaldo = qtd // AJUSTE = valor absoluto
  }

  const usuarioNome = session.user.name || session.user.email || 'Usuária'
  const movId = Math.random().toString(36).slice(2) + Date.now().toString(36)

  await prisma.$executeRaw`
    INSERT INTO "EstProdutoMovimento"
      ("id","workspaceId","variacaoId","tipo","quantidade","saldoApos",
       "motivo","referencia","usuarioNome")
    VALUES
      (${movId}, ${workspaceId}, ${variacaoId}, ${tipo}, ${qtd}, ${novoSaldo},
       ${motivo ?? null}, ${referencia ?? null}, ${usuarioNome})
  `

  const saldoId = Math.random().toString(36).slice(2) + Date.now().toString(36)
  await prisma.$executeRaw`
    INSERT INTO "EstProdutoSaldo"
      ("id","workspaceId","variacaoId","saldoAtual","estoqueMinimo","updatedAt")
    VALUES
      (${saldoId}, ${workspaceId}, ${variacaoId}, ${novoSaldo}, 0, NOW())
    ON CONFLICT ("workspaceId","variacaoId")
    DO UPDATE SET
      "saldoAtual" = ${novoSaldo},
      "updatedAt"  = NOW()
  `

  return NextResponse.json({ ok: true, novoSaldo })
}