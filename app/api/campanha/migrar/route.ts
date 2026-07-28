// Migração da artesã: cria a assinatura CARTÃO no Asaas (29,90/mês) e, se o e-mail
// estiver na whitelist dos 130, aplica o CUPOM de R$20 na 1ª cobrança (1º mês 9,90).
// Server-side: cupom validado aqui (nunca no client); uso único. Cartão via página
// hospedada do Asaas (tokenização) — nada de cartão trafega/armazena no nosso lado.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { garantirCliente, criarAssinatura, sincronizarCobrancasDaAssinatura, asaasOperacional } from '@/lib/pagamento/asaas'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { getPlano } from '@/lib/assinatura/planos'
import { cpfValido, limparCpf } from '@/lib/assinatura/cpf'
import { validarCupomMigracao, marcarCupomUsado, CUPOM_VALOR } from '@/lib/campanha/cupom'

export const dynamic = 'force-dynamic'

// Preview do preço ANTES de pagar: e-mail da whitelist dos 130 → 1º mês 9,90; fora → 29,90.
export async function GET() {
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email || '').trim().toLowerCase()
  const mensal = getPlano('mensal').valor
  if (!session || !email) return NextResponse.json({ mensal, primeiroMes: mensal, temCupom: false })
  const cupom = await validarCupomMigracao(email)
  return NextResponse.json({ mensal, primeiroMes: cupom.valido ? Math.max(0, mensal - CUPOM_VALOR) : mensal, temCupom: cupom.valido })
}

function primeiroVencimento(trialAte: Date | null): string {
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1)
  const alvo = trialAte && new Date(trialAte) > amanha ? new Date(trialAte) : amanha
  return alvo.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const workspaceId = session.user.workspaceId
  const email = (session.user.email || '').trim().toLowerCase()

  const b = await req.json().catch(() => ({}))
  const cpf = limparCpf(b.cpf)
  if (!cpfValido(cpf)) return NextResponse.json({ error: 'Confira o CPF — os números não conferem.' }, { status: 400 })
  if (!await asaasOperacional()) return NextResponse.json({ error: 'Pagamento temporariamente indisponível. Tente em alguns minutos.' }, { status: 503 })

  const plano = getPlano('mensal')

  // Já tem assinatura viva? Se JÁ PAGOU, é assinatura real → não cria outra (409).
  // Se está só PENDENTE (criou mas abandonou a tela do cartão), NÃO prende a artesã:
  // devolve o link da cobrança para ela RETOMAR o pagamento onde parou.
  const [ja] = await prisma.$queryRaw`
    SELECT "subscriptionId" FROM "AsaasAssinatura"
    WHERE "workspaceId" = ${workspaceId} AND "status" <> 'CANCELADA'
    ORDER BY "createdAt" DESC LIMIT 1
  ` as { subscriptionId: string }[]
  if (ja) {
    // Asaas é a fonte da verdade: re-sincroniza antes de decidir (o webhook pode atrasar).
    const sync = await sincronizarCobrancasDaAssinatura(ja.subscriptionId, workspaceId)
    const [paga] = await prisma.$queryRaw`
      SELECT 1 AS ok FROM "AsaasCobranca"
      WHERE "subscriptionId" = ${ja.subscriptionId}
        AND "status" IN ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH')
      LIMIT 1
    ` as { ok: number }[]
    if (paga) return NextResponse.json({ error: 'Você já tem uma assinatura ativa.' }, { status: 409 })
    const linkPendente = sync.dados?.find(c => c.invoiceUrl)?.invoiceUrl ?? null
    if (linkPendente) return NextResponse.json({ ok: true, retomar: true, invoiceUrl: linkPendente, mensal: plano.valor })
    // Sem link recuperável (raro): a cobrança ainda está nascendo no Asaas.
    return NextResponse.json({ error: 'Sua cobrança está sendo gerada. Recarregue em instantes para pagar.' }, { status: 409 })
  }

  const [ws] = await prisma.$queryRaw`SELECT "nome","trialAte" FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1` as { nome: string; trialAte: Date | null }[]
  if (!ws) return NextResponse.json({ error: 'Workspace não encontrada' }, { status: 404 })

  try {
    const cli = await garantirCliente(workspaceId, { name: ws.nome, cpfCnpj: cpf, email, externalReference: workspaceId })
    if (!cli.ok || !cli.dados?.customerId) return NextResponse.json({ error: cli.erro || 'Não consegui criar seu cadastro de pagamento.' }, { status: 502 })

    const ass = await criarAssinatura({
      workspaceId, customerId: cli.dados.customerId, valor: plano.valor,
      primeiroVencimento: primeiroVencimento(ws.trialAte), ciclo: plano.ciclo, forma: 'CREDIT_CARD',
      descricao: `SOA — plano ${plano.nome}`, referencia: workspaceId,
    })
    if (!ass.ok || !ass.dados?.subscriptionId) return NextResponse.json({ error: ass.erro || 'Não consegui criar sua assinatura.' }, { status: 502 })

    await prisma.$executeRaw`UPDATE "Workspace" SET "assinaturaOrigem" = 'asaas', "updatedAt" = NOW() WHERE "id" = ${workspaceId}`

    // 1ª cobrança (nasce no Asaas) → aplica o cupom R$20 (whitelist) e pega o link.
    const sync = await sincronizarCobrancasDaAssinatura(ass.dados.subscriptionId, workspaceId)
    const cob = sync.dados?.[0] ?? null
    let primeiroMes = plano.valor
    const cupom = await validarCupomMigracao(email)
    if (cob?.paymentId && cupom.valido) {
      const desc = await chamarAsaas(`/payments/${cob.paymentId}`, { metodo: 'POST', corpo: { discount: { value: CUPOM_VALOR, dueDateLimitDays: 0, type: 'FIXED' } } })
      if (desc.ok) { await marcarCupomUsado(email); primeiroMes = Math.max(0, plano.valor - CUPOM_VALOR) }
      else console.error(`[MIGRAR] cupom não aplicado ws=${workspaceId}: ${desc.erro}`)
    }

    return NextResponse.json({ ok: true, subscriptionId: ass.dados.subscriptionId, invoiceUrl: cob?.invoiceUrl ?? null, primeiroMes, mensal: plano.valor })
  } catch (e) {
    console.error(`[MIGRAR] erro ws=${workspaceId}:`, (e as Error)?.message)
    return NextResponse.json({ error: 'Algo deu errado. Tente de novo.' }, { status: 500 })
  }
}
