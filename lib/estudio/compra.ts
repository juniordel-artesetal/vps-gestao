// SOA Edition — compra AVULSA de pacotes de imagens (Asaas), creditada ao LOGIN que comprou.
//
// Cobrança avulsa (não assinatura), billingType UNDEFINED: a artesã escolhe Pix ou cartão na
// fatura hospedada do Asaas. Só o WEBHOOK de pagamento confirmado credita — nunca a rota.
// externalReference = "EST:<workspaceId>:<userId>:<compraId>" → o webhook da plataforma
// encaminha para aplicarEventoEstudio (não vira cobrança/acesso da assinatura principal).
//
// Idempotência: a compra só passa de PENDENTE→PAGA uma vez (UPDATE ... WHERE status<>'PAGA'
// RETURNING); o crédito só é somado quando essa transição acontece. Todo movimento vai para o
// extrato EstudioCreditoMov (auditoria).
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { limparCpf, cpfValido } from '@/lib/assinatura/cpf'
import { ensureEstudioSchema } from './schema'
import { IMAGENS_POR_PACOTE, precoPacote } from './cota'

export const MARCA_EST = 'EST:'
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const hojeISO = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)

/** Customer do Asaas que esta artesã já tem (assinatura do SOA, add-ons) — evita pedir CPF de novo. */
export async function customerExistente(workspaceId: string, userId: string): Promise<string | null> {
  const consultas: [string, string][] = [
    [`SELECT "asaasCustomerId" AS c FROM "EstudioAssinatura" WHERE "workspaceId"=$1 AND "asaasCustomerId" IS NOT NULL LIMIT 1`, workspaceId],
    [`SELECT "customerId" AS c FROM "AsaasAssinatura" WHERE "workspaceId"=$1 AND "customerId" IS NOT NULL ORDER BY "createdAt" DESC LIMIT 1`, workspaceId],
    [`SELECT "asaasCustomerId" AS c FROM "PessoalAssinatura" WHERE "userId"=$1 AND "asaasCustomerId" IS NOT NULL LIMIT 1`, userId],
    [`SELECT "asaasCustomerId" AS c FROM "MarketplaceAssinatura" WHERE "workspaceId"=$1 AND "asaasCustomerId" IS NOT NULL LIMIT 1`, workspaceId],
  ]
  for (const [sql, p] of consultas) {
    try { const [r] = await prisma.$queryRawUnsafe<{ c: string }[]>(sql, p); if (r?.c) return r.c } catch { /* tabela ausente neste ambiente */ }
  }
  return null
}

export type ResultadoCompra =
  | { ok: true; compraId: string; invoiceUrl: string | null; valor: number; imagens: number }
  | { ok: false; erro: string; precisaCpf?: boolean; status?: number }

export async function iniciarCompra(
  workspaceId: string, userId: string, dados: { pacotes: number; cpf?: string; nome: string; email: string | null },
): Promise<ResultadoCompra> {
  await ensureEstudioSchema()
  const preco = precoPacote()
  if (preco === null) return { ok: false, erro: 'A compra de pacotes ainda não está disponível.', status: 503 }
  const pacotes = Math.min(20, Math.max(1, Math.floor(dados.pacotes || 1)))

  let customer = await customerExistente(workspaceId, userId)
  if (!customer) {
    const cpf = limparCpf(dados.cpf || '')
    if (!cpf) return { ok: false, erro: 'Informe o CPF do titular para gerar a cobrança.', precisaCpf: true, status: 400 }
    if (!cpfValido(cpf)) return { ok: false, erro: 'CPF inválido.', precisaCpf: true, status: 400 }
    const r = await chamarAsaas<{ id: string }>('/customers', {
      metodo: 'POST', corpo: { name: dados.nome || 'Cliente SOA', cpfCnpj: cpf, email: dados.email || undefined, externalReference: `${MARCA_EST}${workspaceId}:${userId}` },
    })
    if (!r.ok || !r.dados?.id) return { ok: false, erro: r.erro || 'Falha ao criar cliente no Asaas.', status: 502 }
    customer = r.dados.id
  }

  const compraId = gid()
  const imagens = pacotes * IMAGENS_POR_PACOTE
  const valor = Math.round(pacotes * preco * 100) / 100
  const ref = `${MARCA_EST}${workspaceId}:${userId}:${compraId}`
  // Grava ANTES de cobrar: se o webhook chegar rápido, a compra já existe para ser creditada.
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioCompra" ("id","workspaceId","userId","pacotes","imagens","valor","status") VALUES ($1,$2,$3,$4,$5,$6,'PENDENTE')`,
    compraId, workspaceId, userId, pacotes, imagens, valor)
  const p = await chamarAsaas<{ id: string; invoiceUrl?: string }>('/payments', {
    metodo: 'POST',
    corpo: {
      customer, billingType: 'UNDEFINED', value: valor, dueDate: hojeISO(),
      description: `SOA Edition — ${pacotes} pacote(s) de ${IMAGENS_POR_PACOTE} imagens (${imagens} imagens)`,
      externalReference: ref,
    },
  })
  if (!p.ok || !p.dados?.id) {
    await prisma.$executeRawUnsafe(`UPDATE "EstudioCompra" SET "status"='CANCELADA' WHERE "id"=$1`, compraId)
    return { ok: false, erro: p.erro || 'Falha ao gerar a cobrança.', status: 502 }
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "EstudioCompra" SET "asaasPaymentId"=$2, "invoiceUrl"=$3 WHERE "id"=$1`, compraId, p.dados.id, p.dados.invoiceUrl ?? null)
  return { ok: true, compraId, invoiceUrl: p.dados.invoiceUrl ?? null, valor, imagens }
}

export function ehExternalRefEstudio(ref: unknown): boolean {
  return typeof ref === 'string' && ref.startsWith(MARCA_EST)
}

/**
 * Evento do Asaas de uma compra de pacote. Pago → credita UMA vez. Estorno/chargeback → retira
 * o que ainda houver de saldo (nunca negativo). Cobrança apagada → compra cancelada.
 */
export async function aplicarEventoEstudio(evento: string, ref: string, paymentId: string | null): Promise<boolean> {
  const partes = ref.slice(MARCA_EST.length).split(':')
  if (partes.length !== 3) return false
  const [workspaceId, userId, compraId] = partes
  await ensureEstudioSchema()

  if (evento === 'PAYMENT_RECEIVED' || evento === 'PAYMENT_CONFIRMED') {
    const creditou = await prisma.$transaction(async tx => {
      const [c] = await tx.$queryRawUnsafe<{ imagens: number }[]>(
        `UPDATE "EstudioCompra" SET "status"='PAGA', "pagaEm"=now(), "asaasPaymentId"=COALESCE("asaasPaymentId",$4)
         WHERE "id"=$1 AND "workspaceId"=$2 AND "userId"=$3 AND "status" IN ('PENDENTE','CANCELADA')
         RETURNING "imagens"`, compraId, workspaceId, userId, paymentId)
      if (!c) return false // já creditada (reentrega do webhook) ou compra desconhecida
      await tx.$executeRawUnsafe(
        `INSERT INTO "EstudioCredito" ("id","workspaceId","userId","saldo") VALUES ($1,$2,$3,$4)
         ON CONFLICT ("userId") DO UPDATE SET "saldo"="EstudioCredito"."saldo"+EXCLUDED."saldo", "atualizadoEm"=now()`,
        gid(), workspaceId, userId, c.imagens)
      await tx.$executeRawUnsafe(
        `INSERT INTO "EstudioCreditoMov" ("id","workspaceId","userId","delta","motivo","ref") VALUES ($1,$2,$3,$4,'compra',$5)`,
        gid(), workspaceId, userId, c.imagens, compraId)
      return true
    })
    if (creditou) console.log(`[ESTUDIO-COMPRA] paga compra=${compraId} ws=${workspaceId}`)
    return true
  }
  if (evento === 'PAYMENT_REFUNDED' || evento === 'PAYMENT_CHARGEBACK_REQUESTED') {
    await prisma.$transaction(async tx => {
      const [c] = await tx.$queryRawUnsafe<{ imagens: number }[]>(
        `UPDATE "EstudioCompra" SET "status"='ESTORNADA' WHERE "id"=$1 AND "userId"=$2 AND "status"='PAGA' RETURNING "imagens"`, compraId, userId)
      if (!c) return
      const [s] = await tx.$queryRawUnsafe<{ saldo: number }[]>(`SELECT "saldo" FROM "EstudioCredito" WHERE "userId"=$1 FOR UPDATE`, userId)
      const tirar = Math.min(Number(s?.saldo) || 0, c.imagens)
      if (tirar) {
        await tx.$executeRawUnsafe(`UPDATE "EstudioCredito" SET "saldo"="saldo"-$2, "atualizadoEm"=now() WHERE "userId"=$1`, userId, tirar)
        await tx.$executeRawUnsafe(
          `INSERT INTO "EstudioCreditoMov" ("id","workspaceId","userId","delta","motivo","ref") VALUES ($1,$2,$3,$4,'estorno',$5)`,
          gid(), workspaceId, userId, -tirar, compraId)
      }
    })
    return true
  }
  if (evento === 'PAYMENT_DELETED') {
    await prisma.$executeRawUnsafe(`UPDATE "EstudioCompra" SET "status"='CANCELADA' WHERE "id"=$1 AND "status"='PENDENTE'`, compraId)
    return true
  }
  return true // OVERDUE etc.: nada a fazer, mas o evento é nosso
}
