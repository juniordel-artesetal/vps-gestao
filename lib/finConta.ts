// Contas bancárias / carteiras (por workspace) + saldo por conta + transferências.
// Aditivo e idempotente. Prisma raw; escopo por workspaceId; sem SELECT *.
//   FinConta            — as contas (corrente, poupança/porquinho, carteira marketplace, dinheiro)
//   FinTransferencia    — mover saldo entre contas (NÃO é receita/despesa)
//   FinLancamento.contaId + .conciliado — vínculo do lançamento à conta + estado de conciliação
import { prisma } from '@/lib/prisma'

export const TIPOS_CONTA = [
  { id: 'CONTA_CORRENTE', nome: 'Conta corrente' },
  { id: 'POUPANCA',       nome: 'Poupança / Porquinho' },
  { id: 'CARTEIRA_MKT',   nome: 'Carteira de marketplace' },
  { id: 'DINHEIRO',       nome: 'Dinheiro (caixa físico)' },
] as const

let ok = false
export async function ensureContasBancarias() {
  if (ok) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FinConta" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "nome" text NOT NULL,
      "tipo" text NOT NULL DEFAULT 'CONTA_CORRENTE',
      "banco" text,
      "saldoInicial" numeric NOT NULL DEFAULT 0,
      "rendimento" numeric,
      "ativo" boolean NOT NULL DEFAULT true,
      "ordem" integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FinConta_ws_idx" ON "FinConta" ("workspaceId")`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FinTransferencia" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "contaOrigemId" text NOT NULL,
      "contaDestinoId" text NOT NULL,
      "valor" numeric NOT NULL,
      "data" date NOT NULL,
      "descricao" text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FinTransferencia_ws_idx" ON "FinTransferencia" ("workspaceId")`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "FinLancamento" ADD COLUMN IF NOT EXISTS "contaId" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "FinLancamento" ADD COLUMN IF NOT EXISTS "conciliado" boolean NOT NULL DEFAULT false`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "moduloContasBancarias" boolean NOT NULL DEFAULT false`)
  ok = true
}

export async function moduloContasAtivo(workspaceId: string): Promise<boolean> {
  await ensureContasBancarias()
  const r = await prisma.$queryRaw`SELECT "moduloContasBancarias" AS m FROM "Workspace" WHERE "id" = ${workspaceId}` as { m: boolean }[]
  return !!r[0]?.m
}
export async function setModuloContas(workspaceId: string, ativo: boolean) {
  await ensureContasBancarias()
  await prisma.$executeRaw`UPDATE "Workspace" SET "moduloContasBancarias" = ${ativo} WHERE "id" = ${workspaceId}`
}

export interface ContaComSaldo {
  id: string; nome: string; tipo: string; banco: string | null; saldoInicial: number
  rendimento: number | null; ativo: boolean; ordem: number
  entradas: number; saidas: number; transfIn: number; transfOut: number
  saldo: number; aReceber: number; aPagar: number; naoConciliados: number
}

/** Lista as contas com saldo calculado (realizado = PAGO) + pendentes + nº não conciliados. */
export async function listarContas(workspaceId: string): Promise<ContaComSaldo[]> {
  await ensureContasBancarias()
  const contas = await prisma.$queryRaw`
    SELECT "id","nome","tipo","banco","saldoInicial"::float AS "saldoInicial",
           "rendimento"::float AS "rendimento","ativo","ordem"
    FROM "FinConta" WHERE "workspaceId" = ${workspaceId} ORDER BY "ordem" ASC, "nome" ASC
  ` as any[]
  if (contas.length === 0) return []

  const mov = await prisma.$queryRaw`
    SELECT "contaId",
      COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PAGO'     THEN COALESCE("valorRealizado","valor") ELSE 0 END),0)::float AS entradas,
      COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO'     THEN COALESCE("valorRealizado","valor") ELSE 0 END),0)::float AS saidas,
      COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PENDENTE' THEN "valor" ELSE 0 END),0)::float AS areceber,
      COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PENDENTE' THEN "valor" ELSE 0 END),0)::float AS apagar,
      COUNT(*) FILTER (WHERE "status"='PAGO' AND COALESCE("conciliado",false)=false)::int AS naoconc
    FROM "FinLancamento" WHERE "workspaceId" = ${workspaceId} AND "contaId" IS NOT NULL GROUP BY "contaId"
  ` as any[]
  const movMap = new Map(mov.map(m => [m.contaId, m]))

  const transf = await prisma.$queryRaw`
    SELECT "contaOrigemId","contaDestinoId","valor"::float AS valor FROM "FinTransferencia" WHERE "workspaceId" = ${workspaceId}
  ` as { contaOrigemId: string; contaDestinoId: string; valor: number }[]
  const tIn = new Map<string, number>(), tOut = new Map<string, number>()
  for (const t of transf) {
    tOut.set(t.contaOrigemId, (tOut.get(t.contaOrigemId) || 0) + Number(t.valor))
    tIn.set(t.contaDestinoId, (tIn.get(t.contaDestinoId) || 0) + Number(t.valor))
  }

  return contas.map(c => {
    const m = movMap.get(c.id) || {}
    const entradas = Number(m.entradas || 0), saidas = Number(m.saidas || 0)
    const transfIn = tIn.get(c.id) || 0, transfOut = tOut.get(c.id) || 0
    return {
      id: c.id, nome: c.nome, tipo: c.tipo, banco: c.banco, saldoInicial: Number(c.saldoInicial) || 0,
      rendimento: c.rendimento != null ? Number(c.rendimento) : null, ativo: c.ativo, ordem: c.ordem,
      entradas, saidas, transfIn, transfOut,
      saldo: (Number(c.saldoInicial) || 0) + entradas - saidas + transfIn - transfOut,
      aReceber: Number(m.areceber || 0), aPagar: Number(m.apagar || 0), naoConciliados: Number(m.naoconc || 0),
    }
  })
}
