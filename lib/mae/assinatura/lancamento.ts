// Método Mãe — LANÇAMENTO (16/10/2026, 20h de Brasília). Regra ÚNICA de data, pura (sem banco, sem Node: o middleware
// também usa). A venda abre sozinha no horário — as envs (MAE_VENDA_ATIVO + os 4 preços) já podem estar ligadas antes:
// até o horário, tudo continua "em breve". MAE_LANCAMENTO_EM (ISO) troca o horário sem mexer no código (ex.: testar
// em localhost com uma data no passado).
//   • pop-up de incentivo: 1× por dia, do lançamento até 26/10/2026 23:59 (Brasília);
//   • e-mail do lançamento: 1× por conta, disparado pelo cron às 20h de 16/10.

type Env = Record<string, string | undefined>
/** 16/10/2026 20:00 em Brasília (UTC−3). */
export const LANCAMENTO_MAE_PADRAO = '2026-10-16T23:00:00.000Z'
/** Último instante do pop-up: 26/10/2026 23:59:59 em Brasília. */
export const FIM_POPUP_MAE = '2026-10-27T02:59:59.999Z'
/** O e-mail do lançamento só sai até este instante (o cron é anual: em 2027 ele não pode disparar de novo). */
export const FIM_EMAIL_LANCAMENTO_MAE = '2026-10-18T03:00:00.000Z'

export function inicioLancamentoMae(env: Env = process.env): Date {
  const d = new Date(String(env.MAE_LANCAMENTO_EM ?? '').trim() || LANCAMENTO_MAE_PADRAO)
  return Number.isNaN(d.getTime()) ? new Date(LANCAMENTO_MAE_PADRAO) : d
}
/** Já passou do horário do lançamento? */
export const lancamentoMaeChegou = (agora: Date = new Date(), env: Env = process.env) => agora.getTime() >= inicioLancamentoMae(env).getTime()
/** Janela do pop-up de incentivo (do lançamento até 26/10 23:59). */
export const janelaPopupMae = (agora: Date = new Date(), env: Env = process.env) => lancamentoMaeChegou(agora, env) && agora.getTime() <= new Date(FIM_POPUP_MAE).getTime()
/** Janela do e-mail do lançamento (do horário até o fim do dia seguinte — dá margem a um reenvio manual). */
export const janelaEmailLancamentoMae = (agora: Date = new Date(), env: Env = process.env) => lancamentoMaeChegou(agora, env) && agora.getTime() < new Date(FIM_EMAIL_LANCAMENTO_MAE).getTime()
