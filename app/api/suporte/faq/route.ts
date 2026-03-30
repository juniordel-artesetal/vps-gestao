import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── GET — lista FAQs (todos autenticados veem, filtra por categoria se informado)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const categoria = searchParams.get('categoria')
  const busca     = searchParams.get('busca')

  let faqs: any[]

  if (categoria && categoria !== 'Todas') {
    faqs = await prisma.$queryRaw`
      SELECT id, categoria, pergunta, resposta, ordem, ativo, "createdAt"
      FROM "SuporteFaq"
      WHERE "ativo" = true AND "categoria" = ${categoria}
      ORDER BY "ordem" ASC, "createdAt" ASC
    ` as any[]
  } else if (busca) {
    faqs = await prisma.$queryRaw`
      SELECT id, categoria, pergunta, resposta, ordem, ativo, "createdAt"
      FROM "SuporteFaq"
      WHERE "ativo" = true
        AND (
          LOWER("pergunta") LIKE LOWER(${'%' + busca + '%'})
          OR LOWER("resposta") LIKE LOWER(${'%' + busca + '%'})
        )
      ORDER BY "ordem" ASC, "createdAt" ASC
    ` as any[]
  } else {
    faqs = await prisma.$queryRaw`
      SELECT id, categoria, pergunta, resposta, ordem, ativo, "createdAt"
      FROM "SuporteFaq"
      WHERE "ativo" = true
      ORDER BY "categoria" ASC, "ordem" ASC
    ` as any[]
  }

  return NextResponse.json({ faqs })
}

// ── POST — criar FAQ (só ADMIN)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { categoria, pergunta, resposta, ordem } = await req.json()

  if (!categoria?.trim() || !pergunta?.trim() || !resposta?.trim()) {
    return NextResponse.json({ error: 'Preencha categoria, pergunta e resposta' }, { status: 400 })
  }

  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const ordemFinal = ordem ?? 0

  await prisma.$executeRaw`
    INSERT INTO "SuporteFaq" ("id","categoria","pergunta","resposta","ordem","ativo","createdAt","updatedAt")
    VALUES (${id}, ${categoria.trim()}, ${pergunta.trim()}, ${resposta.trim()}, ${ordemFinal}, true, NOW(), NOW())
  `

  return NextResponse.json({ ok: true, id }, { status: 201 })
}
