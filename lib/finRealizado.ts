// FONTE ÚNICA do que é REALIZADO e do que é PREVISTO no financeiro do ateliê.
//
// O contrato já existia escrito em lib/finPagamento.ts, mas só como comentário: cada rota
// repetia o filtro na mão. Isso produziu 3 dialetos incompatíveis convivendo na base:
//   1) status IN ('PAGO','PARCIAL') / IN ('PENDENTE','PARCIAL')  ← o correto
//   2) status = 'PAGO' puro                                      ← perde o parcial já pago
//   3) sem filtro nenhum, SUM("valor")                           ← conta previsto como realizado
// Daqui pra frente todo agregado deve usar estes fragmentos.
//
// Regra (espelha lib/finPagamento.ts):
//   PENDENTE → nada realizado          PARCIAL → 0 < valorRealizado < valor       PAGO → quitado
//   REALIZADO (entrou/saiu de fato) = COALESCE("valorRealizado","valor")  p/ status IN (PAGO, PARCIAL)
//   EM ABERTO (previsto)            = "valor" - COALESCE("valorRealizado",0) p/ status IN (PENDENTE, PARCIAL)
// Um lançamento PARCIAL aparece nos DOIS lados: a parte paga é realizada, o resto segue previsto.
import { Prisma } from '@prisma/client'

export const STATUS_REALIZADO = ['PAGO', 'PARCIAL'] as const
export const STATUS_ABERTO = ['PENDENTE', 'PARCIAL'] as const

/** Prefixo de alias ("l"." ou vazio). O alias é literal do nosso código, nunca entrada do usuário. */
const px = (alias?: string) => (alias ? Prisma.raw(`"${alias}".`) : Prisma.raw(''))

/** WHERE do que JÁ ACONTECEU (entrou/saiu). Use no Caixa e em qualquer "realizado". */
export const ondeRealizado = (alias?: string) => Prisma.sql`${px(alias)}"status" IN ('PAGO','PARCIAL')`

/** WHERE do que AINDA VAI ACONTECER (contas a pagar / a receber). */
export const ondeAberto = (alias?: string) => Prisma.sql`${px(alias)}"status" IN ('PENDENTE','PARCIAL')`

/** Valor efetivamente realizado da linha (respeita o parcial já pago). */
export const valorRealizado = (alias?: string) => Prisma.sql`COALESCE(${px(alias)}"valorRealizado", ${px(alias)}"valor")`

/** Saldo ainda em aberto da linha (PARCIAL entra só com o que falta). */
export const valorAberto = (alias?: string) => Prisma.sql`(${px(alias)}"valor" - COALESCE(${px(alias)}"valorRealizado", 0))`

/** SUM do realizado de um tipo ('RECEITA' | 'DESPESA'), já com o filtro de status embutido. */
export const somaRealizado = (tipo: 'RECEITA' | 'DESPESA', alias?: string) => Prisma.sql`
  COALESCE(SUM(CASE WHEN ${px(alias)}"tipo" = ${tipo} AND ${ondeRealizado(alias)}
                    THEN ${valorRealizado(alias)} ELSE 0 END), 0)::float`

/** SUM do que está em aberto de um tipo — é o "a receber"/"a pagar". */
export const somaAberto = (tipo: 'RECEITA' | 'DESPESA', alias?: string) => Prisma.sql`
  COALESCE(SUM(CASE WHEN ${px(alias)}"tipo" = ${tipo} AND ${ondeAberto(alias)}
                    THEN ${valorAberto(alias)} ELSE 0 END), 0)::float`

// ── Equivalentes em TS (para somar no client, mesma regra) ────────────────────
export interface LancamentoLike { tipo?: string | null; status?: string | null; valor?: any; valorRealizado?: any }

const num = (v: any) => Number(v) || 0

/** Quanto desta linha já entrou/saiu de fato. */
export function realizadoDe(l: LancamentoLike): number {
  if (!STATUS_REALIZADO.includes(String(l.status) as any)) return 0
  return l.valorRealizado == null ? num(l.valor) : num(l.valorRealizado)
}

/** Quanto desta linha ainda está previsto (a receber/a pagar). */
export function abertoDe(l: LancamentoLike): number {
  if (!STATUS_ABERTO.includes(String(l.status) as any)) return 0
  return Math.max(0, Math.round((num(l.valor) - num(l.valorRealizado)) * 100) / 100)
}
