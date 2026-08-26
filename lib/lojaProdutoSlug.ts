// Deep link por produto da Loja. Tabela LojaItemSlug (unifica produto/variacao/combo):
// (workspaceId, tipo, refId) → slug único por loja. Ensure na build do catálogo (é o backfill).
import { prisma } from '@/lib/prisma'

let schemaOk = false
async function ensureSchema() {
  if (schemaOk) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LojaItemSlug" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "tipo" text NOT NULL,
      "refId" text NOT NULL,
      "slug" text NOT NULL,
      "criadoEm" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "LojaItemSlug_ws_slug_key" UNIQUE ("workspaceId","slug"),
      CONSTRAINT "LojaItemSlug_ws_ref_key" UNIQUE ("workspaceId","tipo","refId")
    )
  `)
  schemaOk = true
}

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export function slugify(s: string): string {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'produto'
}

// tipo+refId do item do catálogo (produto→produtoId, combo→comboId, variacao→variacaoId).
function chaveItem(it: any): { tipo: string; refId: string } | null {
  if (it?.tipo === 'produto' && it.produtoId) return { tipo: 'produto', refId: it.produtoId }
  if (it?.tipo === 'combo' && it.comboId) return { tipo: 'combo', refId: it.comboId }
  if (it?.variacaoId) return { tipo: 'variacao', refId: it.variacaoId }
  return null
}

// Garante slug pra cada item e injeta `slug` no objeto. Só grava itens novos (idempotente).
export async function ensureLojaItemSlugs(workspaceId: string, itens: any[]): Promise<void> {
  if (!itens?.length) return
  await ensureSchema()

  const existentes = await prisma.$queryRaw`
    SELECT "tipo","refId","slug" FROM "LojaItemSlug" WHERE "workspaceId" = ${workspaceId}
  ` as { tipo: string; refId: string; slug: string }[]
  const byRef = new Map(existentes.map(e => [`${e.tipo}:${e.refId}`, e.slug]))
  const usados = new Set(existentes.map(e => e.slug))

  const novos: { id: string; tipo: string; refId: string; slug: string }[] = []
  for (const it of itens) {
    const ch = chaveItem(it)
    if (!ch) continue
    const k = `${ch.tipo}:${ch.refId}`
    const jaTem = byRef.get(k)
    if (jaTem) { it.slug = jaTem; continue }
    const base = slugify(it.nome)
    let s = base, i = 2
    while (usados.has(s)) s = `${base}-${i++}`
    usados.add(s); byRef.set(k, s); it.slug = s
    novos.push({ id: gid(), tipo: ch.tipo, refId: ch.refId, slug: s })
  }

  if (novos.length) {
    for (const n of novos) {
      // ON CONFLICT no (ws,tipo,refId): se outra request criou no meio, ignora e relê depois.
      await prisma.$executeRaw`
        INSERT INTO "LojaItemSlug" ("id","workspaceId","tipo","refId","slug")
        VALUES (${n.id}, ${workspaceId}, ${n.tipo}, ${n.refId}, ${n.slug})
        ON CONFLICT ("workspaceId","tipo","refId") DO NOTHING
      `.catch(() => {}) // colisão rara de (ws,slug) por corrida — cai no fallback do próprio slug gerado
    }
    // Relê autoritativo (corrige eventuais corridas) e reatribui.
    const atualizados = await prisma.$queryRaw`
      SELECT "tipo","refId","slug" FROM "LojaItemSlug" WHERE "workspaceId" = ${workspaceId}
    ` as { tipo: string; refId: string; slug: string }[]
    const mapa = new Map(atualizados.map(e => [`${e.tipo}:${e.refId}`, e.slug]))
    for (const it of itens) {
      const ch = chaveItem(it)
      if (ch) it.slug = mapa.get(`${ch.tipo}:${ch.refId}`) || it.slug
    }
  }
}

export type ProdutoResolvido = {
  workspaceId: string
  lojaSlug: string
  tipo: 'produto' | 'variacao' | 'combo'
  refId: string
  nome: string
  preco: number
  descricao: string | null
  imgPath: string | null   // caminho relativo da imagem (host montado pelo chamador)
  disponivel: boolean
}

// Resolve (lojaSlug, produtoSlug) → dados do produto pra SSR/Open Graph. Sem sessão (público).
export async function resolverProdutoLoja(lojaSlug: string, produtoSlug: string): Promise<ProdutoResolvido | null> {
  const [loja] = await prisma.$queryRaw`
    SELECT lc."workspaceId", lc."ativo", w."moduloLoja"
    FROM "LojaConfig" lc JOIN "Workspace" w ON w."id" = lc."workspaceId"
    WHERE lc."slug" = ${lojaSlug} LIMIT 1
  ` as { workspaceId: string; ativo: boolean; moduloLoja: boolean }[]
  if (!loja) return null
  const base = { workspaceId: loja.workspaceId, lojaSlug }

  await ensureSchema()
  const [ref] = await prisma.$queryRaw`
    SELECT "tipo","refId" FROM "LojaItemSlug"
    WHERE "workspaceId" = ${loja.workspaceId} AND "slug" = ${produtoSlug} LIMIT 1
  ` as { tipo: string; refId: string }[]
  if (!ref) return null

  const lojaDisp = !!loja.ativo && !!loja.moduloLoja

  if (ref.tipo === 'combo') {
    const [c] = await prisma.$queryRaw`
      SELECT "nome","descricao", "precoCombo"::float AS preco, "ativo", "visivelLoja",
             ("imagem" IS NOT NULL) AS "temImg"
      FROM "PrecCombo" WHERE "id" = ${ref.refId} AND "workspaceId" = ${loja.workspaceId} LIMIT 1
    ` as any[]
    if (!c) return null
    return { ...base, tipo: 'combo', refId: ref.refId, nome: c.nome, preco: Number(c.preco) || 0,
      descricao: c.descricao || null, disponivel: lojaDisp && !!c.ativo && !!c.visivelLoja,
      imgPath: c.temImg ? `/api/loja/${lojaSlug}/combo-imagem/${ref.refId}` : null }
  }

  if (ref.tipo === 'produto') {
    const [p] = await prisma.$queryRaw`
      SELECT p."nome", p."descricao", p."ativo", p."visivelLoja",
             (SELECT MIN(COALESCE(NULLIF(v."precoPromocional",0), v."precoVenda"))::float
                FROM "PrecVariacao" v WHERE v."produtoId" = p."id" AND v."visivelLoja" = true AND COALESCE(v."precoVenda",0) > 0) AS preco,
             (SELECT v."id" FROM "PrecVariacao" v WHERE v."produtoId" = p."id" AND v."visivelLoja" = true AND COALESCE(v."precoVenda",0) > 0 ORDER BY COALESCE(v."precoVenda",0) ASC LIMIT 1) AS "capaId"
      FROM "PrecProduto" p WHERE p."id" = ${ref.refId} AND p."workspaceId" = ${loja.workspaceId} LIMIT 1
    ` as any[]
    if (!p) return null
    return { ...base, tipo: 'produto', refId: ref.refId, nome: p.nome, preco: Number(p.preco) || 0,
      descricao: p.descricao || null, disponivel: lojaDisp && !!p.ativo && !!p.visivelLoja && p.preco != null,
      imgPath: p.capaId ? `/api/loja/${lojaSlug}/imagem/${p.capaId}` : `/api/loja/${lojaSlug}/imagem/${ref.refId}` }
  }

  // variacao
  const [v] = await prisma.$queryRaw`
    SELECT p."nome" AS "produtoNome", v."nome" AS "variacaoNome", p."descricao",
           COALESCE(NULLIF(v."precoPromocional",0), v."precoVenda")::float AS preco,
           p."ativo", p."visivelLoja", v."visivelLoja" AS "vVisivel"
    FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
    WHERE v."id" = ${ref.refId} AND p."workspaceId" = ${loja.workspaceId} LIMIT 1
  ` as any[]
  if (!v) return null
  const label = (v.variacaoNome && String(v.variacaoNome).trim() && v.variacaoNome !== 'Padrão') ? ` — ${v.variacaoNome}` : ''
  return { ...base, tipo: 'variacao', refId: ref.refId, nome: `${v.produtoNome}${label}`, preco: Number(v.preco) || 0,
    descricao: v.descricao || null, disponivel: lojaDisp && !!v.ativo && !!v.visivelLoja && !!v.vVisivel && Number(v.preco) > 0,
    imgPath: `/api/loja/${lojaSlug}/imagem/${ref.refId}` }
}
