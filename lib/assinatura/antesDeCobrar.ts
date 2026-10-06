// Antes de abrir um checkout/Pix NOVO (reativar/regularizar): a conta está mesmo "em dia"? (chamado JPGP/Lane)
//
// O bug: as rotas barravam com "Sua assinatura já está ativa" todo status TRIAL — inclusive o TRIAL VENCIDO,
// que a tela de acesso trata como SEM acesso ("assinatura suspensa… Reativar"). Resultado: a cliente não
// entrava e não conseguia pagar. Aconteceu com a Lane (anual pago no cartão, pagamento órfão; o anual não é
// auto-cortado, então ela ficou em TRIAL vencido). Agora, com o TRIAL vencido:
//   · já existe cobrança PAGA da conta  → reativa pelo caminho testado (aplicarNoAcesso) e NÃO cobra de novo;
//   · existe assinatura ativa no cartão → não cria outra (evita cobrança dupla) e explica;
//   · não existe nada                   → deixa seguir para o checkout/Pix de regularização.
import { prisma } from '@/lib/prisma'
import { estadoDaAssinatura } from './index'
import { aplicarNoAcesso } from './acesso'

export type Decisao =
  | { seguir: true }
  | { seguir: false; status: number; mensagem: string; reativou?: boolean }

const JA_ATIVA = { seguir: false as const, status: 409, mensagem: 'Sua assinatura já está ativa.' }

export async function antesDeCobrarDeNovo(workspaceId: string, statusAtual: string): Promise<Decisao> {
  if (statusAtual === 'ATIVA') return JA_ATIVA
  if (statusAtual !== 'TRIAL') return { seguir: true }

  // TRIAL ainda valendo (teste + carência): ela está em dia — não gera cobrança nova.
  const estado = await estadoDaAssinatura(workspaceId)
  if (!estado || estado.temAcesso) return JA_ATIVA

  // TRIAL VENCIDO. 1) Pagamento já recebido e só não refletido no acesso? Reativa.
  const [paga] = await prisma.$queryRaw`
    SELECT c."paymentId", c."subscriptionId", c."status", c."valor"::float AS valor, c."valorLiquido"::float AS liq,
           TO_CHAR(c."vencimento", 'YYYY-MM-DD') AS venc
    FROM "AsaasCobranca" c
    JOIN "AsaasAssinatura" a ON a."subscriptionId" = c."subscriptionId" AND a."workspaceId" = ${workspaceId}
    WHERE c."status" IN ('RECEIVED', 'CONFIRMED')
    ORDER BY c."pagoEm" DESC NULLS LAST LIMIT 1
  ` as { paymentId: string; subscriptionId: string; status: string; valor: number | null; liq: number | null; venc: string | null }[]
  if (paga) {
    const r = await aplicarNoAcesso({
      subscriptionId: paga.subscriptionId, paymentId: paga.paymentId, status: paga.status,
      vencimento: paga.venc, valorLiquido: paga.liq, valorPago: paga.valor, temParcelamento: false,
    })
    if (r.tocou) return { seguir: false, status: 409, reativou: true, mensagem: 'Encontramos o seu pagamento e a sua assinatura foi reativada. Atualize a página.' }
  }

  // 2) Assinatura no cartão ainda ativa (cobrança em processamento): criar outra cobraria duas vezes.
  const [ativa] = await prisma.$queryRaw`
    SELECT 1 AS ok FROM "AsaasAssinatura"
    WHERE "workspaceId" = ${workspaceId} AND "status" IN ('ACTIVE', 'OVERDUE') LIMIT 1
  ` as { ok: number }[]
  if (ativa) {
    return { seguir: false, status: 409, mensagem: 'Sua assinatura no cartão já existe e a cobrança está sendo processada — não precisa cadastrar de novo. Se o acesso não voltar em algumas horas, fale com o suporte.' }
  }

  // 3) Nada pago e nenhuma assinatura viva: regularização normal.
  return { seguir: true }
}
