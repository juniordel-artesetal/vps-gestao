// Gatilho AUTOMÁTICO de publicação no marketplace, no FLUXO NORMAL do produto: ao salvar uma
// variação com o canal TikTok (ou ao completar os "Dados do Marketplace"), o produto sobe/atualiza
// sozinho. FAIL-OPEN: nunca derruba o salvamento do produto. Idempotente (UPDATE via MarketplaceAnuncio).
import { prisma } from '@/lib/prisma'
import { marketplacesLiberado } from '@/lib/marketplace/modulo'
import { lerCampos, validarCamposObrigatorios, salvarVinculo, lerVinculo } from '@/lib/marketplace/produtoCampos'
import { publicarProduto, type VariacaoPublicar } from '@/lib/tiktok/catalogo'
import { normalizarCanal } from '@/lib/canaisVendaCalc'

const CANAL = 'tiktokshop'

/** True se o produto tem alguma variação no canal TikTok (é o que dispara a publicação). */
async function temVariacaoTikTok(produtoId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw`SELECT "canal" FROM "PrecVariacao" WHERE "produtoId" = ${produtoId}` as { canal: string | null }[]
  return rows.some(r => normalizarCanal(r.canal || '') === CANAL)
}

/**
 * Publica/atualiza o produto no TikTok SE ele estiver marcado nesse canal e o módulo ligado.
 * - Campos completos → publica (rascunho por padrão; ativo se camposMarketplace.publicarAtivo).
 * - Faltando obrigatório → marca o vínculo como 'pendente' com o que falta (a UI mostra o aviso);
 *   assim que completar os campos, o mesmo gatilho publica.
 * Nunca lança (o salvamento do produto/variação segue de qualquer jeito).
 */
export async function publicarSeMarcadoTikTok(workspaceId: string, produtoId: string): Promise<void> {
  try {
    if (!produtoId) return
    if (!(await marketplacesLiberado(workspaceId))) return
    if (!(await temVariacaoTikTok(produtoId))) return // canal não marcado → não faz nada (não despublica)

    const campos = await lerCampos(workspaceId, produtoId)
    const vinc = await lerVinculo(workspaceId, produtoId, CANAL)
    const pendente = (motivo: string) => salvarVinculo(workspaceId, produtoId, CANAL, {
      status: vinc?.produtoExternoId ? vinc.status : 'pendente', ultimoErro: motivo,
    })

    const val = validarCamposObrigatorios(campos)
    if (!val.ok) { await pendente('Complete os Dados do Marketplace para publicar (faltam: ' + val.faltando.join(', ') + ').'); return }

    const [prod] = await prisma.$queryRaw`SELECT "nome","sku",(to_jsonb(p)->>'imagem') AS imagem FROM "PrecProduto" p WHERE "id" = ${produtoId} AND "workspaceId" = ${workspaceId} LIMIT 1` as { nome: string; sku: string | null; imagem: string | null }[]
    if (!prod) return
    // IMAGEM: usa a FOTO do produto (galeria), não URL digitada. Sem foto → pendente com aviso claro.
    if (!prod.imagem) { await pendente('Adicione uma foto ao produto para publicar no marketplace.'); return }

    // SKUs = VARIAÇÕES do canal TikTok, cada uma com o PREÇO da precificação daquele canal.
    const vars = await prisma.$queryRaw`SELECT "canal","subOpcao","tipo","precoVenda"::float AS preco FROM "PrecVariacao" WHERE "produtoId" = ${produtoId}` as { canal: string | null; subOpcao: string | null; tipo: string; preco: number }[]
    const varsTikTok = vars.filter(v => normalizarCanal(v.canal || '') === CANAL)
    const variacoes: VariacaoPublicar[] = (varsTikTok.length ? varsTikTok : []).map(v => ({
      sku: prod.sku, preco: v.preco || 0, nome: v.subOpcao || v.tipo || null,
    }))
    if (variacoes.length === 0) return // sem variação TikTok (canal desmarcado) → não publica

    // A foto do produto vira a imagem do anúncio (uploadImagem faz data:URI → URI do TikTok).
    const camposComFoto = { ...campos, imagens: [prod.imagem] }
    const rascunho = !(campos as any)?.publicarAtivo // padrão RASCUNHO
    await publicarProduto(workspaceId, produtoId, prod.nome, camposComFoto, variacoes, { rascunho })
  } catch (e) {
    console.error('[marketplace][autoPublicar] falhou (não trava o produto):', (e as Error)?.message)
  }
}
