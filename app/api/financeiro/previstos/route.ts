// CONTAS A PAGAR / A RECEBER — as PREVISÕES (o que ainda não entrou nem saiu).
// Até aqui não existia tela para isso: a artesã abria o Caixa Diário só para ver previsão,
// que é justamente o que o Caixa não deveria ser. Aqui ficam as despesas e receitas em aberto
// (de compras, de pedidos e avulsas), com o saldo que falta em cada uma.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ondeAberto, valorAberto, somaAberto } from '@/lib/finRealizado'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const workspaceId = session.user.workspaceId

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo')            // RECEITA | DESPESA | null (ambos)
  const de = searchParams.get('de')                // vencimento >= (YYYY-MM-DD)
  const ate = searchParams.get('ate')              // vencimento <= (YYYY-MM-DD)
  const busca = (searchParams.get('busca') || '').trim()
  const categoriaId = searchParams.get('categoriaId')
  const soVencidas = searchParams.get('vencidas') === '1'

  const fTipo = tipo === 'RECEITA' || tipo === 'DESPESA' ? Prisma.sql`AND l."tipo" = ${tipo}` : Prisma.empty
  const fDe = de ? Prisma.sql`AND l."data" >= ${de}::date` : Prisma.empty
  const fAte = ate ? Prisma.sql`AND l."data" <= ${ate}::date` : Prisma.empty
  const fCat = categoriaId ? Prisma.sql`AND l."categoriaId" = ${categoriaId}` : Prisma.empty
  const fVenc = soVencidas ? Prisma.sql`AND l."data" < CURRENT_DATE` : Prisma.empty
  const fBusca = busca
    ? Prisma.sql`AND (l."descricao" ILIKE ${'%' + busca + '%'} OR l."referencia" ILIKE ${'%' + busca + '%'})`
    : Prisma.empty

  const itens = await prisma.$queryRaw`
    SELECT l."id", l."tipo", l."descricao", l."valor"::float AS "valor",
           COALESCE(l."valorRealizado", 0)::float AS "valorRealizado",
           ${valorAberto('l')}::float AS "saldo",
           TO_CHAR(l."data", 'YYYY-MM-DD') AS "vencimento",
           (l."data" < CURRENT_DATE) AS "vencida",
           (CURRENT_DATE - l."data")::int AS "diasAtraso",
           l."status", l."canal", l."referencia", l."parcela", l."totalParcelas",
           c."nome" AS "categoriaNome", c."cor" AS "categoriaCor"
    FROM "FinLancamento" l
    LEFT JOIN "FinCategoria" c ON c."id" = l."categoriaId"
    WHERE l."workspaceId" = ${workspaceId}
      AND ${ondeAberto('l')}
      ${fTipo} ${fDe} ${fAte} ${fCat} ${fVenc} ${fBusca}
    ORDER BY l."data" ASC, l."createdAt" ASC
    LIMIT 500
  ` as any[]

  // Totais do MESMO recorte (sem o LIMIT), separando o que já venceu.
  const [totais] = await prisma.$queryRaw`
    SELECT ${somaAberto('RECEITA', 'l')} AS "aReceber",
           ${somaAberto('DESPESA', 'l')} AS "aPagar",
           COALESCE(SUM(CASE WHEN l."tipo" = 'RECEITA' AND l."data" < CURRENT_DATE
                             THEN ${valorAberto('l')} ELSE 0 END), 0)::float AS "aReceberVencido",
           COALESCE(SUM(CASE WHEN l."tipo" = 'DESPESA' AND l."data" < CURRENT_DATE
                             THEN ${valorAberto('l')} ELSE 0 END), 0)::float AS "aPagarVencido",
           COUNT(*)::int AS "qtd"
    FROM "FinLancamento" l
    WHERE l."workspaceId" = ${workspaceId}
      AND ${ondeAberto('l')}
      ${fTipo} ${fDe} ${fAte} ${fCat} ${fVenc} ${fBusca}
  ` as any[]

  return NextResponse.json(serialize({ itens, totais, truncado: itens.length >= 500 }))
}
