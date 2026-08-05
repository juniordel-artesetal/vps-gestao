// Artesã — grava a resposta da enquete. Idempotente por (enquete, workspace):
// ON CONFLICT DO NOTHING garante que não repete nem sobrescreve.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureEnquetesSchema, gid, type Pergunta } from '@/lib/enquetes'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  await ensureEnquetesSchema()
  const { id } = await params
  const workspaceId = session.user.workspaceId
  const b = await req.json().catch(() => ({}))

  const [enq] = await prisma.$queryRaw`
    SELECT "id","perguntas","ativo" FROM "Enquete" WHERE "id" = ${id}
  ` as any[]
  if (!enq) return NextResponse.json({ error: 'Enquete não encontrada' }, { status: 404 })
  if (!enq.ativo) return NextResponse.json({ error: 'Esta enquete foi encerrada.' }, { status: 409 })

  // Sanitiza respostas contra as perguntas reais (nunca confiar no client).
  const perguntas: Pergunta[] = Array.isArray(enq.perguntas) ? enq.perguntas : []
  const entrada = b.respostas && typeof b.respostas === 'object' ? b.respostas : {}
  const limpa: Record<string, string | number> = {}
  for (const p of perguntas) {
    const v = entrada[p.id]
    if (v == null || v === '') continue
    if (p.tipo === 'escala') { const n = Number(v); if (n >= 1 && n <= 5) limpa[p.id] = n }
    else if (p.tipo === 'multipla') { const s = String(v); if ((p.opcoes || []).includes(s)) limpa[p.id] = s }
    else limpa[p.id] = String(v).slice(0, 1000)
  }
  if (Object.keys(limpa).length === 0) return NextResponse.json({ error: 'Responda ao menos uma pergunta.' }, { status: 400 })

  const nome = session.user.name ?? null
  const r = await prisma.$executeRaw`
    INSERT INTO "EnqueteResposta" ("id","enqueteId","workspaceId","usuarioNome","respostas")
    VALUES (${gid()}, ${id}, ${workspaceId}, ${nome}, ${JSON.stringify(limpa)}::jsonb)
    ON CONFLICT ("enqueteId","workspaceId") DO NOTHING
  `
  return NextResponse.json({ ok: true, jaRespondida: Number(r) === 0 })
}
