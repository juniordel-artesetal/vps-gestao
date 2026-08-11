import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { estadoDaAssinatura } from '@/lib/assinatura'
import { identificarAssinante } from '@/lib/assinatura/identidadeSemLogin'

export const dynamic = 'force-dynamic'

/**
 * GET — status enxuto, para a tela consultar de tempos em tempos enquanto ela
 * paga (QR do Pix na tela, ou popup do cartão aberta).
 *
 * Separado de /api/assinatura de propósito: aquele monta planos, assinatura e
 * cobrança em aberto — peso desnecessário numa chamada que se repete a cada
 * poucos segundos. Aqui só sai o que muda.
 *
 * Consulta o NOSSO banco, nunca o Asaas: quem fala com o Asaas é o webhook. Se
 * a tela batesse no provedor a cada ciclo, um QR aberto viraria dezenas de
 * chamadas externas por minuto.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const who = await identificarAssinante({
    email: url.searchParams.get('e'),
    token: url.searchParams.get('t'),
  })
  if (!who) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = who.workspaceId
  const estado = await estadoDaAssinatura(workspaceId)

  const [cob] = await prisma.$queryRaw`
    SELECT "status" FROM "AsaasCobranca"
    WHERE "workspaceId" = ${workspaceId}
    ORDER BY "createdAt" DESC LIMIT 1
  ` as { status: string }[]

  const pago = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(cob?.status ?? '')

  return NextResponse.json({
    status: estado?.status ?? null,
    temAcesso: estado?.temAcesso ?? false,
    cobrancaStatus: cob?.status ?? null,
    // O sinal que a tela espera para trocar de estado.
    pago,
  })
}
