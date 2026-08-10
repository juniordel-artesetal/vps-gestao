import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

// GET — TODAS as promoções/cupons ativos e no período (visão de navegação da artesã).
// Não consome o teto 2x/dia nem conta impressão (isso é do pop-up servido). Só ordena
// por prioridade. Clique continua rastreado via /api/promocoes/clique. Sem imagem na lista.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const hoje = new Date().toISOString().slice(0, 10)
    const rows = await prisma.$queryRaw`
      SELECT dp."id", p."nome" AS "parceiroNome", dp."titulo", dp."descricao", dp."cupom", dp."linkCompra",
             ("dp"."imagem" IS NOT NULL) AS "temImagem",
             TO_CHAR(dp."dataFim",'YYYY-MM-DD') AS "dataFim"
      FROM "DistribuidorPromocao" dp
      JOIN "Parceiro" p ON p."id" = dp."parceiroId"
      WHERE dp."ativo" = true AND p."ativo" = true
        AND (dp."dataInicio" IS NULL OR dp."dataInicio" <= ${hoje}::date)
        AND (dp."dataFim"    IS NULL OR dp."dataFim"    >= ${hoje}::date)
      ORDER BY dp."prioridade" DESC, dp."createdAt" DESC
      LIMIT 200
    ` as any[]
    return NextResponse.json(serialize({ promocoes: rows }))
  } catch (error) {
    console.error('[PROMOCOES] listar:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
