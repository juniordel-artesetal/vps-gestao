// app/api/precificacao/produtos/massa/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { produtos } = await req.json()
    if (!Array.isArray(produtos) || produtos.length === 0) return NextResponse.json({ error: 'Lista vazia' }, { status: 400 })
    if (produtos.length > 100) return NextResponse.json({ error: 'Máximo 100 produtos por vez' }, { status: 400 })
    const workspaceId = session.user.workspaceId
    const criados: { id: string; nome: string }[] = []
    const erros: { nome: string; erro: string }[] = []
    for (const p of produtos) {
      const nome = (p.nome || '').trim()
      if (!nome) continue
      try {
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
        await prisma.$executeRaw`
          INSERT INTO "PrecProduto" ("id","workspaceId","nome","sku","categoria","ativo","createdAt","updatedAt")
          VALUES (${id}, ${workspaceId}, ${nome}, ${p.sku?.trim()||null}, ${p.categoria?.trim()||null}, true, NOW(), NOW())
        `
        criados.push({ id, nome })
      } catch (e: any) { erros.push({ nome, erro: e.message }) }
    }
    return NextResponse.json({ criados, erros, total: criados.length }, { status: 201 })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
