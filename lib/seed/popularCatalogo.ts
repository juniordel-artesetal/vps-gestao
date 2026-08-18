// Popula o catálogo de um workspace a partir de um SegmentoSeed: materiais (dedup por nome),
// produtos + variação base (dedup por nome) e o vínculo material→produto (composição).
// Setores só quando comSetores=true (onboarding de novo assinante). Tudo SEM preços (custos/preço = 0).
// Transação POR SEGMENTO. Idempotente: rodar de novo não duplica. Prisma raw.
import { prisma } from '@/lib/prisma'
import { SEGMENTO_POR_ID, type SegmentoSeed } from '@/lib/seed/catalogoSegmentos'
import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export interface ResultadoPopular {
  produtosCriados: number
  produtosPulados: number
  materiaisCriados: number
  materiaisReusados: number
  setoresCriados: number
}
const zero = (): ResultadoPopular => ({ produtosCriados: 0, produtosPulados: 0, materiaisCriados: 0, materiaisReusados: 0, setoresCriados: 0 })

/** Resolve o id de um material por nome no workspace: reusa se existe, cria (sem preço) se não. */
async function resolverMaterial(tx: Tx, workspaceId: string, nome: string, unidade: string, cache: Map<string, string>, r: ResultadoPopular): Promise<string> {
  const chave = nome.trim().toLowerCase()
  const emCache = cache.get(chave)
  if (emCache) return emCache
  const [ex] = await tx.$queryRaw`
    SELECT "id" FROM "PrecMaterial" WHERE "workspaceId" = ${workspaceId} AND lower("nome") = ${chave} LIMIT 1
  ` as { id: string }[]
  if (ex) { cache.set(chave, ex.id); r.materiaisReusados++; return ex.id }
  const id = gid()
  await tx.$executeRaw`
    INSERT INTO "PrecMaterial" ("id","workspaceId","nome","unidade","precoPacote","qtdPacote","precoUnidade","ativo","createdAt","updatedAt")
    VALUES (${id}, ${workspaceId}, ${nome.trim()}, ${unidade || 'un'}, 0, 1, 0, true, NOW(), NOW())
  `
  cache.set(chave, id); r.materiaisCriados++
  return id
}

/** Aplica UM segmento dentro de uma transação já aberta. Exportado para teste (tx-rollback). */
export async function aplicarSegmentoTx(tx: Tx, workspaceId: string, seg: SegmentoSeed, comSetores: boolean): Promise<ResultadoPopular> {
  const r = zero()
  const cacheMat = new Map<string, string>()   // lower(nome) -> materialId (deste run)

  // 1) Materiais do segmento (dedup por nome). Popula o cache p/ os vínculos dos produtos.
  for (const m of seg.materiais) await resolverMaterial(tx, workspaceId, m.nome, m.unidade, cacheMat, r)
  const unidadePorNome = new Map(seg.materiais.map(m => [m.nome.trim().toLowerCase(), m.unidade || 'un']))

  // 2) Produtos (dedup por nome) + variação base + composição.
  for (const p of seg.produtos) {
    const [exP] = await tx.$queryRaw`
      SELECT "id" FROM "PrecProduto" WHERE "workspaceId" = ${workspaceId} AND lower("nome") = ${p.nome.trim().toLowerCase()} LIMIT 1
    ` as { id: string }[]
    if (exP) { r.produtosPulados++; continue }

    const pid = gid()
    await tx.$executeRaw`
      INSERT INTO "PrecProduto" ("id","workspaceId","nome","sku","categoria","ativo","createdAt","updatedAt")
      VALUES (${pid}, ${workspaceId}, ${p.nome.trim()}, ${null}, ${p.categoria || null}, true, NOW(), NOW())
    `
    const vid = gid()
    await tx.$executeRaw`
      INSERT INTO "PrecVariacao"
        ("id","produtoId","tipo","isKit","canal","custoMaterial","custoMaoObra","custoEmbalagem","custoArte","custoTotal","impostos","precoVenda","emPromo","createdAt","updatedAt")
      VALUES (${vid}, ${pid}, 'UNITARIO', false, ${null}, 0, 0, 0, 0, 0, 0, 0, false, NOW(), NOW())
    `
    for (const it of p.materiais) {
      const un = unidadePorNome.get(it.nome.trim().toLowerCase()) || 'un'
      const materialId = await resolverMaterial(tx, workspaceId, it.nome, un, cacheMat, r)
      await tx.$executeRaw`
        INSERT INTO "PrecMaterialItem" ("id","variacaoId","materialId","nomeMaterial","qtdUsada","custoUnit","rendimento")
        VALUES (${gid()}, ${vid}, ${materialId}, ${it.nome.trim()}, ${it.qtd}, 0, 1)
      `
    }
    r.produtosCriados++
  }

  // 3) Setores — SÓ no onboarding de novo assinante. Dedup por nome; não mexe em quem já opera.
  if (comSetores) {
    for (let i = 0; i < seg.setores.length; i++) {
      const nome = seg.setores[i]
      const [exS] = await tx.$queryRaw`
        SELECT "id" FROM "SetorConfig" WHERE "workspaceId" = ${workspaceId} AND lower("nome") = ${nome.trim().toLowerCase()} LIMIT 1
      ` as { id: string }[]
      if (exS) continue
      // Colunas idênticas ao /api/onboarding/finalizar (SetorConfig tem só estas). ordem 1-based.
      await tx.$executeRaw`
        INSERT INTO "SetorConfig" ("id","workspaceId","nome","ordem","ativo","createdAt")
        VALUES (${gid()}, ${workspaceId}, ${nome.trim()}, ${i + 1}, true, NOW())
      `
      r.setoresCriados++
    }
  }
  return r
}

/** Popula vários segmentos (por id) no workspace. comSetores só no onboarding novo. */
export async function popularSegmentos(workspaceId: string, ids: string[], opts: { comSetores?: boolean } = {}): Promise<ResultadoPopular & { segmentos: string[]; ignorados: string[] }> {
  const total = zero()
  const feitos: string[] = []
  const ignorados: string[] = []
  for (const id of ids) {
    const seg = SEGMENTO_POR_ID[id]
    // "Personalizado" (ou id desconhecido) → não popula nada, sem erro.
    if (!seg) { ignorados.push(id); continue }
    const r = await prisma.$transaction((tx) => aplicarSegmentoTx(tx, workspaceId, seg, !!opts.comSetores))
    total.produtosCriados += r.produtosCriados
    total.produtosPulados += r.produtosPulados
    total.materiaisCriados += r.materiaisCriados
    total.materiaisReusados += r.materiaisReusados
    total.setoresCriados += r.setoresCriados
    feitos.push(id)
  }
  return { ...total, segmentos: feitos, ignorados }
}
