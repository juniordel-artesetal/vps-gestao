import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { cancelarAssinatura } from '@/lib/assinatura/cancelar'
import { estornarUltimoPagamento } from '@/lib/assinatura/estornar'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — assinaturas Asaas + comissões. ?status=TRIAL|ATIVA|INADIMPLENTE|CORTADA|CANCELADA
//
// Fonte ADICIONAL: a visão Hotmart (/master/hotmart) não é tocada. Aqui só entra
// quem tem assinaturaOrigem='asaas'.
export async function GET(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Lista branca: o valor entra na query por interpolação (o filtro é dinâmico),
  // então nada além destes cinco chega perto do SQL.
  const STATUS_VALIDOS = ['TRIAL', 'ATIVA', 'INADIMPLENTE', 'CORTADA', 'CANCELADA']
  const pedido = new URL(req.url).searchParams.get('status')
  const status = pedido && STATUS_VALIDOS.includes(pedido) ? pedido : null

  const assinaturas = await prisma.$queryRawUnsafe(`
    SELECT w."id" AS "workspaceId", w."nome" AS "workspace", w."assinaturaStatus" AS "status",
           w."ativo", w."liberacaoManual", w."liberacaoMotivo",
           TO_CHAR(w."trialAte", 'DD/MM/YYYY')          AS "trialAte",
           TO_CHAR(w."assinaturaExpira", 'DD/MM/YYYY')  AS "expiraEm",
           a."subscriptionId", a."ciclo", a."valor"::float AS "valor",
           TO_CHAR(a."proximoVencimento", 'DD/MM/YYYY') AS "proximoVencimento",
           TO_CHAR(a."canceladaEm", 'DD/MM/YYYY HH24:MI') AS "canceladaEm",
           a."canceladaPor", a."canceladaMotivo",
           a."splitWalletId", a."splitValor"::float AS "splitValor",
           a."splitPercentual"::float AS "splitPercentual", a."splitErro",
           p."id" AS "parceiroId", p."nome" AS "parceiro", p."walletId" AS "parceiroWallet",
           u."email" AS "emailAdmin"
    FROM "Workspace" w
    LEFT JOIN LATERAL (
      SELECT * FROM "AsaasAssinatura" WHERE "workspaceId" = w."id"
      ORDER BY "createdAt" DESC LIMIT 1
    ) a ON true
    LEFT JOIN "Parceiro" p ON p."id" = a."parceiroId"
    LEFT JOIN LATERAL (
      SELECT "email" FROM "User" WHERE "workspaceId" = w."id" AND "role" = 'ADMIN' AND "ativo" = true
      ORDER BY "createdAt" ASC LIMIT 1
    ) u ON true
    WHERE w."assinaturaOrigem" = 'asaas'
      ${status ? `AND w."assinaturaStatus" = '${status}'` : ''}
    ORDER BY w."createdAt" DESC
    LIMIT 300
  `)

  // Comissões: o que o split pagou × o que ficou para acertar na mão.
  const comissoes = await prisma.$queryRawUnsafe(`
    SELECT c."status", COUNT(*)::int AS "quantidade", COALESCE(SUM(c."valor"),0)::float AS "total"
    FROM "ParceiroComissao" c GROUP BY 1 ORDER BY 1
  `)

  // ⚠️ O que a revisão exigiu ficar VISÍVEL: split recusado vira comissão manual,
  // e comissão manual invisível é comissão esquecida.
  const falhasSplit = await prisma.$queryRawUnsafe(`
    SELECT w."nome" AS "workspace", a."workspaceId", a."subscriptionId", a."splitErro",
           p."nome" AS "parceiro", p."walletId" AS "parceiroWallet",
           a."valor"::float AS "valorPlano", a."ciclo",
           TO_CHAR(a."createdAt", 'DD/MM/YYYY') AS "desde"
    FROM "AsaasAssinatura" a
    JOIN "Workspace" w ON w."id" = a."workspaceId"
    LEFT JOIN "Parceiro" p ON p."id" = a."parceiroId"
    WHERE a."splitErro" IS NOT NULL
       OR (a."parceiroId" IS NOT NULL AND a."splitWalletId" IS NULL)
    ORDER BY a."createdAt" DESC LIMIT 100
  `)

  // LEADS — contas que pararam no portão de pagamento. É a lista de follow-up
  // manual do time (WhatsApp, ligação): lead invisível é lead perdido.
  // Traz o ÚLTIMO TOQUE enviado, para ninguém ligar antes de o e-mail sair nem
  // depois de a régua já ter esgotado os quatro.
  const leads = await prisma.$queryRawUnsafe(`
    SELECT w."id" AS "workspaceId", w."nome" AS "workspace", w."segmento",
           w."planoEscolhido", w."metodoEscolhido", w."formaEscolhida",
           w."checkoutLink",
           TO_CHAR(w."createdAt", 'DD/MM/YYYY HH24:MI')        AS "cadastradaEm",
           TO_CHAR(w."checkoutCriadoEm", 'DD/MM/YYYY HH24:MI') AS "checkoutEm",
           EXTRACT(EPOCH FROM (NOW() - w."checkoutCriadoEm"))/3600 AS "horasParada",
           u."nome" AS "pessoa", u."email",
           t."tipo" AS "ultimoToque",
           TO_CHAR(t."enviadoEm", 'DD/MM/YYYY HH24:MI') AS "ultimoToqueEm"
    FROM "Workspace" w
    LEFT JOIN LATERAL (
      SELECT "nome", "email" FROM "User"
      WHERE "workspaceId" = w."id" AND "role" = 'ADMIN' AND "ativo" = true
      ORDER BY "createdAt" ASC LIMIT 1
    ) u ON true
    LEFT JOIN LATERAL (
      SELECT "tipo", "enviadoEm" FROM "AssinaturaAviso"
      WHERE "workspaceId" = w."id" AND "tipo" LIKE 'CHECKOUT_ABANDONADO%'
      ORDER BY "createdAt" DESC LIMIT 1
    ) t ON true
    WHERE w."assinaturaStatus" = 'AGUARDANDO_PAGAMENTO'
      AND w."assinaturaOrigem" = 'asaas'
    ORDER BY w."createdAt" DESC
    LIMIT 200
  `)

  // Divergências de cobrança (hoje: a borda do 12x pago em 1x). Mesmo princípio
  // das falhas de split — cobrança fora do combinado não pode ficar invisível.
  const anomalias = await prisma.$queryRawUnsafe(`
    SELECT c."paymentId", c."anomalia", c."valor"::float AS "valor",
           w."nome" AS "workspace", w."id" AS "workspaceId",
           TO_CHAR(c."pagoEm", 'DD/MM/YYYY') AS "pagoEm"
    FROM "AsaasCobranca" c
    JOIN "Workspace" w ON w."id" = c."workspaceId"
    WHERE c."anomalia" IS NOT NULL
    ORDER BY c."pagoEm" DESC NULLS LAST LIMIT 50
  `)

  const [totais] = await prisma.$queryRawUnsafe<Record<string, number>[]>(`
    SELECT COUNT(*)::int AS "total",
           COUNT(*) FILTER (WHERE "assinaturaStatus" = 'TRIAL')::int        AS "trial",
           COUNT(*) FILTER (WHERE "assinaturaStatus" = 'ATIVA')::int        AS "ativa",
           COUNT(*) FILTER (WHERE "assinaturaStatus" = 'INADIMPLENTE')::int AS "inadimplente",
           COUNT(*) FILTER (WHERE "assinaturaStatus" = 'CORTADA')::int      AS "cortada",
           COUNT(*) FILTER (WHERE "assinaturaStatus" = 'CANCELADA')::int    AS "cancelada",
           COUNT(*) FILTER (WHERE "assinaturaStatus" = 'AGUARDANDO_PAGAMENTO')::int AS "leads",
           COUNT(*) FILTER (WHERE "liberacaoManual" = true)::int            AS "liberadas"
    FROM "Workspace" WHERE "assinaturaOrigem" = 'asaas'
  `)

  return NextResponse.json(serialize({ assinaturas, leads, comissoes, falhasSplit, anomalias, totais }))
}

// POST — ações do Master. body: { acao: 'cancelar'|'estornar'|'liberar'|'revogarLiberacao', workspaceId, motivo? }
export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const workspaceId = String(b.workspaceId || '')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId obrigatório' }, { status: 400 })

  if (b.acao === 'cancelar') {
    const r = await cancelarAssinatura({ workspaceId, por: 'master', motivo: b.motivo ?? 'Cancelado pelo Master' })
    return r.ok
      ? NextResponse.json(serialize({ ok: true, acessoAte: r.acessoAte }))
      : NextResponse.json({ error: r.erro }, { status: 502 })
  }

  // Estorno (devolução ao cartão) do ÚLTIMO pagamento pago — só Asaas. NÃO cancela a
  // assinatura (para encerrar cobranças futuras, use a ação 'cancelar' também).
  if (b.acao === 'estornar') {
    const r = await estornarUltimoPagamento({ workspaceId, por: 'master', motivo: b.motivo ?? 'Estorno pelo Master' })
    return r.ok
      ? NextResponse.json(serialize({ ok: true, paymentId: r.paymentId, valor: r.valor, status: r.status }))
      : NextResponse.json({ error: r.erro }, { status: 502 })
  }

  // Trava anti-corte: mesma semântica da Hotmart. Vence qualquer régua.
  if (b.acao === 'liberar') {
    await prisma.$executeRaw`
      UPDATE "Workspace"
      SET "liberacaoManual" = true, "liberacaoMotivo" = ${String(b.motivo || 'Liberação do Master').slice(0, 300)},
          "liberacaoEm" = NOW(), "ativo" = true, "updatedAt" = NOW()
      WHERE "id" = ${workspaceId}
    `
    return NextResponse.json({ ok: true })
  }

  if (b.acao === 'revogarLiberacao') {
    await prisma.$executeRaw`
      UPDATE "Workspace"
      SET "liberacaoManual" = false, "liberacaoMotivo" = NULL, "liberacaoEm" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${workspaceId}
    `
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 })
}
