import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { contarRevisoesPendentes } from '@/lib/canaisMonitor'

// Serializa BigInt, Decimal e Date — resolve o bug de "Invalid Date"
function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

async function verificarMaster() {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export async function GET(req: NextRequest) {
  if (!await verificarMaster()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const secao = searchParams.get('secao') ?? 'workspaces'

  if (secao === 'workspaces') {
    // Subqueries escalares por workspace — evitam o JOIN fan-out (Workspace × User ×
    // Order × AiUsageLog × LoginHistory) que gerava um produto cartesiano enorme + o
    // COUNT(DISTINCT) pra deduplicar: ~60-70s segurando AccessShare na Workspace (a
    // tabela lida em toda request) → travava o SOA inteiro (incidente 25/08). Assim
    // cada contagem usa o índice de workspaceId da sua tabela: caiu p/ ~0,4s.
    const workspaces = await prisma.$queryRaw`
      SELECT
        w.id, w.nome, w.slug, w.plano, w.ativo, w."createdAt",
        (SELECT COUNT(*)::int FROM "User"  u  WHERE u."workspaceId"  = w.id)               AS total_usuarios,
        (SELECT COUNT(*)::int FROM "Order" o  WHERE o."workspaceId"  = w.id)               AS total_pedidos,
        (SELECT MAX(al."data")     FROM "AiUsageLog"   al WHERE al."workspaceId" = w.id)   AS ultimo_uso_ia,
        (SELECT MAX(lh."createdAt") FROM "LoginHistory" lh WHERE lh."workspaceId" = w.id)  AS ultimo_login
      FROM "Workspace" w
      ORDER BY w."createdAt" DESC
    ` as unknown as any[]
    return NextResponse.json(serialize({ workspaces }))
  }

  if (secao === 'chamados') {
    const chamados = await prisma.$queryRaw`
      SELECT
        sc.id, sc."workspaceId", sc."usuarioNome", sc.email,
        sc.descricao, sc."respostaIA", sc."notaInterna", sc.protocolo,
        sc.status, sc."emailEnviado", sc."telegramEnviado", sc.imagem,
        sc.whatsapp, sc."respondidoEm", sc."createdAt",
        w.nome AS "workspaceNome"
      FROM "SuporteChamado" sc
      LEFT JOIN "Workspace" w ON w.id = sc."workspaceId"
      ORDER BY sc."createdAt" DESC
      LIMIT 100
    ` as unknown as any[]
    return NextResponse.json(serialize({ chamados }))
  }

  if (secao === 'hotmart') {
    const eventos = await prisma.$queryRaw`
      SELECT id, evento, email, "workspaceId", processado, erro, "createdAt"
      FROM "HotmartEvent"
      ORDER BY "createdAt" DESC
      LIMIT 50
    ` as unknown as any[]
    return NextResponse.json(serialize({ eventos }))
  }

  if (secao === 'stats') {
    const hoje = new Date().toISOString().slice(0, 10)

    const totais = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int                            AS total_workspaces,
        COUNT(*) FILTER (WHERE ativo=true)::int  AS ativos,
        COUNT(*) FILTER (WHERE ativo=false)::int AS bloqueados,
        (SELECT COUNT(*)::int FROM "User")       AS total_usuarios
      FROM "Workspace"
    ` as unknown as any[]

    const iaHoje = await prisma.$queryRaw`
      SELECT COALESCE(SUM(calls),0)::int AS total
      FROM "AiUsageLog" WHERE "data"::text = ${hoje}
    ` as unknown as any[]

    const chamadosAbertos = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS total FROM "SuporteChamado" WHERE status = 'ABERTO'
    ` as unknown as any[]

    const loginsHoje = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS total FROM "LoginHistory"
      WHERE "createdAt"::date = ${hoje}::date AND "sucesso" = true
    ` as unknown as any[]

    // Parceiras (só quando a frente está ligada): quantas aguardando aprovação.
    const parcAtivo = String(process.env.PARCEIRAS_ATIVO || '').toLowerCase() === 'on'
    const parcPend = parcAtivo
      ? (await prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM "Parceiro" WHERE "status" = 'pendente'` as unknown as any[])
      : [{ total: 0 }]

    // Taxas de canal a revisar (monitoramento Shopee/TikTok)
    const taxasRevisar = await contarRevisoesPendentes().catch(() => 0)

    return NextResponse.json(serialize({
      stats: {
        ...totais[0],
        ia_hoje:          iaHoje[0]?.total ?? 0,
        chamados_abertos: chamadosAbertos[0]?.total ?? 0,
        logins_hoje:      loginsHoje[0]?.total ?? 0,
        parceiras_ativo:     parcAtivo,
        parceiras_pendentes: parcPend[0]?.total ?? 0,
        taxas_a_revisar:     taxasRevisar,
      },
    }))
  }

  return NextResponse.json({ error: 'Seção inválida' }, { status: 400 })
}
