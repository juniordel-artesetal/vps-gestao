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
    const val = validarCamposObrigatorios(campos)
    if (!val.ok) {
      // Pendente de publicação: guarda o motivo p/ a UI ("faltam: X, Y"). Não é erro fatal.
      const vinc = await lerVinculo(workspaceId, produtoId, CANAL)
      await salvarVinculo(workspaceId, produtoId, CANAL, {
        status: vinc?.produtoExternoId ? vinc.status : 'pendente',
        ultimoErro: 'Complete os Dados do Marketplace para publicar (faltam: ' + val.faltando.join(', ') + ').',
      })
      return
    }

    const [prod] = await prisma.$queryRaw`SELECT "nome","sku" FROM "PrecProduto" WHERE "id" = ${produtoId} AND "workspaceId" = ${workspaceId} LIMIT 1` as { nome: string; sku: string | null }[]
    if (!prod) return
    const vars = await prisma.$queryRaw`SELECT "subOpcao","tipo","precoVenda"::float AS preco FROM "PrecVariacao" WHERE "produtoId" = ${produtoId}` as { subOpcao: string | null; tipo: string; preco: number }[]
    const variacoes: VariacaoPublicar[] = (vars.length ? vars : [{ subOpcao: null, tipo: '', preco: 0 }]).map(v => ({
      sku: prod.sku, preco: v.preco || 0, nome: v.subOpcao || v.tipo || null,
    }))

    // Padrão RASCUNHO (segurança). camposMarketplace.publicarAtivo=true → publica ativo.
    const rascunho = !(campos as any)?.publicarAtivo
    await publicarProduto(workspaceId, produtoId, prod.nome, campos, variacoes, { rascunho })
  } catch (e) {
    console.error('[marketplace][autoPublicar] falhou (não trava o produto):', (e as Error)?.message)
  }
}
