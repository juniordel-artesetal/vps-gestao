// Atribuição de indicação — link /r/{slug} + cupom no cadastro.
//
// REGRAS (fechadas pelo Diretor):
//   • CUPOM válido VENCE o link. Cupom digitado que não resolve NÃO bloqueia o
//     cadastro — cai no cookie do link e sinaliza "cupom não encontrado".
//   • Janela de 30 dias, last-click: cada visita a /r sobrescreve o cookie.
//   • Depois que o Lead grava o parceiroId, a atribuição é PERMANENTE (não há
//     campo "expira"): a indicada pode assinar dias depois que parceiroDoWorkspace
//     ainda a encontra pelo Lead.
//
// Tudo atrás da flag PARCEIRAS_ATIVO — com ela OFF, nada disto roda e o funil se
// comporta exatamente como hoje.
import { prisma } from '@/lib/prisma'

export const COOKIE_REF = 'soa_ref'
export const JANELA_DIAS = 30
const JANELA_MS = JANELA_DIAS * 24 * 60 * 60 * 1000

/** Trial da indicada por INFLUENCIADORA: 14 dias (nova política 01/09/2026 — substitui os
 *  antigos 30 dias). Só vale quando o cupom/link é de uma influenciadora (selo). O MAIOR
 *  trial vence (regra GREATEST) — nunca encurta um trial já concedido. */
export const DIAS_TRIAL_INFLUENCIADORA = 14

/** Flag da frente. Valor exato "on" (como as demais). */
export function parceirasAtivo(): boolean {
  return String(process.env.PARCEIRAS_ATIVO || '').toLowerCase() === 'on'
}

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Parceiro ATIVO pelo linkSlug (usado pela rota /r). Só o id. */
export async function parceiroPorSlug(slug: string): Promise<{ id: string } | null> {
  const [p] = await prisma.$queryRaw`
    SELECT "id" FROM "Parceiro" WHERE "linkSlug" = ${slug} AND "ativo" = true LIMIT 1
  ` as { id: string }[]
  return p ?? null
}

async function parceiroPorCupom(cupom: string): Promise<{ id: string } | null> {
  const [p] = await prisma.$queryRaw`
    SELECT "id" FROM "Parceiro" WHERE lower("cupom") = lower(${cupom}) AND "ativo" = true LIMIT 1
  ` as { id: string }[]
  return p ?? null
}

async function parceiroAtivo(id: string): Promise<boolean> {
  const [p] = await prisma.$queryRaw`
    SELECT 1 AS ok FROM "Parceiro" WHERE "id" = ${id} AND "ativo" = true LIMIT 1
  ` as { ok: number }[]
  return !!p
}

export interface Atribuicao {
  /** null quando não há atribuição resolvida. */
  parceiroId: string | null
  via: 'cupom' | 'link' | null
  /** true quando um cupom foi DIGITADO mas não resolveu (aviso gentil, sem bloquear). */
  cupomNaoEncontrado: boolean
}

/**
 * Resolve a atribuição do cadastro. Ordem: cupom válido vence; senão o cookie do
 * link (se dentro de 30 dias e ainda de parceiro ativo).
 */
export async function resolverAtribuicao(
  cupom: string | null | undefined,
  cookieRaw: string | null | undefined,
): Promise<Atribuicao> {
  let cupomNaoEncontrado = false

  const c = (cupom ?? '').trim()
  if (c) {
    const p = await parceiroPorCupom(c)
    if (p) return { parceiroId: p.id, via: 'cupom', cupomNaoEncontrado: false }
    cupomNaoEncontrado = true // digitou e não resolveu → tenta o link, sem bloquear
  }

  if (cookieRaw) {
    try {
      const obj = JSON.parse(cookieRaw) as { parceiroId?: string; ts?: number }
      if (obj.parceiroId && obj.ts && Date.now() - obj.ts < JANELA_MS && (await parceiroAtivo(obj.parceiroId))) {
        return { parceiroId: obj.parceiroId, via: 'link', cupomNaoEncontrado }
      }
    } catch {
      /* cookie corrompido — ignora */
    }
  }

  return { parceiroId: null, via: null, cupomNaoEncontrado }
}

/**
 * Grava o Lead de atribuição (o elo durável workspace→parceiro que
 * parceiroDoWorkspace lê depois). `telefone` é NOT NULL no schema e o cadastro
 * não coleta — placeholder vazio; o Lead de atribuição não usa o telefone.
 */
export async function registrarLeadAtribuicao(p: {
  workspaceId: string
  parceiroId: string
  via: 'cupom' | 'link'
  nome: string
  email: string
}): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "Lead" ("id","nome","telefone","email","origem","consentimento",
                        "parceiroId","tipoAtribuicao","status","workspaceId","createdAt")
    VALUES (${gerarId()}, ${p.nome}, '', ${p.email}, 'parceira', true,
            ${p.parceiroId}, ${p.via}, 'cadastrou', ${p.workspaceId}, NOW())
  `
}

/** A indicada tem parceira atribuída? (base do split de comissão.) */
export async function temParceiraAtribuida(workspaceId: string): Promise<boolean> {
  const [l] = await prisma.$queryRaw`
    SELECT 1 AS ok FROM "Lead"
    WHERE "workspaceId" = ${workspaceId} AND "parceiroId" IS NOT NULL LIMIT 1
  ` as { ok: number }[]
  return !!l
}

/** A indicada veio de uma INFLUENCIADORA? (base do trial de 14 dias — decisão do Júnior:
 *  o benefício estendido é exclusivo de influenciadora, não de parceira comum.) A
 *  influenciadora é o Parceiro cujo workspace (via userId, dual-identidade) tem selo. */
export async function temInfluenciadoraAtribuida(workspaceId: string): Promise<boolean> {
  const [l] = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM "Lead" l
    JOIN "Parceiro" p ON p."id" = l."parceiroId"
    JOIN "User" u ON u."id" = p."userId"
    JOIN "Workspace" w ON w."id" = u."workspaceId"
    WHERE l."workspaceId" = ${workspaceId} AND l."parceiroId" IS NOT NULL
      AND w."selo" = 'influenciadora'
    LIMIT 1
  ` as { ok: number }[]
  return !!l
}
