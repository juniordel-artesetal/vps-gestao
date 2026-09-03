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
                  WHERE table_name='FornecedorCompra' AND column_name='freteValor')
      AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='FornecedorCompra' AND column_name='descontoValor')
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
  // Frete no pedido de compra (Feature 1) + auditoria do cancelamento (Feature 2).
  await prisma.$executeRawUnsafe(`ALTER TABLE "FornecedorCompra" ADD COLUMN IF NOT EXISTS "freteValor" NUMERIC NOT NULL DEFAULT 0`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "FornecedorCompra" ADD COLUMN IF NOT EXISTS "freteTipo" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "FornecedorCompra" ADD COLUMN IF NOT EXISTS "freteResponsavel" TEXT`)
  // Desconto final do fornecedor (Feature 3): incide sobre o subtotal dos itens; frete soma depois.
  await prisma.$executeRawUnsafe(`ALTER TABLE "FornecedorCompra" ADD COLUMN IF NOT EXISTS "descontoValor" NUMERIC NOT NULL DEFAULT 0`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "FornecedorCompra" ADD COLUMN IF NOT EXISTS "descontoTipo" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "FornecedorCompra" ADD COLUMN IF NOT EXISTS "canceladaEm" TIMESTAMPTZ`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "FornecedorCompra" ADD COLUMN IF NOT EXISTS "canceladaPor" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "moduloCompras" BOOLEAN NOT NULL DEFAULT false`)
  ok = true
}

/** Categoria "Frete/Logística" (DESPESA) do workspace — find-or-create. Retorna o id. */
async function garantirCategoriaFrete(workspaceId: string): Promise<string> {
  const [ja] = await prisma.$queryRaw`
    SELECT "id" FROM "FinCategoria"
    WHERE "workspaceId" = ${workspaceId} AND "tipo" = 'DESPESA' AND lower("nome") = 'frete/logística' LIMIT 1
  ` as { id: string }[]
  if (ja?.id) return ja.id
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "FinCategoria" ("id","workspaceId","nome","tipo","cor","icone","padrao","ordem")
    VALUES (${id}, ${workspaceId}, 'Frete/Logística', 'DESPESA', '#f97316', '🚚', false, 999)
  `
  return id
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
  // Frete (Feature 1): NA_NF soma na despesa da compra; TERCEIRIZADO vira lançamento à parte.
  freteValor?: number | string | null
  freteTipo?: 'NA_NF' | 'TERCEIRIZADO' | null
  freteResponsavel?: string | null
  // Desconto final do fornecedor (Feature 3): incide sobre o SUBTOTAL DOS ITENS (frete soma depois).
  descontoValor?: number | string | null
  descontoTipo?: 'valor' | 'percentual' | null
  usuarioNome?: string | null
}

// Abatimento do desconto final sobre o subtotal dos itens (% ou R$). Nunca passa do subtotal
// (total não fica negativo); % clampado em 0–100. Espelha abatimentoOrcamento.
export function abatimentoCompra(itensTotal: number, descontoValor: number | string | null | undefined, descontoTipo: string | null | undefined): number {
  let d = Math.max(0, Number(descontoValor) || 0)
  if (d <= 0) return 0
  const pct = descontoTipo === 'percentual'
  if (pct) d = Math.min(d, 100)
  const abate = pct ? itensTotal * (d / 100) : d
  return r2(Math.min(Math.max(0, abate), itensTotal))
}

// ── Orquestrador ──────────────────────────────────────────────────────────────
export async function concluirPedidoCompra(workspaceId: string, p: ConcluirCompraIn) {
  await ensureComprasSchema()
  const itens = (p.itens || []).filter(i => i && i.nome && Number(i.qtdPacotes) > 0)
  if (!p.fornecedorId) throw new Error('Fornecedor obrigatório')
  if (itens.length === 0) throw new Error('Adicione ao menos 1 item')

  // Total dos ITENS = Σ (precoPacote × qtdPacotes)
  const itensTotal = r2(itens.reduce((s, i) => s + (Number(i.precoPacote) || 0) * (Number(i.qtdPacotes) || 0), 0))

  // Desconto final do fornecedor (Feature 3): incide sobre o subtotal dos itens (frete soma depois).
  const descontoTipo = p.descontoTipo === 'percentual' ? 'percentual' : 'valor'
  const desconto = abatimentoCompra(itensTotal, p.descontoValor, descontoTipo)
  const itensComDesconto = r2(itensTotal - desconto)
  // Fator de rateio: reduz o custo efetivo de cada item proporcional ao seu valor
  // (proporcional ao valor ⇔ mesmo fator para todos). Reflete no custo do material e nos produtos.
  const fatorDesc = itensTotal > 0 ? itensComDesconto / itensTotal : 1

  // Frete (Feature 1): NA_NF entra na despesa da compra; TERCEIRIZADO fica à parte.
  const frete = Math.max(0, Number(p.freteValor) || 0)
  const freteTipo = frete > 0 ? (p.freteTipo === 'NA_NF' || p.freteTipo === 'TERCEIRIZADO' ? p.freteTipo : null) : null
  const freteNaNf = freteTipo === 'NA_NF' ? frete : 0
  const total = r2(itensComDesconto + freteNaNf)   // valor a pagar = (itens − desconto) + frete na NF

  const dataCompra = p.data ? new Date(p.data) : new Date()
  const descricao = `Compra ${itens.length} item(ns)` + (p.nf ? ` · NF ${p.nf}` : '')

  // Cabeçalho (FornecedorCompra) — reusa a tabela existente.
  const compraId = gid()
  await prisma.$executeRaw`
    INSERT INTO "FornecedorCompra" ("id","fornecedorId","workspaceId","descricao","valor","data","nf","observacoes","status","freteValor","freteTipo","freteResponsavel","descontoValor","descontoTipo","createdAt")
    VALUES (${compraId}, ${p.fornecedorId}, ${workspaceId}, ${descricao}, ${total}, ${dataCompra}, ${p.nf ?? null}, ${p.observacoes ?? null}, 'concluida',
            ${frete}, ${freteTipo}, ${freteTipo === 'TERCEIRIZADO' ? (p.freteResponsavel ?? null) : null}, ${desconto}, ${desconto > 0 ? descontoTipo : null}, NOW())
  `

  const resumo = { compraId, total, itensTotal, desconto, itensComDesconto, frete, freteTipo, itens: itens.length, entradas: 0, custosAtualizados: 0, contasPagar: 0, variacoesRecalc: 0, freteLancado: false }

  for (const it of itens) {
    const qtdPacotes = Number(it.qtdPacotes) || 0
    const qtdPacote = Math.max(1, Number(it.qtdPacote) || 1)
    const precoPacote = Number(it.precoPacote) || 0
    const precoUnidade = r4(precoPacote / qtdPacote)
    const subtotal = r2(precoPacote * qtdPacotes)
    // Custo EFETIVO após rateio do desconto (custo real pago) — usado no material/produtos.
    const precoPacoteEf = r4(precoPacote * fatorDesc)
    const precoUnidadeEf = r4(precoPacoteEf / qtdPacote)

    await prisma.$executeRaw`
      INSERT INTO "CompraItem" ("id","compraId","workspaceId","materialId","nome","qtdPacotes","qtdPacote","precoPacote","precoUnidade","subtotal","custoAtualizado","createdAt")
      VALUES (${gid()}, ${compraId}, ${workspaceId}, ${it.materialId ?? null}, ${it.nome}, ${qtdPacotes}, ${qtdPacote}, ${precoPacote}, ${precoUnidade}, ${subtotal}, ${!!it.atualizarCusto}, NOW())
    `

    if (it.materialId) {
      // (b) atualizar custo se a artesã aceitou
      if (it.atualizarCusto) {
        await prisma.$executeRaw`
          UPDATE "PrecMaterial" SET "precoPacote" = ${precoPacoteEf}, "qtdPacote" = ${qtdPacote}, "precoUnidade" = ${precoUnidadeEf}, "updatedAt" = NOW()
          WHERE "id" = ${it.materialId} AND "workspaceId" = ${workspaceId}
        `
        const rs = await resyncCustoMaterial(workspaceId, it.materialId, precoUnidadeEf)
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

  // Frete TERCEIRIZADO (Lalamove/Uber/…) → 2º lançamento de DESPESA, categoria Frete/Logística,
  // vinculado por referencia=compraId (o cancelamento limpa junto). Idempotente pela referência+categoria.
  if (p.contasPagar?.gerar && freteTipo === 'TERCEIRIZADO' && frete > 0) {
    const catFrete = await garantirCategoriaFrete(workspaceId)
    const jaFrete = await prisma.$queryRaw`
      SELECT 1 FROM "FinLancamento" WHERE "workspaceId" = ${workspaceId} AND "referencia" = ${compraId} AND "categoriaId" = ${catFrete} LIMIT 1
    ` as any[]
    if (!jaFrete.length) {
      const respon = (p.freteResponsavel || '').trim()
      const venc = p.contasPagar.vencimento ? new Date(p.contasPagar.vencimento) : dataCompra
      await prisma.$executeRaw`
        INSERT INTO "FinLancamento" ("id","workspaceId","tipo","categoriaId","descricao","valor","data","status","canal","referencia","observacoes","createdAt")
        VALUES (${gid()}, ${workspaceId}, 'DESPESA', ${catFrete},
                ${'Frete' + (respon ? ` — ${respon}` : '') + (p.nf ? ` · NF ${p.nf}` : '')},
                ${r2(frete)}, ${venc}, 'PENDENTE', ${p.contasPagar.forma ?? null}, ${compraId}, '[frete-compra]', NOW())
      `
      resumo.freteLancado = true
    }
  }

  return resumo
}

// ── FEATURE 2 — Cancelar pedido de compra: status CANCELADA + limpa financeiro + reverte estoque ──
export async function cancelarPedidoCompra(
  workspaceId: string, compraId: string, usuarioNome?: string | null,
): Promise<{ ok: boolean; jaCancelada?: boolean; naoEncontrada?: boolean; lancamentosRemovidos: number; estoqueRevertido: number }> {
  await ensureComprasSchema()
  return prisma.$transaction(async (tx) => {
    // Marca CANCELADA (mantém o registro). O guard status<>'CANCELADA' garante idempotência.
    const upd = await tx.$executeRaw`
      UPDATE "FornecedorCompra" SET "status" = 'CANCELADA', "canceladaEm" = NOW(), "canceladaPor" = ${usuarioNome ?? null}
      WHERE "id" = ${compraId} AND "workspaceId" = ${workspaceId} AND "status" <> 'CANCELADA'
    `
    if (Number(upd) === 0) {
      const [existe] = await tx.$queryRaw`SELECT "status" FROM "FornecedorCompra" WHERE "id" = ${compraId} AND "workspaceId" = ${workspaceId} LIMIT 1` as { status: string }[]
      return { ok: !!existe, jaCancelada: existe?.status === 'CANCELADA', naoEncontrada: !existe, lancamentosRemovidos: 0, estoqueRevertido: 0 }
    }

    // Remove TODOS os lançamentos vinculados (a despesa da compra + o frete terceirizado).
    const del = await tx.$executeRaw`DELETE FROM "FinLancamento" WHERE "workspaceId" = ${workspaceId} AND "referencia" = ${compraId}`

    // Reverte a entrada de estoque (se houve): SAIDA de estorno + baixa no saldo. Idempotente
    // (não estorna 2×: pula o que já tem movimento de estorno pra essa referência).
    const entradas = await tx.$queryRaw`
      SELECT "materialId", "quantidade"::float AS q FROM "EstMaterialMovimento"
      WHERE "workspaceId" = ${workspaceId} AND "referencia" = ${compraId} AND "tipo" = 'ENTRADA_COMPRA'
    ` as { materialId: string; q: number }[]
    let revertido = 0
    for (const e of entradas) {
      const [jaEst] = await tx.$queryRaw`
        SELECT 1 FROM "EstMaterialMovimento" WHERE "workspaceId" = ${workspaceId} AND "referencia" = ${compraId}
          AND "materialId" = ${e.materialId} AND "tipo" = 'ESTORNO_COMPRA' LIMIT 1
      ` as any[]
      if (jaEst) continue   // já estornado → não estorna 2×
      const [saldoRow] = await tx.$queryRaw`SELECT "saldoAtual" FROM "EstMaterialSaldo" WHERE "workspaceId" = ${workspaceId} AND "materialId" = ${e.materialId}` as { saldoAtual: any }[]
      const novoSaldo = r4(Math.max(0, (Number(saldoRow?.saldoAtual) || 0) - (Number(e.q) || 0)))
      await tx.$executeRaw`
        INSERT INTO "EstMaterialMovimento" ("id","workspaceId","materialId","tipo","quantidade","saldoApos","motivo","referencia","usuarioNome","createdAt")
        VALUES (${gid()}, ${workspaceId}, ${e.materialId}, 'ESTORNO_COMPRA', ${Number(e.q) || 0}, ${novoSaldo}, 'Estorno por cancelamento da compra', ${compraId}, ${usuarioNome ?? null}, NOW())
      `
      await tx.$executeRaw`UPDATE "EstMaterialSaldo" SET "saldoAtual" = ${novoSaldo}, "updatedAt" = NOW() WHERE "workspaceId" = ${workspaceId} AND "materialId" = ${e.materialId}`
      revertido++
    }

    return { ok: true, lancamentosRemovidos: Number(del), estoqueRevertido: revertido }
  })
}
