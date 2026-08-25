// Pedido de compra: um lançamento que faz 3 coisas (idempotente por referência=compraId):
//   (a) contas a pagar (FinLancamento DESPESA/PENDENTE + parcelas)
//   (b) atualiza o custo do material (opcional) + RESYNC dos produtos que o usam
//   (c) entrada no estoque do material
// Reusa FornecedorCompra (cabeçalho) + CompraItem (linhas) + EstMaterial* + PrecMaterial*.
import { prisma } from '@/lib/prisma'

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const r4 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 10000) / 10000
const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }

let ok = false
export async function ensureComprasSchema(): Promise<void> {
  if (ok) return
  // Pré-check via catálogo (SELECT = AccessShare, NÃO conflita): se o schema já está
  // aplicado, NÃO emite DDL. Sem isto, cada cold-start serverless refazia o
  // `ALTER TABLE "Workspace" ADD COLUMN ...` (ACCESS EXCLUSIVE na tabela mais quente do
  // sistema); colidindo com uma leitura lenta, enfileirava e TRAVAVA o app inteiro
  // (incidente de lock 25/08). Assim o caminho comum vira uma leitura barata.
  const [pronto] = await prisma.$queryRawUnsafe(`
    SELECT (
      to_regclass('public."CompraItem"') IS NOT NULL
      AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='FornecedorCompra' AND column_name='status')
      AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='Workspace' AND column_name='moduloCompras')
    ) AS ok
  `) as { ok: boolean }[]
  if (pronto?.ok) { ok = true; return }
  // Caminho raro (schema ainda não aplicado): cria uma vez.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CompraItem" (
      "id"            TEXT PRIMARY KEY,
      "compraId"      TEXT NOT NULL,
      "workspaceId"   TEXT NOT NULL,
      "materialId"    TEXT,
      "nome"          TEXT NOT NULL,
      "qtdPacotes"    NUMERIC NOT NULL DEFAULT 1,
      "qtdPacote"     NUMERIC NOT NULL DEFAULT 1,
      "precoPacote"   NUMERIC NOT NULL DEFAULT 0,
      "precoUnidade"  NUMERIC NOT NULL DEFAULT 0,
      "subtotal"      NUMERIC NOT NULL DEFAULT 0,
      "custoAtualizado" BOOLEAN NOT NULL DEFAULT false,
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CompraItem_compra_idx" ON "CompraItem" ("compraId")`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "FornecedorCompra" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'registrada'`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "moduloCompras" BOOLEAN NOT NULL DEFAULT false`)
  ok = true
}

// ── (c) Entrada de estoque — idempotente por (referencia, materialId) ──────────
export async function darEntradaEstoqueMaterial(workspaceId: string, materialId: string, quantidade: number, meta: { referencia: string; fornecedor?: string | null; fornecedorId?: string | null; usuarioNome?: string | null }): Promise<{ ok: boolean; jaFeito?: boolean }> {
  const qtd = Number(quantidade) || 0
  if (qtd <= 0) return { ok: false }
  // Só materiais monitorados no estoque (têm saldo). Se não tem, cria com 0 primeiro.
  const jaMov = await prisma.$queryRaw`
    SELECT 1 FROM "EstMaterialMovimento"
    WHERE "workspaceId" = ${workspaceId} AND "materialId" = ${materialId}
      AND "referencia" = ${meta.referencia} AND "tipo" = 'ENTRADA_COMPRA' LIMIT 1
  ` as any[]
  if (jaMov.length) return { ok: true, jaFeito: true }

  const [saldoRow] = await prisma.$queryRaw`SELECT "saldoAtual" FROM "EstMaterialSaldo" WHERE "workspaceId" = ${workspaceId} AND "materialId" = ${materialId}` as { saldoAtual: any }[]
  const saldoAtual = Number(saldoRow?.saldoAtual) || 0
  const novoSaldo = r4(saldoAtual + qtd)

  await prisma.$executeRaw`
    INSERT INTO "EstMaterialMovimento" ("id","workspaceId","materialId","tipo","quantidade","saldoApos","motivo","referencia","fornecedor","fornecedorId","usuarioNome","createdAt")
    VALUES (${gid()}, ${workspaceId}, ${materialId}, 'ENTRADA_COMPRA', ${qtd}, ${novoSaldo}, 'Entrada por compra', ${meta.referencia}, ${meta.fornecedor ?? null}, ${meta.fornecedorId ?? null}, ${meta.usuarioNome ?? null}, NOW())
  `
  await prisma.$executeRaw`
    INSERT INTO "EstMaterialSaldo" ("id","workspaceId","materialId","saldoAtual","updatedAt")
    VALUES (${gid()}, ${workspaceId}, ${materialId}, ${novoSaldo}, NOW())
    ON CONFLICT ("workspaceId","materialId") DO UPDATE SET "saldoAtual" = ${novoSaldo}, "updatedAt" = NOW()
  `
  return { ok: true }
}

// ── (b) Resync do custo do material nos produtos (delta, preserva mão de obra etc.) ──
export async function resyncCustoMaterial(workspaceId: string, materialId: string, novoPrecoUnidade: number): Promise<{ itens: number; variacoes: number }> {
  const novoPU = Number(novoPrecoUnidade) || 0
  const itens = await prisma.$queryRaw`
    SELECT "id","variacaoId","qtdUsada","custoUnit","rendimento" FROM "PrecMaterialItem" WHERE "materialId" = ${materialId}
  ` as { id: string; variacaoId: string; qtdUsada: any; custoUnit: any; rendimento: any }[]
  const deltaPorVar = new Map<string, number>()
  for (const it of itens) {
    const rend = Number(it.rendimento) || 1
    const q = Number(it.qtdUsada) || 0
    const antigo = (q * (Number(it.custoUnit) || 0)) / rend
    const novo = (q * novoPU) / rend
    deltaPorVar.set(it.variacaoId, (deltaPorVar.get(it.variacaoId) || 0) + (novo - antigo))
    await prisma.$executeRaw`UPDATE "PrecMaterialItem" SET "custoUnit" = ${novoPU} WHERE "id" = ${it.id}`
  }
  for (const [variacaoId, delta] of deltaPorVar) {
    await prisma.$executeRaw`
      UPDATE "PrecVariacao"
      SET "custoMaterial" = GREATEST(0, "custoMaterial" + ${r4(delta)}),
          "custoTotal"    = GREATEST(0, "custoTotal"    + ${r4(delta)})
      WHERE "id" = ${variacaoId}
    `
  }
  return { itens: itens.length, variacoes: deltaPorVar.size }
}

export interface CompraItemIn { materialId?: string | null; nome: string; qtdPacotes: number; qtdPacote: number; precoPacote: number; atualizarCusto?: boolean }
export interface ConcluirCompraIn {
  fornecedorId: string
  data: string           // data da compra (competência)
  nf?: string | null
  observacoes?: string | null
  itens: CompraItemIn[]
  darEntrada?: boolean   // (c) mexer no estoque
  contasPagar?: { gerar: boolean; categoriaId?: string | null; vencimento?: string | null; forma?: string | null; parcelas?: number }
  usuarioNome?: string | null
}

// ── Orquestrador ──────────────────────────────────────────────────────────────
export async function concluirPedidoCompra(workspaceId: string, p: ConcluirCompraIn) {
  await ensureComprasSchema()
  const itens = (p.itens || []).filter(i => i && i.nome && Number(i.qtdPacotes) > 0)
  if (!p.fornecedorId) throw new Error('Fornecedor obrigatório')
  if (itens.length === 0) throw new Error('Adicione ao menos 1 item')

  // Valor total = Σ (precoPacote × qtdPacotes)
  const total = r2(itens.reduce((s, i) => s + (Number(i.precoPacote) || 0) * (Number(i.qtdPacotes) || 0), 0))
  const dataCompra = p.data ? new Date(p.data) : new Date()
  const descricao = `Compra ${itens.length} item(ns)` + (p.nf ? ` · NF ${p.nf}` : '')

  // Cabeçalho (FornecedorCompra) — reusa a tabela existente.
  const compraId = gid()
  await prisma.$executeRaw`
    INSERT INTO "FornecedorCompra" ("id","fornecedorId","workspaceId","descricao","valor","data","nf","observacoes","status","createdAt")
    VALUES (${compraId}, ${p.fornecedorId}, ${workspaceId}, ${descricao}, ${total}, ${dataCompra}, ${p.nf ?? null}, ${p.observacoes ?? null}, 'concluida', NOW())
  `

  const resumo = { compraId, total, itens: itens.length, entradas: 0, custosAtualizados: 0, contasPagar: 0, variacoesRecalc: 0 }

  for (const it of itens) {
    const qtdPacotes = Number(it.qtdPacotes) || 0
    const qtdPacote = Math.max(1, Number(it.qtdPacote) || 1)
    const precoPacote = Number(it.precoPacote) || 0
    const precoUnidade = r4(precoPacote / qtdPacote)
    const subtotal = r2(precoPacote * qtdPacotes)

    await prisma.$executeRaw`
      INSERT INTO "CompraItem" ("id","compraId","workspaceId","materialId","nome","qtdPacotes","qtdPacote","precoPacote","precoUnidade","subtotal","custoAtualizado","createdAt")
      VALUES (${gid()}, ${compraId}, ${workspaceId}, ${it.materialId ?? null}, ${it.nome}, ${qtdPacotes}, ${qtdPacote}, ${precoPacote}, ${precoUnidade}, ${subtotal}, ${!!it.atualizarCusto}, NOW())
    `

    if (it.materialId) {
      // (b) atualizar custo se a artesã aceitou
      if (it.atualizarCusto) {
        await prisma.$executeRaw`
          UPDATE "PrecMaterial" SET "precoPacote" = ${precoPacote}, "qtdPacote" = ${qtdPacote}, "precoUnidade" = ${precoUnidade}, "updatedAt" = NOW()
          WHERE "id" = ${it.materialId} AND "workspaceId" = ${workspaceId}
        `
        const rs = await resyncCustoMaterial(workspaceId, it.materialId, precoUnidade)
        resumo.custosAtualizados++
        resumo.variacoesRecalc += rs.variacoes
      }
      // (c) entrada no estoque (unidades = pacotes × un/pacote)
      if (p.darEntrada) {
        const e = await darEntradaEstoqueMaterial(workspaceId, it.materialId, qtdPacotes * qtdPacote, { referencia: compraId, fornecedorId: p.fornecedorId, usuarioNome: p.usuarioNome })
        if (e.ok && !e.jaFeito) resumo.entradas++
      }
    }
  }

  // (a) contas a pagar — idempotente por referencia=compraId
  if (p.contasPagar?.gerar && total > 0) {
    const jaTem = await prisma.$queryRaw`SELECT 1 FROM "FinLancamento" WHERE "workspaceId" = ${workspaceId} AND "referencia" = ${compraId} LIMIT 1` as any[]
    if (!jaTem.length) {
      const parcelas = Math.max(1, Math.min(Number(p.contasPagar.parcelas) || 1, 60))
      const venc0 = p.contasPagar.vencimento ? new Date(p.contasPagar.vencimento) : dataCompra
      const valorParcela = r2(total / parcelas)
      const recId = parcelas > 1 ? gid() : null
      const catId = p.contasPagar.categoriaId || null
      const forma = p.contasPagar.forma ? ` · ${p.contasPagar.forma}` : ''
      for (let i = 0; i < parcelas; i++) {
        const desc = parcelas > 1 ? `${descricao} (${i + 1}/${parcelas})${forma}` : `${descricao}${forma}`
        await prisma.$executeRaw`
          INSERT INTO "FinLancamento" ("id","workspaceId","tipo","categoriaId","descricao","valor","data","status","canal","referencia","recorrenciaId","recorrencia","parcela","totalParcelas","createdAt")
          VALUES (${gid()}, ${workspaceId}, 'DESPESA', ${catId}, ${desc}, ${valorParcela}, ${addMonths(venc0, i)}, 'PENDENTE', ${p.contasPagar.forma ?? null}, ${compraId}, ${recId}, ${parcelas > 1 ? 'PARCELAS' : null}, ${i + 1}, ${parcelas}, NOW())
        `
        resumo.contasPagar++
      }
    }
  }

  return resumo
}
