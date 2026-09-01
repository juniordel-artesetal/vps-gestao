// Cron — LEMBRETES do Módulo Pessoal (in-app + Telegram).
// (1) Tarefas com "lembrete" <= agora, não enviadas e não concluídas → Notificacao in-app +
//     mensagem no Telegram (bot próprio da pessoa), marcando lembreteEnviado=true (não repete).
// (2) Resumo diário de CONTAS VENCENDO (despesas em aberto vencidas/de hoje) → 1 msg/dia por
//     pessoa no Telegram, idempotente via PessoalAvisoDia (userId, dia) com ON CONFLICT.
// Telegram só p/ quem tem link ATIVO + avisosAtivos + assinatura ativa. Escopo por userId (privado).
// Autorizada por CRON_SECRET (Bearer, como a Vercel envia, ou ?secret=). Agendar ~a cada 15 min.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePessoalTables } from '@/lib/pessoal/schema'
import { assinaturaAtiva } from '@/lib/pessoal/assinatura'
import { gid } from '@/lib/pessoal/api'
import { decryptToken } from '@/lib/pagamento/asaas/cripto'
import { enviarMensagem } from '@/lib/pessoal/telegram'

export const dynamic = 'force-dynamic'
const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

export async function GET(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || new URL(req.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  await ensurePessoalTables()

  // Links Telegram ativos e com avisos ligados → mapa userId -> {chatId, token decriptado}.
  const links = await prisma.$queryRaw`
    SELECT "userId","telegramChatId","botTokenCriptografado"
    FROM "PessoalTelegramLink"
    WHERE "status"='ATIVO' AND "avisosAtivos"=true
      AND "telegramChatId" IS NOT NULL AND "botTokenCriptografado" IS NOT NULL
  ` as { userId: string; telegramChatId: string; botTokenCriptografado: string }[]
  const tgMap = new Map<string, { chatId: string; token: string }>()
  for (const l of links) {
    const token = decryptToken(l.botTokenCriptografado)
    if (token) tgMap.set(l.userId, { chatId: l.telegramChatId, token })
  }

  // Cache de assinatura ativa (só consulta quem for de fato notificar no Telegram).
  const ativoCache = new Map<string, boolean>()
  async function podeTelegram(userId: string): Promise<{ chatId: string; token: string } | null> {
    const tg = tgMap.get(userId); if (!tg) return null
    let ok = ativoCache.get(userId)
    if (ok === undefined) { ok = await assinaturaAtiva(userId); ativoCache.set(userId, ok) }
    return ok ? tg : null
  }

  // ── (1) Lembretes de tarefas ────────────────────────────────────────────────
  const vencidas = await prisma.$queryRaw`
    SELECT t."id", t."userId", t."titulo", t."prazo", u."workspaceId"
    FROM "PessoalTarefa" t JOIN "User" u ON u."id" = t."userId"
    WHERE t."lembrete" IS NOT NULL AND t."lembrete" <= NOW()
      AND NOT t."lembreteEnviado" AND t."status" <> 'CONCLUIDA'
    ORDER BY t."lembrete" ASC
    LIMIT 300
  ` as { id: string; userId: string; titulo: string; prazo: string | null; workspaceId: string }[]

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
    const tg = await podeTelegram(t.userId)
    if (tg) await enviarMensagem(tg.token, tg.chatId, `⏰ <b>Lembrete de tarefa</b>\n${t.titulo || 'Você tem uma tarefa'}`).catch(() => {})
  }

  // ── (2) Resumo diário de contas vencendo (1x/dia por pessoa, só quem tem Telegram) ──
  let avisosContas = 0
  if (tgMap.size) {
    const alvos = Array.from(tgMap.keys())
    const contas = await prisma.$queryRaw`
      SELECT l."userId", COUNT(*)::int AS qtd, COALESCE(SUM(l."valor"),0)::float AS total,
             COALESCE(SUM(CASE WHEN l."data" < CURRENT_DATE THEN 1 ELSE 0 END),0)::int AS atrasadas
      FROM "PessoalLancamento" l
      WHERE l."userId" = ANY(${alvos}) AND l."tipo"='DESPESA' AND l."status" IN ('PENDENTE','PARCIAL')
        AND l."data" <= CURRENT_DATE
      GROUP BY l."userId"
    ` as { userId: string; qtd: number; total: number; atrasadas: number }[]

    for (const c of contas) {
      const tg = await podeTelegram(c.userId); if (!tg) continue
      // Marca o dia ANTES de enviar (ON CONFLICT garante 1x/dia mesmo com crons concorrentes).
      const ins = await prisma.$executeRaw`
        INSERT INTO "PessoalAvisoDia" ("userId","dia","createdAt")
        VALUES (${c.userId}, CURRENT_DATE, NOW()) ON CONFLICT ("userId","dia") DO NOTHING
      `
      if (ins !== 1) continue // já avisado hoje
      const atr = Number(c.atrasadas || 0)
      const corpo = `📌 <b>Contas de hoje</b>\nVocê tem <b>${c.qtd}</b> conta(s) em aberto — total <b>${fmt(c.total)}</b>.`
        + (atr ? `\n🔴 ${atr} atrasada(s).` : '')
        + `\nDigite <b>/contas</b> pra ver a lista.`
      await enviarMensagem(tg.token, tg.chatId, corpo).catch(() => {})
      avisosContas++
    }
  }

  return NextResponse.json({ ok: true, enviados, avisosContas })
}
