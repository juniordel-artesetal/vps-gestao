import { prisma } from '@/lib/prisma'
import { normNome } from '@/lib/normNome'

// Índice de preços de mercado — AGREGADO e ANÔNIMO entre workspaces.
// ★NUNCA★ retorna linhas individuais nem identifica workspace/artesã.
// Só devolve estatísticas quando há amostra mínima de FONTES DISTINTAS.
export const MIN_FONTES = 4

export type IndiceResultado =
  | { suficiente: false; motivo: 'termo_curto' | 'amostra_insuficiente'; nFontes?: number }
  | {
      suficiente: true
      termo: string
      normNome: string
      menor: number
      medio: number
      faixaMin: number
      faixaMax: number
      nFontes: number
      nAmostras: number
      unidade: string | null
      confiabilidade: 'baixa' | 'media' | 'alta'
      ondeComprar: { fornecedor: string; precoMedio: number; nCompras: number }[]
    }

function percentil(ordenado: number[], p: number): number {
  if (ordenado.length === 0) return 0
  const idx = Math.min(ordenado.length - 1, Math.max(0, Math.floor((p / 100) * ordenado.length)))
  return ordenado[idx]
}
function maisComum(vals: (string | null)[]): string | null {
  const m = new Map<string, number>()
  for (const v of vals) { const s = (v || '').trim(); if (!s) continue; m.set(s, (m.get(s) || 0) + 1) }
  let melhor: string | null = null, max = 0
  for (const [k, n] of m) if (n > max) { max = n; melhor = k }
  return melhor
}

export async function calcularIndice(query: string): Promise<IndiceResultado> {
  const qn = normNome(query)
  if (!qn || qn.length < 2) return { suficiente: false, motivo: 'termo_curto' }

  // Termo SQL amplo (primeira palavra significativa) só para NARROW; o match fino é por normNome.
  const termoBusca = (query.trim().split(/\s+/).find(w => w.length >= 3) || query.trim())
  const like = `%${termoBusca}%`

  // Leitura AGREGADA de todos os workspaces (nunca retornada ao cliente).
  const rows = await prisma.$queryRaw`
    SELECT "nome", "precoUnidade"::float AS "preco", "unidade", "workspaceId", "fornecedor"
    FROM "PrecMaterial"
    WHERE "ativo" = true AND COALESCE("precoUnidade", 0) > 0 AND "nome" ILIKE ${like}
    LIMIT 4000
  ` as { nome: string; preco: number; unidade: string | null; workspaceId: string; fornecedor: string | null }[]

  const matched = rows.filter(r => {
    const n = normNome(r.nome)
    return n === qn || n.includes(qn) || qn.includes(n)
  })

  const precos = matched.map(r => Number(r.preco)).filter(v => v > 0).sort((a, b) => a - b)
  const fontes = new Set(matched.map(r => r.workspaceId))
  const nFontes = fontes.size

  if (nFontes < MIN_FONTES || precos.length < MIN_FONTES)
    return { suficiente: false, motivo: 'amostra_insuficiente', nFontes }

  const menor = precos[0]
  const medio = precos.reduce((a, b) => a + b, 0) / precos.length

  // Onde comprar (orgânico): por fornecedor, SÓ se aparecer em ≥ 2 workspaces (anonimato).
  const porForn = new Map<string, { precos: number[]; ws: Set<string> }>()
  for (const r of matched) {
    const f = String(r.fornecedor || '').trim()
    if (!f) continue
    const g = porForn.get(f) || { precos: [], ws: new Set<string>() }
    g.precos.push(Number(r.preco)); g.ws.add(r.workspaceId)
    porForn.set(f, g)
  }
  const ondeComprar = [...porForn.entries()]
    .filter(([, g]) => g.ws.size >= 2)
    .map(([f, g]) => ({ fornecedor: f, precoMedio: g.precos.reduce((a, b) => a + b, 0) / g.precos.length, nCompras: g.precos.length }))
    .sort((a, b) => a.precoMedio - b.precoMedio)
    .slice(0, 6)

  const confiabilidade = nFontes >= 25 ? 'alta' : nFontes >= 10 ? 'media' : 'baixa'

  return {
    suficiente: true,
    termo: query.trim(),
    normNome: qn,
    menor,
    medio,
    faixaMin: percentil(precos, 25),
    faixaMax: percentil(precos, 75),
    nFontes,
    nAmostras: precos.length,
    unidade: maisComum(matched.map(r => r.unidade)),
    confiabilidade,
    ondeComprar,
  }
}
