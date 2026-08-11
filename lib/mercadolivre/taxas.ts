// Taxa REAL do Mercado Livre por CONTA (Listing Prices) — depende da reputação do
// seller, então é POR WORKSPACE. Guarda as regras em MLTaxaWorkspace; a precificação
// pode ler daí (fonte única por conta). Sem conexão → fallback (catálogo global).
import { prisma } from '@/lib/prisma'
import { getAccessTokenValido } from '@/lib/mercadolivre/conta'
import type { RegraTaxa } from '@/lib/canaisVendaCalc'

const SITE = process.env.ML_SITE_ID || 'MLB'
const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const LISTING_TYPES: { id: string; variante: string }[] = [
  { id: 'gold_special', variante: 'classico' },
  { id: 'gold_pro',     variante: 'premium'  },
]
const AMOSTRAS: { preco: number; precoAte: number | null }[] = [
  { preco: 20, precoAte: 29 }, { preco: 45, precoAte: 50 }, { preco: 70, precoAte: 79 },
  { preco: 120, precoAte: 200 }, { preco: 350, precoAte: null },
]

let ok = false
export async function ensureMLTaxaWorkspace(): Promise<void> {
  if (ok) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MLTaxaWorkspace" (
      "workspaceId"  TEXT PRIMARY KEY,
      "regras"       JSONB NOT NULL DEFAULT '[]',
      "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  ok = true
}

export interface SaleFeeML { taxaPercent: number; taxaFixa: number }
export async function consultarSaleFeeML(preco: number, listingTypeId: string, token: string): Promise<SaleFeeML | null> {
  try {
    const url = `https://api.mercadolibre.com/sites/${SITE}/listing_prices?price=${encodeURIComponent(String(preco))}&listing_type_id=${encodeURIComponent(listingTypeId)}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10000)
    const r = await fetch(url, { signal: ctrl.signal, headers: { authorization: `Bearer ${token}` } })
    clearTimeout(t)
    if (!r.ok) return null
    const j: any = await r.json()
    const item = Array.isArray(j) ? j.find(x => x.listing_type_id === listingTypeId) || j[0] : j
    const det = item?.sale_fee_details
    if (!det) return null
    const percent = Number(det.percentage_fee)
    const fixo = Number(det.fixed_fee ?? 0)
    if (!Number.isFinite(percent)) return null
    return { taxaPercent: percent, taxaFixa: Number.isFinite(fixo) ? fixo : 0 }
  } catch { return null }
}

export interface ResultadoTaxaML { ok: boolean; motivo?: string; atualizou: boolean; consultas: number; falhas: number }
export async function refreshTaxasML(workspaceId: string): Promise<ResultadoTaxaML> {
  await ensureMLTaxaWorkspace()
  const token = await getAccessTokenValido(workspaceId)
  if (!token) return { ok: false, motivo: 'Conta do Mercado Livre não conectada.', atualizou: false, consultas: 0, falhas: 0 }

  const regras: RegraTaxa[] = []
  let consultas = 0, falhas = 0
  for (const lt of LISTING_TYPES) {
    for (const a of AMOSTRAS) {
      consultas++
      const fee = await consultarSaleFeeML(a.preco, lt.id, token)
      if (!fee) { falhas++; continue }
      regras.push({ variante: lt.variante, precoAte: a.precoAte ?? undefined, taxaPercent: fee.taxaPercent, taxaFixa: fee.taxaFixa, label: `ML ${lt.variante} até ${a.precoAte ?? '∞'} (API)` })
    }
  }
  let atualizou = false
  if (regras.length > 0) {
    await prisma.$executeRaw`
      INSERT INTO "MLTaxaWorkspace" ("workspaceId","regras","atualizadoEm")
      VALUES (${workspaceId}, ${JSON.stringify(regras)}::jsonb, NOW())
      ON CONFLICT ("workspaceId") DO UPDATE SET "regras" = EXCLUDED."regras", "atualizadoEm" = NOW()
    `
    atualizou = true
  }
  return { ok: falhas < consultas, motivo: falhas > 0 ? `${falhas}/${consultas} consultas falharam.` : undefined, atualizou, consultas, falhas }
}

// Regras de taxa ML da conta (para a precificação preferir sobre o catálogo global). [] = sem conexão.
export async function taxaMLWorkspace(workspaceId: string): Promise<{ regras: RegraTaxa[]; atualizadoEm: string | null }> {
  await ensureMLTaxaWorkspace()
  const [r] = await prisma.$queryRaw`
    SELECT "regras", "atualizadoEm" FROM "MLTaxaWorkspace" WHERE "workspaceId" = ${workspaceId}
  ` as { regras: any; atualizadoEm: Date | null }[]
  return { regras: Array.isArray(r?.regras) ? r.regras : [], atualizadoEm: r?.atualizadoEm ? new Date(r.atualizadoEm).toISOString() : null }
}
