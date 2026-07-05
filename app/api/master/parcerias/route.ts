// app/api/master/parcerias/route.ts
// Painel de Parcerias: métricas GLOBAIS e AGREGADAS de tração (para vender
// publicidade a fornecedores). Só o MASTER acessa. Nada de dado individual sensível.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}
async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export async function GET() {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // ── Atividade econômica (Order) — GMV exclui CANCELADO ──
  const [eco] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS "pedidos",
      COUNT(*) FILTER (WHERE "status" <> 'CANCELADO')::int AS "pedidosValidos",
      COALESCE(SUM(COALESCE("valorTotal", "valor", 0)) FILTER (WHERE "status" <> 'CANCELADO'), 0)::float AS "gmv"
    FROM "Order"
  ` as any[]
  const gmv = Number(eco?.gmv || 0)
  const pedidosValidos = Number(eco?.pedidosValidos || 0)
  const ticketMedio = pedidosValidos > 0 ? gmv / pedidosValidos : 0

  // ── Alcance (Workspace / User) ──
  const [alc] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS "workspacesTotal",
      COUNT(*) FILTER (WHERE "ativo" = true)::int AS "workspacesAtivos"
    FROM "Workspace"
  ` as any[]
  const [online] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE "ultimoAcesso" >= NOW() - INTERVAL '5 minutes')::int AS "online5min",
      COUNT(*) FILTER (WHERE "ultimoAcesso" >= NOW() - INTERVAL '30 days')::int AS "ativas30d"
    FROM "User"
  ` as any[]

  // ── Inventário / índice ──
  const [inv] = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM "Fornecedor") AS "fornecedores",
      (SELECT COUNT(*)::int FROM "PrecMaterial") AS "materiais",
      (SELECT COUNT(*)::int FROM "LojaConfig" WHERE "ativo" = true) AS "lojasAtivas"
  ` as any[]

  // ── Buscas do Assistente (30d) + top termos ──
  const [busca] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS "buscas30d"
    FROM "PesquisaLog" WHERE "createdAt" >= NOW() - INTERVAL '30 days'
  ` as any[]
  const topTermos = await prisma.$queryRaw`
    SELECT "normNome" AS "termo", COUNT(*)::int AS "total"
    FROM "PesquisaLog"
    WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND COALESCE("normNome",'') <> ''
    GROUP BY "normNome" ORDER BY "total" DESC LIMIT 12
  ` as any[]

  // ── Patrocinados (impressões / cliques) ──
  const [anuncios] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE "tipo" = 'impressao')::int AS "impressoes",
      COUNT(*) FILTER (WHERE "tipo" = 'clique')::int AS "cliques"
    FROM "PesquisaAnuncioEvento"
  ` as any[]
  const [pats] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE "ativo" = true)::int AS "ativos"
    FROM "PesquisaPatrocinado"
  ` as any[]

  // ── Distribuições (por segmento / por estado) ──
  const porSegmento = await prisma.$queryRaw`
    SELECT COALESCE(NULLIF(TRIM("segmento"),''),'—') AS "segmento", COUNT(*)::int AS "total"
    FROM "Workspace" GROUP BY 1 ORDER BY "total" DESC LIMIT 15
  ` as any[]
  const porEstado = await prisma.$queryRaw`
    SELECT COALESCE(NULLIF(TRIM(UPPER("estado")),''),'—') AS "estado", COUNT(*)::int AS "total"
    FROM "Workspace" GROUP BY 1 ORDER BY "total" DESC LIMIT 20
  ` as any[]

  // ── Crescimento de assinantes por mês (12 meses) ──
  const crescimento = await prisma.$queryRaw`
    SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS "mes", COUNT(*)::int AS "novos"
    FROM "Workspace"
    WHERE "createdAt" >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months'
    GROUP BY 1 ORDER BY 1 ASC
  ` as any[]

  return NextResponse.json(serialize({
    economia: { pedidos: Number(eco?.pedidos || 0), pedidosValidos, gmv, ticketMedio },
    alcance: {
      workspacesTotal: Number(alc?.workspacesTotal || 0),
      workspacesAtivos: Number(alc?.workspacesAtivos || 0),
      online5min: Number(online?.online5min || 0),
      ativas30d: Number(online?.ativas30d || 0),
    },
    inventario: {
      fornecedores: Number(inv?.fornecedores || 0),
      materiais: Number(inv?.materiais || 0),
      lojasAtivas: Number(inv?.lojasAtivas || 0),
    },
    assistente: { buscas30d: Number(busca?.buscas30d || 0), topTermos },
    anuncios: {
      impressoes: Number(anuncios?.impressoes || 0),
      cliques: Number(anuncios?.cliques || 0),
      patrocinados: Number(pats?.total || 0),
      patrocinadosAtivos: Number(pats?.ativos || 0),
    },
    porSegmento, porEstado, crescimento,
    geradoEm: new Date().toISOString(),
  }))
}
