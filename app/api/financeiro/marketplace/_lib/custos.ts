// Resolução de custo por item de marketplace: casa a chave externa (SKU; fallback
// nome normalizado) → variacaoId (MarketplaceProdutoVinculo) → custoTotal da PrecVariacao.
import { prisma } from '@/lib/prisma'
import { normNome } from '@/lib/normNome'

export interface Resolucao {
  custoDeVariacao: Map<string, number>
  vinculoPorChave: Map<string, string>
  resolverVariacao: (sku: string | null, produto: string | null) => string | null
  custoDoItem: (sku: string | null, produto: string | null, qtd: number) => { variacaoId: string | null; custo: number | null }
}

export async function carregarResolucao(workspaceId: string, canal: string): Promise<Resolucao> {
  const vincs = await prisma.$queryRaw`
    SELECT "chaveExterna", "variacaoId" FROM "MarketplaceProdutoVinculo"
    WHERE "workspaceId" = ${workspaceId} AND "canal" = ${canal}
  ` as any[]
  const vinculoPorChave = new Map<string, string>()
  for (const v of vincs) vinculoPorChave.set(String(v.chaveExterna), String(v.variacaoId))

  const vars = await prisma.$queryRaw`
    SELECT v."id", COALESCE(v."custoTotal", 0)::float AS "custoTotal"
    FROM "PrecVariacao" v
    INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
    WHERE p."workspaceId" = ${workspaceId}
  ` as any[]
  const custoDeVariacao = new Map<string, number>()
  for (const v of vars) custoDeVariacao.set(String(v.id), Number(v.custoTotal))

  const resolverVariacao = (sku: string | null, produto: string | null): string | null => {
    if (sku && vinculoPorChave.has(sku)) return vinculoPorChave.get(sku)!
    const nn = produto ? normNome(produto) : ''
    if (nn && vinculoPorChave.has(nn)) return vinculoPorChave.get(nn)!
    return null
  }

  const custoDoItem = (sku: string | null, produto: string | null, qtd: number) => {
    const variacaoId = resolverVariacao(sku, produto)
    if (!variacaoId || !custoDeVariacao.has(variacaoId)) return { variacaoId, custo: null }
    return { variacaoId, custo: custoDeVariacao.get(variacaoId)! * (qtd || 1) }
  }

  return { custoDeVariacao, vinculoPorChave, resolverVariacao, custoDoItem }
}

// Chave de vínculo preferida para um item (SKU se houver; senão nome normalizado)
export function chaveDeItem(sku: string | null, produto: string | null): string | null {
  if (sku && sku.trim()) return sku.trim()
  if (produto && produto.trim()) return normNome(produto)
  return null
}
