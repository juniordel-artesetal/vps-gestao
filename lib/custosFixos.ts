// Custos fixos & RATEIO — camada de BANCO (config por workspace). A matemática de
// rateio vive em lib/custosFixosCalc.ts (pura, sem prisma) e é reexportada aqui, para
// ser a FONTE ÚNICA usada pelo preço sugerido (client), simulador e Resultado das vendas.
// Flag OFF por padrão (sem linha ou ativo=false) → precificação atual intacta.
import { prisma } from '@/lib/prisma'
import { PADRAO, parseItens, type CustosFixosConfig, type MetodoRateio } from '@/lib/custosFixosCalc'

export * from '@/lib/custosFixosCalc'

// ─────────────────────────── SCHEMA (idempotente) ───────────────────────────
let pronto = false
export async function ensureCustosFixosTable(): Promise<void> {
  if (pronto) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PrecCustosFixos" (
      "id"              TEXT PRIMARY KEY,
      "workspaceId"     TEXT NOT NULL UNIQUE,
      "ativo"           BOOLEAN NOT NULL DEFAULT false,
      "metodo"          TEXT NOT NULL DEFAULT 'horas',
      "custoFixoMensal" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "itens"           JSONB NOT NULL DEFAULT '[]'::jsonb,
      "unidadesMes"     INTEGER NOT NULL DEFAULT 0,
      "horasMes"        NUMERIC(10,2) NOT NULL DEFAULT 0,
      "faturamentoMes"  NUMERIC(12,2) NOT NULL DEFAULT 0,
      "valorManual"     NUMERIC(10,2) NOT NULL DEFAULT 0,
      "percentualPerda" NUMERIC(6,2) NOT NULL DEFAULT 0,
      "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
  pronto = true
}

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// ─────────────────────────────── CONFIG ─────────────────────────────────────
export async function getCustosFixos(workspaceId: string): Promise<CustosFixosConfig> {
  await ensureCustosFixosTable()
  const [r] = await prisma.$queryRaw`
    SELECT "ativo", "metodo", "custoFixoMensal"::float AS "custoFixoMensal", "itens",
           "unidadesMes", "horasMes"::float AS "horasMes", "faturamentoMes"::float AS "faturamentoMes",
           "valorManual"::float AS "valorManual", "percentualPerda"::float AS "percentualPerda"
    FROM "PrecCustosFixos" WHERE "workspaceId" = ${workspaceId} LIMIT 1
  ` as (Omit<CustosFixosConfig, 'itens'> & { itens: unknown })[]
  if (!r) return { ...PADRAO }
  return { ...r, metodo: (r.metodo as MetodoRateio) || 'horas', itens: parseItens(r.itens) }
}

export async function custoFixoAtivo(workspaceId: string): Promise<boolean> {
  return (await getCustosFixos(workspaceId)).ativo
}

export async function salvarCustosFixos(workspaceId: string, p: Partial<CustosFixosConfig>): Promise<void> {
  await ensureCustosFixosTable()
  const atual = await getCustosFixos(workspaceId)
  const c = { ...atual, ...p }
  const itens = Array.isArray(c.itens) ? c.itens.map(i => ({ nome: String(i.nome || ''), valor: Math.max(0, Number(i.valor) || 0) })) : []
  // Se ela detalhou itens, o total é a soma deles; senão usa o custoFixoMensal informado.
  const totalItens = itens.reduce((s, i) => s + i.valor, 0)
  const custoFixoMensal = itens.length > 0 ? totalItens : Math.max(0, Number(c.custoFixoMensal) || 0)
  const metodo: MetodoRateio = (['unidades', 'horas', 'faturamento', 'manual'] as const).includes(c.metodo) ? c.metodo : 'horas'
  await prisma.$executeRaw`
    INSERT INTO "PrecCustosFixos" ("id","workspaceId","ativo","metodo","custoFixoMensal","itens","unidadesMes","horasMes","faturamentoMes","valorManual","percentualPerda","createdAt","updatedAt")
    VALUES (${gerarId()}, ${workspaceId}, ${!!c.ativo}, ${metodo}, ${custoFixoMensal}, ${JSON.stringify(itens)}::jsonb,
            ${Math.max(0, Math.round(Number(c.unidadesMes) || 0))}, ${Math.max(0, Number(c.horasMes) || 0)},
            ${Math.max(0, Number(c.faturamentoMes) || 0)}, ${Math.max(0, Number(c.valorManual) || 0)}, ${Math.max(0, Number(c.percentualPerda) || 0)}, NOW(), NOW())
    ON CONFLICT ("workspaceId") DO UPDATE SET
      "ativo" = EXCLUDED."ativo", "metodo" = EXCLUDED."metodo", "custoFixoMensal" = EXCLUDED."custoFixoMensal",
      "itens" = EXCLUDED."itens", "unidadesMes" = EXCLUDED."unidadesMes", "horasMes" = EXCLUDED."horasMes",
      "faturamentoMes" = EXCLUDED."faturamentoMes", "valorManual" = EXCLUDED."valorManual",
      "percentualPerda" = EXCLUDED."percentualPerda", "updatedAt" = NOW()
  `
}
