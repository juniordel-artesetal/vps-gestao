// Detecção de divergência entre o que ela ESCOLHEU aqui e o que PAGOU lá.
//
// A borda que isto cobre: o checkout de 12x manda item de R$ 287,88, e o Asaas
// só divide — ele não impede a artesã de escolher 1x na página dele. Se ela
// fizer isso, paga R$ 287,88 à vista, R$ 47,48 acima do preço à vista real.
//
// É raro. Mas raro e silencioso é como cliente vira ex-cliente: ela descobre no
// extrato, não em nós. Marcamos o caso para o Master ver e o Júnior decidir o
// gesto — estorno da diferença, crédito, ou um contato.
import { prisma } from '@/lib/prisma'
import { PLANOS, PARCELADO_12X } from './planos'

export interface Divergencia {
  houve: boolean
  descricao?: string
}

/**
 * Confere um pagamento contra a forma escolhida. Nunca lança: detecção de borda
 * não pode derrubar o processamento do pagamento em si.
 *
 * `parcelas` vem do payload do Asaas — cobrança avulsa não traz `installment`,
 * então ausência significa 1x.
 */
export async function conferirDivergencia(p: {
  workspaceId: string
  paymentId: string
  valor: number | null
  temParcelamento: boolean
}): Promise<Divergencia> {
  try {
    const [ws] = await prisma.$queryRaw`
      SELECT "formaEscolhida", "planoEscolhido" FROM "Workspace" WHERE "id" = ${p.workspaceId} LIMIT 1
    ` as { formaEscolhida: string | null; planoEscolhido: string | null }[]

    // Só há borda quando ela escolheu PARCELAR o anual e o pagamento veio inteiro.
    const escolheuParcelar = ws?.formaEscolhida === 'parcelado' && ws?.planoEscolhido === 'anual'
    if (!escolheuParcelar || p.temParcelamento) return { houve: false }

    const diferenca = Math.round((PARCELADO_12X.total - PLANOS.anual.valor) * 100) / 100
    const descricao =
      `Escolheu 12x (item R$ ${PARCELADO_12X.total.toFixed(2)}) mas pagou em 1x. ` +
      `Cobrado R$ ${(p.valor ?? PARCELADO_12X.total).toFixed(2)} contra R$ ${PLANOS.anual.valor.toFixed(2)} ` +
      `do anual à vista — diferença de R$ ${diferenca.toFixed(2)} a favor do SOA.`

    await prisma.$executeRaw`
      UPDATE "AsaasCobranca" SET "anomalia" = ${descricao}, "updatedAt" = NOW()
      WHERE "paymentId" = ${p.paymentId}
    `
    console.warn(`[ANOMALIA] ws=${p.workspaceId} pagamento=${p.paymentId}: ${descricao}`)
    return { houve: true, descricao }
  } catch (e) {
    console.error('[ANOMALIA] não conferida:', (e as Error)?.message)
    return { houve: false }
  }
}
