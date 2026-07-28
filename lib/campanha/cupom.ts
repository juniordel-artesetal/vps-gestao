// Cupom de R$20 (crédito da diferença) da campanha de migração dos 130.
// Regras RÍGIDAS, validadas SEMPRE no servidor:
//   - só e-mail da WHITELIST (quem está na CampanhaMigracao — os 130)
//   - USO ÚNICO por pessoa
//   - só na 1ª cobrança da 1ª assinatura (1º mês 9,90; depois 29,90)
// A aplicação do desconto acontece no checkout do Asaas (épico de pagamento);
// aqui mora a AUTORIDADE (validação + marca de uso).
import { prisma } from '@/lib/prisma'

export const CUPOM_VALOR = 20

export interface ResultadoCupom { valido: boolean; desconto?: number; motivo?: string }

export async function validarCupomMigracao(email: string): Promise<ResultadoCupom> {
  const e = String(email || '').trim().toLowerCase()
  if (!e) return { valido: false, motivo: 'E-mail ausente.' }
  const [row] = await prisma.$queryRaw`
    SELECT "cupomAplicadoEm" FROM "CampanhaMigracao" WHERE lower("email") = ${e} LIMIT 1
  ` as { cupomAplicadoEm: Date | null }[]
  if (!row) return { valido: false, motivo: 'E-mail fora da campanha de migração.' }
  if (row.cupomAplicadoEm) return { valido: false, motivo: 'Cupom já utilizado.' }
  return { valido: true, desconto: CUPOM_VALOR }
}

/** Marca o cupom como usado (idempotente). O checkout chama ao aplicar o desconto. */
export async function marcarCupomUsado(email: string): Promise<void> {
  const e = String(email || '').trim().toLowerCase()
  await prisma.$executeRaw`
    UPDATE "CampanhaMigracao" SET "cupomAplicadoEm" = NOW(), "updatedAt" = NOW()
    WHERE lower("email") = ${e} AND "cupomAplicadoEm" IS NULL
  `
}
