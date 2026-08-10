import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { creditar, saldos, historico, MotivoMovimento } from '@/lib/creditos'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — saldos + histórico de um workspace (para o Master inspecionar). ?workspaceId=
// Sem workspaceId: lista os workspaces que já têm carteira, com o total por tipo.
export async function GET(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')

  if (workspaceId) {
    const [listaSaldos, ledger, ws] = await Promise.all([
      saldos(workspaceId),
      historico(workspaceId, null, 100),
      prisma.$queryRaw`SELECT "id","nome" FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1` as Promise<any[]>,
    ])
    return NextResponse.json(serialize({ workspace: ws[0] || null, saldos: listaSaldos, historico: ledger }))
  }

  // Visão geral: carteiras existentes agrupadas por workspace
  const rows = await prisma.$queryRaw`
    SELECT cs."workspaceId", w."nome" AS "workspaceNome", cs."tipo",
           cs."saldo"::float AS "saldo", cs."cotaGratisMes"::int AS "cotaGratisMes"
    FROM "CreditoSaldo" cs
    JOIN "Workspace" w ON w."id" = cs."workspaceId"
    ORDER BY w."nome" ASC, cs."tipo" ASC
  ` as any[]
  return NextResponse.json(serialize(rows))
}

// POST — concede crédito manual (auditado no ledger). body: { workspaceId, tipo, qtd, motivo?, referencia? }
export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const workspaceId = String(b.workspaceId || '').trim()
  const tipo = String(b.tipo || '').trim()
  const qtd = Number(b.qtd) || 0
  const motivo = (b.motivo as MotivoMovimento) || 'ajuste_master'
  const referencia = b.referencia ? String(b.referencia) : null

  if (!workspaceId || !tipo) return NextResponse.json({ error: 'workspaceId e tipo obrigatórios' }, { status: 400 })
  if (qtd <= 0) return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })

  const r = await creditar({ workspaceId, tipo, qtd, motivo, referencia })
  if (!r.ok) return NextResponse.json(r, { status: 400 })
  return NextResponse.json(r)
}
