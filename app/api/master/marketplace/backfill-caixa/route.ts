// Master — backfill das ENTRADAS de marketplace no caixa: cria o PREVISTO dos pedidos
// ENVIADO de marketplace que ainda não têm lançamento. GET = dry-run (lista); POST = aplica.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { backfillEnviadosSemLancamento } from '@/lib/marketplace/recebivelFluxo'

export const dynamic = 'force-dynamic'

async function autorizado(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

// Resolve o workspace por id OU slug OU trecho do nome.
async function resolverWs(ref: string): Promise<{ id: string; nome: string } | null> {
  const [w] = await prisma.$queryRaw`
    SELECT "id","nome" FROM "Workspace"
    WHERE "id" = ${ref} OR "slug" = ${ref} OR "nome" ILIKE ${'%' + ref + '%'} LIMIT 1
  ` as { id: string; nome: string }[]
  return w || null
}

export async function GET(req: NextRequest) {
  if (!(await autorizado(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const ref = req.nextUrl.searchParams.get('ws') || ''
  if (!ref) return NextResponse.json({ error: 'Informe ?ws=<id|slug|nome>' }, { status: 400 })
  const ws = await resolverWs(ref)
  if (!ws) return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })
  const r = await backfillEnviadosSemLancamento(ws.id, true)   // dry-run
  return NextResponse.json(serialize({ dryRun: true, workspace: ws.nome, aCriar: r.pedidos.length, pedidos: r.pedidos }))
}

export async function POST(req: NextRequest) {
  if (!(await autorizado(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const ref = body.ws || ''
  if (!ref) return NextResponse.json({ error: 'Informe ws no corpo' }, { status: 400 })
  const ws = await resolverWs(String(ref))
  if (!ws) return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })
  const r = await backfillEnviadosSemLancamento(ws.id, false)  // aplica
  return NextResponse.json(serialize({ ok: true, workspace: ws.nome, criados: r.criados, considerados: r.pedidos.length }))
}
