import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normNome } from '@/lib/normNome'

export const dynamic = 'force-dynamic'
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// POST — registra clique num patrocinado (contador + evento para o relatório)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id, query } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "cliques" = "cliques" + 1 WHERE "id" = ${String(id)} AND "ativo" = true`
  try {
    const qn = query ? normNome(String(query)) : null
    await prisma.$executeRaw`INSERT INTO "PesquisaAnuncioEvento" ("id","patrocinadoId","tipo","query","createdAt") VALUES (${novoId()}, ${String(id)}, 'clique', ${qn || null}, NOW())`
  } catch { }
  return NextResponse.json({ ok: true })
}
