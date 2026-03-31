// Destino: app/api/config/usuarios/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        u.id, u.nome, u.email, u.role, u.ativo, u."primeiroLogin", u."createdAt",
        lh."createdAt" AS "ultimoLogin",
        lh.ip           AS "ultimoIp"
      FROM "User" u
      LEFT JOIN LATERAL (
        SELECT "createdAt", ip FROM "LoginHistory"
        WHERE "userId" = u.id AND sucesso = true
        ORDER BY "createdAt" DESC LIMIT 1
      ) lh ON true
      WHERE u."workspaceId" = ${workspaceId}
      ORDER BY u."createdAt" ASC
    ` as any[]

    return NextResponse.json(serialize(rows))
  } catch (err) {
    console.error('[GET /api/config/usuarios]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  try {
    const body = await req.json()
    const { nome, email, senha, role } = body

    if (!nome?.trim())
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    if (!email?.trim())
      return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 })
    if (!senha || senha.length < 6)
      return NextResponse.json({ error: 'Senha mínima de 6 caracteres' }, { status: 400 })
    if (!['ADMIN', 'DELEGADOR', 'OPERADOR'].includes(role))
      return NextResponse.json({ error: 'Role inválido' }, { status: 400 })

    const dup = await prisma.$queryRaw`
      SELECT id FROM "User"
      WHERE email = ${email.toLowerCase().trim()} AND "workspaceId" = ${workspaceId}
    ` as any[]
    if (dup.length > 0)
      return NextResponse.json({ error: 'E-mail já cadastrado neste workspace' }, { status: 400 })

    const id   = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const hash = await bcrypt.hash(senha, 10)

    await prisma.$executeRaw`
      INSERT INTO "User"
        ("id","workspaceId","nome","email","senha","role","ativo","primeiroLogin","createdAt")
      VALUES
        (${id}, ${workspaceId}, ${nome.trim()}, ${email.toLowerCase().trim()},
         ${hash}, ${role}, true, true, NOW())
    `

    const rows = await prisma.$queryRaw`
      SELECT id, nome, email, role, ativo, "primeiroLogin", "createdAt"
      FROM "User" WHERE id = ${id}
    ` as any[]

    return NextResponse.json(serialize(rows[0]), { status: 201 })
  } catch (err) {
    console.error('[POST /api/config/usuarios]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
