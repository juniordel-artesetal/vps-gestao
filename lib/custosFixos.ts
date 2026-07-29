// Custos fixos & RATEIO — segundo modelo de precificação (opcional, flag por workspace),
// ao lado da margem de contribuição que já existe. A artesã ATIVA, escolhe o MÉTODO de
// rateio (a/b/c/d) e o sistema passa a somar o custo fixo por peça e mostrar o LUCRO REAL.
//
// Métodos (F = custos fixos do mês):
//   (a) unidades   → custo fixo/peça = F ÷ unidades do mês            (R$ no custo)
//   (b) horas      → F ÷ horas do mês = R$/hora; × horas da peça      (R$ no custo)
//   (c) faturamento→ % = F ÷ faturamento do mês; entra no denominador (% como imposto)
//   (d) manual     → R$ fixo por peça definido por ela                (R$ no custo)
//
// Flag OFF por padrão (sem linha ou ativo=false) → precificação atual intacta.
// Tudo raw SQL idempotente (como lib/canaisVenda.ts).
import { prisma } from '@/lib/prisma'

export type MetodoRateio = 'unidades' | 'horas' | 'faturamento' | 'manual'

export interface CustosFixosConfig {
  ativo: boolean
  metodo: MetodoRateio
  custoFixoMensal: number
  itens: { nome: string; valor: number }[]
  unidadesMes: number
  horasMes: number
  faturamentoMes: number
  valorManual: number
  percentualPerda: number
}

const PADRAO: CustosFixosConfig = {
  ativo: false, metodo: 'horas', custoFixoMensal: 0, itens: [],
  unidadesMes: 0, horasMes: 0, faturamentoMes: 0, valorManual: 0, percentualPerda: 0,
}

export const METODOS: { id: MetodoRateio; nome: string; explicacao: string }[] = [
  { id: 'unidades', nome: 'Por unidades produzidas', explicacao: 'Divide os custos fixos do mês pelo número de peças que você produz no mês. Cada peça carrega a mesma fatia. Bom quando seus produtos dão trabalho parecido.' },
  { id: 'horas', nome: 'Por horas de produção', explicacao: 'Divide os custos fixos pelas horas que você trabalha no mês (custo fixo por hora) e cobra de cada peça conforme o tempo dela. Mais justo para ateliê: quem demora mais carrega mais.' },
  { id: 'faturamento', nome: 'Por faturamento', explicacao: 'Os custos fixos viram uma % do seu faturamento (fixos ÷ faturamento do mês) e essa % entra no preço, como um imposto. Bom quando você tem produtos de valores bem diferentes.' },
  { id: 'manual', nome: 'Valor fixo por peça', explicacao: 'Você mesma define um valor fixo de custo por peça (ex.: R$ 5,00). Simples e direto, se você já sabe o quanto quer embutir.' },
]

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

function parseItens(raw: unknown): { nome: string; valor: number }[] {
  const a = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw) } catch { return [] } })() : [])
  return (Array.isArray(a) ? a : []).map((x: { nome?: string; valor?: number }) => ({ nome: String(x?.nome || ''), valor: Number(x?.valor) || 0 }))
}

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

// ─────────────────────────── RATEIO / CÁLCULO ───────────────────────────────

/** Quanto de custo fixo cai NAQUELA peça: em R$ (métodos a/b/d) OU como % do preço (c). */
export function ratearCustoFixo(cfg: CustosFixosConfig, ctx: { horasProduto?: number } = {}): { rateioRS: number; rateioPct: number } {
  if (!cfg.ativo) return { rateioRS: 0, rateioPct: 0 }
  const F = Math.max(0, cfg.custoFixoMensal || 0)
  switch (cfg.metodo) {
    case 'unidades': return { rateioRS: cfg.unidadesMes > 0 ? arred(F / cfg.unidadesMes) : 0, rateioPct: 0 }
    case 'horas': {
      const porHora = cfg.horasMes > 0 ? F / cfg.horasMes : 0
      return { rateioRS: arred(porHora * Math.max(0, ctx.horasProduto || 0)), rateioPct: 0 }
    }
    case 'faturamento': return { rateioRS: 0, rateioPct: cfg.faturamentoMes > 0 ? F / cfg.faturamentoMes : 0 }
    case 'manual': return { rateioRS: arred(Math.max(0, cfg.valorManual || 0)), rateioPct: 0 }
    default: return { rateioRS: 0, rateioPct: 0 }
  }
}

/** Custo fixo em R$ que cai numa venda de preço `preco` (resolve a/b/d e c num número só). */
export function custoFixoDaVenda(cfg: CustosFixosConfig, preco: number, ctx: { horasProduto?: number } = {}): number {
  const { rateioRS, rateioPct } = ratearCustoFixo(cfg, ctx)
  return arred(rateioRS + Math.max(0, preco || 0) * rateioPct)
}

/** Lucro REAL de uma venda = preço − variáveis − taxa do canal (R$) − imposto − custo fixo rateado. */
export function lucroReal(p: { preco: number; custoVariavel: number; taxaCanalRS?: number; impostoPct?: number; custoFixoRateado: number }): number {
  const imposto = Math.max(0, p.preco || 0) * (Math.max(0, p.impostoPct || 0) / 100)
  return arred((p.preco || 0) - (p.custoVariavel || 0) - (p.taxaCanalRS || 0) - imposto - (p.custoFixoRateado || 0))
}

function arred(n: number): number { return Math.round((Number(n) || 0) * 100) / 100 }
