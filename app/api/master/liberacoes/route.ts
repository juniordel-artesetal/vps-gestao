// Liberações manuais de acesso (paliativo de billing). Só Master.
// GET  → lista os workspaces com liberacaoManual = true (reversibilidade/auditoria).
// DELETE?workspaceId=xxx → desliga a flag de UM workspace (quando o billing regularizar).
//   (sem workspaceId e ?todos=1 → desliga de todos — usar só no fim da regularização.)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') { const r: any = {}; for (const k of Object.keys(obj)) r[k] = serialize(obj[k]); return r }
  return obj
}

async function ehMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export async function GET(_req: NextRequest) {
  if (!await ehMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const rows = await prisma.$queryRaw`
    SELECT w."id", w."nome", w."ativo", w."liberacaoMotivo", w."liberacaoEm",
           (SELECT COUNT(*)::int FROM "User" u WHERE u."workspaceId" = w."id") AS "usuarios"
    FROM "Workspace" w
    WHERE w."liberacaoManual" = true
    ORDER BY w."liberacaoEm" DESC NULLS LAST
  ` as any[]
  return NextResponse.json({ total: rows.length, liberacoes: serialize(rows) })
}

export async function DELETE(req: NextRequest) {
  if (!await ehMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const todos = searchParams.get('todos') === '1'
  if (!workspaceId && !todos)
    return NextResponse.json({ error: 'Informe workspaceId ou ?todos=1' }, { status: 400 })

  // Desligar a flag NÃO reativa cobrança nem corta acesso: o webhook volta a mandar no ws.ativo
  // a partir do próximo evento. Só remove a proteção paliativa.
  let n: number
  if (todos) {
    n = await prisma.$executeRaw`
      UPDATE "Workspace" SET "liberacaoManual" = false, "liberacaoMotivo" = NULL, "liberacaoEm" = NULL
      WHERE "liberacaoManual" = true
    `
  } else {
    n = await prisma.$executeRaw`
      UPDATE "Workspace" SET "liberacaoManual" = false, "liberacaoMotivo" = NULL, "liberacaoEm" = NULL
      WHERE "id" = ${workspaceId}
    `
  }
  console.log(`[LIBERACOES] flag removida — ${todos ? 'TODOS' : workspaceId} (${n} ws)`)
  return NextResponse.json({ ok: true, atualizados: n })
}
