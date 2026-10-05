// Fonte ÚNICA do que vira SKU no TikTok (usada pela rota de publicar e pela publicação automática):
// variações do produto marcadas no canal TikTok, cada uma com o preço da precificação do canal e o
// ESTOQUE — saldo do Estoque de Produtos quando a variação tem controle; senão o "estoque do anúncio"
// informado nos Dados do Marketplace (sob encomenda). Sem isso o anúncio subia com estoque 0.
import { prisma } from '@/lib/prisma'
import { normalizarCanal } from '@/lib/canaisVendaCalc'
import { fotosMarketplace, type CamposMarketplace } from '@/lib/marketplace/produtoCampos'
import { baseSku, type VarTT } from '@/lib/tiktok/regrasProduto'

export async function dadosParaPublicarTikTok(workspaceId: string, produtoId: string, campos: CamposMarketplace): Promise<
  { ok: true; nome: string; skuBase: string; variacoes: VarTT[]; fotos: string[] } | { ok: false; erro: string; faltando?: string[] }
> {
  const [prod] = await prisma.$queryRaw`
    SELECT "nome", "sku" FROM "PrecProduto" WHERE "id" = ${produtoId} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as { nome: string; sku: string | null }[]
  if (!prod) return { ok: false, erro: 'Produto não encontrado' }

  const vars = await prisma.$queryRaw`
    SELECT v."id", v."canal", v."nome", v."subOpcao", v."tipo", v."precoVenda"::float AS preco,
           (SELECT s."saldoAtual"::int FROM "EstProdutoSaldo" s WHERE s."variacaoId" = v."id" AND s."workspaceId" = ${workspaceId} LIMIT 1) AS saldo
    FROM "PrecVariacao" v WHERE v."produtoId" = ${produtoId}
    ORDER BY v."id"
  ` as { id: string; canal: string | null; nome: string | null; subOpcao: string | null; tipo: string; preco: number; saldo: number | null }[]
  const doTikTok = vars.filter(v => normalizarCanal(v.canal || '') === 'tiktokshop')
  if (doTikTok.length === 0) return { ok: false, erro: 'Marque o canal TikTok em pelo menos uma variação (o preço vem da precificação).' }

  const estoqueAnuncio = Number(campos.estoqueAnuncio)
  const variacoes: VarTT[] = doTikTok.map(v => ({
    variacaoId: v.id,
    nome: v.subOpcao || v.nome || v.tipo || null,
    preco: v.preco || 0,
    estoque: v.saldo != null ? Math.max(0, v.saldo) : (Number.isFinite(estoqueAnuncio) ? estoqueAnuncio : 0),
  }))
  const semPreco = variacoes.filter(v => !(v.preco > 0))
  if (semPreco.length) return { ok: false, erro: `Variação sem preço de venda no TikTok: ${semPreco.map(v => v.nome || 'sem nome').join(', ')}.`, faltando: ['preço da variação'] }

  const fotos = await fotosMarketplace(workspaceId, produtoId, doTikTok.map(v => v.id))
  if (fotos.length === 0) return { ok: false, erro: 'Adicione fotos à variação para publicar no marketplace.', faltando: ['fotos da variação'] }
  return { ok: true, nome: prod.nome, skuBase: baseSku(prod.sku, produtoId), variacoes, fotos }
}
