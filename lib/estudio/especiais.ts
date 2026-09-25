// SOA Edition — TEMPLATES ESPECIAIS (acervo da Naty): assinatura própria (R$ 29,90/mês via Asaas,
// ESTUDIO_TEMPLATES_PRECO), independente do SOA Edition. ESPELHA lib/estudio/assinatura.ts:
//   • pagamento confirmado → Workspace.templatesEspeciais = true (origem 'asaas')
//   • vencida/encerrada → false (só se origem != 'cortesia'); cortesia pelo Master nunca é cortada
// Bloquear NUNCA apaga nada: o que ela salvou fica; o acervo volta a abrir ao pagar.
//
// O acervo mora num "workspace" reservado (ACERVO_WS) — as consultas normais (por workspace da
// sessão) nunca enxergam. Nada é publicado sem aprovação no Master (trilha em EstudioAcervoAuditoria).
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { limparCpf, cpfValido } from '@/lib/assinatura/cpf'
import { garantirColuna } from '@/lib/ddlGuard'
import { customerExistente } from './compra'
import { ensureEstudioSchema } from './schema'

export const ACERVO_WS = '__acervo_naty__'
/** Versão do termo de responsabilidade (mudou o texto → pede aceite de novo). */
export const TERMO_VERSAO = '2026-09-25'
export const TERMO_TEXTO = 'Os elementos dos Templates Especiais (fundos, moldes, laços, pedras, elementos de festa e temas genéricos) são de uso livre para os meus pedidos. A personalização — e qualquer arte, personagem, marca ou imagem de terceiros que EU adicionar — é de minha inteira responsabilidade. Não vou redistribuir nem revender os templates como arquivo.'

export function precoTemplates(): number | null {
  const raw = (process.env.ESTUDIO_TEMPLATES_PRECO || '').trim().replace(',', '.')
  const v = Number(raw)
  return raw && Number.isFinite(v) && v >= 5 ? Math.round(v * 100) / 100 : null
}

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const hojeISO = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)

// Marcador do produto no Asaas — o webhook casa por este prefixo (≠ EDMOD: do SOA Edition, ≠ EST: do pacote).
export const MARCA_EDTPL = 'EDTPL:'
export const externalRefEdtpl = (workspaceId: string) => MARCA_EDTPL + workspaceId
export const ehExternalRefEdtpl = (ref: unknown): boolean => typeof ref === 'string' && ref.startsWith(MARCA_EDTPL)

let pronto = false
export async function ensureEspeciais(): Promise<void> {
  if (pronto) return
  await ensureEstudioSchema()
  // Workspace é tabela quente: pré-check no catálogo (lib/ddlGuard) — o caminho comum é só leitura.
  await garantirColuna('Workspace', 'templatesEspeciais', 'boolean NOT NULL DEFAULT false')
  await garantirColuna('Workspace', 'templatesEspeciaisOrigem', 'text')
  const [t] = await prisma.$queryRawUnsafe<{ ok: boolean }[]>(`SELECT to_regclass('public."EstudioTemplatesAssinatura"') IS NOT NULL AS ok`)
  if (!t?.ok) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EstudioTemplatesAssinatura" (
        "id" text PRIMARY KEY, "workspaceId" text NOT NULL,
        "asaasCustomerId" text, "asaasSubscriptionId" text,
        "status" text NOT NULL DEFAULT 'PENDENTE', "valor" numeric(12,2) NOT NULL DEFAULT 0,
        "proximoVencimento" date, "ativadaEm" timestamptz, "canceladaEm" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "EstudioTemplatesAssinatura_ws_uidx" ON "EstudioTemplatesAssinatura" ("workspaceId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EstudioTemplatesAssinatura_sub_idx" ON "EstudioTemplatesAssinatura" ("asaasSubscriptionId")`)
  }
  pronto = true
}

export interface StatusEspeciais {
  ativo: boolean
  origem: 'asaas' | 'cortesia' | null
  status: string | null
  proximoVencimento: string | null
  venda: boolean
  preco: number | null
}

export async function statusEspeciais(workspaceId: string): Promise<StatusEspeciais> {
  await ensureEspeciais()
  const [w] = await prisma.$queryRaw<{ on: boolean | null; origem: string | null }[]>`
    SELECT (to_jsonb(w) ->> 'templatesEspeciais')::boolean AS "on", (to_jsonb(w) ->> 'templatesEspeciaisOrigem') AS "origem"
    FROM "Workspace" w WHERE w."id" = ${workspaceId} LIMIT 1`
  const [a] = await prisma.$queryRaw<{ status: string; proximoVencimento: string | null }[]>`
    SELECT "status", TO_CHAR("proximoVencimento",'YYYY-MM-DD') AS "proximoVencimento"
    FROM "EstudioTemplatesAssinatura" WHERE "workspaceId" = ${workspaceId} LIMIT 1`
  const preco = precoTemplates()
  return {
    ativo: !!w?.on, origem: w?.origem === 'asaas' || w?.origem === 'cortesia' ? w.origem : null,
    status: a?.status ?? null, proximoVencimento: a?.proximoVencimento ?? null, venda: preco !== null, preco,
  }
}

export async function especiaisLiberado(workspaceId: string): Promise<boolean> {
  return (await statusEspeciais(workspaceId)).ativo
}

async function definirEntitlement(workspaceId: string, on: boolean, origem: 'asaas' | 'cortesia' | null): Promise<void> {
  await ensureEspeciais()
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "templatesEspeciais" = ${on}, "templatesEspeciaisOrigem" = ${on ? origem : null}, "updatedAt" = NOW()
    WHERE "id" = ${workspaceId}`
}

export async function definirCortesiaEspeciais(workspaceId: string, on: boolean): Promise<void> {
  await definirEntitlement(workspaceId, on, on ? 'cortesia' : null)
}

async function faturaEmAberto(subscriptionId: string): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 800))
    const pg = await chamarAsaas<{ data?: { invoiceUrl?: string; status?: string }[] }>(`/subscriptions/${subscriptionId}/payments?limit=10`)
    if (!pg.ok) continue
    const abertas = (pg.dados?.data || []).filter(p => p.status === 'OVERDUE' || p.status === 'PENDING')
    const url = (abertas[0] ?? pg.dados?.data?.[0])?.invoiceUrl
    if (url) return url
  }
  return null
}

/** Assinar / renovar (self-service). Só o webhook de pagamento confirmado libera. Idempotente. */
export async function assinarEspeciais(
  workspaceId: string, userId: string, dados: { nome: string; email: string | null; cpf?: string },
): Promise<{ ok: true; status: string; invoiceUrl: string | null; jaAtiva?: boolean } | { ok: false; erro: string; precisaCpf?: boolean; status?: number }> {
  await ensureEspeciais()
  const preco = precoTemplates()
  if (preco === null) return { ok: false, erro: 'A assinatura dos Templates Especiais abre em breve.', status: 503 }
  const atual = await statusEspeciais(workspaceId)
  if (atual.ativo && atual.origem === 'cortesia') return { ok: true, status: 'CORTESIA', invoiceUrl: null, jaAtiva: true }
  const [row] = await prisma.$queryRaw<{ asaasCustomerId: string | null; asaasSubscriptionId: string | null; status: string }[]>`
    SELECT "asaasCustomerId", "asaasSubscriptionId", "status" FROM "EstudioTemplatesAssinatura" WHERE "workspaceId" = ${workspaceId} LIMIT 1`
  if (row?.status === 'ATIVA' && atual.ativo) return { ok: true, status: 'ATIVA', invoiceUrl: null, jaAtiva: true }
  if (row?.asaasSubscriptionId && row.status !== 'CANCELADA') return { ok: true, status: row.status, invoiceUrl: await faturaEmAberto(row.asaasSubscriptionId) }

  let customerId = row?.asaasCustomerId || (await customerExistente(workspaceId, userId))
  if (!customerId) {
    const cpf = limparCpf(dados.cpf || '')
    if (!cpf) return { ok: false, erro: 'Informe o CPF do titular para a cobrança.', precisaCpf: true, status: 400 }
    if (!cpfValido(cpf)) return { ok: false, erro: 'CPF inválido.', precisaCpf: true, status: 400 }
    const r = await chamarAsaas<{ id: string }>('/customers', {
      metodo: 'POST', corpo: { name: dados.nome || 'Assinante SOA', cpfCnpj: cpf, email: dados.email || undefined, externalReference: externalRefEdtpl(workspaceId) },
    })
    if (!r.ok || !r.dados?.id) return { ok: false, erro: r.erro || 'Falha ao criar cliente no Asaas.', status: 502 }
    customerId = r.dados.id
  }
  const s = await chamarAsaas<{ id: string; nextDueDate?: string }>('/subscriptions', {
    metodo: 'POST',
    corpo: {
      customer: customerId, billingType: 'UNDEFINED', value: preco, nextDueDate: hojeISO(), cycle: 'MONTHLY',
      description: 'SOA Edition — Templates Especiais (mensal)', externalReference: externalRefEdtpl(workspaceId),
    },
  })
  if (!s.ok || !s.dados?.id) return { ok: false, erro: s.erro || 'Falha ao criar a assinatura no Asaas.', status: 502 }
  await prisma.$executeRaw`
    INSERT INTO "EstudioTemplatesAssinatura" ("id","workspaceId","asaasCustomerId","asaasSubscriptionId","status","valor","proximoVencimento")
    VALUES (${gid()}, ${workspaceId}, ${customerId}, ${s.dados.id}, 'PENDENTE', ${preco}, ${s.dados.nextDueDate || hojeISO()}::date)
    ON CONFLICT ("workspaceId") DO UPDATE SET
      "asaasCustomerId" = EXCLUDED."asaasCustomerId", "asaasSubscriptionId" = EXCLUDED."asaasSubscriptionId",
      "status" = 'PENDENTE', "valor" = EXCLUDED."valor", "proximoVencimento" = EXCLUDED."proximoVencimento",
      "canceladaEm" = NULL, "updatedAt" = NOW()`
  return { ok: true, status: 'PENDENTE', invoiceUrl: await faturaEmAberto(s.dados.id) }
}

/** Evento do Asaas na assinatura de Templates Especiais (por subscriptionId). Idempotente. */
export async function aplicarEventoEspeciais(evento: string, subscriptionId: string | null, dueDate: string | null): Promise<boolean> {
  if (!subscriptionId) return false
  await ensureEspeciais()
  const [a] = await prisma.$queryRaw<{ workspaceId: string; origem: string | null }[]>`
    SELECT e."workspaceId", (to_jsonb(w) ->> 'templatesEspeciaisOrigem') AS "origem"
    FROM "EstudioTemplatesAssinatura" e LEFT JOIN "Workspace" w ON w."id" = e."workspaceId"
    WHERE e."asaasSubscriptionId" = ${subscriptionId} LIMIT 1`
  if (!a) return false
  const cortesia = a.origem === 'cortesia'
  if (evento === 'PAYMENT_RECEIVED' || evento === 'PAYMENT_CONFIRMED') {
    await prisma.$executeRaw`
      UPDATE "EstudioTemplatesAssinatura" SET "status" = 'ATIVA', "ativadaEm" = COALESCE("ativadaEm", NOW()),
        "proximoVencimento" = COALESCE(${dueDate}::date, "proximoVencimento"), "canceladaEm" = NULL, "updatedAt" = NOW()
      WHERE "asaasSubscriptionId" = ${subscriptionId}`
    if (!cortesia) await definirEntitlement(a.workspaceId, true, 'asaas')
  } else if (evento === 'PAYMENT_OVERDUE') {
    await prisma.$executeRaw`
      UPDATE "EstudioTemplatesAssinatura" SET "status" = 'INADIMPLENTE', "proximoVencimento" = COALESCE(${dueDate}::date, "proximoVencimento"), "updatedAt" = NOW()
      WHERE "asaasSubscriptionId" = ${subscriptionId} AND "status" <> 'CANCELADA'`
    if (!cortesia) await definirEntitlement(a.workspaceId, false, null)
  } else if (evento === 'SUBSCRIPTION_DELETED' || evento === 'SUBSCRIPTION_INACTIVATED') {
    await prisma.$executeRaw`
      UPDATE "EstudioTemplatesAssinatura" SET "status" = 'CANCELADA', "canceladaEm" = COALESCE("canceladaEm", NOW()), "updatedAt" = NOW()
      WHERE "asaasSubscriptionId" = ${subscriptionId} AND "status" <> 'CANCELADA'`
    if (!cortesia) await definirEntitlement(a.workspaceId, false, null)
  } else return true
  console.log(`[ESTUDIO-ESPECIAIS] ${evento} ws=${a.workspaceId} sub=${subscriptionId}${cortesia ? ' (cortesia: acesso não muda)' : ''}`)
  return true
}

// ── termo de responsabilidade (aceite por login, com versão) ────────────────────
export async function termoAceito(userId: string): Promise<boolean> {
  await ensureEstudioSchema()
  const [r] = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*)::int AS n FROM "EstudioTermoAceite" WHERE "userId"=$1 AND "versao"=$2`, userId, TERMO_VERSAO)
  return (r?.n || 0) > 0
}
export async function aceitarTermo(workspaceId: string, userId: string): Promise<void> {
  await ensureEstudioSchema()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioTermoAceite" ("userId","versao","workspaceId") VALUES ($1,$2,$3) ON CONFLICT ("userId","versao") DO NOTHING`,
    userId, TERMO_VERSAO, workspaceId)
}

/** Trilha de auditoria da curadoria (quem, o quê, quando) — base para takedown rápido. */
export async function auditar(templateId: string, acao: string, por: string, nota: string | null = null): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioAcervoAuditoria" ("id","templateId","acao","por","nota") VALUES ($1,$2,$3,$4,$5)`,
    gid(), templateId, acao, por.slice(0, 80), nota ? nota.slice(0, 500) : null)
}
