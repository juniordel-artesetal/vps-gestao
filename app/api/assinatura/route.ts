import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { estadoDaAssinatura } from '@/lib/assinatura'
import { listarPlanos } from '@/lib/assinatura/planos'
import { identificarAssinante } from '@/lib/assinatura/identidadeSemLogin'

export const dynamic = 'force-dynamic'

// GET — estado da assinatura + planos. Identifica pela SESSÃO ou, quando aberta
// por um link de reativação pré-vinculado, pelo TOKEN assinado (?e=&t=).
// Alimenta tanto a tela de regularização quanto a faixa de aviso do layout.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const who = await identificarAssinante({
    email: url.searchParams.get('e'),
    token: url.searchParams.get('t'),
  })
  if (!who) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = who.workspaceId
  const estado = await estadoDaAssinatura(workspaceId)
  if (!estado) return NextResponse.json({ error: 'Workspace não encontrada' }, { status: 404 })

  // Cobrança em aberto, se houver: é o link que a artesã precisa para pagar.
  // Só o que veio da assinatura DESTA workspace — nunca cobrança de terceiro.
  const [cobranca] = await prisma.$queryRaw`
    SELECT c."paymentId", c."valor"::float AS "valor", c."status",
           TO_CHAR(c."vencimento", 'DD/MM/YYYY') AS "vencimento"
    FROM "AsaasCobranca" c
    JOIN "AsaasAssinatura" a ON a."subscriptionId" = c."subscriptionId"
    WHERE a."workspaceId" = ${workspaceId}
      AND c."status" NOT IN ('RECEIVED', 'CONFIRMED', 'REFUNDED', 'DELETED')
    ORDER BY c."vencimento" ASC NULLS LAST
    LIMIT 1
  ` as { paymentId: string; valor: number; status: string; vencimento: string | null }[]

  const [assinatura] = await prisma.$queryRaw`
    SELECT "subscriptionId", "ciclo", "valor"::float AS "valor", "status",
           TO_CHAR("proximoVencimento", 'DD/MM/YYYY') AS "proximoVencimento"
    FROM "AsaasAssinatura"
    WHERE "workspaceId" = ${workspaceId}
    ORDER BY "createdAt" DESC LIMIT 1
  ` as { subscriptionId: string; ciclo: string; valor: number; status: string; proximoVencimento: string | null }[]

  return NextResponse.json(serialize({
    estado,
    assinatura: assinatura ?? null,
    cobrancaAberta: cobranca ?? null,
    planos: listarPlanos(),
    nome: who.nomePessoa || null,
    workspaceNome: who.workspaceNome || null,
  }))
}
