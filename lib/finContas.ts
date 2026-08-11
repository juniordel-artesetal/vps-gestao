// Plano de contas gerenciais (conta > subconta) sobre FinCategoria.
// Aditivo: parentId (null = conta; setado = subconta) + grupoDRE p/ agrupar o DRE.
// Lançamentos antigos (categoria flat ou nome livre) continuam válidos.
import { prisma } from '@/lib/prisma'

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export type GrupoDRE =
  | 'receita_operacional' | 'receita_nao_operacional'
  | 'cmv' | 'administrativa' | 'financeira' | null

// Estrutura padrão (editável depois pela artesã).
export const PLANO_PADRAO: Record<'RECEITA' | 'DESPESA', { conta: string; icone: string; grupoDRE: Exclude<GrupoDRE, null>; subs: string[] }[]> = {
  RECEITA: [
    { conta: 'Operacionais',     icone: '🧾', grupoDRE: 'receita_operacional',     subs: ['Venda de pedido', 'Loja virtual'] },
    { conta: 'Não operacionais', icone: '💠', grupoDRE: 'receita_nao_operacional', subs: ['Aporte', 'Rendimento', 'Transferência'] },
  ],
  DESPESA: [
    { conta: 'Custo da mercadoria', icone: '📦', grupoDRE: 'cmv',           subs: ['Embalagem', 'Matéria-prima', 'Insumo'] },
    { conta: 'Administrativas',     icone: '🏢', grupoDRE: 'administrativa', subs: ['Aluguel', 'Marketing / Ads', 'Pró-labore', 'Água / Luz'] },
    { conta: 'Financeiras',         icone: '🏦', grupoDRE: 'financeira',      subs: ['Tarifa bancária', 'Tarifa de marketplace'] },
  ],
}

let ok = false
export async function ensureFinContas(): Promise<void> {
  if (ok) return
  await prisma.$executeRawUnsafe(`ALTER TABLE "FinCategoria" ADD COLUMN IF NOT EXISTS "parentId" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "FinCategoria" ADD COLUMN IF NOT EXISTS "padrao" BOOLEAN NOT NULL DEFAULT false`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "FinCategoria" ADD COLUMN IF NOT EXISTS "ordem" INTEGER NOT NULL DEFAULT 0`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "FinCategoria" ADD COLUMN IF NOT EXISTS "grupoDRE" TEXT`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FinCategoria_parent_idx" ON "FinCategoria" ("parentId")`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "moduloContasGerenciais" BOOLEAN NOT NULL DEFAULT false`)
  ok = true
}

// Acha (ou cria) uma categoria por (workspace, tipo, nome, parent). Idempotente.
async function upsertCategoria(workspaceId: string, tipo: string, nome: string, parentId: string | null, extra: { icone?: string; grupoDRE?: string; ordem?: number; padrao?: boolean }): Promise<string> {
  const existentes = await prisma.$queryRaw`
    SELECT "id" FROM "FinCategoria"
    WHERE "workspaceId" = ${workspaceId} AND "tipo" = ${tipo} AND lower("nome") = lower(${nome})
      AND "parentId" IS NOT DISTINCT FROM ${parentId}
    LIMIT 1
  ` as { id: string }[]
  if (existentes[0]) return existentes[0].id
  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "FinCategoria" ("id","workspaceId","nome","tipo","cor","icone","parentId","padrao","ordem","grupoDRE")
    VALUES (${id}, ${workspaceId}, ${nome}, ${tipo}, ${'#f97316'}, ${extra.icone ?? '📁'}, ${parentId}, ${extra.padrao ?? false}, ${extra.ordem ?? 0}, ${extra.grupoDRE ?? null})
  `
  return id
}

// Semeia o plano padrão (idempotente — não duplica se já existe).
export async function semearPlanoContas(workspaceId: string): Promise<{ contas: number; subcontas: number }> {
  await ensureFinContas()
  let contas = 0, subcontas = 0
  for (const tipo of ['RECEITA', 'DESPESA'] as const) {
    let ordemC = 0
    for (const c of PLANO_PADRAO[tipo]) {
      const contaId = await upsertCategoria(workspaceId, tipo, c.conta, null, { icone: c.icone, grupoDRE: c.grupoDRE, ordem: ordemC++, padrao: true })
      contas++
      let ordemS = 0
      for (const sub of c.subs) {
        await upsertCategoria(workspaceId, tipo, sub, contaId, { grupoDRE: c.grupoDRE, ordem: ordemS++, padrao: true })
        subcontas++
      }
    }
  }
  return { contas, subcontas }
}

export interface ContaComSub {
  id: string; nome: string; tipo: string; cor: string | null; icone: string | null; grupoDRE: string | null; ordem: number; padrao: boolean
  subcontas: { id: string; nome: string; cor: string | null; icone: string | null; grupoDRE: string | null; ordem: number; padrao: boolean }[]
}

// Lista o plano em árvore (contas com subcontas). Categorias flat antigas (sem parent
// e sem subconta) aparecem como "conta" sozinha — nada quebra.
export async function listarPlano(workspaceId: string, tipo?: string | null): Promise<ContaComSub[]> {
  await ensureFinContas()
  const filtro = tipo && ['RECEITA', 'DESPESA'].includes(tipo)
  const rows = filtro
    ? await prisma.$queryRaw`
        SELECT "id","nome","tipo","cor","icone","parentId","grupoDRE","ordem","padrao"
        FROM "FinCategoria" WHERE "workspaceId" = ${workspaceId} AND "tipo" = ${tipo}
        ORDER BY "ordem" ASC, "nome" ASC` as any[]
    : await prisma.$queryRaw`
        SELECT "id","nome","tipo","cor","icone","parentId","grupoDRE","ordem","padrao"
        FROM "FinCategoria" WHERE "workspaceId" = ${workspaceId}
        ORDER BY "tipo" ASC, "ordem" ASC, "nome" ASC` as any[]

  const contas = rows.filter(r => !r.parentId).map(r => ({
    id: r.id, nome: r.nome, tipo: r.tipo, cor: r.cor, icone: r.icone, grupoDRE: r.grupoDRE, ordem: r.ordem, padrao: r.padrao,
    subcontas: rows.filter(s => s.parentId === r.id).map(s => ({ id: s.id, nome: s.nome, cor: s.cor, icone: s.icone, grupoDRE: s.grupoDRE, ordem: s.ordem, padrao: s.padrao })),
  }))
  return contas
}

export async function moduloAtivo(workspaceId: string): Promise<boolean> {
  await ensureFinContas()
  const r = await prisma.$queryRaw`SELECT "moduloContasGerenciais" AS m FROM "Workspace" WHERE "id" = ${workspaceId}` as { m: boolean }[]
  return !!r[0]?.m
}

export async function setModulo(workspaceId: string, ativo: boolean): Promise<void> {
  await ensureFinContas()
  await prisma.$executeRaw`UPDATE "Workspace" SET "moduloContasGerenciais" = ${ativo} WHERE "id" = ${workspaceId}`
}
