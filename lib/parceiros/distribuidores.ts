// Canal Distribuidores: ofertas nos materiais (match por nome normalizado, match ÚNICO)
// e serving da fila de promoções (teto 2x/dia por assinante + rotação por prioridade).
// Prisma raw; nunca SELECT *; imagem só sob demanda.
import { prisma } from '@/lib/prisma'
import { normNome } from '@/lib/normNome'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

export interface Oferta {
  produtoId: string
  parceiroId: string
  parceiroNome: string
  preco: number | null
  unidade: string | null
  linkCompra: string | null
}

// Para uma lista de nomes de material, devolve um mapa nomeNormalizado → Oferta.
// SÓ match ÚNICO (um produto de parceiro para aquele nome) — nunca adivinha.
export async function ofertasPorNomes(nomes: string[]): Promise<Record<string, Oferta>> {
  const normalizados = Array.from(new Set(nomes.map(normNome).filter(Boolean)))
  if (normalizados.length === 0) return {}

  const rows = await prisma.$queryRaw`
    SELECT dp."id" AS "produtoId", dp."parceiroId", p."nome" AS "parceiroNome",
           dp."nomeNormalizado", dp."preco"::float AS "preco", dp."unidade", dp."linkCompra"
    FROM "DistribuidorProduto" dp
    JOIN "Parceiro" p ON p."id" = dp."parceiroId"
    WHERE dp."ativo" = true AND p."ativo" = true AND p."tipo" = 'distribuidor'
      AND dp."nomeNormalizado" = ANY(${normalizados}::text[])
  ` as any[]

  // Agrupa por nome; descarta ambíguos (2+ produtos para o mesmo nome)
  const porNome: Record<string, Oferta[]> = {}
  for (const r of rows) {
    (porNome[r.nomeNormalizado] ||= []).push({
      produtoId: r.produtoId, parceiroId: r.parceiroId, parceiroNome: r.parceiroNome,
      preco: r.preco, unidade: r.unidade, linkCompra: r.linkCompra,
    })
  }
  const out: Record<string, Oferta> = {}
  for (const [nome, lista] of Object.entries(porNome)) {
    if (lista.length === 1) out[nome] = lista[0]   // match único
  }
  return out
}

// Incrementa impressão das ofertas efetivamente exibidas.
export async function registrarImpressaoOfertas(produtoIds: string[]) {
  if (!produtoIds.length) return
  await prisma.$executeRaw`
    UPDATE "DistribuidorProduto" SET "impressoes" = "impressoes" + 1
    WHERE "id" = ANY(${produtoIds}::text[])
  `
}

export async function registrarCliqueOferta(produtoId: string): Promise<string | null> {
  const [row] = await prisma.$queryRaw`
    SELECT "linkCompra" FROM "DistribuidorProduto" WHERE "id" = ${produtoId} AND "ativo" = true LIMIT 1
  ` as any[]
  if (!row) return null
  await prisma.$executeRaw`UPDATE "DistribuidorProduto" SET "cliques" = "cliques" + 1 WHERE "id" = ${produtoId}`
  return row.linkCompra || null
}

// ── Fila de promoções ───────────────────────────────────────────────────────
const TETO_DIA = 2

// Serve UMA promoção elegível respeitando o teto de 2x/dia por assinante e rotação.
// Rotação: entre as elegíveis (não estouradas), escolhe a de MAIOR prioridade com MENOS
// exibições hoje; empate → a menos exibida no total. Registra a exibição + impressão.
export async function servirPromocao(workspaceId: string): Promise<{
  id: string; titulo: string; descricao: string | null; cupom: string | null; linkCompra: string | null; parceiroNome: string
} | null> {
  const hoje = new Date().toISOString().slice(0, 10)

  const elegiveis = await prisma.$queryRaw`
    SELECT dp."id", dp."titulo", dp."descricao", dp."cupom", dp."linkCompra", dp."prioridade",
           p."nome" AS "parceiroNome",
           COALESCE(pe."vezes", 0) AS "vezesHoje"
    FROM "DistribuidorPromocao" dp
    JOIN "Parceiro" p ON p."id" = dp."parceiroId"
    LEFT JOIN "PromocaoExibicao" pe
      ON pe."promocaoId" = dp."id" AND pe."workspaceId" = ${workspaceId} AND pe."data" = ${hoje}::date
    WHERE dp."ativo" = true AND p."ativo" = true
      AND (dp."dataInicio" IS NULL OR dp."dataInicio" <= ${hoje}::date)
      AND (dp."dataFim"    IS NULL OR dp."dataFim"    >= ${hoje}::date)
      AND COALESCE(pe."vezes", 0) < ${TETO_DIA}
    ORDER BY dp."prioridade" DESC, COALESCE(pe."vezes", 0) ASC, dp."impressoes" ASC
    LIMIT 1
  ` as any[]

  const promo = elegiveis[0]
  if (!promo) return null

  // Registra exibição (upsert por workspace+promo+dia) e impressão
  await prisma.$executeRaw`
    INSERT INTO "PromocaoExibicao" ("id","workspaceId","promocaoId","data","vezes")
    VALUES (${gerarId()}, ${workspaceId}, ${promo.id}, ${hoje}::date, 1)
    ON CONFLICT ("workspaceId","promocaoId","data") DO UPDATE SET "vezes" = "PromocaoExibicao"."vezes" + 1
  `
  await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "impressoes" = "impressoes" + 1 WHERE "id" = ${promo.id}`

  return {
    id: promo.id, titulo: promo.titulo, descricao: promo.descricao,
    cupom: promo.cupom, linkCompra: promo.linkCompra, parceiroNome: promo.parceiroNome,
  }
}

export async function registrarCliquePromocao(promocaoId: string): Promise<string | null> {
  const [row] = await prisma.$queryRaw`
    SELECT "linkCompra" FROM "DistribuidorPromocao" WHERE "id" = ${promocaoId} AND "ativo" = true LIMIT 1
  ` as any[]
  if (!row) return null
  await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "cliques" = "cliques" + 1 WHERE "id" = ${promocaoId}`
  return row.linkCompra || null
}

export { normNome }
