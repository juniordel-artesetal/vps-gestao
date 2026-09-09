// GET de UM pedido de compra completo (Q3). O histórico lista item por item e não mostra
// frete, desconto nem o total do pedido — aqui vem tudo junto: cabeçalho + itens + as contas
// a pagar geradas (vinculadas por referencia = compraId).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureComprasSchema } from '@/lib/compras'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureComprasSchema()
  const { id } = await params
  const workspaceId = session.user.workspaceId

  const [compra] = await prisma.$queryRaw`
    SELECT fc."id", fc."codigo", fc."descricao", fc."valor"::float AS "valor",
           TO_CHAR(fc."data", 'YYYY-MM-DD') AS "data",
           fc."nf", fc."observacoes", fc."status",
           fc."freteValor"::float AS "freteValor", fc."freteTipo", fc."freteResponsavel",
           fc."descontoValor"::float AS "descontoValor", fc."descontoTipo",
           TO_CHAR(fc."canceladaEm", 'YYYY-MM-DD') AS "canceladaEm", fc."canceladaPor",
           fc."fornecedorId", f."nome" AS "fornecedorNome", f."whatsapp" AS "fornecedorWhatsapp"
    FROM "FornecedorCompra" fc
    LEFT JOIN "Fornecedor" f ON f."id" = fc."fornecedorId"
    WHERE fc."id" = ${id} AND fc."workspaceId" = ${workspaceId}
    LIMIT 1
  ` as any[]
  if (!compra) return NextResponse.json({ error: 'Compra não encontrada' }, { status: 404 })

  const itens = await prisma.$queryRaw`
    SELECT "id", "materialId", "nome",
           "qtdPacotes"::float AS "qtdPacotes", "qtdPacote"::float AS "qtdPacote",
           "precoPacote"::float AS "precoPacote", "precoUnidade"::float AS "precoUnidade",
           "subtotal"::float AS "subtotal", "custoAtualizado"
    FROM "CompraItem"
    WHERE "compraId" = ${id} AND "workspaceId" = ${workspaceId}
    ORDER BY "createdAt" ASC
  ` as any[]

  // Contas a pagar geradas por esta compra (a despesa parcelada + o frete terceirizado).
  const lancamentos = await prisma.$queryRaw`
    SELECT "id", "descricao", "valor"::float AS "valor", TO_CHAR("data", 'YYYY-MM-DD') AS "data",
           "status", "parcela", "totalParcelas", "observacoes"
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId} AND "referencia" = ${id}
    ORDER BY "data" ASC
  ` as any[]

  // Subtotal dos itens (base do desconto). O total já gravado no cabeçalho é (itens − desconto) + frete na NF.
  const subtotalItens = itens.reduce((s, i) => s + (Number(i.subtotal) || 0), 0)

  return NextResponse.json(serialize({ compra, itens, lancamentos, subtotalItens }))
}
