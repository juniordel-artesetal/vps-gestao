import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

async function verificarMaster() {
  const cookieStore = await cookies()
  const token = cookieStore.get('master_token')?.value
  return token === process.env.MASTER_SECRET_TOKEN
}

export async function GET(req: NextRequest) {
  if (!await verificarMaster()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const secao = searchParams.get('secao') ?? 'workspaces'

  if (secao === 'workspaces') {
    const workspaces = await prisma.$queryRaw`
      SELECT
        w.id, w.nome, w.slug, w.plano, w.ativo, w."createdAt",
        COUNT(DISTINCT u.id)::int AS total_usuarios,
        COUNT(DISTINCT o.id)::int AS total_pedidos,
        MAX(al."data")            AS ultimo_uso_ia
      FROM "Workspace" w
      LEFT JOIN "User"          u  ON u."workspaceId"  = w.id
      LEFT JOIN "Order"         o  ON o."workspaceId"  = w.id
      LEFT JOIN "AiUsageLog"    al ON al."workspaceId" = w.id
      GROUP BY w.id, w.nome, w.slug, w.plano, w.ativo, w."createdAt"
      ORDER BY w."createdAt" DESC
    ` as any[]
    return NextResponse.json(serialize({ workspaces }))
  }

  if (secao === 'chamados') {
    const chamados = await prisma.$queryRaw`
      SELECT sc.*, w.nome AS "workspaceNome"
      FROM "SuporteChamado" sc
      LEFT JOIN "Workspace" w ON w.id = sc."workspaceId"
      ORDER BY sc."createdAt" DESC
      LIMIT 100
    ` as any[]
    return NextResponse.json(serialize({ chamados }))
  }

  if (secao === 'hotmart') {
    const eventos = await prisma.$queryRaw`
      SELECT id, evento, email, "workspaceId", processado, erro, "createdAt"
      FROM "HotmartEvent"
      ORDER BY "createdAt" DESC
      LIMIT 50
    ` as any[]
    return NextResponse.json(serialize({ eventos }))
  }

  if (secao === 'stats') {
    const hoje = new Date().toISOString().slice(0, 10)
    const [totais, iaHoje, chamadosAbertos] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          COUNT(*)::int                            AS total_workspaces,
          COUNT(*) FILTER (WHERE ativo=true)::int  AS ativos,
          COUNT(*) FILTER (WHERE ativo=false)::int AS bloqueados,
          (SELECT COUNT(*)::int FROM "User")       AS total_usuarios
        FROM "Workspace"
      ` as any[],
      prisma.$queryRaw`
        SELECT COALESCE(SUM(calls),0)::int AS total
        FROM "AiUsageLog" WHERE "data"::text = ${hoje}
      ` as any[],
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM "SuporteChamado" WHERE status = 'ABERTO'
      ` as any[],
    ])
    return NextResponse.json(serialize({
      stats: {
        ...totais[0],
        ia_hoje: iaHoje[0]?.total ?? 0,
        chamados_abertos: chamadosAbertos[0]?.total ?? 0,
      },
    }))
  }

  return NextResponse.json({ error: 'Seção inválida' }, { status: 400 })
}