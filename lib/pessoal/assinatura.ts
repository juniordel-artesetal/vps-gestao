// Regras da assinatura do add-on PESSOAL (R$ 5,90/mês via Asaas), escopo por userId.
// status: ATIVA | PENDENTE | INADIMPLENTE | CANCELADA.
import { prisma } from '@/lib/prisma'
import { ensurePessoalTables } from './schema'
import { chamarAsaasPessoal } from './asaas'
import { limparCpf, cpfValido } from '@/lib/assinatura/cpf'

export const PESSOAL_VALOR = 5.90
// PONTO ÚNICO da carência de inadimplência (dias após o vencimento em que o acesso
// ainda vale antes de bloquear). Ajuste aqui e vale no gate inteiro.
export const CARENCIA_DIAS = 5

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function hojeISO() { return new Date().toISOString().slice(0, 10) }

export interface AssinaturaPessoal {
  status: string; valor: number; proximoVencimento: string | null
  asaasSubscriptionId: string | null; ativadaEm: string | null
}

/** Lê a assinatura do usuário (sem segredos). */
export async function lerAssinatura(userId: string): Promise<AssinaturaPessoal | null> {
  await ensurePessoalTables()
  const [a] = await prisma.$queryRaw`
    SELECT "status", "valor"::float AS "valor",
           TO_CHAR("proximoVencimento",'YYYY-MM-DD') AS "proximoVencimento",
           "asaasSubscriptionId",
           TO_CHAR("ativadaEm",'YYYY-MM-DD"T"HH24:MI:SSOF') AS "ativadaEm"
    FROM "PessoalAssinatura" WHERE "userId" = ${userId} LIMIT 1
  ` as AssinaturaPessoal[]
  return a || null
}

/** GATE: o usuário tem acesso ao módulo Pessoal? ATIVA sempre; INADIMPLENTE até a carência. */
export async function assinaturaAtiva(userId: string): Promise<boolean> {
  const a = await lerAssinatura(userId)
  if (!a) return false
  if (a.status === 'ATIVA') return true
  if (a.status === 'INADIMPLENTE' && a.proximoVencimento) {
    const limite = new Date(a.proximoVencimento + 'T23:59:59Z')
    limite.setDate(limite.getDate() + CARENCIA_DIAS)
    return new Date() <= limite
  }
  return false
}

/** Link da fatura mais recente de uma subscription (pix/boleto hospedado). null se ainda não há. */
export async function linkFatura(subscriptionId: string): Promise<string | null> {
  const pg = await chamarAsaasPessoal<{ data?: { invoiceUrl?: string }[] }>(`/subscriptions/${subscriptionId}/payments?limit=1`)
  return pg.ok ? (pg.dados?.data?.[0]?.invoiceUrl ?? null) : null
}

interface ClienteAsaasResp { id: string }
interface SubResp { id: string; nextDueDate?: string }
interface PagamentosResp { data?: { id: string; invoiceUrl?: string; status?: string }[] }

/**
 * Ativa (ou reusa) a assinatura: cria/reusa customer + subscription no Asaas, grava
 * PessoalAssinatura=PENDENTE e devolve o link da fatura (pix/boleto hospedado).
 * Idempotente: reusa customer/subscription já vinculados; não duplica.
 */
export async function ativarAssinatura(
  userId: string, dados: { nome: string; email: string | null; cpf: string },
): Promise<{ ok: boolean; erro?: string; status?: string; invoiceUrl?: string | null; jaAtiva?: boolean }> {
  await ensurePessoalTables()

  const cpf = limparCpf(dados.cpf)
  if (!cpfValido(cpf)) return { ok: false, erro: 'CPF inválido.' }

  const atual = await lerAssinatura(userId)
  if (atual?.status === 'ATIVA') return { ok: true, jaAtiva: true, status: 'ATIVA' }

  // Linha atual (para reusar ids do Asaas) — inclui os ids que lerAssinatura não traz.
  const [row] = await prisma.$queryRaw`
    SELECT "asaasCustomerId", "asaasSubscriptionId" FROM "PessoalAssinatura" WHERE "userId" = ${userId} LIMIT 1
  ` as { asaasCustomerId: string | null; asaasSubscriptionId: string | null }[]

  // 1) Customer — reusa ou cria.
  let customerId = row?.asaasCustomerId || null
  if (!customerId) {
    const r = await chamarAsaasPessoal<ClienteAsaasResp>('/customers', {
      metodo: 'POST',
      corpo: { name: dados.nome || 'Assinante SOA', cpfCnpj: cpf, email: dados.email || undefined, externalReference: userId },
    })
    if (!r.ok || !r.dados?.id) return { ok: false, erro: r.erro || 'Falha ao criar cliente no Asaas.' }
    customerId = r.dados.id
  }

  // 2) Subscription — reusa ou cria (billingType UNDEFINED = cliente escolhe pix/boleto na fatura).
  let subscriptionId = row?.asaasSubscriptionId || null
  let nextDueDate: string | null = atual?.proximoVencimento || null
  if (!subscriptionId) {
    const r = await chamarAsaasPessoal<SubResp>('/subscriptions', {
      metodo: 'POST',
      corpo: {
        customer: customerId, billingType: 'UNDEFINED', value: PESSOAL_VALOR,
        nextDueDate: hojeISO(), cycle: 'MONTHLY',
        description: 'SOA Pessoal — assinatura mensal', externalReference: userId,
      },
    })
    if (!r.ok || !r.dados?.id) return { ok: false, erro: r.erro || 'Falha ao criar assinatura no Asaas.' }
    subscriptionId = r.dados.id
    nextDueDate = r.dados.nextDueDate || hojeISO()
  }

  // 3) Grava/atualiza a assinatura local como PENDENTE (o webhook confirma → ATIVA).
  await prisma.$executeRaw`
    INSERT INTO "PessoalAssinatura" ("id","userId","asaasCustomerId","asaasSubscriptionId","status","valor","proximoVencimento","createdAt")
    VALUES (${gerarId()}, ${userId}, ${customerId}, ${subscriptionId}, 'PENDENTE', ${PESSOAL_VALOR}, ${nextDueDate}::date, NOW())
    ON CONFLICT ("userId") DO UPDATE SET
      "asaasCustomerId" = COALESCE("PessoalAssinatura"."asaasCustomerId", EXCLUDED."asaasCustomerId"),
      "asaasSubscriptionId" = COALESCE("PessoalAssinatura"."asaasSubscriptionId", EXCLUDED."asaasSubscriptionId"),
      "status" = CASE WHEN "PessoalAssinatura"."status" = 'CANCELADA' THEN 'PENDENTE' ELSE "PessoalAssinatura"."status" END,
      "valor" = EXCLUDED."valor",
      "proximoVencimento" = COALESCE("PessoalAssinatura"."proximoVencimento", EXCLUDED."proximoVencimento")
  `

  // 4) Link da fatura. A 1ª cobrança nasce DEPOIS da subscription (async no Asaas),
  //    então o invoiceUrl pode não existir no 1º fetch — tenta algumas vezes.
  let invoiceUrl: string | null = null
  for (let i = 0; i < 3 && !invoiceUrl; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 800))
    const pg = await chamarAsaasPessoal<PagamentosResp>(`/subscriptions/${subscriptionId}/payments?limit=1`)
    if (pg.ok) invoiceUrl = pg.dados?.data?.[0]?.invoiceUrl ?? null
  }

  return { ok: true, status: 'PENDENTE', invoiceUrl }
}

/** Aplica um evento de webhook do Asaas na assinatura do Pessoal (por subscriptionId).
 *  Idempotente. Retorna se casou com alguma assinatura do Pessoal. */
export async function aplicarEventoPessoal(evento: string, subscriptionId: string | null, dueDate: string | null): Promise<boolean> {
  if (!subscriptionId) return false
  await ensurePessoalTables()
  const [a] = await prisma.$queryRaw`SELECT "id" FROM "PessoalAssinatura" WHERE "asaasSubscriptionId" = ${subscriptionId} LIMIT 1` as { id: string }[]
  if (!a) return false // não é assinatura do Pessoal (provável da plataforma)

  if (evento === 'PAYMENT_RECEIVED' || evento === 'PAYMENT_CONFIRMED') {
    await prisma.$executeRaw`
      UPDATE "PessoalAssinatura"
      SET "status" = 'ATIVA',
          "ativadaEm" = COALESCE("ativadaEm", NOW()),
          "proximoVencimento" = COALESCE(${dueDate}::date, "proximoVencimento"),
          "canceladaEm" = NULL
      WHERE "asaasSubscriptionId" = ${subscriptionId}
    `
  } else if (evento === 'PAYMENT_OVERDUE') {
    await prisma.$executeRaw`
      UPDATE "PessoalAssinatura" SET "status" = 'INADIMPLENTE',
        "proximoVencimento" = COALESCE(${dueDate}::date, "proximoVencimento")
      WHERE "asaasSubscriptionId" = ${subscriptionId} AND "status" <> 'CANCELADA'
    `
  } else if (evento === 'SUBSCRIPTION_DELETED' || evento === 'SUBSCRIPTION_INACTIVATED') {
    await prisma.$executeRaw`
      UPDATE "PessoalAssinatura" SET "status" = 'CANCELADA', "canceladaEm" = COALESCE("canceladaEm", NOW())
      WHERE "asaasSubscriptionId" = ${subscriptionId} AND "status" <> 'CANCELADA'
    `
  } else {
    return false
  }
  return true
}
