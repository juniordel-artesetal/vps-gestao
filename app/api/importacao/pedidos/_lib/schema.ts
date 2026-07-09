// Provisão idempotente das tabelas da camada fiscal/financeira do marketplace.
// Projeto sem prisma migrate — tabelas criadas via SQL (CREATE TABLE IF NOT EXISTS).
import { prisma } from '@/lib/prisma'

let provisionado = false

export async function ensurePedidoMarketplaceTables() {
  if (provisionado) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PedidoMarketplace" (
      "id" text PRIMARY KEY, "workspaceId" text NOT NULL, "orderId" text,
      "canal" text NOT NULL DEFAULT 'shopee', "idExterno" text NOT NULL,
      "statusExterno" text, "statusDevolucao" text, "rastreio" text, "opcaoEnvio" text,
      "dataCriacaoExterna" timestamptz, "dataPagamento" timestamptz, "dataPrevistaEnvioExterna" timestamptz,
      "subtotalProdutos" numeric, "freteComprador" numeric, "descontoVendedor" numeric,
      "descontoShopee" numeric, "cupomVendedor" numeric, "cupomShopee" numeric,
      "ajusteAcaoComercial" numeric, "valorTotal" numeric, "totalGlobal" numeric,
      "taxaTransacao" numeric, "comissaoBruta" numeric, "comissaoLiquida" numeric,
      "servicoBruta" numeric, "servicoLiquida" numeric, "freteReverso" numeric,
      "freteEstimado" numeric, "liquidoEstimado" numeric,
      "destinatarioNome" text, "cpfCriptografado" text, "telefoneMascarado" text,
      "endereco" text, "bairro" text, "cidade" text, "uf" text, "cep" text, "pais" text,
      "observacaoComprador" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "PedidoMarketplace_uniq" ON "PedidoMarketplace" ("workspaceId","canal","idExterno")
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PedidoMarketplaceItem" (
      "id" text PRIMARY KEY, "pedidoMarketplaceId" text NOT NULL, "workspaceId" text NOT NULL,
      "produto" text, "sku" text, "skuRef" text, "variacao" text,
      "qtd" int NOT NULL DEFAULT 1, "qtdDevolvida" int NOT NULL DEFAULT 0,
      "precoOriginal" numeric, "precoAcordado" numeric, "subtotal" numeric, "pesoSku" numeric
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PMI_pm_idx" ON "PedidoMarketplaceItem" ("pedidoMarketplaceId")
  `)
  provisionado = true
}
