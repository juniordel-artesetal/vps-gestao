// Entitlement do MÓDULO PAGO "Integração com Marketplaces" (Workspace.moduloMarketplaces).
// SEPARADO do INTEGRACOES_ATIVO (interruptor técnico geral, por env). Para a artesã ver/usar
// o módulo, os DOIS precisam estar on: o técnico (env) E o comprado (por workspace).
//
// A coluna é criada sob demanda com PRÉ-CHECK no catálogo ANTES do ALTER (Workspace é tabela
// quente — regra anti-lock-storm: nunca rodar DDL nela a cada cold-start).
import { prisma } from '@/lib/prisma'

/** Interruptor técnico geral (env). Mesmo padrão das demais flags do projeto. */
export function integracoesTecnicoAtivo(): boolean {
  return String(process.env.INTEGRACOES_ATIVO || '').trim().toLowerCase() === 'on'
}

let colunaOk = false
export async function garantirColunaModuloMarketplaces(): Promise<void> {
  if (colunaOk) return
  const cols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Workspace' AND column_name IN ('moduloMarketplaces', 'moduloMarketplacesOrigem')
  `
  const tem = new Set(cols.map(c => c.column_name))
  if (!tem.has('moduloMarketplaces'))
    await prisma.$executeRawUnsafe(`ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "moduloMarketplaces" boolean NOT NULL DEFAULT false`)
  if (!tem.has('moduloMarketplacesOrigem'))
    // 'asaas' (assinatura paga) | 'cortesia' (Master/testes) | NULL
    await prisma.$executeRawUnsafe(`ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "moduloMarketplacesOrigem" text`)
  colunaOk = true
}

/** Lê o entitlement do workspace de forma TOLERANTE (funciona mesmo se a coluna ainda não existir). */
export async function temModuloMarketplaces(workspaceId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ on: boolean | null }[]>`
    SELECT (to_jsonb(w) ->> 'moduloMarketplaces')::boolean AS "on" FROM "Workspace" w WHERE w."id" = ${workspaceId} LIMIT 1
  `
  return !!rows[0]?.on
}

/** Regra final: técnico (env) E comprado (workspace). É o que os menus/telas devem checar. */
export async function marketplacesLiberado(workspaceId: string): Promise<boolean> {
  if (!integracoesTecnicoAtivo()) return false
  return await temModuloMarketplaces(workspaceId)
}
