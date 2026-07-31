import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

// GET — catálogo de pacotes ATIVOS disponíveis para compra (visão do assinante).
// Filtro opcional ?tipo=  (ex.: só pacotes de 'foto'). Nunca SELECT *.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo')

    const rows = tipo
      ? await prisma.$queryRaw`
          SELECT "id","tipo","nome","quantidade"::int AS "quantidade","preco"::float AS "preco"
          FROM "CreditoPacote" WHERE "ativo" = true AND "tipo" = ${tipo}
          ORDER BY "quantidade" ASC
        ` as any[]
      : await prisma.$queryRaw`
          SELECT "id","tipo","nome","quantidade"::int AS "quantidade","preco"::float AS "preco"
          FROM "CreditoPacote" WHERE "ativo" = true
          ORDER BY "tipo" ASC, "quantidade" ASC
        ` as any[]

    return NextResponse.json(serialize(rows))
  } catch (error) {
    console.error('[CREDITOS] pacotes:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
