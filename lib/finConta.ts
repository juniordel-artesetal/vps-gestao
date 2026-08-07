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

/** Soma dos saldos de TODAS as contas do workspace (saldoInicial + entradas − saídas + transf). */
export async function saldoTotalContas(workspaceId: string): Promise<number> {
  const contas = await listarContas(workspaceId)
  return contas.reduce((s, c) => s + c.saldo, 0)
}

export interface MovimentoExtrato {
  id: string; kind: 'lancamento' | 'transferencia'
  data: string; descricao: string; entrada: boolean; valor: number
  conciliado?: boolean; status: string | null   // PAGO/PENDENTE p/ lançamento; null p/ transferência
  categoriaId: string | null; categoriaNome: string | null; categoriaIcone: string | null
  saldo: number | null   // saldo corrente APÓS o movimento (null nos PENDENTES — não movem o banco)
}
export interface ExtratoConta {
  conta: { id: string; nome: string; saldoInicial: number; saldo: number; aConciliar: number } | null
  movimentos: MovimentoExtrato[]   // mais recente primeiro
}

/** Extrato de UMA conta: lançamentos (pagos e pendentes) + transferências, com saldo corrente.
 *  O saldo acumula SÓ o realizado (PAGO + transferências); PENDENTE aparece mas não move o saldo. */
export async function extratoConta(workspaceId: string, contaId: string): Promise<ExtratoConta> {
  await ensureContasBancarias()
  const [conta] = await prisma.$queryRaw`
    SELECT "id","nome","saldoInicial"::float AS "saldoInicial"
    FROM "FinConta" WHERE "id" = ${contaId} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as { id: string; nome: string; saldoInicial: number }[]
  if (!conta) return { conta: null, movimentos: [] }

  const lancs = await prisma.$queryRaw`
    SELECT l."id", l."descricao", TO_CHAR(l."data",'YYYY-MM-DD') AS "data", l."tipo", l."status",
           COALESCE(l."valorRealizado", l."valor")::float AS "valor", COALESCE(l."conciliado",false) AS "conciliado", l."createdAt",
           l."categoriaId", c."nome" AS "categoriaNome", c."icone" AS "categoriaIcone"
    FROM "FinLancamento" l
    LEFT JOIN "FinCategoria" c ON c."id" = l."categoriaId"
    WHERE l."workspaceId" = ${workspaceId} AND l."contaId" = ${contaId} AND l."status" IN ('PAGO','PENDENTE')
  ` as any[]

  const transf = await prisma.$queryRaw`
    SELECT t."id", TO_CHAR(t."data",'YYYY-MM-DD') AS "data", t."valor"::float AS "valor", t."descricao",
           t."contaOrigemId", t."contaDestinoId", t."createdAt",
           o."nome" AS "origemNome", d."nome" AS "destinoNome"
    FROM "FinTransferencia" t
    LEFT JOIN "FinConta" o ON o."id" = t."contaOrigemId"
    LEFT JOIN "FinConta" d ON d."id" = t."contaDestinoId"
    WHERE t."workspaceId" = ${workspaceId} AND (t."contaOrigemId" = ${contaId} OR t."contaDestinoId" = ${contaId})
  ` as any[]

  type Bruto = MovimentoExtrato & { _ord: number }
  const brutos: Bruto[] = []
  for (const l of lancs) brutos.push({
    id: l.id, kind: 'lancamento', data: l.data, descricao: l.descricao, status: l.status,
    entrada: l.tipo === 'RECEITA', valor: Number(l.valor), conciliado: !!l.conciliado, saldo: null,
    categoriaId: l.categoriaId ?? null, categoriaNome: l.categoriaNome ?? null, categoriaIcone: l.categoriaIcone ?? null,
    _ord: new Date(l.createdAt).getTime(),
  })
  for (const t of transf) {
    const saida = t.contaOrigemId === contaId
    brutos.push({
      id: t.id, kind: 'transferencia', data: t.data, status: null,
      descricao: t.descricao || (saida ? `Transferência para ${t.destinoNome ?? 'outra conta'}` : `Transferência de ${t.origemNome ?? 'outra conta'}`),
      entrada: !saida, valor: Number(t.valor), saldo: null,
      categoriaId: null, categoriaNome: null, categoriaIcone: null,
      _ord: new Date(t.createdAt).getTime(),
    })
  }

  // Cronológico → acumula SÓ realizado (PAGO ou transferência). PENDENTE fica com saldo null.
  brutos.sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : a._ord - b._ord)
  let saldo = Number(conta.saldoInicial) || 0
  for (const m of brutos) {
    if (m.kind === 'transferencia' || m.status === 'PAGO') {
      saldo += m.entrada ? m.valor : -m.valor
      m.saldo = Math.round(saldo * 100) / 100
    }
  }
  const aConciliar = brutos.filter(m => m.kind === 'lancamento' && m.status === 'PAGO' && !m.conciliado).length

  const movimentos = brutos.reverse().map(({ _ord, ...m }) => m)
  return {
    conta: { id: conta.id, nome: conta.nome, saldoInicial: Number(conta.saldoInicial) || 0, saldo: Math.round(saldo * 100) / 100, aConciliar },
    movimentos,
  }
}
