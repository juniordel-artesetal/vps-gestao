// Feed webcal PÚBLICO-POR-TOKEN: /api/pessoal/agenda/feed/<token>. Sem sessão (o token é a chave).
// Serve APENAS título + prazo das tarefas do dono do token — nada de conteúdo. Revogar o token corta na hora.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { gerarICS, type TarefaICS } from '@/lib/pessoal/ics'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const tk = String(token || '').replace(/\.ics$/i, '') // tolera .../feed/<token>.ics
  if (!tk) return new NextResponse('token ausente', { status: 400 })

  const [dono] = await prisma.$queryRaw`
    SELECT "userId" FROM "PessoalAgendaToken" WHERE "token" = ${tk} AND "ativo" = true LIMIT 1
  ` as { userId: string }[]
  // 404 genérico (não revela se o token existiu).
  if (!dono) return new NextResponse('não encontrado', { status: 404 })

  const rows = await prisma.$queryRaw`
    SELECT "id", "titulo", TO_CHAR("prazo",'YYYY-MM-DD') AS "prazo", ("status" = 'CONCLUIDA') AS "concluida"
    FROM "PessoalTarefa" WHERE "userId" = ${dono.userId} AND "prazo" IS NOT NULL
    ORDER BY "prazo" ASC
  ` as TarefaICS[]

  return new NextResponse(gerarICS(rows), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Content-Disposition': 'inline; filename="soa-agenda.ics"',
    },
  })
}
