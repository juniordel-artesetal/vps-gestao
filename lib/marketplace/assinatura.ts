// Assinatura do add-on "Integração com Marketplaces" (R$ 19,90/mês via Asaas), escopo por
// workspaceId. Espelha o add-on PESSOAL (proven): mesmo customer/subscription/webhook, mesma
// idempotência. O acesso efetivo é o bool Workspace.moduloMarketplaces, dirigido por:
//   • pagamento confirmado → true (origem 'asaas')
//   • cancelamento/inativação → false (SÓ se origem != 'cortesia')
//   • cortesia (Master/testes) → true (origem 'cortesia'), sem Asaas, nunca cortada
// status da assinatura: ATIVA | PENDENTE | INADIMPLENTE | CANCELADA.
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { garantirColunaModuloMarketplaces } from '@/lib/marketplace/modulo'
import { limparCpf, cpfValido } from '@/lib/assinatura/cpf'

// PONTO ÚNICO do preço mensal do módulo.
export const MARKETPLACES_PRECO_MENSAL = 19.90

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function hojeISO() { return new Date().toISOString().slice(0, 10) }

// Marcador que identifica customer/subscription/cobrança do add-on no Asaas. O webhook da
// plataforma casa por este prefixo e ENCAMINHA para aplicarEventoMarketplaces (não vira
// cobrança/acesso da assinatura principal do SOA).
export const MARCA_MKT = 'MKT:'
export function externalRefMkt(workspaceId: string) { return MARCA_MKT + workspaceId }
export function ehExternalRefMkt(ref: string | null | undefined): boolean {
  return typeof ref === 'string' && ref.startsWith(MARCA_MKT)
}

let tabelaOk = false
export async function ensureMarketplaceAssinatura(): Promise<void> {
  if (tabelaOk) return
  await garantirColunaModuloMarketplaces()
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MarketplaceAssinatura" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "asaasCustomerId" text, "asaasSubscriptionId" text,
      "status" text NOT NULL DEFAULT 'PENDENTE',
      "origem" text NOT NULL DEFAULT 'asaas',
      "valor" numeric(12,2) NOT NULL DEFAULT 0,
      "proximoVencimento" date, "ativadaEm" timestamptz, "canceladaEm" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceAssinatura_ws_uidx" ON "MarketplaceAssinatura" ("workspaceId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceAssinatura_sub_idx" ON "MarketplaceAssinatura" ("asaasSubscriptionId")`)
  tabelaOk = true
}

export interface StatusAssinatura {
  ativo: boolean; origem: string | null; status: string | null
  valor: number; proximoVencimento: string | null; invoiceUrl?: string | null
}

/** Estado da assinatura/entitlement do workspace (sem segredos). */
export async function statusMarketplace(workspaceId: string): Promise<StatusAssinatura> {
  await ensureMarketplaceAssinatura()
  const [w] = await prisma.$queryRaw`
    SELECT (to_jsonb(w) ->> 'moduloMarketplaces')::boolean AS "on",
           (to_jsonb(w) ->> 'moduloMarketplacesOrigem') AS "origem"
    FROM "Workspace" w WHERE w."id" = ${workspaceId} LIMIT 1
  ` as { on: boolean | null; origem: string | null }[]
  const [a] = await prisma.$queryRaw`
    SELECT "status", "valor"::float AS valor, TO_CHAR("proximoVencimento",'YYYY-MM-DD') AS "proximoVencimento"
    FROM "MarketplaceAssinatura" WHERE "workspaceId" = ${workspaceId} LIMIT 1
  ` as { status: string; valor: number; proximoVencimento: string | null }[]
  return {
    ativo: !!w?.on,
    origem: w?.origem ?? null,
    status: a?.status ?? null,
    valor: a?.valor ?? MARKETPLACES_PRECO_MENSAL,
    proximoVencimento: a?.proximoVencimento ?? null,
  }
}

interface ClienteResp { id: string }
interface SubResp { id: string; nextDueDate?: string }
interface PagamentosResp { data?: { invoiceUrl?: string }[] }

/**
 * Ativa (ou reusa) a assinatura paga: cria/reusa customer + subscription no Asaas, grava
 * MarketplaceAssinatura=PENDENTE e devolve o link da fatura (Pix/boleto/cartão hospedado).
 * NÃO libera o módulo aqui — só o webhook de pagamento confirmado libera. Idempotente.
 */
export async function ativarAssinaturaMarketplaces(
  workspaceId: string, dados: { nome: string; email: string | null; cpf: string },
): Promise<{ ok: boolean; erro?: string; status?: string; invoiceUrl?: string | null; jaAtiva?: boolean }> {
  await ensureMarketplaceAssinatura()

  const cpf = limparCpf(dados.cpf)
  if (!cpfValido(cpf)) return { ok: false, erro: 'CPF inválido.' }

  const atual = await statusMarketplace(workspaceId)
  if (atual.ativo && atual.origem === 'cortesia') return { ok: true, jaAtiva: true, status: 'CORTESIA' }

  const [row] = await prisma.$queryRaw`
    SELECT "asaasCustomerId", "asaasSubscriptionId", "status" FROM "MarketplaceAssinatura" WHERE "workspaceId" = ${workspaceId} LIMIT 1
  ` as { asaasCustomerId: string | null; asaasSubscriptionId: string | null; status: string }[]
  if (row?.status === 'ATIVA') return { ok: true, jaAtiva: true, status: 'ATIVA' }

  // 1) Customer — reusa ou cria.
  let customerId = row?.asaasCustomerId || null
  if (!customerId) {
    const r = await chamarAsaas<ClienteResp>('/customers', {
      metodo: 'POST',
      corpo: { name: dados.nome || 'Assinante SOA', cpfCnpj: cpf, email: dados.email || undefined, externalReference: externalRefMkt(workspaceId) },
    })
    if (!r.ok || !r.dados?.id) return { ok: false, erro: r.erro || 'Falha ao criar cliente no Asaas.' }
    customerId = r.dados.id
  }

  // 2) Subscription — reusa ou cria. billingType UNDEFINED = cliente escolhe Pix/cartão na fatura.
  let subscriptionId = row?.asaasSubscriptionId || null
  let nextDueDate: string | null = atual.proximoVencimento || null
  if (!subscriptionId) {
    const r = await chamarAsaas<SubResp>('/subscriptions', {
      metodo: 'POST',
      corpo: {
        customer: customerId, billingType: 'UNDEFINED', value: MARKETPLACES_PRECO_MENSAL,
        nextDueDate: hojeISO(), cycle: 'MONTHLY',
        description: 'SOA — Integração com Marketplaces (mensal)', externalReference: externalRefMkt(workspaceId),
      },
    })
    if (!r.ok || !r.dados?.id) return { ok: false, erro: r.erro || 'Falha ao criar assinatura no Asaas.' }
    subscriptionId = r.dados.id
    nextDueDate = r.dados.nextDueDate || hojeISO()
  }

  // 3) Grava/atualiza como PENDENTE (o webhook confirma → ATIVA + libera o módulo).
  await prisma.$executeRaw`
    INSERT INTO "MarketplaceAssinatura" ("id","workspaceId","asaasCustomerId","asaasSubscriptionId","status","origem","valor","proximoVencimento","createdAt","updatedAt")
    VALUES (${gerarId()}, ${workspaceId}, ${customerId}, ${subscriptionId}, 'PENDENTE', 'asaas', ${MARKETPLACES_PRECO_MENSAL}, ${nextDueDate}::date, NOW(), NOW())
    ON CONFLICT ("workspaceId") DO UPDATE SET
      "asaasCustomerId" = COALESCE("MarketplaceAssinatura"."asaasCustomerId", EXCLUDED."asaasCustomerId"),
      "asaasSubscriptionId" = COALESCE("MarketplaceAssinatura"."asaasSubscriptionId", EXCLUDED."asaasSubscriptionId"),
      "status" = CASE WHEN "MarketplaceAssinatura"."status" = 'CANCELADA' THEN 'PENDENTE' ELSE "MarketplaceAssinatura"."status" END,
      "valor" = EXCLUDED."valor",
      "proximoVencimento" = COALESCE("MarketplaceAssinatura"."proximoVencimento", EXCLUDED."proximoVencimento"),
      "updatedAt" = NOW()
  `

  // 4) Link da fatura (a 1ª cobrança nasce async no Asaas — tenta algumas vezes).
  let invoiceUrl: string | null = null
  for (let i = 0; i < 3 && !invoiceUrl; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 800))
    const pg = await chamarAsaas<PagamentosResp>(`/subscriptions/${subscriptionId}/payments?limit=1`)
    if (pg.ok) invoiceUrl = pg.dados?.data?.[0]?.invoiceUrl ?? null
  }

  return { ok: true, status: 'PENDENTE', invoiceUrl }
}

/** Liga/desliga o entitlement do workspace (fonte do gate). `origem` marca cortesia × asaas. */
async function definirEntitlement(workspaceId: string, on: boolean, origem: 'asaas' | 'cortesia' | null): Promise<void> {
  await garantirColunaModuloMarketplaces()
  await prisma.$executeRaw`
    UPDATE "Workspace"
    SET "moduloMarketplaces" = ${on},
        "moduloMarketplacesOrigem" = ${on ? origem : null},
        "updatedAt" = NOW()
    WHERE "id" = ${workspaceId}
  `
}

/** CORTESIA (Master/testes): libera sem Asaas, marcado, idempotente. `on=false` remove a cortesia. */
export async function definirCortesiaMarketplaces(workspaceId: string, on: boolean): Promise<void> {
  await ensureMarketplaceAssinatura()
  await definirEntitlement(workspaceId, on, on ? 'cortesia' : null)
}

/** Aplica um evento de webhook do Asaas na assinatura do módulo (por subscriptionId). Idempotente.
 *  Retorna se casou com alguma assinatura de marketplaces. */
export async function aplicarEventoMarketplaces(evento: string, subscriptionId: string | null, dueDate: string | null): Promise<boolean> {
  if (!subscriptionId) return false
  await ensureMarketplaceAssinatura()
  const [a] = await prisma.$queryRaw`
    SELECT "workspaceId", "origem" FROM "MarketplaceAssinatura" WHERE "asaasSubscriptionId" = ${subscriptionId} LIMIT 1
  ` as { workspaceId: string; origem: string }[]
  if (!a) return false // não é assinatura de marketplaces

  if (evento === 'PAYMENT_RECEIVED' || evento === 'PAYMENT_CONFIRMED') {
    await prisma.$executeRaw`
      UPDATE "MarketplaceAssinatura"
      SET "status" = 'ATIVA', "ativadaEm" = COALESCE("ativadaEm", NOW()),
          "proximoVencimento" = COALESCE(${dueDate}::date, "proximoVencimento"), "canceladaEm" = NULL, "updatedAt" = NOW()
      WHERE "asaasSubscriptionId" = ${subscriptionId}
    `
    await definirEntitlement(a.workspaceId, true, 'asaas') // libera o módulo
  } else if (evento === 'PAYMENT_OVERDUE') {
    // Inadimplente: marca, mas NÃO corta na hora (carência / não cortar por engano). O Asaas
    // eventualmente INATIVA/DELETA a subscription se não pagar → aí sim corta (abaixo).
    await prisma.$executeRaw`
      UPDATE "MarketplaceAssinatura" SET "status" = 'INADIMPLENTE',
        "proximoVencimento" = COALESCE(${dueDate}::date, "proximoVencimento"), "updatedAt" = NOW()
      WHERE "asaasSubscriptionId" = ${subscriptionId} AND "status" <> 'CANCELADA'
    `
  } else if (evento === 'SUBSCRIPTION_DELETED' || evento === 'SUBSCRIPTION_INACTIVATED') {
    await prisma.$executeRaw`
      UPDATE "MarketplaceAssinatura" SET "status" = 'CANCELADA', "canceladaEm" = COALESCE("canceladaEm", NOW()), "updatedAt" = NOW()
      WHERE "asaasSubscriptionId" = ${subscriptionId} AND "status" <> 'CANCELADA'
    `
    // Corta o acesso — MAS nunca uma cortesia (proteção da régua "não cortar cortesia").
    if (a.origem !== 'cortesia') await definirEntitlement(a.workspaceId, false, null)
  } else {
    return false
  }
  return true
}
