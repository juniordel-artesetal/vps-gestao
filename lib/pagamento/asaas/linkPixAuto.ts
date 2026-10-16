// PIX AUTOMÁTICO pelo LINK DE PAGAMENTO do Asaas (16/10/2026). A API de autorizações (/pix/automatic/authorizations)
// responde 403 na nossa conta ("fale com o gerente"), mas o LINK de pagamento com billingType PIX + chargeType RECURRENT
// + subscriptionCycle MONTHLY é aceito em produção: a cliente abre o link, paga o 1º Pix e autoriza no app do banco; as
// próximas mensalidades são debitadas sozinhas. Vale para o SOA mensal e o Método Mãe mensal.
// Casamento no webhook: o `externalReference` do link (conferido em produção: o Asaas guarda) e o id do link, que vem
// no `paymentLink` de cada cobrança — guardamos os dois. O link expira em 2 dias (cada clique gera um novo).
// Desligar: PIX_AUTO=off.
import { chamarAsaas } from './client'

export const pixAutoLigado = (env: Record<string, string | undefined> = process.env) => (env.PIX_AUTO ?? '').trim().toLowerCase() !== 'off'
/** Link de pagamento do Asaas ("…/c/<id>") — diferente do checkout hospedado ("…/checkoutSession/…"). */
export const ehLinkDePagamento = (url: string | null | undefined) => !!url && /\/c\/[A-Za-z0-9]+\/?$/.test(url)

const daquiA = (dias: number) => { const d = new Date(Date.now() - 3 * 3600_000); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10) }

export async function criarLinkPixAuto(p: { nome: string; descricao: string; valor: number; externalReference: string; sucesso: string }):
  Promise<{ ok: true; id: string; url: string } | { ok: false; erro: string }> {
  const r = await chamarAsaas<{ id?: string; url?: string }>('/paymentLinks', {
    metodo: 'POST',
    corpo: {
      name: p.nome.slice(0, 30), description: p.descricao.slice(0, 150), value: p.valor,
      billingType: 'PIX', chargeType: 'RECURRENT', subscriptionCycle: 'MONTHLY',
      dueDateLimitDays: 1, endDate: daquiA(2), notificationEnabled: false,
      externalReference: p.externalReference,
      callback: { successUrl: p.sucesso, autoRedirect: true },
    },
  })
  if (!r.ok || !r.dados?.id || !r.dados?.url) return { ok: false, erro: r.erro || 'Não consegui abrir o Pix Automático.' }
  return { ok: true, id: r.dados.id, url: r.dados.url }
}

/** Desativa um link antigo (a cada clique nasce um novo — o velho não pode mais ser pago). Nunca lança. */
export async function apagarLinkPixAuto(id: string | null | undefined): Promise<void> {
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) return
  await chamarAsaas(`/paymentLinks/${id}`, { metodo: 'DELETE' }).catch(() => {})
}
