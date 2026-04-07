import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { novaSenha } = await req.json()

  if (!novaSenha || novaSenha.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
  }

  // Buscar o usuário pelo email (fallback robusto — não depende de session.user.id)
  // session.user.id pode ser undefined em tokens antigos gerados antes do fix do auth.ts
  const email = session.user.email
  const userId = (session.user as any).id || null

  if (!email && !userId) {
    return NextResponse.json({ error: 'Sessão inválida — faça login novamente' }, { status: 401 })
  }

  const hash = await bcrypt.hash(novaSenha, 10)

  let updated = 0

  if (userId) {
    const res = await prisma.$executeRaw`
      UPDATE "User"
      SET "senha" = ${hash}, "primeiroLogin" = false
      WHERE "id" = ${userId}
    `
    updated = Number(res)
  }

  // Fallback: usar email se id não funcionou
  if (!updated && email) {
    await prisma.$executeRaw`
      UPDATE "User"
      SET "senha" = ${hash}, "primeiroLogin" = false
      WHERE "email" = ${email}
    `
  }

  return NextResponse.json({ ok: true })
}
