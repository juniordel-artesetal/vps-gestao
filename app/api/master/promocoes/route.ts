import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — todas as promoções (moderação). Sem imagem na listagem.
export async function GET() {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const rows = await prisma.$queryRaw`
    SELECT dp."id", p."nome" AS "parceiroNome", dp."titulo", dp."descricao", dp."cupom", dp."linkCompra",
           dp."prioridade", dp."ativo", dp."impressoes", dp."cliques",
           TO_CHAR(dp."dataInicio",'YYYY-MM-DD') AS "dataInicio",
           TO_CHAR(dp."dataFim",'YYYY-MM-DD') AS "dataFim"
    FROM "DistribuidorPromocao" dp
    JOIN "Parceiro" p ON p."id" = dp."parceiroId"
    ORDER BY dp."ativo" DESC, dp."prioridade" DESC, dp."createdAt" DESC
  ` as any[]
  return NextResponse.json(serialize(rows))
}

// POST — moderação: define prioridade e/ou ativa/pausa. body: { id, prioridade?, ativo? }
export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  if (b.prioridade !== undefined)
    await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "prioridade" = ${Number(b.prioridade) || 0} WHERE "id" = ${String(b.id)}`
  if (typeof b.ativo === 'boolean')
    await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "ativo" = ${b.ativo} WHERE "id" = ${String(b.id)}`
  return NextResponse.json({ ok: true })
}
