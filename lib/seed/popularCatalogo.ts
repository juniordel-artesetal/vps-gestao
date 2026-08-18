// Popula o catálogo de um workspace a partir de um SegmentoSeed: materiais (dedup por nome),
// produtos + variação base (dedup por nome) e o vínculo material→produto (composição).
// Setores só quando comSetores=true (onboarding de novo assinante). Tudo SEM preços (custos/preço = 0).
// Transação POR SEGMENTO, com INSERTs em BATELADA (poucas queries) — evita estourar o timeout da
// transação interativa (antes eram ~150 round-trips sequenciais → 500 "Transaction closed"). Prisma raw.
import { prisma } from '@/lib/prisma'
import { SEGMENTO_POR_ID, type SegmentoSeed } from '@/lib/seed/catalogoSegmentos'
import { Prisma } from '@prisma/client'

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

/** Aplica UM segmento dentro de uma transação já aberta. Exportado para teste (tx-rollback). */
export async function aplicarSegmentoTx(tx: Tx, workspaceId: string, seg: SegmentoSeed, comSetores: boolean): Promise<ResultadoPopular> {
  const r = zero()

  // 1) MATERIAIS — junta todos os nomes necessários (lista do segmento + citados nas composições),
  //    busca os existentes numa query e cria os que faltam num único INSERT em batelada.
  const necessarios = new Map<string, { nome: string; unidade: string }>() // lower(nome) -> {nome, unidade}
  for (const m of seg.materiais) {
    const k = m.nome.trim().toLowerCase()
    if (k && !necessarios.has(k)) necessarios.set(k, { nome: m.nome.trim(), unidade: m.unidade || 'un' })
  }
  for (const p of seg.produtos) for (const it of p.materiais) {
    const k = it.nome.trim().toLowerCase()
    if (k && !necessarios.has(k)) necessarios.set(k, { nome: it.nome.trim(), unidade: 'un' })
  }
  const chaves = [...necessarios.keys()]
  const matId = new Map<string, string>() // lower(nome) -> materialId

  if (chaves.length) {
    const existentes = await tx.$queryRaw`
      SELECT "id", lower("nome") AS k FROM "PrecMaterial"
      WHERE "workspaceId" = ${workspaceId} AND lower("nome") IN (${Prisma.join(chaves)})
    ` as { id: string; k: string }[]
    for (const e of existentes) { matId.set(e.k, e.id); r.materiaisReusados++ }

    const faltam = chaves.filter(k => !matId.has(k))
    if (faltam.length) {
      const rows = faltam.map(k => {
        const id = gid(); matId.set(k, id)
        const m = necessarios.get(k)!
        return Prisma.sql`(${id}, ${workspaceId}, ${m.nome}, ${m.unidade}, 0, 1, 0, true, NOW(), NOW())`
      })
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "PrecMaterial" ("id","workspaceId","nome","unidade","precoPacote","qtdPacote","precoUnidade","ativo","createdAt","updatedAt")
        VALUES ${Prisma.join(rows)}
      `)
      r.materiaisCriados += faltam.length
    }
  }

  // 2) PRODUTOS — busca os nomes já existentes numa query; monta produtos + variação base + itens
  //    (todos os ids gerados no app) e insere em 3 INSERTs em batelada (ordem: produto → variação → itens).
  const nomesProd = seg.produtos.map(p => p.nome.trim())
  const jaTem = new Set<string>()
  if (nomesProd.length) {
    const ex = await tx.$queryRaw`
      SELECT lower("nome") AS k FROM "PrecProduto"
      WHERE "workspaceId" = ${workspaceId} AND lower("nome") IN (${Prisma.join(nomesProd.map(n => n.toLowerCase()))})
    ` as { k: string }[]
    for (const e of ex) jaTem.add(e.k)
  }

  const prodRows: Prisma.Sql[] = [], varRows: Prisma.Sql[] = [], itemRows: Prisma.Sql[] = []
  for (const p of seg.produtos) {
    if (jaTem.has(p.nome.trim().toLowerCase())) { r.produtosPulados++; continue }
    const pid = gid(), vid = gid()
    prodRows.push(Prisma.sql`(${pid}, ${workspaceId}, ${p.nome.trim()}, ${null}, ${p.categoria || null}, true, NOW(), NOW())`)
    varRows.push(Prisma.sql`(${vid}, ${pid}, 'UNITARIO', false, 0, 0, 0, 0, 0, 0, 0, false, NOW(), NOW())`)
    for (const it of p.materiais) {
      const k = it.nome.trim().toLowerCase()
      itemRows.push(Prisma.sql`(${gid()}, ${vid}, ${matId.get(k) || null}, ${it.nome.trim()}, ${it.qtd}, 0, 1)`)
    }
    r.produtosCriados++
  }

  if (prodRows.length) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "PrecProduto" ("id","workspaceId","nome","sku","categoria","ativo","createdAt","updatedAt")
      VALUES ${Prisma.join(prodRows)}
    `)
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "PrecVariacao" ("id","produtoId","tipo","isKit","custoMaterial","custoMaoObra","custoEmbalagem","custoArte","custoTotal","impostos","precoVenda","emPromo","createdAt","updatedAt")
      VALUES ${Prisma.join(varRows)}
    `)
    if (itemRows.length) await tx.$executeRaw(Prisma.sql`
      INSERT INTO "PrecMaterialItem" ("id","variacaoId","materialId","nomeMaterial","qtdUsada","custoUnit","rendimento")
      VALUES ${Prisma.join(itemRows)}
    `)
  }

  // 3) SETORES — SÓ no onboarding de novo assinante. Dedup por nome; não mexe em quem já opera.
  if (comSetores && seg.setores.length) {
    const exS = await tx.$queryRaw`
      SELECT lower("nome") AS k FROM "SetorConfig"
      WHERE "workspaceId" = ${workspaceId} AND lower("nome") IN (${Prisma.join(seg.setores.map(s => s.trim().toLowerCase()))})
    ` as { k: string }[]
    const temSetor = new Set(exS.map(e => e.k))
    const setRows: Prisma.Sql[] = []
    seg.setores.forEach((nome, i) => {
      if (temSetor.has(nome.trim().toLowerCase())) return
      setRows.push(Prisma.sql`(${gid()}, ${workspaceId}, ${nome.trim()}, ${i + 1}, true, NOW())`)
      r.setoresCriados++
    })
    if (setRows.length) await tx.$executeRaw(Prisma.sql`
      INSERT INTO "SetorConfig" ("id","workspaceId","nome","ordem","ativo","createdAt") VALUES ${Prisma.join(setRows)}
    `)
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
    // timeout folgado: mesmo em batelada, damos margem p/ latência Vercel→Neon.
    const r = await prisma.$transaction((tx) => aplicarSegmentoTx(tx, workspaceId, seg, !!opts.comSetores), { timeout: 30000, maxWait: 10000 })
    total.produtosCriados += r.produtosCriados
    total.produtosPulados += r.produtosPulados
    total.materiaisCriados += r.materiaisCriados
    total.materiaisReusados += r.materiaisReusados
    total.setoresCriados += r.setoresCriados
    feitos.push(id)
  }
  return { ...total, segmentos: feitos, ignorados }
}
