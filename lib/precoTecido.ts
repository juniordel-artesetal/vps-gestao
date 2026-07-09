import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────
// "Modo tecido" da Precificação: material comprado em metro linear
// (rolo) e consumido em área (m²).
//
//   preço/metro = precoMetroLinear informado  OU  precoPacote ÷ qtdPacote (rolo)
//   preço/m²    = preço/metro ÷ larguraTecido
//
// O preço/m² (precoUnidade) é guardado com PRECISÃO TOTAL — nunca arredondar
// antes de multiplicar pela área do retalho, senão o custo distorce no centavo.
// precoPacote/qtdPacote são NOT NULL: em modo tecido sem rolo guardamos
// (preço/metro, largura), mantendo a invariante precoPacote/qtdPacote = precoUnidade.
// ─────────────────────────────────────────────────────────────

// Colunas do modo tecido — idempotente (ambientes novos sem migração manual).
export async function ensureColunasTecido() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "PrecMaterial" ADD COLUMN IF NOT EXISTS "precoMetroLinear" numeric`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "PrecMaterial" ADD COLUMN IF NOT EXISTS "larguraTecido" numeric`)
  } catch (e) { console.warn('[precoTecido] ensureColunasTecido:', e) }
}

// Número positivo ou null (aceita string do form; '' / 0 / inválido → null)
export function numPos(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

export type DerivarPrecoResult =
  | { ok: true; precoUnidade: number; precoPacoteStore: number; qtdPacoteStore: number; precoMetroLinear: number | null; larguraTecido: number | null }
  | { ok: false }

export function derivarPrecoMaterial(opts: {
  unidade: string | null
  precoPacote: number | null
  qtdPacote: number | null
  precoMetroLinear: number | null
  larguraTecido: number | null
}): DerivarPrecoResult {
  const ehM2 = opts.unidade === 'm²' || opts.unidade === 'm2'
  const larg = opts.larguraTecido

  if (ehM2 && larg) {
    const precoMetro = opts.precoMetroLinear
      ?? (opts.precoPacote && opts.qtdPacote ? opts.precoPacote / opts.qtdPacote : null)
    if (precoMetro && precoMetro > 0) {
      return {
        ok: true,
        precoUnidade:     precoMetro / larg,               // R$/m² — precisão total
        precoPacoteStore: opts.precoPacote ?? precoMetro,  // mantém rolo se informado
        qtdPacoteStore:   opts.qtdPacote ?? larg,
        precoMetroLinear: precoMetro,
        larguraTecido:    larg,
      }
    }
  }

  // Modo normal (preço por unidade direto) — ou m² incompleto cai aqui
  if (opts.precoPacote && opts.qtdPacote && opts.qtdPacote > 0) {
    return {
      ok: true,
      precoUnidade:     opts.precoPacote / opts.qtdPacote,
      precoPacoteStore: opts.precoPacote,
      qtdPacoteStore:   opts.qtdPacote,
      precoMetroLinear: null,   // sem tecido → limpa os campos
      larguraTecido:    null,
    }
  }

  return { ok: false }
}
