// Conexão do bot PRÓPRIO do usuário (BYO-bot): GET status · POST cola+valida+seta webhook · DELETE desconecta.
// Token CRIPTOGRAFADO no banco (cripto do AsaasConfig). Escopo por userId, sob o gate (ADMIN + ATIVA).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid } from '@/lib/pessoal/api'
import { baseUrlDeHeaders } from '@/lib/baseUrl'
import { encryptToken, decryptToken } from '@/lib/pagamento/asaas/cripto'
import { validarToken, webhookIdNovo, secretDoWebhook, setWebhookBot, deleteWebhookBot } from '@/lib/pessoal/telegram'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const [l] = await prisma.$queryRaw`
    SELECT "status", "botUsername", ("botTokenCriptografado" IS NOT NULL) AS "temToken", ("telegramChatId" IS NOT NULL) AS "temChat"
    FROM "PessoalTelegramLink" WHERE "userId" = ${g.userId} LIMIT 1
  ` as any[]
  return NextResponse.json(serialize({
    temToken: !!l?.temToken,
    status: l?.status ?? null,
    botUsername: l?.botUsername ?? null,
    vinculado: l?.status === 'ATIVO' && !!l?.temChat,
  }))
}

export async function POST(req: NextRequest) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const token = String(b?.token ?? '').trim()
  if (!/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(token)) return NextResponse.json({ error: 'Token do bot inválido. Copie o token completo do BotFather.' }, { status: 400 })

  const v = await validarToken(token)
  if (!v.ok) return NextResponse.json({ error: `Não consegui validar o bot: ${v.erro || 'token recusado'}.` }, { status: 400 })

  const cript = encryptToken(token)
  if (!cript) return NextResponse.json({ error: 'Falha ao proteger o token (cripto indisponível).' }, { status: 500 })

  // Reusa o webhookId se já existir (reconexão); senão gera um novo.
  const [ex] = await prisma.$queryRaw`SELECT "id","webhookId" FROM "PessoalTelegramLink" WHERE "userId" = ${g.userId} LIMIT 1` as any[]
  const webhookId = ex?.webhookId || webhookIdNovo()
  const base = baseUrlDeHeaders(req.headers)
  const url = `${base}/api/pessoal/telegram/webhook/${webhookId}`
  const secret = secretDoWebhook(webhookId, token)

  const wh = await setWebhookBot(token, url, secret)
  if (!wh.ok) return NextResponse.json({ error: `Não consegui registrar o webhook no seu bot: ${wh.erro || 'erro'}.` }, { status: 400 })

  if (ex) {
    await prisma.$executeRaw`
      UPDATE "PessoalTelegramLink"
      SET "botTokenCriptografado" = ${cript}, "botUsername" = ${v.username ?? null}, "webhookId" = ${webhookId},
          "status" = 'PENDENTE', "telegramChatId" = NULL, "ativo" = false, "vinculadoEm" = NOW()
      WHERE "id" = ${ex.id}
    `
  } else {
    await prisma.$executeRaw`
      INSERT INTO "PessoalTelegramLink" ("id","userId","botTokenCriptografado","botUsername","webhookId","status","ativo","vinculadoEm")
      VALUES (${gid()}, ${g.userId}, ${cript}, ${v.username ?? null}, ${webhookId}, 'PENDENTE', false, NOW())
    `
  }
  return NextResponse.json({ ok: true, botUsername: v.username ?? null })
}

export async function DELETE() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const [l] = await prisma.$queryRaw`SELECT "botTokenCriptografado" FROM "PessoalTelegramLink" WHERE "userId" = ${g.userId} LIMIT 1` as any[]
  const tok = decryptToken(l?.botTokenCriptografado)
  if (tok) await deleteWebhookBot(tok).catch(() => {})
  await prisma.$executeRaw`DELETE FROM "PessoalTelegramLink" WHERE "userId" = ${g.userId}`
  return NextResponse.json({ ok: true })
}
