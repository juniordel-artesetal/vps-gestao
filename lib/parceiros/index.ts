// Núcleo do módulo Parceiros: atribuição (cupom/link), concessão de trial e
// ACCRUAL de comissão (regra configurável por parceiro). Payout = STUB (Asaas depois).
// Prisma raw; nunca SELECT *; senhaHash nunca sai daqui.
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export interface ParceiroBasico {
  id: string
  tipo: string
  nome: string
  ativo: boolean
  cupom: string | null
  linkSlug: string | null
  comissaoPercAnual: number
  comissaoPercMensal: number
  comissaoRecorrente: boolean
  walletId: string | null
}

const COLS_PARC = `"id","tipo","nome","ativo","cupom","linkSlug",
  "comissaoPercAnual"::float AS "comissaoPercAnual","comissaoPercMensal"::float AS "comissaoPercMensal",
  "comissaoRecorrente","walletId"`

export async function parceiroPorCupom(cupom: string): Promise<ParceiroBasico | null> {
  const c = String(cupom || '').trim().toUpperCase()
  if (!c) return null
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT ${COLS_PARC} FROM "Parceiro" WHERE UPPER("cupom") = $1 AND "ativo" = true LIMIT 1`, c
  ) as any[]
  return row ?? null
}

export async function parceiroPorSlug(slug: string): Promise<ParceiroBasico | null> {
  const s = String(slug || '').trim().toLowerCase()
  if (!s) return null
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT ${COLS_PARC} FROM "Parceiro" WHERE LOWER("linkSlug") = $1 AND "ativo" = true LIMIT 1`, s
  ) as any[]
  return row ?? null
}

export async function parceiroPorId(id: string): Promise<ParceiroBasico | null> {
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT ${COLS_PARC} FROM "Parceiro" WHERE "id" = $1 LIMIT 1`, id
  ) as any[]
  return row ?? null
}

const DIAS_TRIAL = 30

// Concede 30 dias de trial ao workspace (marca trialAte). Idempotente-ish (sempre estende p/ hoje+30).
export async function concederTrial(workspaceId: string) {
  await prisma.$executeRaw`
    UPDATE "Workspace"
    SET "trialAte" = (CURRENT_DATE + ${DIAS_TRIAL})
    WHERE "id" = ${workspaceId}
  `
}

// Registra a ATRIBUIÇÃO no cadastro: cria o Lead ligado ao parceiro + concede trial.
// Dedupe por email/telefone dentro da origem 'parceiro'. Retorna o leadId (ou null).
export async function registrarAtribuicao(p: {
  parceiro: ParceiroBasico
  tipo: 'cupom' | 'link'
  nome: string
  email?: string | null
  telefone?: string | null
  workspaceId: string
}): Promise<string | null> {
  const email = (p.email || '').trim().toLowerCase() || null
  const telefone = (p.telefone || '').replace(/\D/g, '') || null

  // Dedupe: mesma pessoa (email OU telefone) já atribuída a este parceiro
  const [dup] = await prisma.$queryRaw`
    SELECT "id" FROM "Lead"
    WHERE "parceiroId" = ${p.parceiro.id}
      AND ((${email}::text IS NOT NULL AND "email" = ${email})
        OR (${telefone}::text IS NOT NULL AND "telefone" = ${telefone}))
    LIMIT 1
  ` as any[]

  if (dup) {
    await prisma.$executeRaw`
      UPDATE "Lead" SET "status" = 'trial', "workspaceId" = ${p.workspaceId},
        "tipoAtribuicao" = ${p.tipo}
      WHERE "id" = ${dup.id}
    `
    await concederTrial(p.workspaceId)
    return dup.id
  }

  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "Lead" ("id","nome","telefone","email","origem","consentimento",
                        "parceiroId","tipoAtribuicao","status","workspaceId","createdAt")
    VALUES (${id}, ${(p.nome || '').slice(0, 120) || 'Cadastro'}, ${telefone || ''}, ${email},
            'parceiro', ${true}, ${p.parceiro.id}, ${p.tipo}, 'trial', ${p.workspaceId}, NOW())
  `
  await concederTrial(p.workspaceId)
  return id
}

// ACCRUAL de comissão quando o lead vira PAGANTE. Só INFLUENCER gera comissão.
// Regra por parceiro: percentual (mensal/anual) + comissaoRecorrente (true = todo pagamento;
// false = só o 1º). IDEMPOTENTE por `referencia`. Payout NÃO acontece aqui (stub).
export async function registrarComissaoConversao(p: {
  workspaceId: string
  base: number
  periodicidade: 'mensal' | 'anual'
  competencia: string          // ex.: '2026-07'
  referencia: string           // ex.: transação do pagamento (idempotência)
}): Promise<{ ok: boolean; valor?: number; motivo?: string }> {
  // Acha a atribuição do workspace
  const [lead] = await prisma.$queryRaw`
    SELECT "id","parceiroId" FROM "Lead"
    WHERE "workspaceId" = ${p.workspaceId} AND "parceiroId" IS NOT NULL
    ORDER BY "createdAt" ASC LIMIT 1
  ` as any[]
  if (!lead?.parceiroId) return { ok: false, motivo: 'Sem parceiro atribuído' }

  const parceiro = await parceiroPorId(lead.parceiroId)
  if (!parceiro || !parceiro.ativo) return { ok: false, motivo: 'Parceiro inativo' }
  if (parceiro.tipo !== 'influencer') return { ok: false, motivo: 'Distribuidor não gera comissão' }

  // Regra: recorrente? senão, só a 1ª comissão desse parceiro+workspace
  if (!parceiro.comissaoRecorrente) {
    const [existe] = await prisma.$queryRaw`
      SELECT "id" FROM "ParceiroComissao"
      WHERE "parceiroId" = ${parceiro.id} AND "workspaceId" = ${p.workspaceId}
      LIMIT 1
    ` as any[]
    if (existe) return { ok: false, motivo: 'Comissão de 1ª parcela já registrada' }
  }

  const perc = p.periodicidade === 'anual' ? parceiro.comissaoPercAnual : parceiro.comissaoPercMensal
  const valor = Math.round((Number(p.base) || 0) * (Number(perc) || 0) / 100 * 100) / 100
  if (valor <= 0) return { ok: false, motivo: 'Percentual/base zerado' }

  const id = gerarId()
  try {
    await prisma.$executeRaw`
      INSERT INTO "ParceiroComissao" ("id","parceiroId","leadId","workspaceId","competencia",
                                      "base","percentual","valor","status","referencia","createdAt")
      VALUES (${id}, ${parceiro.id}, ${lead.id}, ${p.workspaceId}, ${p.competencia},
              ${Number(p.base) || 0}, ${Number(perc) || 0}, ${valor}, 'pendente', ${p.referencia}, NOW())
    `
  } catch (e: any) {
    if (String(e?.message || '').includes('ParceiroComissao_ref_idx') || e?.code === 'P2002') {
      return { ok: false, motivo: 'Comissão já registrada (idempotência)' }
    }
    throw e
  }

  // marca o lead como convertido
  await prisma.$executeRaw`UPDATE "Lead" SET "status" = 'convertido' WHERE "id" = ${lead.id}`

  // Payout é STUB por ora
  await pagarComissao(parceiro.walletId, valor, id)
  return { ok: true, valor }
}

// STUB de payout — o repasse real pluga no split do Asaas quando a conta existir.
// NÃO paga nada; só registra a intenção. A comissão continua 'pendente'.
export async function pagarComissao(walletId: string | null, valor: number, comissaoId?: string): Promise<{ ok: boolean; pendente: boolean }> {
  console.log(`[parceiros] payout PENDENTE (Asaas): comissao=${comissaoId ?? '?'} wallet=${walletId ? 'definida' : 'ausente'} valor=${valor}`)
  return { ok: false, pendente: true }
}

// Gera cupom/slug sugeridos a partir do nome (Master pode sobrescrever).
export function sugerirCupom(nome: string): string {
  return (nome || 'PARC').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'PARC'
}
export function sugerirSlug(nome: string): string {
  return (nome || 'parceiro').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'parceiro'
}
