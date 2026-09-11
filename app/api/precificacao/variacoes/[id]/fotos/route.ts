// Fotos DA VARIAÇÃO (fonte da verdade) — no fluxo de Precificação, SEM exigir vitrine.
// Guarda no MESMO armazém da vitrine (LojaImagem, por variacaoId): uma foto, dois consumidores
// (vitrine quando ativa + marketplace). Escopo por workspace (variação → produto → workspace).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// Confere que a variação é do workspace e devolve o produtoId (dono alternativo da imagem).
async function donoVariacao(variacaoId: string, workspaceId: string): Promise<{ produtoId: string } | null> {
  const [v] = await prisma.$queryRaw`
    SELECT v."produtoId" FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
    WHERE v."id" = ${variacaoId} AND p."workspaceId" = ${workspaceId} LIMIT 1
  ` as { produtoId: string }[]
  return v ?? null
}

async function ctx(id: string) {
  const session = await getServerSession(authOptions)
  if (!session) return { erro: 'Não autenticado', status: 401 as const }
  if (session.user.role === 'OPERADOR') return { erro: 'Sem permissão', status: 403 as const }
  const dono = await donoVariacao(id, session.user.workspaceId)
  if (!dono) return { erro: 'Variação não encontrada', status: 404 as const }
  return { workspaceId: session.user.workspaceId as string, produtoId: dono.produtoId }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await ctx(id); if ('erro' in c) return NextResponse.json({ error: c.erro }, { status: c.status })
  const fotos = await prisma.$queryRaw`
    SELECT "id", "capa", "ordem", "imagem" FROM "LojaImagem"
    WHERE "workspaceId" = ${c.workspaceId} AND "variacaoId" = ${id}
    ORDER BY "capa" DESC, "ordem" ASC, "createdAt" ASC
  ` as { id: string; capa: boolean; ordem: number; imagem: string }[]
  return NextResponse.json({ fotos })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await ctx(id); if ('erro' in c) return NextResponse.json({ error: c.erro }, { status: c.status })
  const { imagem } = await req.json().catch(() => ({}))
  if (typeof imagem !== 'string' || !imagem.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Envie uma imagem válida.' }, { status: 400 })
  }
  const [ag] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n, COALESCE(MAX("ordem"), -1) AS "maxOrdem" FROM "LojaImagem"
    WHERE "workspaceId" = ${c.workspaceId} AND "variacaoId" = ${id}
  ` as { n: number; maxOrdem: number }[]
  const primeira = (ag?.n ?? 0) === 0
  await prisma.$executeRaw`
    INSERT INTO "LojaImagem" ("id","workspaceId","produtoId","variacaoId","imagem","ordem","capa","createdAt")
    VALUES (${gid()}, ${c.workspaceId}, ${null}, ${id}, ${imagem}, ${(ag?.maxOrdem ?? -1) + 1}, ${primeira}, NOW())
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await ctx(id); if ('erro' in c) return NextResponse.json({ error: c.erro }, { status: c.status })
  const imagemId = new URL(req.url).searchParams.get('imagemId')
  if (!imagemId) return NextResponse.json({ error: 'imagemId obrigatório' }, { status: 400 })
  await prisma.$executeRaw`DELETE FROM "LojaImagem" WHERE "id" = ${imagemId} AND "workspaceId" = ${c.workspaceId} AND "variacaoId" = ${id}`
  // Garante uma capa: se sobrou alguma e nenhuma é capa, promove a primeira.
  const restantes = await prisma.$queryRaw`SELECT "id","capa" FROM "LojaImagem" WHERE "workspaceId" = ${c.workspaceId} AND "variacaoId" = ${id} ORDER BY "ordem" ASC` as { id: string; capa: boolean }[]
  if (restantes.length && !restantes.some(r => r.capa)) {
    await prisma.$executeRaw`UPDATE "LojaImagem" SET "capa" = true WHERE "id" = ${restantes[0].id}`
  }
  return NextResponse.json({ ok: true })
}
