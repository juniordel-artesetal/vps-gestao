// Download .ics de UMA tarefa (autenticado, escopo userId).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'
import { gerarICS, type TarefaICS } from '@/lib/pessoal/ics'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const [t] = await prisma.$queryRaw`
    SELECT "id", "titulo", TO_CHAR("prazo",'YYYY-MM-DD') AS "prazo", ("status" = 'CONCLUIDA') AS "concluida"
    FROM "PessoalTarefa" WHERE "id" = ${id} AND "userId" = ${g.userId} AND "prazo" IS NOT NULL
  ` as TarefaICS[]
  if (!t) return NextResponse.json({ error: 'Tarefa sem prazo ou não encontrada' }, { status: 404 })
  const ics = gerarICS([t], t.titulo)
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="tarefa-${id}.ics"`,
    },
  })
}
