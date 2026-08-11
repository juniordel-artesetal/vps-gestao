// Mercado Livre — taxa via API OFICIAL (Listing Prices) como fonte da verdade.
// GET https://api.mercadolibre.com/sites/MLB/listing_prices?price=P&listing_type_id=TYPE
// → sale_fee_details { percentage_fee, fixed_fee }. Guarda em cache e ALIMENTA o
// registro 'mercadolivre' do CatalogoCanal (fonte única: resolverTaxaLocal lê dali).
//
// Token só via env (ML_ACCESS_TOKEN). Sem token/API → fallback: mantém o cache/catálogo
// atual e avisa. NUNCA quebra a precificação.
import { prisma } from '@/lib/prisma'
import { atualizarCatalogoCanal } from '@/lib/canaisVenda'
import type { RegraTaxa } from '@/lib/canaisVendaCalc'

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const SITE = process.env.ML_SITE_ID || 'MLB'

// Tipos de anúncio ML → variante do catálogo. gold_special = Clássico, gold_pro = Premium.
const LISTING_TYPES: { id: string; variante: string }[] = [
  { id: 'gold_special', variante: 'classico' },
  { id: 'gold_pro',     variante: 'premium'  },
]
// Preços de amostra por faixa (o custo fixo do ML muda em faixas baixas de preço).
const AMOSTRAS: { preco: number; precoAte: number | null }[] = [
  { preco: 20,  precoAte: 29 },
  { preco: 45,  precoAte: 50 },
  { preco: 70,  precoAte: 79 },
  { preco: 120, precoAte: 200 },
  { preco: 350, precoAte: null },   // faixa alta → só percentual
]

let ok = false
export async function ensureMLTaxaCache(): Promise<void> {
  if (ok) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MLTaxaCache" (
      "id"             TEXT PRIMARY KEY,
      "listingTypeId"  TEXT NOT NULL,
      "variante"       TEXT NOT NULL,
      "precoAmostra"   NUMERIC NOT NULL,
      "precoAte"       NUMERIC,
      "taxaPercent"    NUMERIC NOT NULL,
      "taxaFixa"       NUMERIC NOT NULL,
      "atualizadoEm"   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MLTaxaCache_key_idx" ON "MLTaxaCache" ("listingTypeId","precoAmostra")`)
  ok = true
}

export interface SaleFeeML { taxaPercent: number; taxaFixa: number }

/** Consulta a taxa oficial do ML para 1 preço/tipo de anúncio. null = indisponível (fallback). */
export async function consultarSaleFeeML(preco: number, listingTypeId: string): Promise<SaleFeeML | null> {
  const token = process.env.ML_ACCESS_TOKEN
  try {
    const url = `https://api.mercadolibre.com/sites/${SITE}/listing_prices?price=${encodeURIComponent(String(preco))}&listing_type_id=${encodeURIComponent(listingTypeId)}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10000)
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
    clearTimeout(t)
    if (!r.ok) return null
    const j: any = await r.json()
    const item = Array.isArray(j) ? j.find(x => x.listing_type_id === listingTypeId) || j[0] : j
    const det = item?.sale_fee_details
    if (!det) return null
    const percentual = Number(det.percentage_fee)               // ex.: 13
    const fixo = Number(det.fixed_fee ?? det.gross_amount ?? 0)  // custo fixo em R$
    if (!Number.isFinite(percentual)) return null
    return { taxaPercent: percentual, taxaFixa: Number.isFinite(fixo) ? fixo : 0 }
  } catch {
    return null
  }
}

export interface ResultadoRefreshML {
  ok: boolean
  motivo?: string
  atualizou: boolean
  consultas: number
  falhas: number
  atualizadoEm: string | null
}

/**
 * Atualiza o cache de taxas do ML e reescreve as regras do 'mercadolivre' no
 * CatalogoCanal (fonte única). Sem token/API → não toca no catálogo (fallback).
 */
export async function refreshMLTaxas(opts: { dryRun?: boolean } = {}): Promise<ResultadoRefreshML> {
  await ensureMLTaxaCache()
  if (!process.env.ML_ACCESS_TOKEN) {
    return { ok: false, motivo: 'ML_ACCESS_TOKEN ausente — usando o catálogo/cache atual (fallback).', atualizou: false, consultas: 0, falhas: 0, atualizadoEm: await ultimoAtualizadoEm() }
  }

  const regras: RegraTaxa[] = []
  let consultas = 0, falhas = 0
  for (const lt of LISTING_TYPES) {
    for (const a of AMOSTRAS) {
      consultas++
      const fee = await consultarSaleFeeML(a.preco, lt.id)
      if (!fee) { falhas++; continue }
      regras.push({
        variante: lt.variante,
        precoAte: a.precoAte ?? undefined,
        taxaPercent: fee.taxaPercent,
        taxaFixa: fee.taxaFixa,
        label: `ML ${lt.variante} até ${a.precoAte ?? '∞'} (API oficial)`,
      })
      if (!opts.dryRun) {
        await prisma.$executeRaw`
          INSERT INTO "MLTaxaCache" ("id","listingTypeId","variante","precoAmostra","precoAte","taxaPercent","taxaFixa","atualizadoEm")
          VALUES (${gerarId()}, ${lt.id}, ${lt.variante}, ${a.preco}, ${a.precoAte}, ${fee.taxaPercent}, ${fee.taxaFixa}, NOW())
          ON CONFLICT ("listingTypeId","precoAmostra") DO UPDATE SET
            "taxaPercent" = EXCLUDED."taxaPercent", "taxaFixa" = EXCLUDED."taxaFixa", "atualizadoEm" = NOW()
        `
      }
    }
  }

  // Só reescreve o catálogo se conseguimos ao menos parte das taxas (senão mantém o atual).
  let atualizou = false
  if (!opts.dryRun && regras.length > 0) {
    await atualizarCatalogoCanal('mercadolivre', { regras, atualizadoPor: 'ml-api', variantes: ['classico', 'premium'] })
    atualizou = true
  }

  return {
    ok: falhas < consultas,
    motivo: falhas > 0 ? `${falhas}/${consultas} consultas falharam.` : undefined,
    atualizou,
    consultas,
    falhas,
    atualizadoEm: await ultimoAtualizadoEm(),
  }
}

async function ultimoAtualizadoEm(): Promise<string | null> {
  const r = await prisma.$queryRaw`SELECT MAX("atualizadoEm") AS m FROM "MLTaxaCache"` as { m: Date | null }[]
  return r[0]?.m ? new Date(r[0].m).toISOString() : null
}
