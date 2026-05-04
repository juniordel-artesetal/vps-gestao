// app/api/suporte/mensagens/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const r: any = {}
    for (const k of Object.keys(obj)) r[k] = serialize(obj[k])
    return r
  }
  return obj
}

// GET — mensagens de um chamado/feedback
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const referenciaId = searchParams.get('referenciaId')
  if (!referenciaId) return NextResponse.json([])

  const msgs = await prisma.$queryRaw`
    SELECT id, tipo, "referenciaId", remetente, texto, imagem, "createdAt"
    FROM "SuporteMensagem"
    WHERE "referenciaId" = ${referenciaId}
    ORDER BY "createdAt" ASC
  ` as any[]

  return NextResponse.json(serialize(msgs))
}

// POST — usuária envia mensagem
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { referenciaId, tipo, texto, imagem } = await req.json()
  if (!referenciaId || !tipo || !texto?.trim())
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const id          = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const workspaceId = session.user.workspaceId
  const usuarioNome = session.user.name ?? 'Usuária'

  if (imagem) {
    await prisma.$executeRaw`
      INSERT INTO "SuporteMensagem" ("id","tipo","referenciaId","remetente","texto","imagem","createdAt")
      VALUES (${id}, ${tipo}, ${referenciaId}, 'USUARIO', ${texto.trim()}, ${imagem}, NOW())
    `
  } else {
    await prisma.$executeRaw`
      INSERT INTO "SuporteMensagem" ("id","tipo","referenciaId","remetente","texto","createdAt")
      VALUES (${id}, ${tipo}, ${referenciaId}, 'USUARIO', ${texto.trim()}, NOW())
    `
  }

  // Reabrir se estava concluído
  if (tipo === 'CHAMADO') {
    await prisma.$executeRaw`
      UPDATE "SuporteChamado" SET "status" = 'ABERTO'
      WHERE id = ${referenciaId} AND "status" = 'RESOLVIDO'
    `
  } else {
    await prisma.$executeRaw`
      UPDATE "SuporteFeedback" SET "status" = 'ABERTO'
      WHERE id = ${referenciaId} AND "status" = 'CONCLUIDO'
    `
  }

  // Notificar Telegram
  try {
    const emoji = tipo === 'CHAMADO' ? '💬' : '📝'
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `${emoji} <b>Nova resposta da usuária — ${tipo}</b>\n\n<b>Usuária:</b> ${usuarioNome}\n\n${texto.slice(0, 400)}`,
          parse_mode: 'HTML',
        }),
      }
    )
  } catch {}

  return NextResponse.json({ ok: true, id })
}
