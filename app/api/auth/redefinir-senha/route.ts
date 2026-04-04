import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { token, novaSenha } = await req.json()

    if (!token || !novaSenha)
      return NextResponse.json({ error: 'Token e nova senha são obrigatórios' }, { status: 400 })

    if (novaSenha.length < 6)
      return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 })

    // Busca usuário pelo token e verifica validade
    const users = await prisma.$queryRaw`
      SELECT id, "resetExpires"
      FROM "User"
      WHERE "resetToken" = ${token}
        AND "resetExpires" > NOW()
      LIMIT 1
    ` as any[]

    if (!users.length)
      return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 410 })

    const user  = users[0]
    const hash  = await bcrypt.hash(novaSenha, 12)

    // Salva nova senha e limpa o token
    await prisma.$executeRaw`
      UPDATE "User"
      SET senha          = ${hash},
          "resetToken"   = NULL,
          "resetExpires" = NULL,
          "primeiroLogin" = false
      WHERE id = ${user.id}
    `

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/auth/redefinir-senha:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
