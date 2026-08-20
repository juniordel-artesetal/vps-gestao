// Download .ics de TODAS as tarefas com prazo (autenticado, escopo userId).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'
import { gerarICS, type TarefaICS } from '@/lib/pessoal/ics'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const rows = await prisma.$queryRaw`
    SELECT "id", "titulo", TO_CHAR("prazo",'YYYY-MM-DD') AS "prazo", ("status" = 'CONCLUIDA') AS "concluida"
    FROM "PessoalTarefa" WHERE "userId" = ${g.userId} AND "prazo" IS NOT NULL
    ORDER BY "prazo" ASC
  ` as TarefaICS[]
  const ics = gerarICS(rows)
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tarefas-soa.ics"',
    },
  })
}
