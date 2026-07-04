// lib/reconciliarVinculos.ts — reconciliação idempotente material↔produto — VPS-20260630-NQA8
// Para cada material com `pecasImportadas`, garante um PrecMaterialItem (qtdUsada=0)
// na variação padrão de cada produto citado. Independente de ordem (materiais x produtos)
// e idempotente (não duplica). qtd 0 → NÃO altera custoTotal (não infla — regressão J7RX).
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { normNome } from '@/lib/normNome'

const novoId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
function chunk<T>(arr: T[], n: number): T[][] {
  const o: T[][] = []
  for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n))
  return o
}

export async function reconciliarVinculosMateriais(
  workspaceId: string
): Promise<{ vinculosCriados: number; produtosNaoEncontrados: string[] }> {
  const mats = await prisma.$queryRaw`
    SELECT "id", "nome", "precoUnidade"::float AS "precoUnidade", "pecasImportadas"
    FROM "PrecMaterial"
    WHERE "workspaceId" = ${workspaceId}
      AND "pecasImportadas" IS NOT NULL AND "pecasImportadas" <> ''
  ` as { id: string; nome: string; precoUnidade: number; pecasImportadas: string }[]
  if (!mats.length) return { vinculosCriados: 0, produtosNaoEncontrados: [] }

  // Produto → variação padrão (prefere canal 'direta', senão menor qtdKit)
  const prodVars = await prisma.$queryRaw`
    SELECT p."id" AS pid, p."nome" AS pnome, v."id" AS vid, v."canal" AS canal, COALESCE(v."qtdKit",1)::int AS qtdkit
    FROM "PrecProduto" p JOIN "PrecVariacao" v ON v."produtoId" = p."id"
    WHERE p."workspaceId" = ${workspaceId} AND p."ativo" = true
  ` as { pid: string; pnome: string; vid: string; canal: string | null; qtdkit: number }[]
  const melhor = new Map<string, { vid: string; score: number; qtdkit: number; pnome: string }>()
  for (const r of prodVars) {
    const score = String(r.canal || '').toLowerCase() === 'direta' ? 0 : 1
    const cur = melhor.get(r.pid)
    if (!cur || score < cur.score || (score === cur.score && r.qtdkit < cur.qtdkit)) {
      melhor.set(r.pid, { vid: r.vid, score, qtdkit: r.qtdkit, pnome: r.pnome })
    }
  }
  const varPorNome = new Map<string, string>()
  for (const v of melhor.values()) {
    const k = normNome(v.pnome)
    if (!varPorNome.has(k)) varPorNome.set(k, v.vid)
  }

  // Pares (variação, material) já existentes → idempotência
  const itens = await prisma.$queryRaw`
    SELECT mi."variacaoId" AS vid, mi."materialId" AS mid
    FROM "PrecMaterialItem" mi
    JOIN "PrecVariacao" v ON v."id" = mi."variacaoId"
    JOIN "PrecProduto" p ON p."id" = v."produtoId"
    WHERE p."workspaceId" = ${workspaceId}
  ` as { vid: string; mid: string }[]
  const pares = new Set(itens.map(x => `${x.vid}|${x.mid}`))

  const vinculos: { id: string; vid: string; mid: string; nome: string; cu: number }[] = []
  const naoEnc = new Set<string>()
  const seen = new Set<string>()
  for (const m of mats) {
    const pecas = String(m.pecasImportadas).split(',').map(x => x.trim()).filter(Boolean)
    for (const peca of pecas) {
      const vid = varPorNome.get(normNome(peca))
      if (!vid) { naoEnc.add(peca); continue }
      const par = `${vid}|${m.id}`
      if (pares.has(par) || seen.has(par)) continue
      seen.add(par)
      vinculos.push({ id: novoId(), vid, mid: m.id, nome: m.nome, cu: m.precoUnidade ?? 0 })
    }
  }

  // Vínculos com qtdUsada=0 → contribuição de custo 0 (custoTotal NÃO muda)
  for (const c of chunk(vinculos, 200)) {
    const vals = c.map(v => Prisma.sql`(${v.id}, ${v.vid}, ${v.mid}, ${v.nome}, 0, ${v.cu}, 1)`)
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "PrecMaterialItem" ("id","variacaoId","materialId","nomeMaterial","qtdUsada","custoUnit","rendimento")
      VALUES ${Prisma.join(vals)}`)
  }

  return { vinculosCriados: vinculos.length, produtosNaoEncontrados: Array.from(naoEnc).sort() }
}
