import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { gerarPixDaAssinatura, qrDaCobranca } from '@/lib/assinatura/pix'
import { ehPlanoValido } from '@/lib/assinatura/planos'
import { cpfValido, limparCpf } from '@/lib/assinatura/cpf'
import { identificarAssinante } from '@/lib/assinatura/identidadeSemLogin'

export const dynamic = 'force-dynamic'

/**
 * POST — gera o Pix da assinatura e devolve o QR para a NOSSA tela.
 *
 * ⚠️ QUESTÃO DE PRODUTO EM ABERTO — o que é o "portão" no Pix?
 * No cartão, o portão é registrar o meio de pagamento: ela cadastra e a cobrança
 * sai sozinha no dia 14. No Pix não existe "registrar" — só existe pagar. Como o
 * desenho aprovado manda a primeira cobrança vencer no dia 14, a geração do QR
 * acaba sendo o único gesto disponível como portão, e o acesso começa aqui.
 *
 * Consequência assumida: no Pix o portão é FRACO — basta clicar para ganhar 14
 * dias. É a mesma porta do abuso de trial repetido já registrada como pendência.
 * As alternativas (cobrar o 1º mês na hora, ou só liberar quando o Pix for pago)
 * mudam a promessa do trial e são decisão do Diretor.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const who = await identificarAssinante({ email: b.e, token: b.t })
  if (!who) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = who.workspaceId

  if (!ehPlanoValido(b.plano)) return NextResponse.json({ error: 'Escolha um plano válido.' }, { status: 400 })

  const cpf = limparCpf(b.cpf)
  if (!cpfValido(cpf)) {
    return NextResponse.json({ error: 'Confira o CPF — os números não conferem.' }, { status: 400 })
  }

  const [ws] = await prisma.$queryRaw`
    SELECT "nome", "assinaturaStatus" FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1
  ` as { nome: string; assinaturaStatus: string }[]
  if (!ws) return NextResponse.json({ error: 'Workspace não encontrada' }, { status: 404 })

  // Já existe cobrança Pix em aberto? Devolve o MESMO QR em vez de cobrar de novo.
  // Isto vem ANTES da guarda de status: gerar o QR já concede o TRIAL (portão do
  // Pix), então recarregar a tela durante o trial precisa remontar o MESMO QR —
  // barrar aqui por "já está ativa" esconderia dela a cobrança que ela tem de pagar.
  const [aberta] = await prisma.$queryRaw`
    SELECT "paymentId" FROM "AsaasCobranca"
    WHERE "workspaceId" = ${workspaceId} AND "billingType" = 'PIX'
      AND "status" NOT IN ('RECEIVED','CONFIRMED','REFUNDED','DELETED')
    ORDER BY "createdAt" DESC LIMIT 1
  ` as { paymentId: string }[]
  if (aberta) {
    const qr = await qrDaCobranca(aberta.paymentId)
    if (qr.ok) return NextResponse.json(serialize({ ...qr, reaproveitada: true }))
  }

  // Sem cobrança aberta e já ativa/paga: não gera uma nova (evita segundo Pix).
  if (['TRIAL', 'ATIVA'].includes(ws.assinaturaStatus)) {
    return NextResponse.json({ error: 'Sua assinatura já está ativa.' }, { status: 409 })
  }

  const r = await gerarPixDaAssinatura({
    workspaceId, plano: b.plano, cpf,
    nome: ws.nome, email: who.email,
  })

  return r.ok
    ? NextResponse.json(serialize(r))
    : NextResponse.json({ error: r.erro }, { status: 502 })
}
