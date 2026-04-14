import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return parseFloat(String(obj))
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  const workspaceId = session.user.workspaceId
  const rows = await prisma.$queryRaw`
    SELECT fm.id, fm."segmentoId", fm.nome, fm.emoji, fm.ativo,
      COALESCE(json_agg(json_build_object('fmsId',fms.id,'ordem',fms.ordem,'setorId',sc.id,'nome',sc.nome,'icone',sc.icone,'cor',sc.cor) ORDER BY fms.ordem ASC) FILTER (WHERE fms.id IS NOT NULL),'[]') AS setores
    FROM "FluxoModelo" fm
    LEFT JOIN "FluxoModeloSetor" fms ON fms."fluxoModeloId" = fm.id
    LEFT JOIN "SetorConfig" sc ON sc.id = fms."setorConfigId"
    WHERE fm.id = ${id} AND fm."workspaceId" = ${workspaceId}
    GROUP BY fm.id
  ` as any[]
  if (!rows.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(serialize(rows[0]))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  const workspaceId = session.user.workspaceId
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { nome, emoji, ativo, setorIds } = body
  await prisma.$executeRaw`
    UPDATE "FluxoModelo"
    SET nome = COALESCE(${nome ?? null}, nome), emoji = COALESCE(${emoji ?? null}, emoji), ativo = COALESCE(${ativo ?? null}::boolean, ativo)
    WHERE id = ${id} AND "workspaceId" = ${workspaceId}
  `
  if (Array.isArray(setorIds)) {
    await prisma.$executeRaw`DELETE FROM "FluxoModeloSetor" WHERE "fluxoModeloId" = ${id}`
    for (let i = 0; i < setorIds.length; i++) {
      const fmsId = gerarId()
      await prisma.$executeRaw`INSERT INTO "FluxoModeloSetor" ("id","fluxoModeloId","setorConfigId","ordem") VALUES (${fmsId},${id},${setorIds[i]},${i})`
    }
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  const workspaceId = session.user.workspaceId
  const [qtd] = await prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM "FluxoModelo" WHERE "workspaceId" = ${workspaceId} AND ativo = true` as any[]
  if (qtd.total <= 1) return NextResponse.json({ error: 'Não é possível excluir o único fluxo ativo' }, { status: 400 })
  await prisma.$executeRaw`DELETE FROM "FluxoModeloSetor" WHERE "fluxoModeloId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "FluxoModelo" WHERE id = ${id} AND "workspaceId" = ${workspaceId}`
  return NextResponse.json({ ok: true })
}