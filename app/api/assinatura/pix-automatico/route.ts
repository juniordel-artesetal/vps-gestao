// Pix Automático (recorrência via Pix, sem cartão) para a assinatura MENSAL do SOA — pelo LINK de pagamento do Asaas
// (lib/pagamento/asaas/linkPixAuto.ts; a API de autorizações dá 403 na nossa conta). Valor definido no SERVIDOR.
// Devolve { link }: a cliente paga o 1º Pix e autoriza no app do banco; o webhook ativa a conta e encerra a assinatura
// antiga (sem cobrança dupla).
// TROCA do Pix avulso → Pix Automático (16/10/2026, convite da véspera do vencimento): a assinante ATIVA no Pix avulso
// pode trocar enquanto a mensalidade do mês está EM ABERTO (o 1º Pix Automático paga esse mês; o avulso some). O VALOR
// é o da assinatura atual (grandfather: quem paga R$ 29,90 continua R$ 29,90). No cartão, ou com o mês já pago, não.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLANOS } from '@/lib/assinatura/planos'
import { ensurePixAutoTable } from '@/lib/pagamento/asaas/pixAutomatico'
import { criarLinkPixAuto, pixAutoLigado } from '@/lib/pagamento/asaas/linkPixAuto'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { getCredenciais } from '@/lib/pagamento/asaas/config'
import { URL_SOA } from '@/lib/baseUrl'
import { PIX_AUTOMATICO_LIBERADO } from '@/lib/pagamento/pixAutomaticoLiberado'

export const dynamic = 'force-dynamic'

/** Assinatura mensal viva da conta no Asaas (tipo de pagamento, valor e se o mês está em aberto). */
async function mensalViva(workspaceId: string): Promise<{ billingType: string; valor: number; emAberto: boolean } | null> {
  const [a] = await prisma.$queryRaw<{ subscriptionId: string }[]>`
    SELECT "subscriptionId" FROM "AsaasAssinatura"
    WHERE "workspaceId" = ${workspaceId} AND "canceladaEm" IS NULL AND "status" IN ('ACTIVE','OVERDUE')
    ORDER BY "createdAt" DESC LIMIT 1`
  if (!a) return null
  const s = await chamarAsaas<{ billingType?: string; value?: number; cycle?: string; status?: string }>(`/subscriptions/${a.subscriptionId}`)
  if (!s.ok || !s.dados || s.dados.cycle !== 'MONTHLY' || s.dados.status !== 'ACTIVE') return null
  const p = await chamarAsaas<{ data?: { status?: string }[] }>(`/subscriptions/${a.subscriptionId}/payments?limit=20`)
  const emAberto = (p.dados?.data ?? []).some(x => x.status === 'PENDING' || x.status === 'OVERDUE')
  return { billingType: s.dados.billingType ?? 'UNDEFINED', valor: Number(s.dados.value) || 0, emAberto }
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const workspaceId = session.user.workspaceId
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Só a administradora da conta pode assinar.' }, { status: 403 })
  if (!PIX_AUTOMATICO_LIBERADO || !pixAutoLigado()) return NextResponse.json({ error: 'O Pix Automático chega em breve. Por enquanto, use o Pix mês a mês ou o cartão.' }, { status: 400 })

  // Teste grátis = SÓ CARTÃO. Pix Automático fica para quem já passou do teste.
  const [ws] = await prisma.$queryRaw`
    SELECT "assinaturaStatus" FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1
  ` as { assinaturaStatus: string }[]
  if (ws?.assinaturaStatus === 'AGUARDANDO_PAGAMENTO') {
    return NextResponse.json({ error: 'Para começar o teste grátis, cadastre um cartão de crédito.' }, { status: 400 })
  }
  if (ws?.assinaturaStatus === 'TRIAL') {
    return NextResponse.json({ error: 'Você está no teste grátis com cartão — a assinatura já segue sozinha.' }, { status: 400 })
  }

  const viva = await mensalViva(workspaceId)
  if (ws?.assinaturaStatus === 'ATIVA') {
    if (!viva) return NextResponse.json({ error: 'Sua assinatura já está ativa — não é preciso assinar de novo.' }, { status: 400 })
    if (viva.billingType === 'CREDIT_CARD') return NextResponse.json({ error: 'Sua assinatura já é cobrada sozinha no cartão — não é preciso o Pix Automático.' }, { status: 400 })
    if (!viva.emAberto) return NextResponse.json({ error: 'A mensalidade deste mês já está paga. O convite para o Pix Automático chega por e-mail um dia antes do próximo vencimento.' }, { status: 400 })
  }

  // Pix Automático = recorrência MENSAL. Valor do servidor: o da assinatura atual (grandfather) ou o do plano.
  const valor = viva && viva.valor > 0 && viva.valor <= 100 ? viva.valor : PLANOS.mensal.valor
  const r = await criarLinkPixAuto({
    nome: 'SOA mensal · Pix Automático',
    descricao: `SOA mensal: ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês no Pix Automático — autorize uma vez no app do seu banco; cancele quando quiser.`,
    valor, externalReference: workspaceId, sucesso: `${URL_SOA}/assinatura?pago=1`,
  })
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 502 })

  // o vínculo link → conta (o webhook acha a conta pelo externalReference OU pelo id do link)
  await ensurePixAutoTable()
  const { sandbox } = await getCredenciais()
  await prisma.$executeRaw`
    INSERT INTO "AsaasPixAutoAutorizacao" ("id","workspaceId","asaasAuthorizationId","status","frequencia","valor","sandbox","criadoEm","atualizadoEm")
    VALUES (${Math.random().toString(36).slice(2) + Date.now().toString(36)}, ${workspaceId}, ${'plink:' + r.id}, 'CREATED', 'MONTHLY', ${valor}, ${sandbox}, NOW(), NOW())
    ON CONFLICT ("asaasAuthorizationId") DO NOTHING`
  console.log(`[PIX AUTO] link SOA ws=${workspaceId} link=${r.id} valor=${valor}${viva ? ' (troca do Pix avulso)' : ''}`)
  return NextResponse.json({ ok: true, link: r.url, valor })
}
