import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { validarForcaSenha } from '@/lib/senhaPolicy'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 })
    }

    const senha: string = body?.senha ?? ''

    // Força de senha (política única). Senhas antigas seguem valendo; isto só barra a NOVA.
    const forca = validarForcaSenha(senha)
    if (!forca.ok) {
      return NextResponse.json({ error: forca.erros.join(' '), erros: forca.erros }, { status: 400 })
    }

    const email = session.user.email.toLowerCase().trim()

    const usuarios = await prisma.$queryRaw`
      SELECT "id" FROM "User"
      WHERE LOWER("email") = ${email}
      LIMIT 1
    ` as any[]

    if (usuarios.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const senhaHash = await bcrypt.hash(senha, 10)

    await prisma.$executeRaw`
      UPDATE "User"
      SET "senha" = ${senhaHash},
          "primeiroLogin" = false
      WHERE "id" = ${usuarios[0].id}
    `

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/auth/trocar-senha]', err)
    return NextResponse.json({ error: 'Erro interno ao trocar senha' }, { status: 500 })
  }
}
