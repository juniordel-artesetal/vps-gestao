// Assinatura do módulo pago "SOA Edition" (R$ 29,90/mês via Asaas), escopo por workspaceId.
// ESPELHA o add-on de Marketplaces (lib/marketplace/assinatura): mesmo customer/subscription/
// webhook, mesma idempotência. O acesso efetivo é o bool Workspace.moduloEstudio, dirigido por:
//   • pagamento confirmado → true (origem 'asaas')
//   • cobrança vencida (OVERDUE) ou assinatura encerrada no Asaas → false (SÓ se origem != 'cortesia')
//   • cortesia (Master/testes) → true (origem 'cortesia'), sem Asaas, nunca cortada
// Bloquear NUNCA apaga dados: moldes, templates, designs e créditos ficam; voltam ao pagar.
// status da assinatura: ATIVA | PENDENTE | INADIMPLENTE | CANCELADA.
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { limparCpf, cpfValido } from '@/lib/assinatura/cpf'
import { garantirColunaModuloEstudio } from './modulo'
import { customerExistente } from './compra'

/** Preço mensal do módulo (ESTUDIO_MODULO_PRECO). Sem valor → venda desligada ("em breve"). */
export function precoModulo(): number | null {
  const raw = (process.env.ESTUDIO_MODULO_PRECO || '').trim().replace(',', '.')
  const v = Number(raw)
  return raw && Number.isFinite(v) && v >= 5 ? Math.round(v * 100) / 100 : null
}

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const hojeISO = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)

// Marcador do produto no Asaas. O webhook da plataforma casa por este prefixo e ENCAMINHA para
// aplicarEventoAssinaturaEstudio (não vira cobrança/acesso da assinatura principal do SOA).
// Diferente de "EST:" (pacote avulso de imagens).
export const MARCA_EDMOD = 'EDMOD:'
export const externalRefEdmod = (workspaceId: string) => MARCA_EDMOD + workspaceId
export const ehExternalRefEdmod = (ref: unknown): boolean => typeof ref === 'string' && ref.startsWith(MARCA_EDMOD)

let tabelaOk = false
export async function ensureEstudioAssinatura(): Promise<void> {
  if (tabelaOk) return
  await garantirColunaModuloEstudio() // inclui moduloEstudioOrigem (pré-check no catálogo)
  const [t] = await prisma.$queryRawUnsafe<{ ok: boolean }[]>(`SELECT to_regclass('public."EstudioAssinatura"') IS NOT NULL AS ok`)
  if (!t?.ok) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EstudioAssinatura" (
        "id" text PRIMARY KEY,
        "workspaceId" text NOT NULL,
        "asaasCustomerId" text, "asaasSubscriptionId" text,
        "status" text NOT NULL DEFAULT 'PENDENTE',
        "valor" numeric(12,2) NOT NULL DEFAULT 0,
        "proximoVencimento" date, "ativadaEm" timestamptz, "canceladaEm" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "EstudioAssinatura_ws_uidx" ON "EstudioAssinatura" ("workspaceId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EstudioAssinatura_sub_idx" ON "EstudioAssinatura" ("asaasSubscriptionId")`)
  }
  tabelaOk = true
}

export interface StatusModulo {
  ativo: boolean
  origem: 'asaas' | 'cortesia' | null
  status: string | null
  valor: number | null
  proximoVencimento: string | null
  /** Venda aberta (preço definido no ambiente). */
  venda: boolean
  preco: number | null
}

export async function statusModuloEstudio(workspaceId: string): Promise<StatusModulo> {
  await ensureEstudioAssinatura()
  const [w] = await prisma.$queryRaw<{ on: boolean | null; origem: string | null }[]>`
    SELECT (to_jsonb(w) ->> 'moduloEstudio')::boolean AS "on", (to_jsonb(w) ->> 'moduloEstudioOrigem') AS "origem"
    FROM "Workspace" w WHERE w."id" = ${workspaceId} LIMIT 1`
  const [a] = await prisma.$queryRaw<{ status: string; valor: number; proximoVencimento: string | null }[]>`
    SELECT "status", "valor"::float AS valor, TO_CHAR("proximoVencimento",'YYYY-MM-DD') AS "proximoVencimento"
    FROM "EstudioAssinatura" WHERE "workspaceId" = ${workspaceId} LIMIT 1`
  const preco = precoModulo()
  return {
    ativo: !!w?.on,
    origem: w?.origem === 'asaas' || w?.origem === 'cortesia' ? w.origem : null,
    status: a?.status ?? null,
    valor: a?.valor ?? preco,
    proximoVencimento: a?.proximoVencimento ?? null,
    venda: preco !== null,
    preco,
  }
}

/** Liga/desliga o módulo (fonte do gate). `origem` marca cortesia × asaas. */
async function definirEntitlement(workspaceId: string, on: boolean, origem: 'asaas' | 'cortesia' | null): Promise<void> {
  await garantirColunaModuloEstudio()
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "moduloEstudio" = ${on}, "moduloEstudioOrigem" = ${on ? origem : null}, "updatedAt" = NOW()
    WHERE "id" = ${workspaceId}`
}

/** CORTESIA (Master/testes): libera sem Asaas, marcado, idempotente. `on=false` retira. */
export async function definirCortesiaEstudio(workspaceId: string, on: boolean): Promise<void> {
  await ensureEstudioAssinatura()
  await definirEntitlement(workspaceId, on, on ? 'cortesia' : null)
}

interface PagamentosResp { data?: { invoiceUrl?: string; status?: string }[] }

async function faturaEmAberto(subscriptionId: string): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 800))
    const pg = await chamarAsaas<PagamentosResp>(`/subscriptions/${subscriptionId}/payments?limit=10`)
    if (!pg.ok) continue
    const abertas = (pg.dados?.data || []).filter(p => p.status === 'OVERDUE' || p.status === 'PENDING')
    const url = (abertas[0] ?? pg.dados?.data?.[0])?.invoiceUrl
    if (url) return url
  }
  return null
}

/**
 * Assinar / renovar (self-service). Cria ou reusa customer + subscription MONTHLY no Asaas e
 * devolve o link da fatura. Inadimplente → devolve a fatura em aberto. Cancelada → assinatura nova.
 * NÃO libera o módulo aqui — só o webhook de pagamento confirmado libera. Idempotente.
 */
export async function assinarEstudio(
  workspaceId: string, userId: string, dados: { nome: string; email: string | null; cpf?: string },
): Promise<{ ok: true; status: string; invoiceUrl: string | null; jaAtiva?: boolean } | { ok: false; erro: string; precisaCpf?: boolean; status?: number }> {
  await ensureEstudioAssinatura()
  const preco = precoModulo()
  if (preco === null) return { ok: false, erro: 'A assinatura do SOA Edition abre em breve.', status: 503 }

  const atual = await statusModuloEstudio(workspaceId)
  if (atual.ativo && atual.origem === 'cortesia') return { ok: true, status: 'CORTESIA', invoiceUrl: null, jaAtiva: true }

  const [row] = await prisma.$queryRaw<{ asaasCustomerId: string | null; asaasSubscriptionId: string | null; status: string }[]>`
    SELECT "asaasCustomerId", "asaasSubscriptionId", "status" FROM "EstudioAssinatura" WHERE "workspaceId" = ${workspaceId} LIMIT 1`
  if (row?.status === 'ATIVA' && atual.ativo) return { ok: true, status: 'ATIVA', invoiceUrl: null, jaAtiva: true }

  // Renovar: assinatura viva com fatura em aberto → devolve a fatura (não cria outra).
  if (row?.asaasSubscriptionId && row.status !== 'CANCELADA') {
    const url = await faturaEmAberto(row.asaasSubscriptionId)
    return { ok: true, status: row.status, invoiceUrl: url }
  }

  // 1) Customer — da própria assinatura, de outro produto SOA dela, ou novo (pede CPF).
  let customerId = row?.asaasCustomerId || (await customerExistente(workspaceId, userId))
  if (!customerId) {
    const cpf = limparCpf(dados.cpf || '')
    if (!cpf) return { ok: false, erro: 'Informe o CPF do titular para a cobrança.', precisaCpf: true, status: 400 }
    if (!cpfValido(cpf)) return { ok: false, erro: 'CPF inválido.', precisaCpf: true, status: 400 }
    const r = await chamarAsaas<{ id: string }>('/customers', {
      metodo: 'POST', corpo: { name: dados.nome || 'Assinante SOA', cpfCnpj: cpf, email: dados.email || undefined, externalReference: externalRefEdmod(workspaceId) },
    })
    if (!r.ok || !r.dados?.id) return { ok: false, erro: r.erro || 'Falha ao criar cliente no Asaas.', status: 502 }
    customerId = r.dados.id
  }

  // 2) Subscription nova (primeira vez ou depois de cancelada). UNDEFINED = Pix ou cartão na fatura.
  const s = await chamarAsaas<{ id: string; nextDueDate?: string }>('/subscriptions', {
    metodo: 'POST',
    corpo: {
      customer: customerId, billingType: 'UNDEFINED', value: preco, nextDueDate: hojeISO(), cycle: 'MONTHLY',
      description: 'SOA Edition — edição de artes (mensal)', externalReference: externalRefEdmod(workspaceId),
    },
  })
  if (!s.ok || !s.dados?.id) return { ok: false, erro: s.erro || 'Falha ao criar a assinatura no Asaas.', status: 502 }

  await prisma.$executeRaw`
    INSERT INTO "EstudioAssinatura" ("id","workspaceId","asaasCustomerId","asaasSubscriptionId","status","valor","proximoVencimento")
    VALUES (${gid()}, ${workspaceId}, ${customerId}, ${s.dados.id}, 'PENDENTE', ${preco}, ${s.dados.nextDueDate || hojeISO()}::date)
    ON CONFLICT ("workspaceId") DO UPDATE SET
      "asaasCustomerId" = EXCLUDED."asaasCustomerId", "asaasSubscriptionId" = EXCLUDED."asaasSubscriptionId",
      "status" = 'PENDENTE', "valor" = EXCLUDED."valor", "proximoVencimento" = EXCLUDED."proximoVencimento",
      "canceladaEm" = NULL, "updatedAt" = NOW()`
  return { ok: true, status: 'PENDENTE', invoiceUrl: await faturaEmAberto(s.dados.id) }
}

/**
 * Evento do Asaas na assinatura do módulo (por subscriptionId). Idempotente.
 * Retorna se casou com alguma assinatura do SOA Edition.
 */
export async function aplicarEventoAssinaturaEstudio(evento: string, subscriptionId: string | null, dueDate: string | null): Promise<boolean> {
  if (!subscriptionId) return false
  await ensureEstudioAssinatura()
  const [a] = await prisma.$queryRaw<{ workspaceId: string; origem: string | null }[]>`
    SELECT e."workspaceId", (to_jsonb(w) ->> 'moduloEstudioOrigem') AS "origem"
    FROM "EstudioAssinatura" e LEFT JOIN "Workspace" w ON w."id" = e."workspaceId"
    WHERE e."asaasSubscriptionId" = ${subscriptionId} LIMIT 1`
  if (!a) return false
  const cortesia = a.origem === 'cortesia'

  if (evento === 'PAYMENT_RECEIVED' || evento === 'PAYMENT_CONFIRMED') {
    await prisma.$executeRaw`
      UPDATE "EstudioAssinatura" SET "status" = 'ATIVA', "ativadaEm" = COALESCE("ativadaEm", NOW()),
        "proximoVencimento" = COALESCE(${dueDate}::date, "proximoVencimento"), "canceladaEm" = NULL, "updatedAt" = NOW()
      WHERE "asaasSubscriptionId" = ${subscriptionId}`
    if (!cortesia) await definirEntitlement(a.workspaceId, true, 'asaas')
  } else if (evento === 'PAYMENT_OVERDUE') {
    // Régua do módulo: cobrança vencida bloqueia (dados preservados); pagar a fatura religa.
    await prisma.$executeRaw`
      UPDATE "EstudioAssinatura" SET "status" = 'INADIMPLENTE', "proximoVencimento" = COALESCE(${dueDate}::date, "proximoVencimento"), "updatedAt" = NOW()
      WHERE "asaasSubscriptionId" = ${subscriptionId} AND "status" <> 'CANCELADA'`
    if (!cortesia) await definirEntitlement(a.workspaceId, false, null)
  } else if (evento === 'SUBSCRIPTION_DELETED' || evento === 'SUBSCRIPTION_INACTIVATED') {
    await prisma.$executeRaw`
      UPDATE "EstudioAssinatura" SET "status" = 'CANCELADA', "canceladaEm" = COALESCE("canceladaEm", NOW()), "updatedAt" = NOW()
      WHERE "asaasSubscriptionId" = ${subscriptionId} AND "status" <> 'CANCELADA'`
    if (!cortesia) await definirEntitlement(a.workspaceId, false, null)
  } else {
    return true // outros eventos do nosso produto: nada a fazer
  }
  console.log(`[ESTUDIO-ASSINATURA] ${evento} ws=${a.workspaceId} sub=${subscriptionId}${cortesia ? ' (cortesia: acesso não muda)' : ''}`)
  return true
}
