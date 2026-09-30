// VALIDAÇÃO DO CARTÃO no início do teste grátis — prova que o cartão é de verdade.
//
// O cartão continua sendo digitado SÓ na página do Asaas (checkout hospedado): o número
// nunca passa pelo SOA. Quando o checkout conclui, o Asaas já guardou o cartão na
// assinatura e nos devolve só o TOKEN (`creditCard.creditCardToken`). Com ele:
//
//   1. PRÉ-AUTORIZAÇÃO de R$ 5,00 (`authorizeOnly`) — o banco reserva o valor, NÃO cobra.
//      R$ 5 porque é o MÍNIMO do Asaas para cartão (R$ 1 é recusado — provado no sandbox).
//   2. Aprovou → LIBERA a reserva na hora (POST /payments/{id}/refund numa pré-autorização
//      só cancela a reserva) e o teste começa.
//   3. Recusou → o teste NÃO começa, a assinatura desse cartão é apagada no Asaas (não
//      cobraria nada no fim) e a tela pede outro cartão.
//
// Idempotente por checkoutId (o webhook pode chegar repetido): uma linha em
// "CartaoValidacao" por checkout; quem já tem desfecho não pré-autoriza de novo.
// Auditoria sem PII sensível: status, datas, bandeira e os 4 últimos dígitos.
// Falha do ASAAS (rede/instabilidade, sem resposta do banco) NÃO pune a artesã: libera o
// teste e fica registrado como ERRO/SEM_TOKEN para a equipe olhar.
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'

/** Valor da pré-autorização. Mínimo do Asaas para cartão de crédito. */
export const VALOR_VALIDACAO = 5

/** Prefixo do externalReference da pré-autorização — o webhook ignora (não é cobrança do plano). */
export const PREFIXO_VALIDACAO = 'VALCARD:'
export const ehExternalRefValidacao = (ref: unknown): boolean =>
  typeof ref === 'string' && ref.startsWith(PREFIXO_VALIDACAO)

export type StatusValidacao = 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'SEM_TOKEN' | 'ERRO'

export interface ResultadoValidacao {
  /** true = o teste pode começar (aprovado, ou falha nossa/do Asaas que não é culpa dela). */
  libera: boolean
  status: StatusValidacao
  mensagem?: string
}

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const hojeSP = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)
const espera = (ms: number) => new Promise(r => setTimeout(r, ms))

let tabelaOk = false
async function ensureTabela() {
  if (tabelaOk) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CartaoValidacao" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "checkoutId" text NOT NULL UNIQUE,
      "subscriptionId" text,
      "paymentId" text,
      "status" text NOT NULL DEFAULT 'PENDENTE',
      "valor" numeric(12,2) NOT NULL DEFAULT 0,
      "bandeira" text,
      "final" text,
      "mensagem" text,
      "liberadoEm" timestamptz,
      "tentativasLiberar" int NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CartaoValidacao_ws_idx" ON "CartaoValidacao" ("workspaceId","createdAt")`)
  tabelaOk = true
}

interface Linha { id: string; status: StatusValidacao; paymentId: string | null; subscriptionId: string | null; mensagem: string | null }

async function gravar(checkoutId: string, campos: Partial<{ status: StatusValidacao; paymentId: string; subscriptionId: string; valor: number; bandeira: string | null; final: string | null; mensagem: string | null; liberado: boolean }>) {
  await prisma.$executeRaw`
    UPDATE "CartaoValidacao" SET
      "status" = COALESCE(${campos.status ?? null}, "status"),
      "paymentId" = COALESCE(${campos.paymentId ?? null}, "paymentId"),
      "subscriptionId" = COALESCE(${campos.subscriptionId ?? null}, "subscriptionId"),
      "valor" = COALESCE(${campos.valor ?? null}::numeric, "valor"),
      "bandeira" = COALESCE(${campos.bandeira ?? null}, "bandeira"),
      "final" = COALESCE(${campos.final ?? null}, "final"),
      "mensagem" = COALESCE(${campos.mensagem?.slice(0, 300) ?? null}, "mensagem"),
      "liberadoEm" = CASE WHEN ${campos.liberado ?? false}::boolean THEN COALESCE("liberadoEm", NOW()) ELSE "liberadoEm" END,
      "updatedAt" = NOW()
    WHERE "checkoutId" = ${checkoutId}
  `
}

interface SubAsaas {
  id: string; customer: string; status?: string; billingType?: string; dateCreated?: string
  checkoutSession?: string | null
  creditCard?: { creditCardToken?: string; creditCardBrand?: string; creditCardNumber?: string } | null
}

/** A assinatura que o checkout criou (casada pelo checkoutSession; senão a de cartão mais recente). */
async function assinaturaDoCheckout(workspaceId: string, checkoutId: string): Promise<SubAsaas | null> {
  const r = await chamarAsaas<{ data?: SubAsaas[] }>(`/subscriptions?externalReference=${encodeURIComponent(workspaceId)}&status=ACTIVE&limit=20`)
  const lista = (r.dados?.data || []).filter(s => s.billingType === 'CREDIT_CARD')
  const casada = lista.find(s => s.checkoutSession === checkoutId)
  if (casada) return casada
  return lista.sort((a, b) => String(b.dateCreated || '').localeCompare(String(a.dateCreated || '')))[0] ?? null
}

/** Libera a reserva da pré-autorização. Idempotente: se já está REFUNDED, só marca. */
export async function liberarReserva(checkoutId: string, paymentId: string): Promise<boolean> {
  const r = await chamarAsaas<{ status?: string }>(`/payments/${paymentId}/refund`, { metodo: 'POST', corpo: {} })
  let ok = r.ok
  if (!ok) {
    const g = await chamarAsaas<{ status?: string }>(`/payments/${paymentId}`)
    ok = g.ok && ['REFUNDED', 'REFUND_REQUESTED', 'DELETED'].includes(String(g.dados?.status))
  }
  await prisma.$executeRaw`
    UPDATE "CartaoValidacao" SET "tentativasLiberar" = "tentativasLiberar" + 1,
      "liberadoEm" = CASE WHEN ${ok}::boolean THEN COALESCE("liberadoEm", NOW()) ELSE "liberadoEm" END, "updatedAt" = NOW()
    WHERE "checkoutId" = ${checkoutId}
  `
  if (!ok) console.error(`[VALCARD] reserva NÃO liberada ck=${checkoutId} pay=${paymentId}: ${r.erro} (o job tenta de novo)`)
  return ok
}

/**
 * Valida o cartão cadastrado no checkout `checkoutId` da workspace. Chamado pelo
 * concluirCheckout (webhook CHECKOUT_PAID) ANTES de o teste começar.
 */
export async function validarCartaoDoCheckout(workspaceId: string, checkoutId: string): Promise<ResultadoValidacao> {
  await ensureTabela()
  await prisma.$executeRaw`
    INSERT INTO "CartaoValidacao" ("id","workspaceId","checkoutId","status","createdAt","updatedAt")
    VALUES (${gid()}, ${workspaceId}, ${checkoutId}, 'PENDENTE', NOW(), NOW())
    ON CONFLICT ("checkoutId") DO NOTHING
  `
  const [lin] = await prisma.$queryRaw`
    SELECT "id","status","paymentId","subscriptionId","mensagem" FROM "CartaoValidacao" WHERE "checkoutId" = ${checkoutId}
  ` as Linha[]
  // Já tem desfecho (webhook repetido): devolve o mesmo, sem nova pré-autorização.
  if (lin && lin.status !== 'PENDENTE') {
    return { libera: lin.status !== 'RECUSADO', status: lin.status, mensagem: lin.mensagem ?? undefined }
  }

  // 1) A assinatura que o checkout criou e o TOKEN do cartão (pode levar um instante a aparecer).
  let sub: SubAsaas | null = null
  for (let i = 0; i < 3 && !sub?.creditCard?.creditCardToken; i++) {
    if (i) await espera(1500)
    sub = await assinaturaDoCheckout(workspaceId, checkoutId)
  }
  const token = sub?.creditCard?.creditCardToken
  if (!sub || !token) {
    await gravar(checkoutId, { status: 'SEM_TOKEN', subscriptionId: sub?.id, mensagem: 'Asaas não devolveu o token do cartão — teste liberado sem validação.' })
    console.error(`[VALCARD] sem token ws=${workspaceId} ck=${checkoutId} sub=${sub?.id ?? '-'} — liberado sem validar`)
    return { libera: true, status: 'SEM_TOKEN' }
  }
  const bandeira = sub.creditCard?.creditCardBrand ?? null, final = sub.creditCard?.creditCardNumber ?? null
  await gravar(checkoutId, { subscriptionId: sub.id, bandeira, final, valor: VALOR_VALIDACAO })

  // 2) Pré-autorização (reaproveita a de uma tentativa anterior interrompida).
  let paymentId = lin?.paymentId ?? null, status = ''
  if (paymentId) {
    const g = await chamarAsaas<{ status?: string }>(`/payments/${paymentId}`)
    status = String(g.dados?.status ?? '')
  } else {
    const pa = await chamarAsaas<{ id?: string; status?: string }>('/payments', {
      metodo: 'POST',
      corpo: {
        customer: sub.customer, billingType: 'CREDIT_CARD', value: VALOR_VALIDACAO, dueDate: hojeSP(),
        authorizeOnly: true, creditCardToken: token,
        externalReference: `${PREFIXO_VALIDACAO}${workspaceId}`,
        description: 'SOA — validação do cartão (pré-autorização liberada na hora, não é cobrança)',
      },
    })
    if (!pa.ok || !pa.dados?.id) {
      // 4xx = o banco/Asaas recusou o cartão. Rede/instabilidade (pendente ou 5xx) = não é culpa dela.
      const recusado = !pa.pendente && (pa.status ?? 0) >= 400 && (pa.status ?? 0) < 500
      if (!recusado) {
        await gravar(checkoutId, { status: 'ERRO', mensagem: pa.erro ?? 'falha ao pré-autorizar' })
        console.error(`[VALCARD] erro do Asaas ws=${workspaceId} ck=${checkoutId}: ${pa.erro} — liberado sem validar`)
        return { libera: true, status: 'ERRO' }
      }
      return recusar(workspaceId, checkoutId, sub.id, pa.erro)
    }
    paymentId = pa.dados.id; status = String(pa.dados.status ?? '')
    await gravar(checkoutId, { paymentId })
  }

  // 3) Desfecho: AUTHORIZED (ou CONFIRMED, se a conta capturar direto) = cartão bom → libera a reserva.
  if (['AUTHORIZED', 'CONFIRMED', 'RECEIVED', 'REFUNDED', 'REFUND_REQUESTED'].includes(status)) {
    await gravar(checkoutId, { status: 'APROVADO', mensagem: null })
    if (!['REFUNDED', 'REFUND_REQUESTED'].includes(status)) await liberarReserva(checkoutId, paymentId)
    else await gravar(checkoutId, { liberado: true })
    console.log(`[VALCARD] aprovado ws=${workspaceId} ck=${checkoutId} ${bandeira ?? ''} final ${final ?? '?'}`)
    return { libera: true, status: 'APROVADO' }
  }
  return recusar(workspaceId, checkoutId, sub.id, `pré-autorização ${status || 'sem status'}`)
}

async function recusar(workspaceId: string, checkoutId: string, subscriptionId: string, motivo?: string): Promise<ResultadoValidacao> {
  const mensagem = 'Seu cartão não foi aprovado pelo banco. Confira os dados ou use outro cartão de crédito.'
  await gravar(checkoutId, { status: 'RECUSADO', mensagem: `${mensagem} (${(motivo ?? '').slice(0, 150)})` })
  // A assinatura desse cartão não pode ficar viva: apaga no Asaas (nada será cobrado dele).
  const d = await chamarAsaas(`/subscriptions/${subscriptionId}`, { metodo: 'DELETE' })
  if (!d.ok) console.error(`[VALCARD] recusado mas a assinatura ${subscriptionId} não foi apagada: ${d.erro}`)
  console.log(`[VALCARD] recusado ws=${workspaceId} ck=${checkoutId}: ${motivo}`)
  return { libera: false, status: 'RECUSADO', mensagem }
}

/** Última validação da workspace (para a tela: "validando…" / "cartão recusado"). */
export async function ultimaValidacao(workspaceId: string): Promise<{ status: StatusValidacao; mensagem: string | null; createdAt: Date } | null> {
  try {
    await ensureTabela()
    const [v] = await prisma.$queryRaw`
      SELECT "status", "mensagem", "createdAt" FROM "CartaoValidacao"
      WHERE "workspaceId" = ${workspaceId} ORDER BY "createdAt" DESC LIMIT 1
    ` as { status: StatusValidacao; mensagem: string | null; createdAt: Date }[]
    if (!v) return null
    // a mensagem mostrada à artesã é só a frase amigável (sem o motivo técnico entre parênteses)
    return { ...v, mensagem: v.mensagem ? v.mensagem.replace(/\s*\(.*\)$/, '') : null }
  } catch { return null }
}

/** Job: tenta de novo liberar reservas de validações aprovadas que ficaram presas. */
export async function liberarReservasPendentes(): Promise<{ tentadas: number; liberadas: number }> {
  await ensureTabela()
  const pend = await prisma.$queryRaw`
    SELECT "checkoutId", "paymentId" FROM "CartaoValidacao"
    WHERE "status" = 'APROVADO' AND "liberadoEm" IS NULL AND "paymentId" IS NOT NULL AND "tentativasLiberar" < 20
    ORDER BY "createdAt" LIMIT 20
  ` as { checkoutId: string; paymentId: string }[]
  let liberadas = 0
  for (const p of pend) if (await liberarReserva(p.checkoutId, p.paymentId)) liberadas++
  return { tentadas: pend.length, liberadas }
}

/**
 * Assinaturas de CARTÃO vivas no Asaas para a workspace (externalReference = workspaceId).
 * Usado pelo cancelamento no teste: a assinatura do checkout só vira AsaasAssinatura no 1º
 * pagamento — sem isto, cancelar no teste deixava a cobrança do fim do teste viva no Asaas.
 */
export async function assinaturasVivasNoAsaas(workspaceId: string): Promise<{ ok: boolean; ids: string[]; erro?: string }> {
  const r = await chamarAsaas<{ data?: SubAsaas[] }>(`/subscriptions?externalReference=${encodeURIComponent(workspaceId)}&status=ACTIVE&limit=20`)
  if (!r.ok) return { ok: false, ids: [], erro: r.erro }
  return { ok: true, ids: (r.dados?.data || []).map(s => s.id) }
}
