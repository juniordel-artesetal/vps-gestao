// Master — cortesia do Método Mãe (libera o MAE inteiro sem cobrar; imune à cobrança e à carência).
// POST { email | workspaceId, on: boolean }. Desligar só tira a CORTESIA (uma assinatura paga não é tocada).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { definirCortesiaMae, estadoMaeDaConta } from '@/lib/mae/assinatura/servidor'

export const dynamic = 'force-dynamic'

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const headerToken = req.headers.get('x-master-token')
  if (headerToken) return headerToken === process.env.MASTER_SECRET_TOKEN
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  let workspaceId = typeof b.workspaceId === 'string' ? b.workspaceId : ''
  if (!workspaceId && typeof b.email === 'string') {
    const [u] = await prisma.$queryRaw<{ w: string }[]>`SELECT "workspaceId" AS w FROM "User" WHERE lower("email") = lower(${b.email}) LIMIT 1`
    workspaceId = u?.w || ''
  }
  if (!workspaceId) return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })
  await definirCortesiaMae(workspaceId, !!b.on)
  return NextResponse.json({ ok: true, workspaceId, estado: await estadoMaeDaConta(workspaceId) })
}
