// Vínculo do Telegram do usuário: GET status · POST gera código + deep link · DELETE desvincula.
// Escopo por userId, sob o gate (ADMIN + assinatura ATIVA).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid } from '@/lib/pessoal/api'
import { botConfigurado, gerarCodigo } from '@/lib/pessoal/telegram'

export const dynamic = 'force-dynamic'
const EXPIRA_MIN = 15

export async function GET() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const [l] = await prisma.$queryRaw`
    SELECT "status", "telegramUsername", ("telegramChatId" IS NOT NULL) AS "temChat"
    FROM "PessoalTelegramLink" WHERE "userId" = ${g.userId} LIMIT 1
  ` as any[]
  return NextResponse.json(serialize({
    botConfigurado: botConfigurado(),
    botUsername: process.env.NEXT_PUBLIC_TELEGRAM_PESSOAL_BOT_USERNAME || null,
    vinculado: l?.status === 'ATIVO' && !!l?.temChat,
    telegramUsername: l?.telegramUsername ?? null,
  }))
}

export async function POST() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const codigo = gerarCodigo()
  const [ex] = await prisma.$queryRaw`SELECT "id","status" FROM "PessoalTelegramLink" WHERE "userId" = ${g.userId} LIMIT 1` as any[]
  if (ex) {
    await prisma.$executeRaw`
      UPDATE "PessoalTelegramLink"
      SET "codigo" = ${codigo}, "expiraEm" = NOW() + (${EXPIRA_MIN} || ' minutes')::interval,
          "status" = CASE WHEN "status" = 'ATIVO' THEN 'ATIVO' ELSE 'PENDENTE' END
      WHERE "id" = ${ex.id}
    `
  } else {
    await prisma.$executeRaw`
      INSERT INTO "PessoalTelegramLink" ("id","userId","codigo","expiraEm","status","ativo","vinculadoEm")
      VALUES (${gid()}, ${g.userId}, ${codigo}, NOW() + (${EXPIRA_MIN} || ' minutes')::interval, 'PENDENTE', false, NOW())
    `
  }
  const user = process.env.NEXT_PUBLIC_TELEGRAM_PESSOAL_BOT_USERNAME || ''
  const deepLink = user ? `https://t.me/${user}?start=${codigo}` : null
  return NextResponse.json({ ok: true, codigo, deepLink, expiraMin: EXPIRA_MIN, botConfigurado: botConfigurado() })
}

export async function DELETE() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  await prisma.$executeRaw`DELETE FROM "PessoalTelegramLink" WHERE "userId" = ${g.userId}`
  return NextResponse.json({ ok: true })
}
