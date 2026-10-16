// Pix Automático (recorrência via Pix, sem cartão) para a assinatura MENSAL do SOA — pelo LINK de pagamento do Asaas
// (lib/pagamento/asaas/linkPixAuto.ts; a API de autorizações dá 403 na nossa conta). Valor definido no SERVIDOR.
// Devolve { link }: a cliente paga o 1º Pix e autoriza no app do banco; o webhook ativa a conta.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLANOS } from '@/lib/assinatura/planos'
import { ensurePixAutoTable } from '@/lib/pagamento/asaas/pixAutomatico'
import { criarLinkPixAuto, pixAutoLigado } from '@/lib/pagamento/asaas/linkPixAuto'
import { getCredenciais } from '@/lib/pagamento/asaas/config'
import { URL_SOA } from '@/lib/baseUrl'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const workspaceId = session.user.workspaceId
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Só a administradora da conta pode assinar.' }, { status: 403 })
  if (!pixAutoLigado()) return NextResponse.json({ error: 'O Pix Automático está indisponível no momento. Use o cartão ou o Pix mês a mês.' }, { status: 400 })

  // Teste grátis = SÓ CARTÃO. Pix Automático fica para quem já passou do teste.
  const [ws] = await prisma.$queryRaw`
    SELECT "assinaturaStatus" FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1
  ` as { assinaturaStatus: string }[]
  if (ws?.assinaturaStatus === 'AGUARDANDO_PAGAMENTO') {
    return NextResponse.json({ error: 'Para começar o teste grátis, cadastre um cartão de crédito.' }, { status: 400 })
  }
  if (ws?.assinaturaStatus === 'ATIVA' || ws?.assinaturaStatus === 'TRIAL') {
    return NextResponse.json({ error: 'Sua assinatura já está ativa — não é preciso assinar de novo.' }, { status: 400 })
  }

  // Pix Automático = recorrência MENSAL. Valor do servidor (não confiar no cliente).
  const valor = PLANOS.mensal.valor
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
  console.log(`[PIX AUTO] link SOA ws=${workspaceId} link=${r.id}`)
  return NextResponse.json({ ok: true, link: r.url, valor })
}
