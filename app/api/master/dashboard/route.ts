import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { contarRevisoesPendentes } from '@/lib/canaisMonitor'
import { influenciadorasDashAtivo } from '@/lib/influenciadora'

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

    // PAGANTES (reconciliados: Asaas ACTIVE + Hotmart SOA ativo/atraso; ciclo por valor/plano).
    // O marcador é "cicloAssinatura" (só preenchido p/ quem tem assinatura paga ativa —
    // populado pela reconciliação/cron). Cortesia PAGA conta como receita.
    const pagantes = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int                                              AS total,
        COUNT(*) FILTER (WHERE "assinaturaOrigem" = 'asaas')::int  AS asaas,
        COUNT(*) FILTER (WHERE "assinaturaOrigem" IS DISTINCT FROM 'asaas')::int AS hotmart,
        COUNT(*) FILTER (WHERE "cicloAssinatura" = 'MENSAL')::int  AS mensal,
        COUNT(*) FILTER (WHERE "cicloAssinatura" = 'ANUAL')::int   AS anual
      FROM "Workspace"
      WHERE "ativo" = true AND "cicloAssinatura" IS NOT NULL
    ` as unknown as any[]

    // Composição dos ATIVOS que NÃO pagam (explica o gap "ativos" x "pagantes").
    // "No prazo" usa COALESCE(trialAte, createdAt+14): trialAte quase nunca é populado,
    // então a janela real do trial é medida pela data de criação (padrão 14 dias).
    const composicao = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE "cicloAssinatura" IS NULL AND "liberacaoManual" = true)::int AS cortesia,
        COUNT(*) FILTER (WHERE "cicloAssinatura" IS NULL AND "liberacaoManual" = false
                          AND "assinaturaStatus" IN ('TRIAL','AGUARDANDO_PAGAMENTO')
                          AND COALESCE("trialAte"::date, "createdAt"::date + 14) >= CURRENT_DATE)::int AS trial_no_prazo,
        COUNT(*) FILTER (WHERE "cicloAssinatura" IS NULL AND "liberacaoManual" = false
                          AND "assinaturaStatus" IN ('TRIAL','AGUARDANDO_PAGAMENTO')
                          AND COALESCE("trialAte"::date, "createdAt"::date + 14) < CURRENT_DATE)::int AS trial_vencido
      FROM "Workspace" WHERE "ativo" = true
    ` as unknown as any[]

    return NextResponse.json(serialize({
      stats: {
        ...totais[0],
        ia_hoje:          iaHoje[0]?.total ?? 0,
        chamados_abertos: chamadosAbertos[0]?.total ?? 0,
        logins_hoje:      loginsHoje[0]?.total ?? 0,
        parceiras_ativo:     parcAtivo,
        parceiras_pendentes: parcPend[0]?.total ?? 0,
        influenciadoras_dash_ativo: influenciadorasDashAtivo(),
        taxas_a_revisar:     taxasRevisar,
        pagantes:         pagantes[0]?.total ?? 0,
        pagantes_asaas:   pagantes[0]?.asaas ?? 0,
        pagantes_hotmart: pagantes[0]?.hotmart ?? 0,
        pagantes_mensal:  pagantes[0]?.mensal ?? 0,
        pagantes_anual:   pagantes[0]?.anual ?? 0,
        cortesia:         composicao[0]?.cortesia ?? 0,
        trial_no_prazo:   composicao[0]?.trial_no_prazo ?? 0,
        trial_vencido:    composicao[0]?.trial_vencido ?? 0,
      },
    }))
  }

  return NextResponse.json({ error: 'Seção inválida' }, { status: 400 })
}
