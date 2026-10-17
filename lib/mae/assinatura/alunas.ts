// PLANO ALUNAS VPS · MÉTODO MÃE (16/10/2026, pedido do Júnior). Puro (sem banco, testável).
//  • Só o Método Mãe por R$ 49,90/mês (o "só o MAE" normal é R$ 59,90). Anual com o MESMO desconto proporcional do anual
//    do "só o MAE" (R$ 503 × 12 × R$ 59,90 ≈ 30%): R$ 419 à vista (Pix ou cartão) ou até 12× com juros (tabela Price).
//  • Link com VALIDADE: até 31/10/2026 23h59 (Brasília) — depois disso a página mostra "encerrado" e o servidor recusa.
//  • Qualquer aluna, inclusive quem já assina o SOA (o MAE soma à conta dela pelo preço das alunas).
//  • UMA compra por conta: quem já pagou pelo Plano Alunas não compra de novo por ele (marca em "AssinaturaAviso").
// Preços e prazo trocáveis por env: MAE_ALUNAS_MENSAL, MAE_ALUNAS_ANUAL, MAE_ALUNAS_ATE (ISO).
import type { PrecosMae, CicloMae } from './precos'

type Env = Record<string, string | undefined>
const num = (v: string | undefined, padrao: number) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n >= 5 ? Math.round(n * 100) / 100 : padrao }

export const OFERTA_ALUNAS = 'alunas' as const
export type OfertaMae = typeof OFERTA_ALUNAS
/** Prazo padrão: 31/10/2026 23h59m59s de Brasília. */
export const ATE_ALUNAS_PADRAO = '2026-11-01T02:59:59Z'

export const precoAlunas = (env: Env = process.env) => ({ mensal: num(env.MAE_ALUNAS_MENSAL, 49.9), anual: num(env.MAE_ALUNAS_ANUAL, 419) })
export function fimAlunas(env: Env = process.env): Date {
  const d = new Date(env.MAE_ALUNAS_ATE ?? ATE_ALUNAS_PADRAO)
  return Number.isNaN(d.getTime()) ? new Date(ATE_ALUNAS_PADRAO) : d
}
export const alunasAberta = (agora: Date = new Date(), env: Env = process.env) => agora.getTime() <= fimAlunas(env).getTime()

/** Os preços do MAE com o Plano Alunas no lugar (vale para quem assina o SOA e para quem não assina). */
export function precosAlunas(env: Env = process.env): PrecosMae {
  const a = precoAlunas(env)
  return { addon: { ...a }, standalone: { ...a } }
}

/** Nome do item no Asaas (≤ 30 caracteres). */
export const nomeDoItemAlunas = (ciclo: CicloMae) => `MAE Plano Alunas · ${ciclo}`.slice(0, 30)
const brlTxt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ')
/** Descrição no Asaas (≤ 150 caracteres). */
export function descricaoDoItemAlunas(ciclo: CicloMae, c: { parcelas: number; valorParcela: number; total: number }): string {
  const preco = ciclo === 'mensal' ? `${brlTxt(c.total)}/mês. Cancele quando quiser.`
    : c.parcelas > 1 ? `1 ano em ${c.parcelas}x de ${brlTxt(c.valorParcela)} (total ${brlTxt(c.total)} c/ juros). Escolha ${c.parcelas}x no parcelamento.`
      : `1 ano por ${brlTxt(c.total)} à vista, no Pix ou no cartão.`
  return `Método Mãe · Plano Alunas VPS: ${preco}`.slice(0, 150)
}

/** Marcas em "AssinaturaAviso": o checkout aberto pelo Plano Alunas e a compra paga (uma por conta). */
export const marcaCheckoutAlunas = (checkoutId: string) => `MAE_ALUNAS_CK:${checkoutId}`
export const MARCA_COMPRA_ALUNAS = 'MAE_ALUNAS_COMPRA'
export const DIA_MARCA_ALUNAS = '2026-10-16'
