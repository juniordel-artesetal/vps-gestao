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

  const hash = await bcrypt.hash(novaSenha, 10)

  await prisma.$executeRaw`
    UPDATE "User"
    SET "senha" = ${hash}, "primeiroLogin" = false
    WHERE "id" = ${session.user.id}
  `

  return NextResponse.json({ ok: true })
}
