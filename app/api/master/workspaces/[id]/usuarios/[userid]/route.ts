import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

async function verificarMaster() {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

function gerarSenha(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── PUT — resetar senha de um usuário
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { userId } = await params
  const novaSenha  = gerarSenha()
  const hash       = await bcrypt.hash(novaSenha, 10)

  await prisma.$executeRaw`
    UPDATE "User" SET "senha" = ${hash} WHERE "id" = ${userId}
  `

  return NextResponse.json({ ok: true, novaSenha })
}
