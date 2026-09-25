// Entitlement do módulo "SOA Edition" (interno: estudio) — Workspace.moduloEstudio.
// Edição em massa de artes/PDFs personalizados (substituto do TUTU Edition) com o diferencial
// de puxar a lista direto de um PEDIDO do SOA.
//
// Mesmo padrão do módulo Marketplaces: coluna criada sob demanda com PRÉ-CHECK no catálogo
// antes do ALTER (Workspace é tabela quente — regra anti-lock-storm, ver lib/ddlGuard) e
// leitura TOLERANTE via to_jsonb (funciona mesmo se a coluna ainda não existir).
import { prisma } from '@/lib/prisma'
import { garantirColuna } from '@/lib/ddlGuard'

let colunaOk = false
export async function garantirColunaModuloEstudio(): Promise<void> {
  if (colunaOk) return
  await garantirColuna('Workspace', 'moduloEstudio', 'boolean NOT NULL DEFAULT false')
  // 'asaas' (assinatura paga R$ 29,90/mês) | 'cortesia' (Master/testes — nunca cobrada nem cortada) | NULL
  await garantirColuna('Workspace', 'moduloEstudioOrigem', 'text')
  colunaOk = true
}

/** O workspace tem o SOA Edition liberado? Tolerante à ausência da coluna (→ false). */
export async function estudioLiberado(workspaceId: string | null | undefined): Promise<boolean> {
  if (!workspaceId) return false
  const rows = await prisma.$queryRaw<{ on: boolean | null }[]>`
    SELECT (to_jsonb(w) ->> 'moduloEstudio')::boolean AS "on" FROM "Workspace" w WHERE w."id" = ${workspaceId} LIMIT 1
  `
  return !!rows[0]?.on
}
