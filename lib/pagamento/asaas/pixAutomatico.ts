// Pix Automático (Asaas, Jornada 3): recorrência via Pix com autorização prévia. Um único QR reúne
// o 1º pagamento + a autorização; com paymentCreationMode:SUBSCRIPTION o Asaas gera as recorrentes.
// externalReference = workspaceId em TUDO (o webhook casa o workspace — lição da Amália).
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from './client'
import { getCredenciais } from './config'
import { garantirCliente } from './index'

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const iso = (d: Date) => d.toISOString().slice(0, 10)

let tabelaOk = false
export async function ensurePixAutoTable() {
  if (tabelaOk) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AsaasPixAutoAutorizacao" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "asaasCustomerId" text,
      "asaasAuthorizationId" text UNIQUE,
      "contractId" text,
      "status" text NOT NULL DEFAULT 'CREATED',
      "frequencia" text NOT NULL DEFAULT 'MONTHLY',
      "valor" numeric(12,2) NOT NULL DEFAULT 0,
      "proximoVencimento" date,
      "conciliationIdentifier" text,
      "sandbox" boolean NOT NULL DEFAULT true,
      "criadoEm" timestamptz NOT NULL DEFAULT now(),
      "atualizadoEm" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AsaasPixAuto_ws_idx" ON "AsaasPixAutoAutorizacao" ("workspaceId")`)
  tabelaOk = true
}

export interface ResultadoAutorizacao {
  ok: boolean
  erro?: string
  authorizationId?: string
  payload?: string        // Pix copia-e-cola do 1º pagamento
  encodedImage?: string   // QR Code (PNG base64)
  status?: string
}

/** Cria a autorização Pix Automático (com QR imediato do 1º pagamento). Guarda o vínculo. */
export async function criarAutorizacaoPixAuto(
  workspaceId: string,
  p: { valor: number; nome: string; email: string; cpfCnpj: string; descricao?: string },
): Promise<ResultadoAutorizacao> {
  const { sandbox } = await getCredenciais()
  await ensurePixAutoTable()

  const cli = await garantirCliente(workspaceId, { name: p.nome, email: p.email, cpfCnpj: p.cpfCnpj })
  if (!cli.ok || !cli.dados?.customerId) return { ok: false, erro: cli.erro || 'Não foi possível criar o cliente no Asaas' }
  const customerId = cli.dados.customerId

  const hoje = new Date()
  const proximo = new Date(hoje); proximo.setMonth(proximo.getMonth() + 1)
  const contractId = `soa-${workspaceId}-${gid()}`

  const r = await chamarAsaas<{
    id: string; status: string; payload: string; encodedImage: string; endToEndIdentifier?: string
  }>('/pix/automatic/authorizations', {
    metodo: 'POST',
    corpo: {
      customerId, billingType: 'PIX', value: p.valor,
      externalReference: workspaceId,          // ← casa o workspace no webhook
      paymentCreationMode: 'SUBSCRIPTION',      // Asaas gera as recorrentes
      frequency: 'MONTHLY', nextDueDate: iso(proximo), startDate: iso(hoje),
      contractId, description: p.descricao || 'Assinatura SOA (Pix Automático)',
      immediateQrCode: { value: p.valor, originalValue: p.valor, expirationSeconds: 3600, dueDate: iso(hoje) },
    },
  })
  if (!r.ok || !r.dados?.id) return { ok: false, erro: r.erro || 'Falha ao criar a autorização Pix Automático' }
  const d = r.dados

  await prisma.$executeRaw`
    INSERT INTO "AsaasPixAutoAutorizacao"
      ("id","workspaceId","asaasCustomerId","asaasAuthorizationId","contractId","status","frequencia",
       "valor","proximoVencimento","conciliationIdentifier","sandbox","criadoEm","atualizadoEm")
    VALUES (${gid()}, ${workspaceId}, ${customerId}, ${d.id}, ${contractId}, ${d.status || 'CREATED'}, 'MONTHLY',
            ${p.valor}, ${iso(proximo)}::date, ${d.endToEndIdentifier ?? null}, ${sandbox}, NOW(), NOW())
    ON CONFLICT ("asaasAuthorizationId") DO NOTHING
  `
  return { ok: true, authorizationId: d.id, payload: d.payload, encodedImage: d.encodedImage, status: d.status }
}

/** Ativa o workspace quando um pagamento pago (1º ou recorrente) chega com externalReference=workspaceId
 *  E existe uma autorização Pix Automático dele. Idempotente. Retorna true se era Pix Auto. */
export async function ativarSePixAuto(workspaceId: string): Promise<boolean> {
  if (!workspaceId) return false
  await ensurePixAutoTable()
  const [a] = await prisma.$queryRaw`
    SELECT "asaasAuthorizationId" FROM "AsaasPixAutoAutorizacao" WHERE "workspaceId" = ${workspaceId} ORDER BY "criadoEm" DESC LIMIT 1
  ` as { asaasAuthorizationId: string }[]
  if (!a) return false
  await prisma.$executeRaw`
    UPDATE "AsaasPixAutoAutorizacao" SET "status" = 'ACTIVE', "atualizadoEm" = NOW() WHERE "asaasAuthorizationId" = ${a.asaasAuthorizationId}
  `
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "assinaturaStatus" = 'ATIVA', "assinaturaOrigem" = 'asaas', "ativo" = true, "updatedAt" = NOW()
    WHERE "id" = ${workspaceId}
  `
  return true
}

/** Reflete o status da autorização (do webhook) e ativa/desativa o acesso conforme. Idempotente. */
export async function aplicarStatusAutorizacao(authorizationId: string, novoStatus: string): Promise<void> {
  await ensurePixAutoTable()
  const [a] = await prisma.$queryRaw`
    SELECT "workspaceId" FROM "AsaasPixAutoAutorizacao" WHERE "asaasAuthorizationId" = ${authorizationId} LIMIT 1
  ` as { workspaceId: string }[]
  if (!a) return
  await prisma.$executeRaw`
    UPDATE "AsaasPixAutoAutorizacao" SET "status" = ${novoStatus}, "atualizadoEm" = NOW()
    WHERE "asaasAuthorizationId" = ${authorizationId}
  `
  // ATIVA → libera o workspace (sai do trial). CANCELLED/REVOKED/REJECTED → marca inadimplente
  // (o corte real fica pro job diário, como no cartão — não deslogar de imediato).
  const ativos = new Set(['ACTIVE'])
  const encerra = new Set(['CANCELLED', 'REVOKED', 'REJECTED', 'EXPIRED'])
  if (ativos.has(novoStatus)) {
    await prisma.$executeRaw`
      UPDATE "Workspace" SET "assinaturaStatus" = 'ATIVA', "assinaturaOrigem" = 'asaas', "ativo" = true, "updatedAt" = NOW()
      WHERE "id" = ${a.workspaceId}
    `
  } else if (encerra.has(novoStatus)) {
    await prisma.$executeRaw`
      UPDATE "Workspace" SET "assinaturaStatus" = 'INADIMPLENTE', "updatedAt" = NOW()
      WHERE "id" = ${a.workspaceId} AND "assinaturaOrigem" = 'asaas'
    `
  }
}
