// Cron — LEMBRETES de Tarefas do Módulo Pessoal.
// Varre tarefas com "lembrete" <= agora, ainda não enviadas e não concluídas → cria Notificacao
// in-app para o usuário e marca lembreteEnviado=true (não repete). Escopo por userId (privado).
// Autorizada por CRON_SECRET (Bearer, como a Vercel envia, ou ?secret=). Agendar ~a cada 15 min.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePessoalTables } from '@/lib/pessoal/schema'
import { gid } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || new URL(req.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  await ensurePessoalTables()

  // A tarefa é userId-only; a Notificacao exige workspaceId → pega do dono (User).
  const vencidas = await prisma.$queryRaw`
    SELECT t."id", t."userId", t."titulo", u."workspaceId"
    FROM "PessoalTarefa" t JOIN "User" u ON u."id" = t."userId"
    WHERE t."lembrete" IS NOT NULL AND t."lembrete" <= NOW()
      AND NOT t."lembreteEnviado" AND t."status" <> 'CONCLUIDA'
    ORDER BY t."lembrete" ASC
    LIMIT 300
  ` as { id: string; userId: string; titulo: string; workspaceId: string }[]

  let enviados = 0
  for (const t of vencidas) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "Notificacao" ("id","workspaceId","userId","tipo","titulo","mensagem","href","lida","createdAt")
        VALUES (${gid()}, ${t.workspaceId}, ${t.userId}, 'pessoal_tarefa', ${'⏰ Lembrete de tarefa'},
                ${t.titulo || 'Você tem uma tarefa'}, '/pessoal/tarefas', false, NOW())
      `
      await tx.$executeRaw`UPDATE "PessoalTarefa" SET "lembreteEnviado" = true WHERE "id" = ${t.id}`
    })
    enviados++
  }
  return NextResponse.json({ ok: true, enviados })
}
