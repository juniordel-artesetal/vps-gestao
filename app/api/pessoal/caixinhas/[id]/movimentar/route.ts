// Movimentar uma caixinha: DEPOSITO (alocar) ou RETIRADA (resgatar). Escopo por userId.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, gid, parseNum, parseData } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const tipo = b?.tipo === 'RETIRADA' ? 'RETIRADA' : 'DEPOSITO'
  const valor = parseNum(b?.valor)
  if (valor <= 0) return NextResponse.json({ error: 'Informe um valor.' }, { status: 400 })
  const data = parseData(b?.data) || new Date().toISOString().slice(0, 10)

  // Caixinha precisa ser do usuário; pega nome + saldo atual pra validar retirada.
  const [cx] = await prisma.$queryRaw`
    SELECT c."id", c."nome",
      COALESCE(SUM(CASE WHEN m."tipo"='DEPOSITO' THEN m."valor" WHEN m."tipo"='RETIRADA' THEN -m."valor" ELSE 0 END),0)::float AS saldo
    FROM "PessoalCaixinha" c
    LEFT JOIN "PessoalCaixinhaMov" m ON m."caixinhaId" = c."id" AND m."userId" = c."userId"
    WHERE c."id" = ${id} AND c."userId" = ${g.userId} GROUP BY c."id", c."nome" LIMIT 1
  ` as { id: string; nome: string; saldo: number }[]
  if (!cx) return NextResponse.json({ error: 'Caixinha não encontrada' }, { status: 404 })
  if (tipo === 'RETIRADA' && valor > Number(cx.saldo) + 1e-6) return NextResponse.json({ error: 'Saldo insuficiente na caixinha.' }, { status: 400 })

  const contaId = b?.contaId || null
  const delta = tipo === 'DEPOSITO' ? valor : -valor
  // GUARDAR = reserva: sai do CAIXA (lançamento RESERVA, −) e entra na caixinha. NÃO é despesa
  // (RESERVA/RESGATE são excluídos de receita/despesa/resultado — os agregadores filtram por tipo).
  // RESGATAR = o inverso (RESGATE, +). Tudo em transação: lançamento + movimento + saldo juntos.
  const lancTipo = tipo === 'DEPOSITO' ? 'RESERVA' : 'RESGATE'
  const lancDesc = tipo === 'DEPOSITO' ? `🐷 Guardei em ${cx.nome}` : `🐷 Resgatei de ${cx.nome}`
  const lancId = gid()
  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO "PessoalLancamento" ("id","userId","tipo","descricao","valor","data","status","contaId","origem","createdAt")
      VALUES (${lancId}, ${g.userId}, ${lancTipo}, ${lancDesc}, ${valor}, ${data}::date, 'PAGO', ${contaId}, 'CAIXINHA', NOW())`,
    prisma.$executeRaw`
      INSERT INTO "PessoalCaixinhaMov" ("id","caixinhaId","userId","tipo","valor","data","contaId","obs","lancamentoId","createdAt")
      VALUES (${gid()}, ${id}, ${g.userId}, ${tipo}, ${valor}, ${data}::date, ${contaId}, ${b?.obs || null}, ${lancId}, NOW())`,
    prisma.$executeRaw`UPDATE "PessoalCaixinha" SET "saldo" = "saldo" + ${delta} WHERE "id" = ${id} AND "userId" = ${g.userId}`,
  ])
  return NextResponse.json({ ok: true }, { status: 201 })
}
