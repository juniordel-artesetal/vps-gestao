// lib/baixarEstoqueProduto.ts
// Baixa automática do ESTOQUE DE PRODUTOS (pronta entrega) ao expedir o pedido.
// Espelha lib/baixarEstoqueMaterial.ts, mas mexe em EstProdutoSaldo/EstProdutoMovimento e
// SÓ nas variações que ESTÃO no estoque de produtos (têm EstProdutoSaldo) — assim desambigua
// configs de mesmo nome (WYVD) e nunca baixa produto sem controle de estoque.
// Idempotente por (numero do pedido, variacaoId): não baixa 2x se reprocessar.
import { prisma } from '@/lib/prisma'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

interface ProdutoPedido { nome: string; quantidade: number }

export interface ResultadoBaixaProduto {
  ok: boolean
  baixados: Array<{ variacaoId: string; nome: string; quantidade: number; saldoApos: number }>
  naoEncontrados: string[]
  avisos: string[]
}

const MOTIVO_BAIXA = 'Baixa automática (pedido enviado)'
const MOTIVO_REVERSAO = 'Reversão da baixa (pedido reaberto/cancelado)'

// Extrai a lista de produtos do pedido (camposExtras.produtos, com fallback pro campo produto).
export function produtosDoPedido(camposExtras: any, produto: string | null, quantidade: number | null): ProdutoPedido[] {
  let lista: ProdutoPedido[] = []
  try {
    const ex = typeof camposExtras === 'string' ? JSON.parse(camposExtras) : camposExtras
    if (ex && Array.isArray(ex.produtos)) {
      lista = ex.produtos
        .filter((p: any) => p && (p.nome || p.produto))
        .map((p: any) => ({ nome: String(p.nome || p.produto).trim(), quantidade: Number(p.quantidade) || 1 }))
    }
  } catch { /* ignora json inválido */ }
  if (lista.length === 0 && produto) lista = [{ nome: String(produto).trim(), quantidade: Number(quantidade) || 1 }]
  return lista
}

export async function baixarEstoqueProduto(p: {
  workspaceId: string; pedidoId: string; numero: string
  produtos: ProdutoPedido[]; usuarioNome: string
}): Promise<ResultadoBaixaProduto> {
  const res: ResultadoBaixaProduto = { ok: true, baixados: [], naoEncontrados: [], avisos: [] }
  try {
    if (!Array.isArray(p.produtos) || p.produtos.length === 0) return res

    for (const prod of p.produtos) {
      const nomeBusca = prod.nome?.trim()
      if (!nomeBusca) continue
      const qtd = Number(prod.quantidade) || 1
      if (qtd <= 0) continue

      // Acha a variação EM ESTOQUE (tem EstProdutoSaldo) que casa pelo nome. Prefere match
      // exato da variação; depois variação contida no nome do pedido; depois a mais específica.
      const vs = await prisma.$queryRaw`
        SELECT v."id" AS "variacaoId", v."nome" AS "variacaoNome", pr."nome" AS "produtoNome",
               s."saldoAtual"::int AS "saldoAtual"
        FROM "EstProdutoSaldo" s
        JOIN "PrecVariacao" v ON v."id" = s."variacaoId"
        JOIN "PrecProduto" pr ON pr."id" = v."produtoId"
        WHERE s."workspaceId" = ${p.workspaceId} AND pr."ativo" = true
          AND (
            v."nome" = ${nomeBusca}
            OR (v."nome" IS NOT NULL AND v."nome" <> '' AND ${nomeBusca} ILIKE '%' || v."nome" || '%')
            OR ${nomeBusca} ILIKE '%' || pr."nome" || '%'
          )
        ORDER BY (v."nome" = ${nomeBusca}) DESC,
                 (v."nome" IS NOT NULL AND v."nome" <> '' AND ${nomeBusca} ILIKE '%' || v."nome" || '%') DESC,
                 LENGTH(COALESCE(v."nome", '')) DESC
        LIMIT 1
      ` as { variacaoId: string; variacaoNome: string | null; produtoNome: string; saldoAtual: number }[]

      if (vs.length === 0) { res.naoEncontrados.push(nomeBusca); continue } // sem controle de estoque
      const v = vs[0]

      // Idempotência por (numero, variacaoId): já baixou esse pedido/variação?
      const ja = await prisma.$queryRaw`
        SELECT 1 FROM "EstProdutoMovimento"
        WHERE "workspaceId" = ${p.workspaceId} AND "referencia" = ${p.numero}
          AND "variacaoId" = ${v.variacaoId} AND "tipo" = 'SAIDA' AND "motivo" = ${MOTIVO_BAIXA}
        LIMIT 1
      ` as any[]
      if (ja.length) { res.avisos.push(`"${v.produtoNome}" já baixado neste pedido (idempotente)`); continue }

      const novoSaldo = Number(v.saldoAtual) - qtd
      if (novoSaldo < 0) res.avisos.push(`Saldo de "${v.produtoNome} · ${v.variacaoNome || ''}" ficou negativo: ${novoSaldo} (baixa ${qtd})`)

      await prisma.$executeRaw`
        UPDATE "EstProdutoSaldo" SET "saldoAtual" = ${novoSaldo}, "updatedAt" = NOW()
        WHERE "workspaceId" = ${p.workspaceId} AND "variacaoId" = ${v.variacaoId}
      `
      await prisma.$executeRaw`
        INSERT INTO "EstProdutoMovimento"
          ("id","workspaceId","variacaoId","tipo","quantidade","saldoApos","motivo","referencia","usuarioNome")
        VALUES (${gerarId()}, ${p.workspaceId}, ${v.variacaoId}, 'SAIDA', ${qtd}, ${novoSaldo},
                ${MOTIVO_BAIXA}, ${p.numero}, ${p.usuarioNome})
      `
      res.baixados.push({ variacaoId: v.variacaoId, nome: `${v.produtoNome} · ${v.variacaoNome || ''}`.trim(), quantidade: qtd, saldoApos: novoSaldo })
    }
    return res
  } catch (err: any) {
    console.error('[baixarEstoqueProduto] erro:', err?.message)
    return { ...res, ok: false, avisos: [`Erro: ${err?.message}`] }
  }
}

// Devolve ao estoque de produtos a baixa de um pedido (reaberto/cancelado). Idempotente.
export async function reverterBaixaEstoqueProduto(p: {
  workspaceId: string; numero: string; usuarioNome: string
}): Promise<ResultadoBaixaProduto> {
  const res: ResultadoBaixaProduto = { ok: true, baixados: [], naoEncontrados: [], avisos: [] }
  try {
    const movs = await prisma.$queryRaw`
      SELECT "variacaoId", "quantidade"::int AS "quantidade"
      FROM "EstProdutoMovimento"
      WHERE "workspaceId" = ${p.workspaceId} AND "referencia" = ${p.numero}
        AND "tipo" = 'SAIDA' AND "motivo" = ${MOTIVO_BAIXA}
    ` as { variacaoId: string; quantidade: number }[]
    if (movs.length === 0) return res

    for (const m of movs) {
      // Idempotência: já revertido?
      const ja = await prisma.$queryRaw`
        SELECT 1 FROM "EstProdutoMovimento"
        WHERE "workspaceId" = ${p.workspaceId} AND "referencia" = ${p.numero}
          AND "variacaoId" = ${m.variacaoId} AND "tipo" = 'ENTRADA' AND "motivo" = ${MOTIVO_REVERSAO}
        LIMIT 1
      ` as any[]
      if (ja.length) continue

      const [s] = await prisma.$queryRaw`
        SELECT COALESCE("saldoAtual",0)::int AS "saldoAtual" FROM "EstProdutoSaldo"
        WHERE "workspaceId" = ${p.workspaceId} AND "variacaoId" = ${m.variacaoId} LIMIT 1
      ` as { saldoAtual: number }[]
      const qtd = Math.abs(Number(m.quantidade))
      const novoSaldo = (s ? Number(s.saldoAtual) : 0) + qtd
      await prisma.$executeRaw`
        INSERT INTO "EstProdutoSaldo" ("id","workspaceId","variacaoId","saldoAtual","estoqueMinimo","updatedAt")
        VALUES (${gerarId()}, ${p.workspaceId}, ${m.variacaoId}, ${novoSaldo}, 0, NOW())
        ON CONFLICT ("workspaceId","variacaoId") DO UPDATE SET "saldoAtual" = ${novoSaldo}, "updatedAt" = NOW()
      `
      await prisma.$executeRaw`
        INSERT INTO "EstProdutoMovimento"
          ("id","workspaceId","variacaoId","tipo","quantidade","saldoApos","motivo","referencia","usuarioNome")
        VALUES (${gerarId()}, ${p.workspaceId}, ${m.variacaoId}, 'ENTRADA', ${qtd}, ${novoSaldo},
                ${MOTIVO_REVERSAO}, ${p.numero}, ${p.usuarioNome})
      `
      res.baixados.push({ variacaoId: m.variacaoId, nome: m.variacaoId, quantidade: qtd, saldoApos: novoSaldo })
    }
    return res
  } catch (err: any) {
    console.error('[reverterBaixaEstoqueProduto] erro:', err?.message)
    return { ...res, ok: false, avisos: [`Erro: ${err?.message}`] }
  }
}
