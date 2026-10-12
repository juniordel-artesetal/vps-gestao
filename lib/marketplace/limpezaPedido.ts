// Espelho de MARKETPLACE de um pedido — o que acompanha o "Order" quando ele some ou troca de id.
//
// "PedidoMarketplace" (+ itens) e "Recebivel" apontam para o pedido por "orderId", mas SEM chave estrangeira: apagar o
// pedido deixava essas linhas órfãs e os "Números do marketplace" (que somam essas tabelas) continuavam contando as
// vendas apagadas (chamado da Aline, 12/10/2026 — 43 de 54 vendas eram de pedidos já apagados).
//
// Regra financeira: do caixa, só sai o espelho automático PENDENTE ([mkt-auto]); receita já PAGA nunca é apagada aqui.
import { prisma } from '@/lib/prisma'

/** Pedido apagado → apaga a venda de marketplace, os itens, o recebível e o pendente automático no caixa. */
export async function limparMarketplaceDoPedido(workspaceId: string, orderId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId} AND "tipo" = 'RECEITA' AND "referencia" = ${orderId}
      AND "descricao" LIKE '[mkt-auto]%' AND "status" = 'PENDENTE'
  `
  await prisma.$executeRaw`DELETE FROM "Recebivel" WHERE "workspaceId" = ${workspaceId} AND "orderId" = ${orderId}`
  await prisma.$executeRaw`
    DELETE FROM "PedidoMarketplaceItem"
    WHERE "workspaceId" = ${workspaceId} AND "pedidoMarketplaceId" IN (
      SELECT "id" FROM "PedidoMarketplace" WHERE "workspaceId" = ${workspaceId} AND "orderId" = ${orderId}
    )
  `
  await prisma.$executeRaw`DELETE FROM "PedidoMarketplace" WHERE "workspaceId" = ${workspaceId} AND "orderId" = ${orderId}`
}

/**
 * Reimportação com "substituir" (o pedido é apagado e recriado com id NOVO) → o espelho passa para o id novo, mantendo
 * o status e a data prevista do recebível (antes ficava preso no id antigo e um recebível novo era criado ao lado).
 */
export async function religarMarketplaceDoPedido(workspaceId: string, de: string, para: string): Promise<void> {
  if (!de || !para || de === para) return
  await prisma.$executeRaw`UPDATE "Recebivel" SET "orderId" = ${para}, "updatedAt" = NOW() WHERE "workspaceId" = ${workspaceId} AND "orderId" = ${de}`
  await prisma.$executeRaw`UPDATE "PedidoMarketplace" SET "orderId" = ${para} WHERE "workspaceId" = ${workspaceId} AND "orderId" = ${de}`
  await prisma.$executeRaw`
    UPDATE "FinLancamento" SET "referencia" = ${para}
    WHERE "workspaceId" = ${workspaceId} AND "referencia" = ${de} AND "descricao" LIKE '[mkt-auto]%'
  `
}
