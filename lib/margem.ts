// ─────────────────────────────────────────────────────────────
// Motor único de custo/margem pela PRECIFICAÇÃO (estimativa, não caixa).
//
// Fonte de verdade dos custos de cada variação (PrecVariacao) e da resolução
// "produto do pedido → variacaoId". Usado pelo painel "Resultado das vendas"
// e pelo motor de custo do marketplace (financeiro/marketplace/_lib/custos),
// para nunca existirem dois cálculos divergentes.
//
// ⚠️ PrecVariacao.impostos é uma ALÍQUOTA em % (ex.: 6 = 6%), não R$.
//    custoMaterial/custoMaoObra/custoEmbalagem/custoArte/custoTotal são R$/unidade.
// ─────────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'
import { normNome } from '@/lib/normNome'

export interface CustoVariacao {
  custoMaterial: number
  custoMaoObra: number
  custoEmbalagem: number
  custoArte: number
  custoTotal: number
  impostosPct: number   // alíquota em % (0–100)
  precoVenda: number
  canal: string | null
}

// Custos de todas as variações do workspace, por variacaoId.
export async function carregarCustosVariacao(workspaceId: string): Promise<Map<string, CustoVariacao>> {
  const vars = await prisma.$queryRaw`
    SELECT v."id",
      COALESCE(v."custoMaterial",  0)::float AS "custoMaterial",
      COALESCE(v."custoMaoObra",   0)::float AS "custoMaoObra",
      COALESCE(v."custoEmbalagem", 0)::float AS "custoEmbalagem",
      COALESCE(v."custoArte",      0)::float AS "custoArte",
      COALESCE(v."custoTotal",     0)::float AS "custoTotal",
      COALESCE(v."impostos",       0)::float AS "impostosPct",
      COALESCE(v."precoVenda",     0)::float AS "precoVenda",
      v."canal"
    FROM "PrecVariacao" v
    INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
    WHERE p."workspaceId" = ${workspaceId}
  ` as any[]
  const m = new Map<string, CustoVariacao>()
  for (const v of vars) {
    m.set(String(v.id), {
      custoMaterial: Number(v.custoMaterial), custoMaoObra: Number(v.custoMaoObra),
      custoEmbalagem: Number(v.custoEmbalagem), custoArte: Number(v.custoArte),
      custoTotal: Number(v.custoTotal), impostosPct: Number(v.impostosPct),
      precoVenda: Number(v.precoVenda), canal: v.canal ?? null,
    })
  }
  return m
}

// Resolvedor "SKU/nome → variacaoId": vínculos de marketplace (qualquer canal)
// + nomes da própria precificação (PrecProduto). Fallback quando o item do
// pedido não tem variacaoId gravado (pedidos antigos / itens manuais).
export async function carregarResolvedorVariacao(workspaceId: string): Promise<(sku: string | null, nome: string | null) => string | null> {
  const vincs = await prisma.$queryRaw`
    SELECT "chaveExterna", "variacaoId" FROM "MarketplaceProdutoVinculo"
    WHERE "workspaceId" = ${workspaceId}
  ` as any[]
  const porChave = new Map<string, string>()
  for (const v of vincs) porChave.set(String(v.chaveExterna), String(v.variacaoId))

  const nomes = await prisma.$queryRaw`
    SELECT v."id", p."nome" AS "produtoNome"
    FROM "PrecVariacao" v
    INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
    WHERE p."workspaceId" = ${workspaceId}
  ` as any[]
  const porNome = new Map<string, string>()
  for (const n of nomes) {
    const key = normNome(n.produtoNome)
    if (key && !porNome.has(key)) porNome.set(key, String(n.id))
  }

  return (sku: string | null, nome: string | null): string | null => {
    if (sku && porChave.has(sku)) return porChave.get(sku)!
    const nn = nome ? normNome(nome) : ''
    if (!nn) return null
    if (porChave.has(nn)) return porChave.get(nn)!
    if (porNome.has(nn)) return porNome.get(nn)!
    return null
  }
}
