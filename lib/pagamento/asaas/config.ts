// Helpers de banco da AsaasConfig (raw SQL). NUNCA seleciona a API key em listagem.
// A credencial só sai por getCredenciais() — uso EXCLUSIVO de servidor (client.ts).
//
// Escopo 'plataforma': o Asaas é a conta do SOA (assinaturas + split de comissão),
// não uma conta por workspace. Por isso não há workspaceId aqui.
import { prisma } from '@/lib/prisma'
import { encryptToken, decryptToken } from './cripto'
import type { AsaasConfigPublica, AsaasCredenciais } from './tipos'

const ESCOPO = 'plataforma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Garante a linha única da plataforma (idempotente). */
export async function garantirConfig() {
  await prisma.$executeRaw`
    INSERT INTO "AsaasConfig" ("id","escopo","conectado","sandbox","ativo","updatedAt")
    SELECT ${gerarId()}, ${ESCOPO}, false, true, false, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM "AsaasConfig" WHERE "escopo" = ${ESCOPO})
  `
}

/** Config para tela/diagnóstico — sem segredo algum, só flags de presença. */
export async function getConfigPublica(): Promise<AsaasConfigPublica> {
  const env = credenciaisDoEnv()
  const vazio: AsaasConfigPublica = {
    escopo: ESCOPO, ativo: false, conectado: false,
    sandbox: env.sandbox ?? true,
    temApiKey: !!env.apiKey, temWebhookToken: !!env.webhookToken,
    walletIdPlataforma: null, contaNome: null, contaEmail: null,
    ultimoTesteEm: null, ultimoTesteOk: null, ultimoTesteErro: null,
  }

  let row: AsaasConfigPublica | undefined
  try {
    ;[row] = await prisma.$queryRaw`
      SELECT "escopo", "ativo", "conectado", "sandbox",
             ("apiKeyCripto" IS NOT NULL)       AS "temApiKey",
             ("webhookTokenCripto" IS NOT NULL) AS "temWebhookToken",
             "walletIdPlataforma", "contaNome", "contaEmail",
             TO_CHAR("ultimoTesteEm", 'YYYY-MM-DD"T"HH24:MI:SSOF') AS "ultimoTesteEm",
             "ultimoTesteOk", "ultimoTesteErro"
      FROM "AsaasConfig" WHERE "escopo" = ${ESCOPO} LIMIT 1
    ` as AsaasConfigPublica[]
  } catch {
    return vazio   // tabela/coluna ausente (pré-migração) — reporta o que o env dá
  }
  if (!row) return vazio

  // Credencial no env conta como presente, mesmo sem nada gravado no banco.
  return {
    ...row,
    sandbox: env.sandbox ?? row.sandbox,
    temApiKey: row.temApiKey || !!env.apiKey,
    temWebhookToken: row.temWebhookToken || !!env.webhookToken,
  }
}

/**
 * Credenciais do ENV. Têm PRECEDÊNCIA sobre o banco: é a config local do operador,
 * nunca commitada, e é o caminho de bootstrap (funciona antes da migração rodar).
 *
 *   ASAAS_API_KEY        chave da conta (obrigatória para qualquer chamada)
 *   ASAAS_WEBHOOK_TOKEN  segredo do webhook (opcional; a tela também gera e grava)
 *   ASAAS_SANDBOX        'false' força produção — só se precisar contrariar o prefixo
 */
function credenciaisDoEnv(): { apiKey: string | null; webhookToken: string | null; sandbox: boolean | null } {
  const apiKey = (process.env.ASAAS_API_KEY || '').trim() || null
  const webhookToken = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim() || null

  // O PREFIXO DA CHAVE MANDA: "$aact_hmlg_" = homologação (sandbox).
  // Sem isto, uma chave de sandbox com a config apontando para produção bateria em
  // api.asaas.com e voltaria 401 sem explicação óbvia. O prefixo é a fonte da verdade.
  let sandbox: boolean | null = null
  if (apiKey) sandbox = apiKey.includes('_hmlg_')
  if (process.env.ASAAS_SANDBOX) sandbox = process.env.ASAAS_SANDBOX !== 'false'

  return { apiKey, webhookToken, sandbox }
}

/** SEGREDO — só servidor. Nunca devolver o retorno disto num NextResponse.json(). */
export async function getCredenciais(): Promise<AsaasCredenciais> {
  const env = credenciaisDoEnv()

  // O banco é complemento, não pré-requisito: antes da migração a tabela não tem as
  // colunas novas, e mesmo assim a chave do env precisa funcionar.
  let row: { apiKeyCripto: string | null; webhookTokenCripto: string | null; sandbox: boolean; ativo: boolean } | undefined
  try {
    ;[row] = await prisma.$queryRaw`
      SELECT "apiKeyCripto", "webhookTokenCripto", "sandbox", "ativo"
      FROM "AsaasConfig" WHERE "escopo" = ${ESCOPO} LIMIT 1
    ` as typeof row[]
  } catch {
    row = undefined   // tabela/coluna ausente — segue só com o env
  }

  return {
    apiKey: env.apiKey ?? decryptToken(row?.apiKeyCripto),
    webhookToken: env.webhookToken ?? decryptToken(row?.webhookTokenCripto),
    sandbox: env.sandbox ?? (row ? row.sandbox !== false : true),
    ativo: !!row?.ativo,
  }
}

/** Salva credenciais (criptografadas em repouso). Campos ausentes ficam como estavam.
 *  Trocar de ambiente derruba `conectado`: a chave de sandbox não vale em produção. */
export async function salvarCredenciais(p: {
  apiKey?: string | null
  webhookToken?: string | null
  sandbox?: boolean
  ativo?: boolean
  walletIdPlataforma?: string | null
}) {
  await garantirConfig()

  const apiKeyCripto = p.apiKey ? encryptToken(p.apiKey) : null
  const webhookCripto = p.webhookToken ? encryptToken(p.webhookToken) : null
  const sandbox = p.sandbox === undefined ? null : !!p.sandbox

  await prisma.$executeRaw`
    UPDATE "AsaasConfig" SET
      "apiKeyCripto"       = COALESCE(${apiKeyCripto}, "apiKeyCripto"),
      "webhookTokenCripto" = COALESCE(${webhookCripto}, "webhookTokenCripto"),
      "sandbox"            = COALESCE(${sandbox}::boolean, "sandbox"),
      "ativo"              = COALESCE(${p.ativo === undefined ? null : !!p.ativo}::boolean, "ativo"),
      "walletIdPlataforma" = COALESCE(${p.walletIdPlataforma ?? null}, "walletIdPlataforma"),
      -- credencial nova ou troca de ambiente ⇒ precisa testar de novo
      "conectado" = CASE
        WHEN ${apiKeyCripto}::text IS NOT NULL THEN false
        WHEN ${sandbox}::boolean IS NOT NULL AND ${sandbox}::boolean <> "sandbox" THEN false
        ELSE "conectado" END,
      "updatedAt" = NOW()
    WHERE "escopo" = ${ESCOPO}
  `
}

/** Registra o resultado do teste de conexão. `conectado` é derivado daqui — nunca
 *  marcado à mão. Mensagem de erro é truncada e não carrega credencial. */
export async function registrarTeste(r: {
  ok: boolean
  erro?: string | null
  contaNome?: string | null
  contaEmail?: string | null
  walletId?: string | null
}) {
  try {
    await gravarTeste(r)
  } catch (e) {
    // Pré-migração as colunas de diagnóstico não existem. Registrar é BÔNUS: não
    // pode derrubar o teste de conexão, que é justamente como se valida o ambiente.
    console.warn('[ASAAS] diagnóstico não gravado (migração pendente?):', (e as Error)?.message)
  }
}

async function gravarTeste(r: {
  ok: boolean
  erro?: string | null
  contaNome?: string | null
  contaEmail?: string | null
  walletId?: string | null
}) {
  await garantirConfig()
  await prisma.$executeRaw`
    UPDATE "AsaasConfig" SET
      "conectado"      = ${r.ok},
      "ultimoTesteEm"  = NOW(),
      "ultimoTesteOk"  = ${r.ok},
      "ultimoTesteErro" = ${r.erro ? String(r.erro).slice(0, 300) : null},
      "contaNome"      = COALESCE(${r.contaNome ?? null}, "contaNome"),
      "contaEmail"     = COALESCE(${r.contaEmail ?? null}, "contaEmail"),
      "walletIdPlataforma" = COALESCE(${r.walletId ?? null}, "walletIdPlataforma"),
      "updatedAt"      = NOW()
    WHERE "escopo" = ${ESCOPO}
  `
}

/** Remove as credenciais e desconecta. */
export async function desconectar() {
  await prisma.$executeRaw`
    UPDATE "AsaasConfig" SET
      "apiKeyCripto" = NULL, "webhookTokenCripto" = NULL,
      "conectado" = false, "ativo" = false,
      "ultimoTesteEm" = NULL, "ultimoTesteOk" = NULL, "ultimoTesteErro" = NULL,
      "updatedAt" = NOW()
    WHERE "escopo" = ${ESCOPO}
  `
}
