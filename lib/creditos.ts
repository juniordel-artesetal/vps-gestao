// lib/creditos.ts
// Carteira de créditos PRÉ-PAGOS por workspace — genérica e TIPADA.
// Base única para features metradas (NF por pacote, fotos que vendem, etc.).
// Regras: saldo por tipo + cota grátis mensal + razão (ledger) auditado + consumo atômico.
// Consumo/crédito rodam em TRANSAÇÃO e são IDEMPOTENTES por `referencia`
// (unique index em CreditoMovimento.referencia — nunca debita/credita 2x).
// NUNCA SELECT * nessas tabelas.

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Cota grátis mensal padrão por tipo (parametrizável). Aplicada ao criar a linha de saldo.
export const COTA_GRATIS_PADRAO: Record<string, number> = {
  foto: 3,
  nf: 0,
}

export type MotivoMovimento = 'compra' | 'consumo' | 'estorno' | 'ajuste_master'

export interface SaldoTipo {
  tipo: string
  saldo: number
  cotaGratisMes: number
  cotaUsadaMes: number      // já considerando o reset do mês corrente (view read-only)
  cotaGratisRestante: number
  mesReferencia: string | null
}

export interface ResultadoConsumo {
  ok: boolean
  saldo?: number            // saldo após a operação
  usouGratis?: boolean      // se parte/todo o consumo saiu da cota grátis
  gratisUsada?: number      // quantas unidades saíram da cota grátis
  debitado?: number         // quantas unidades saíram do saldo pago
  jaProcessado?: boolean    // idempotência: referência já consumida antes
  faltam?: number           // saldo insuficiente: quantas unidades faltaram
  erro?: string
}

export interface ResultadoCredito {
  ok: boolean
  saldo?: number
  jaProcessado?: boolean
  erro?: string
}

// 'YYYY-MM' do mês corrente (fuso do servidor; suficiente p/ reset de franquia)
function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Garante que exista a linha de saldo (workspace, tipo). Idempotente (ON CONFLICT DO NOTHING).
async function garantirSaldo(tx: Prisma.TransactionClient, workspaceId: string, tipo: string) {
  const cotaPadrao = COTA_GRATIS_PADRAO[tipo] ?? 0
  await tx.$executeRaw`
    INSERT INTO "CreditoSaldo" ("id","workspaceId","tipo","saldo","cotaGratisMes","cotaUsadaMes","mesReferencia","updatedAt")
    VALUES (${gerarId()}, ${workspaceId}, ${tipo}, 0, ${cotaPadrao}, 0, ${mesAtual()}, NOW())
    ON CONFLICT ("workspaceId","tipo") DO NOTHING
  `
}

// Lê a linha de saldo COM LOCK (FOR UPDATE) dentro da transação.
async function lerSaldoTravado(tx: Prisma.TransactionClient, workspaceId: string, tipo: string) {
  const [row] = await tx.$queryRaw`
    SELECT "id", "saldo"::float AS "saldo", "cotaGratisMes"::int AS "cotaGratisMes",
           "cotaUsadaMes"::int AS "cotaUsadaMes", "mesReferencia"
    FROM "CreditoSaldo"
    WHERE "workspaceId" = ${workspaceId} AND "tipo" = ${tipo}
    FOR UPDATE
  ` as any[]
  return row
}

// Já existe movimento com essa referência? (idempotência)
async function refJaUsada(tx: Prisma.TransactionClient, referencia: string): Promise<boolean> {
  const [row] = await tx.$queryRaw`
    SELECT "id" FROM "CreditoMovimento" WHERE "referencia" = ${referencia} LIMIT 1
  ` as any[]
  return !!row
}

/**
 * CONSUMIR créditos de um tipo. Atômico e idempotente por `referencia`.
 * Ordem: usa a COTA GRÁTIS do mês primeiro; o excedente debita do saldo pago.
 * Não deixa saldo negativo — se faltar, retorna { ok:false, faltam }.
 */
export async function consumir(p: {
  workspaceId: string
  tipo: string
  qtd: number
  referencia?: string | null
}): Promise<ResultadoConsumo> {
  const qtd = Math.max(0, Math.floor(Number(p.qtd) || 0))
  if (!p.workspaceId || !p.tipo) return { ok: false, erro: 'Dados inválidos' }
  if (qtd <= 0) return { ok: false, erro: 'Quantidade inválida' }

  try {
    return await prisma.$transaction(async (tx) => {
      await garantirSaldo(tx, p.workspaceId, p.tipo)

      // Idempotência: mesma referência não debita 2x
      if (p.referencia && await refJaUsada(tx, p.referencia)) {
        const atual = await lerSaldoTravado(tx, p.workspaceId, p.tipo)
        return { ok: true, jaProcessado: true, saldo: Number(atual?.saldo) || 0 }
      }

      const row = await lerSaldoTravado(tx, p.workspaceId, p.tipo)
      const saldo = Number(row.saldo) || 0
      const cotaGratisMes = Number(row.cotaGratisMes) || 0

      // Reset da franquia se virou o mês
      const mes = mesAtual()
      const cotaUsadaMes = row.mesReferencia === mes ? (Number(row.cotaUsadaMes) || 0) : 0

      const gratisDisponivel = Math.max(0, cotaGratisMes - cotaUsadaMes)
      const usarGratis = Math.min(qtd, gratisDisponivel)
      const restante = qtd - usarGratis   // precisa sair do saldo pago

      if (restante > saldo) {
        return { ok: false, faltam: restante - saldo, saldo }
      }

      const novoSaldo = saldo - restante
      const novaCotaUsada = cotaUsadaMes + usarGratis

      await tx.$executeRaw`
        UPDATE "CreditoSaldo"
        SET "saldo" = ${novoSaldo}, "cotaUsadaMes" = ${novaCotaUsada},
            "mesReferencia" = ${mes}, "updatedAt" = NOW()
        WHERE "workspaceId" = ${p.workspaceId} AND "tipo" = ${p.tipo}
      `

      // Ledger: delta reflete o saldo PAGO (0 quando saiu tudo da franquia)
      await tx.$executeRaw`
        INSERT INTO "CreditoMovimento" ("id","workspaceId","tipo","delta","motivo","referencia","saldoResultante","createdAt")
        VALUES (${gerarId()}, ${p.workspaceId}, ${p.tipo}, ${-restante}, 'consumo', ${p.referencia ?? null}, ${novoSaldo}, NOW())
      `

      return {
        ok: true,
        saldo: novoSaldo,
        usouGratis: usarGratis > 0,
        gratisUsada: usarGratis,
        debitado: restante,
      }
    })
  } catch (e: any) {
    // Corrida na mesma referência: o unique index barra a 2ª — tratamos como já processado
    if (e?.code === 'P2002' || String(e?.message || '').includes('CreditoMov_ref_uniq')) {
      return { ok: true, jaProcessado: true }
    }
    console.error('[creditos.consumir]', e)
    return { ok: false, erro: 'Erro interno' }
  }
}

/**
 * CREDITAR créditos (compra de pacote via webhook, concessão manual do Master, estorno).
 * Atômico e idempotente por `referencia`.
 */
export async function creditar(p: {
  workspaceId: string
  tipo: string
  qtd: number
  motivo?: MotivoMovimento
  referencia?: string | null
}): Promise<ResultadoCredito> {
  const qtd = Math.floor(Number(p.qtd) || 0)
  const motivo: MotivoMovimento = p.motivo ?? 'compra'
  if (!p.workspaceId || !p.tipo) return { ok: false, erro: 'Dados inválidos' }
  if (qtd <= 0) return { ok: false, erro: 'Quantidade inválida' }

  try {
    return await prisma.$transaction(async (tx) => {
      await garantirSaldo(tx, p.workspaceId, p.tipo)

      if (p.referencia && await refJaUsada(tx, p.referencia)) {
        const atual = await lerSaldoTravado(tx, p.workspaceId, p.tipo)
        return { ok: true, jaProcessado: true, saldo: Number(atual?.saldo) || 0 }
      }

      const row = await lerSaldoTravado(tx, p.workspaceId, p.tipo)
      const saldo = Number(row.saldo) || 0
      const novoSaldo = saldo + qtd

      await tx.$executeRaw`
        UPDATE "CreditoSaldo" SET "saldo" = ${novoSaldo}, "updatedAt" = NOW()
        WHERE "workspaceId" = ${p.workspaceId} AND "tipo" = ${p.tipo}
      `
      await tx.$executeRaw`
        INSERT INTO "CreditoMovimento" ("id","workspaceId","tipo","delta","motivo","referencia","saldoResultante","createdAt")
        VALUES (${gerarId()}, ${p.workspaceId}, ${p.tipo}, ${qtd}, ${motivo}, ${p.referencia ?? null}, ${novoSaldo}, NOW())
      `
      return { ok: true, saldo: novoSaldo }
    })
  } catch (e: any) {
    if (e?.code === 'P2002' || String(e?.message || '').includes('CreditoMov_ref_uniq')) {
      return { ok: true, jaProcessado: true }
    }
    console.error('[creditos.creditar]', e)
    return { ok: false, erro: 'Erro interno' }
  }
}

/** Saldo por tipo do workspace, já com o reset do mês corrente aplicado na leitura. */
export async function saldos(workspaceId: string): Promise<SaldoTipo[]> {
  const mes = mesAtual()
  const rows = await prisma.$queryRaw`
    SELECT "tipo", "saldo"::float AS "saldo", "cotaGratisMes"::int AS "cotaGratisMes",
           "cotaUsadaMes"::int AS "cotaUsadaMes", "mesReferencia"
    FROM "CreditoSaldo"
    WHERE "workspaceId" = ${workspaceId}
    ORDER BY "tipo" ASC
  ` as any[]
  return rows.map((r) => {
    const cotaUsadaMes = r.mesReferencia === mes ? (Number(r.cotaUsadaMes) || 0) : 0
    const cotaGratisMes = Number(r.cotaGratisMes) || 0
    return {
      tipo: r.tipo,
      saldo: Number(r.saldo) || 0,
      cotaGratisMes,
      cotaUsadaMes,
      cotaGratisRestante: Math.max(0, cotaGratisMes - cotaUsadaMes),
      mesReferencia: r.mesReferencia ?? null,
    }
  })
}

/** Histórico (ledger) do workspace — mais recentes primeiro. */
export async function historico(workspaceId: string, tipo?: string | null, limite = 100) {
  const lim = Math.min(500, Math.max(1, limite))
  const rows = tipo
    ? await prisma.$queryRaw`
        SELECT "id","tipo","delta"::float AS "delta","motivo","referencia",
               "saldoResultante"::float AS "saldoResultante","createdAt"
        FROM "CreditoMovimento"
        WHERE "workspaceId" = ${workspaceId} AND "tipo" = ${tipo}
        ORDER BY "createdAt" DESC LIMIT ${lim}
      ` as any[]
    : await prisma.$queryRaw`
        SELECT "id","tipo","delta"::float AS "delta","motivo","referencia",
               "saldoResultante"::float AS "saldoResultante","createdAt"
        FROM "CreditoMovimento"
        WHERE "workspaceId" = ${workspaceId}
        ORDER BY "createdAt" DESC LIMIT ${lim}
      ` as any[]
  return rows
}
