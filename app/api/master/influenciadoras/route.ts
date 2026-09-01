// Master — Gestão de Influenciadoras (READ-ONLY). Ranking (indicações/conversões/uso)
// + comissão (reusa o accrual ParceiroComissao, idêntico ao dashboard da parceira) +
// USO REAL do workspace DELA (contrapartida: login/pedidos/produtos). Nenhuma ação de
// dinheiro/cortesia aqui — essas vivem em /api/master/influenciadora/[workspaceId]/*.
//
// Auth: cookie master_token (padrão das rotas Master). Gate: INFLUENCIADORAS_DASH_ATIVO.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { influenciadorasDashAtivo, garantirColunasInfluenciadora } from '@/lib/influenciadora'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// Base BRUTA do plano mensal (mesma de lib/parceiras/split → plano.valor mensal).
const BASE_MENSAL = 29.90

export async function GET() {
  if (!influenciadorasDashAtivo()) return NextResponse.json({ error: 'Indisponível' }, { status: 404 })
  if (!(await verificarMaster())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await garantirColunasInfluenciadora() // selo/cortesia (aditivas, idempotente)

  // Uma linha por influenciadora (Parceiro.tipo='influencer' + selo='influenciadora').
  // Comissão: recebido (split pago) + pendente (repasse manual = base×%/100) — IDÊNTICO
  // ao dashboard da parceira (app/api/parceira/dashboard). Uso: subqueries no workspace DELA.
  const rows = await prisma.$queryRaw`
    SELECT p."id", p."nome", p."instagram", p."cupom", p."linkSlug",
           p."comissaoPercMensal"::float AS "percMensal", p."comissaoPercAnual"::float AS "percAnual",
           p."createdAt",
           w."id" AS "workspaceId", w."selo",
           w."cortesiaAtivadaEm", w."cortesiaEncerradaEm", w."liberacaoManual",
           -- INDICAÇÕES / CONVERSÕES (indicados dela via Lead.parceiroId)
           (SELECT COUNT(*)::int FROM "Lead" l WHERE l."parceiroId" = p."id") AS "indicacoes",
           (SELECT COUNT(*)::int FROM "Lead" l JOIN "Workspace" iw ON iw."id" = l."workspaceId"
              WHERE l."parceiroId" = p."id" AND iw."assinaturaStatus" = 'TRIAL') AS "emTrial",
           (SELECT COUNT(*)::int FROM "Lead" l JOIN "Workspace" iw ON iw."id" = l."workspaceId"
              WHERE l."parceiroId" = p."id" AND iw."assinaturaStatus" = 'ATIVA') AS "conversoes",
           (SELECT COUNT(*)::int FROM "Lead" l JOIN "Workspace" iw ON iw."id" = l."workspaceId"
              WHERE l."parceiroId" = p."id" AND iw."assinaturaStatus" IN ('CANCELADA','CORTADA')) AS "cancelaram",
           -- COMISSÃO (accrual ParceiroComissao) — mesma fórmula das parceiras
           (SELECT COALESCE(SUM("valor") FILTER (WHERE "status" = 'pago_via_split'),0)::float
              FROM "ParceiroComissao" WHERE "parceiroId" = p."id") AS "comissaoRecebida",
           (SELECT COALESCE(SUM("base" * "percentual" / 100) FILTER (WHERE "status" = 'pendente'),0)::float
              FROM "ParceiroComissao" WHERE "parceiroId" = p."id") AS "comissaoPendente",
           -- USO REAL do workspace DELA (contrapartida): login / pedidos / produtos
           (SELECT MAX(lh."createdAt") FROM "LoginHistory" lh
              WHERE lh."workspaceId" = w."id" AND lh."sucesso" = true) AS "ultimoLogin",
           (SELECT COUNT(DISTINCT lh."createdAt"::date)::int FROM "LoginHistory" lh
              WHERE lh."workspaceId" = w."id" AND lh."sucesso" = true
                AND lh."createdAt" >= NOW() - INTERVAL '30 days') AS "diasAtivos30d",
           (SELECT COUNT(*)::int FROM "Order" o
              WHERE o."workspaceId" = w."id" AND o."createdAt" >= NOW() - INTERVAL '30 days') AS "pedidos30d",
           (SELECT COUNT(*)::int FROM "Order" o WHERE o."workspaceId" = w."id") AS "pedidosTotal",
           (SELECT COUNT(*)::int FROM "PrecProduto" pr WHERE pr."workspaceId" = w."id") AS "produtos"
    FROM "Parceiro" p
    JOIN LATERAL (
      SELECT w2."id", w2."selo", w2."cortesiaAtivadaEm", w2."cortesiaEncerradaEm", w2."liberacaoManual"
      FROM "User" u JOIN "Workspace" w2 ON w2."id" = u."workspaceId"
      WHERE u."id" = p."userId" LIMIT 1
    ) w ON true
    WHERE p."tipo" = 'influencer' AND w."selo" = 'influenciadora'
    ORDER BY "conversoes" DESC, "indicacoes" DESC, p."createdAt" DESC
  ` as any[]

  const HOJE = Date.now()
  const dias = (d: any) => d ? Math.floor((HOJE - new Date(d).getTime()) / 86400000) : null

  const influenciadoras = rows.map(r => {
    const indicacoes = Number(r.indicacoes) || 0
    const conversoes = Number(r.conversoes) || 0
    const acumulado = (Number(r.comissaoRecebida) || 0) + (Number(r.comissaoPendente) || 0)
    // Recorrente ESTIMADO/mês (base mensal 29,90 × % dela × assinantes ativas). Rótulo "estimativa".
    const recorrenteEstMes = Math.round(conversoes * (Number(r.percMensal) || 0) / 100 * BASE_MENSAL * 100) / 100
    // Cortesia: encerrada > ativa > aguardando
    const cortesia = r.cortesiaEncerradaEm ? 'encerrada'
      : (r.cortesiaAtivadaEm && r.liberacaoManual) ? 'ativa' : 'aguardando'
    // USO REAL (contrapartida): Operando / Uso baixo / Inativa
    const diasSemLogin = dias(r.ultimoLogin)
    const pedidos30d = Number(r.pedidos30d) || 0
    const diasAtivos30d = Number(r.diasAtivos30d) || 0
    const logouRecente = diasSemLogin != null && diasSemLogin <= 14
    let uso: 'operando' | 'baixo' | 'inativa'
    if (logouRecente && pedidos30d >= 1) uso = 'operando'
    else if ((diasSemLogin != null && diasSemLogin <= 30) || (Number(r.produtos) || 0) > 0) uso = 'baixo'
    else uso = 'inativa'

    return {
      parceiroId: r.id, nome: r.nome, instagram: r.instagram, cupom: r.cupom, linkSlug: r.linkSlug,
      workspaceId: r.workspaceId, cortesia,
      indicacoes, emTrial: Number(r.emTrial) || 0, conversoes, cancelaram: Number(r.cancelaram) || 0,
      taxaConversao: indicacoes > 0 ? Math.round((conversoes / indicacoes) * 1000) / 10 : 0, // %
      comissaoRecebida: Number(r.comissaoRecebida) || 0,
      comissaoPendente: Number(r.comissaoPendente) || 0,
      comissaoAcumulada: Math.round(acumulado * 100) / 100,
      recorrenteEstMes,
      percMensal: Number(r.percMensal) || 0, percAnual: Number(r.percAnual) || 0,
      // uso real (contrapartida) — do workspace DELA
      ultimoLogin: r.ultimoLogin, diasSemLogin, diasAtivos30d, pedidos30d,
      pedidosTotal: Number(r.pedidosTotal) || 0, produtos: Number(r.produtos) || 0, uso,
    }
  })

  const resumo = {
    total: influenciadoras.length,
    cortesiaAtiva: influenciadoras.filter(i => i.cortesia === 'ativa').length,
    operando: influenciadoras.filter(i => i.uso === 'operando').length,
    inativas: influenciadoras.filter(i => i.uso === 'inativa').length,
    indicacoes: influenciadoras.reduce((a, i) => a + i.indicacoes, 0),
    conversoes: influenciadoras.reduce((a, i) => a + i.conversoes, 0),
    comissaoAcumulada: Math.round(influenciadoras.reduce((a, i) => a + i.comissaoAcumulada, 0) * 100) / 100,
  }

  return NextResponse.json(serialize({ influenciadoras, resumo }))
}
