// Método MAE — PREÇOS e REGRAS DE ACESSO da assinatura (puro: sem banco, testável).
//
// DECISÃO DO JÚNIOR (12/10/2026) — 4 preços, todos em ENV (nunca chumbados no código):
//   ADD-ON (assinante do SOA):  MAE_ADDON_MENSAL (39,90)      · MAE_ADDON_ANUAL (383,00 — até 12× com juros do cliente)
//   STANDALONE (só o MAE):      MAE_STANDALONE_MENSAL (59,90) · MAE_STANDALONE_ANUAL (503,00 — até 12× com juros)
// O anual parcela no CARTÃO pela MESMA tabela Price do anual do SOA (TAXA_PARCELAMENTO_ANUAL): o item do checkout já
// vai com o total com juros; o Asaas só divide. Trial de 7 dias com cartão validado (como o SOA).
// LANÇAMENTO: tudo fica "em breve" até MAE_VENDA_ATIVO=on + os 4 preços (como foi o SOA Design).
import { calcularParcelamentoAnual, MAX_PARCELAS_ANUAL, type Parcelamento } from '@/lib/assinatura/planos'

export type PlanoMaeVenda = 'addon' | 'standalone'
export type CicloMae = 'mensal' | 'anual'
export const TRIAL_DIAS_MAE = 7
/** Dias de acesso depois do vencimento não pago (régua do add-on). */
export const CARENCIA_DIAS_MAE = 5
/** Prefixo do externalReference das assinaturas do MAE (≠ "MAE:", que é compra da Loja da Naty). */
export const MARCA_ASSINATURA_MAE = 'MAEA:'
export const refAssinaturaMae = (ws: string) => `${MARCA_ASSINATURA_MAE}${ws}`
export const ehRefAssinaturaMae = (ref: unknown): boolean => typeof ref === 'string' && ref.startsWith(MARCA_ASSINATURA_MAE)

type Env = Record<string, string | undefined>
const num = (v: string | undefined): number | null => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && n >= 5 ? Math.round(n * 100) / 100 : null
}
export interface PrecosMae { addon: { mensal: number; anual: number }; standalone: { mensal: number; anual: number } }

/** Os 4 preços da config; algum faltando → null ("em breve", nada é vendido). */
export function precosMae(env: Env = process.env): PrecosMae | null {
  const am = num(env.MAE_ADDON_MENSAL), aa = num(env.MAE_ADDON_ANUAL), sm = num(env.MAE_STANDALONE_MENSAL), sa = num(env.MAE_STANDALONE_ANUAL)
  if (am === null || aa === null || sm === null || sa === null) return null
  return { addon: { mensal: am, anual: aa }, standalone: { mensal: sm, anual: sa } }
}
/** A venda do MAE está aberta (flag de lançamento + preços)? */
export const vendaMaeAtiva = (env: Env = process.env) => String(env.MAE_VENDA_ATIVO ?? '').toLowerCase() === 'on' && precosMae(env) !== null

/** Valor cobrado: mensal = o preço; anual = tabela Price em N parcelas (1× sem juros). */
export function cobrancaMae(p: PrecosMae, plano: PlanoMaeVenda, ciclo: CicloMae, parcelas = 1): Parcelamento {
  const base = p[plano][ciclo]
  if (ciclo === 'mensal') return { parcelas: 1, valorParcela: base, total: base }
  return calcularParcelamentoAnual(Math.max(1, Math.min(MAX_PARCELAS_ANUAL, Math.floor(parcelas) || 1)), base)
}
/** Tabela 1..12 do anual (para a tela). */
export const tabelaAnualMae = (p: PrecosMae, plano: PlanoMaeVenda) =>
  Array.from({ length: MAX_PARCELAS_ANUAL }, (_, k) => calcularParcelamentoAnual(k + 1, p[plano].anual))
/** Economia do anual à vista vs 12 meses do mensal (em %, arredondado). */
export const economiaAnual = (p: PrecosMae, plano: PlanoMaeVenda) => Math.round((1 - p[plano].anual / (12 * p[plano].mensal)) * 100)

// ── ACESSO ──────────────────────────────────────────────────────────────────────────────────────
export interface EstadoMaeConta {
  moduloMae: boolean; origem: string | null; ate: string | null
  /** Assinante do SOA Design (moduloEstudio): o SOA Design é DESLIGADO no lançamento do MAE e quem pagava vira
   *  cortesia do MAE até o Júnior decidir a cobrança (decisão de 12/10). */
  soaDesign: boolean
}
export type OrigemAcessoMae = 'cortesia' | 'asaas' | 'soa-design' | null

/** Acesso pago/cortesia ao MAE (o beta e as compras de cortesia em mae_purchases ficam em addonsDaConta). */
export function acessoMae(e: EstadoMaeConta, hoje: string): OrigemAcessoMae {
  if (e.moduloMae && e.origem === 'cortesia') return 'cortesia'
  if (e.moduloMae && (!e.ate || e.ate >= hoje)) return 'asaas'
  if (e.soaDesign) return 'soa-design'
  return null
}

/** AAAA-MM-DD + n dias. */
export function somarDias(d: string, n: number): string {
  const [a, m, dd] = d.split('-').map(Number)
  const x = new Date(Date.UTC(a, m - 1, dd + n))
  return x.toISOString().slice(0, 10)
}
/** Próximo vencimento depois de pagar a cobrança que venceu em `venc`. */
export function proximoDoCiclo(venc: string, ciclo: CicloMae): string {
  const [a, m, d] = venc.split('-').map(Number)
  const x = ciclo === 'anual' ? new Date(Date.UTC(a + 1, m - 1, d)) : new Date(Date.UTC(a, m, d))
  return x.toISOString().slice(0, 10)
}
export const hojeSP = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
