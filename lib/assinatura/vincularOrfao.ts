// Vincula uma cobrança/subscription ÓRFÃ (criada fora do app, sem externalReference) ao
// workspace certo e ativa o acesso. Uso: ação do Master quando o webhook marcou um pagamento
// pago como órfão. Idempotente: reexecutar não duplica e não quebra.
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { getCredenciais } from '@/lib/pagamento/asaas/config'
import { parceiroDoWorkspace } from '@/lib/assinatura/parceiro'
import { aplicarNoAcesso } from '@/lib/assinatura/acesso'

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const PAGOS = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'])

export interface ResultadoVinculo {
  ok: boolean
  motivo: string
  workspaceId?: string
  criouAssinatura?: boolean
  ativou?: boolean
}

export async function vincularOrfao(workspaceId: string, subscriptionId: string): Promise<ResultadoVinculo> {
  const sub = String(subscriptionId || '').trim()
  const ws = String(workspaceId || '').trim()
  if (!sub || !ws) return { ok: false, motivo: 'informe subscriptionId e workspaceId' }

  const [w] = await prisma.$queryRaw`SELECT "assinaturaOrigem" FROM "Workspace" WHERE "id" = ${ws} LIMIT 1` as { assinaturaOrigem: string | null }[]
  if (!w) return { ok: false, motivo: 'workspace não encontrado' }
  if (w.assinaturaOrigem !== 'asaas') return { ok: false, motivo: `origem '${w.assinaturaOrigem}' — fora da máquina Asaas` }

  // Já existe AsaasAssinatura pra essa subscription?
  const [ex] = await prisma.$queryRaw`SELECT "workspaceId" FROM "AsaasAssinatura" WHERE "subscriptionId" = ${sub} LIMIT 1` as { workspaceId: string }[]
  let criouAssinatura = false
  if (ex) {
    if (ex.workspaceId !== ws) return { ok: false, motivo: `subscription já vinculada a OUTRO workspace (${ex.workspaceId})` }
  } else {
    // Ciclo/valor/customer reais da subscription (fonte: Asaas).
    const info = await chamarAsaas<{ customer?: string; cycle?: string; value?: number; nextDueDate?: string }>(`/subscriptions/${sub}`, { exigirAtivo: false })
    const d = info.dados
    const { sandbox } = await getCredenciais()
    const parceiro = await parceiroDoWorkspace(ws)
    await prisma.$executeRaw`
      INSERT INTO "AsaasAssinatura" ("id","workspaceId","subscriptionId","customerId","sandbox","ciclo","valor",
                                     "status","proximoVencimento","parceiroId","createdAt","updatedAt")
      VALUES (${gid()}, ${ws}, ${sub}, ${d?.customer ?? null}, ${sandbox},
              ${d?.cycle ?? 'MONTHLY'}, ${d?.value ?? 0}, 'ACTIVE',
              ${d?.nextDueDate ?? null}::date, ${parceiro?.id ?? null}, NOW(), NOW())
      ON CONFLICT ("subscriptionId") DO NOTHING
    `
    criouAssinatura = true
  }

  // Ativa a partir da cobrança PAGA mais recente dessa subscription (reusa o caminho testado).
  const [cob] = await prisma.$queryRaw`
    SELECT "paymentId", "status", "valor"::float AS valor, "valorLiquido"::float AS liq,
           TO_CHAR("vencimento",'YYYY-MM-DD') AS venc
    FROM "AsaasCobranca"
    WHERE "subscriptionId" = ${sub} AND "status" = ANY(${[...PAGOS]}::text[])
    ORDER BY "pagoEm" DESC NULLS LAST LIMIT 1
  ` as { paymentId: string; status: string; valor: number | null; liq: number | null; venc: string | null }[]

  if (!cob) return { ok: true, motivo: 'vínculo criado, mas não há cobrança PAGA para ativar', workspaceId: ws, criouAssinatura, ativou: false }

  const r = await aplicarNoAcesso({
    subscriptionId: sub, paymentId: cob.paymentId, status: cob.status,
    vencimento: cob.venc, valorLiquido: cob.liq ?? null, valorPago: cob.valor ?? null, temParcelamento: false,
  })
  return { ok: true, motivo: r.tocou ? 'vinculado e ativado' : `vinculado; acesso não tocou (${r.motivo})`, workspaceId: ws, criouAssinatura, ativou: r.tocou }
}
