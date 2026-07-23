// Leitura do parceiro atribuído a uma workspace, para montar o split.
//
// SQL cru de propósito, sem importar lib/parceiros: aquele módulo é WIP de outra
// frente e NÃO existe nesta branch (nem em main). Importá-lo quebraria o build,
// exatamente como aconteceu com lib/logistica/cripto na fundação. As tabelas
// Parceiro/Lead existem no banco, então lemos direto — a frente de pagamento
// continua autocontida.
//
// Quando as frentes se encontrarem no merge, este arquivo pode passar a delegar
// para lib/parceiros sem mudar quem o consome.
import { prisma } from '@/lib/prisma'

export interface ParceiroDoWorkspace {
  id: string
  nome: string
  tipo: string
  ativo: boolean
  comissaoPercMensal: number
  comissaoPercAnual: number
  comissaoRecorrente: boolean
  walletId: string | null
  leadId: string
}

/**
 * Parceiro que trouxe esta workspace, se houver. A atribuição mora no Lead
 * (gravado no cadastro por cupom ou link); pega-se a mais antiga, que é a que
 * de fato originou a conta.
 *
 * Nunca lança: sem parceiro, sem tabela ou com erro, devolve null — a assinatura
 * precisa nascer de qualquer jeito. Comissão é consequência, não pré-requisito.
 */
export async function parceiroDoWorkspace(workspaceId: string): Promise<ParceiroDoWorkspace | null> {
  try {
    const [row] = await prisma.$queryRaw`
      SELECT p."id", p."nome", p."tipo", p."ativo",
             p."comissaoPercMensal"::float AS "comissaoPercMensal",
             p."comissaoPercAnual"::float  AS "comissaoPercAnual",
             p."comissaoRecorrente", p."walletId",
             l."id" AS "leadId"
      FROM "Lead" l
      JOIN "Parceiro" p ON p."id" = l."parceiroId"
      WHERE l."workspaceId" = ${workspaceId} AND l."parceiroId" IS NOT NULL
      ORDER BY l."createdAt" ASC
      LIMIT 1
    ` as ParceiroDoWorkspace[]

    if (!row || !row.ativo) return null
    // Só INFLUENCER gera comissão — distribuidor tem outro acordo comercial.
    if (row.tipo !== 'influencer') return null
    return row
  } catch (e) {
    console.warn('[ASSINATURA] parceiro não consultado:', (e as Error)?.message)
    return null
  }
}
