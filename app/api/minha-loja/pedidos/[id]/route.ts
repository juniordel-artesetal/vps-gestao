// Vitrine — aprovar / recusar (cancelar) um pedido que entrou pela Loja (A3).
//   aprovar  → aprovacao='aprovado' + lança a RECEITA no caixa (loja→financeiro na aprovação).
//   recusar  → aprovacao='recusado' + status CANCELADO + remove o lançamento (se houver) + estorna o estoque.
// Transação, idempotente, auditado (PedidoHistorico). RAW only; workspaceId da sessão.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

export const dynamic = 'force-dynamic'
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const usuarioNome = session.user.name || null
  const { id } = await params
  const { acao } = await req.json().catch(() => ({}))
  if (acao !== 'aprovar' && acao !== 'recusar') return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })

  const [ped] = await prisma.$queryRaw`
    SELECT "id","numero","valor"::float AS valor, "clienteId", "canal", "status",
           ("camposExtras"::jsonb -> 'loja' ->> 'aprovacao') AS aprovacao
    FROM "Order" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as { id: string; numero: string; valor: number; clienteId: string | null; canal: string; status: string; aprovacao: string | null }[]
  if (!ped) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  if (ped.canal !== 'Loja') return NextResponse.json({ error: 'Só pedidos da Loja têm aprovação' }, { status: 400 })

  try {
    return await prisma.$transaction(async (tx) => {
      if (acao === 'aprovar') {
        // Idempotente: se já aprovado, não relança.
        const upd = await tx.$executeRaw`
          UPDATE "Order" SET "camposExtras" = jsonb_set("camposExtras"::jsonb, '{loja,aprovacao}', '"aprovado"'), "updatedAt" = NOW()
          WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} AND COALESCE("camposExtras"::jsonb->'loja'->>'aprovacao','pendente') <> 'aprovado'
        `
        if (Number(upd) > 0 && Number(ped.valor) > 0) {
          const jaTem = await tx.$queryRaw`SELECT 1 FROM "FinLancamento" WHERE "workspaceId" = ${workspaceId} AND "referencia" = ${ped.numero} AND "canal" = 'Loja' LIMIT 1` as any[]
          if (!jaTem.length) {
            await tx.$executeRaw`
              INSERT INTO "FinLancamento" ("id","workspaceId","tipo","categoriaId","descricao","valor","data","status","dataRealizada","valorRealizado","canal","referencia","observacoes","clienteId")
              VALUES (${gid()}, ${workspaceId}, 'RECEITA', NULL, ${`[loja-auto] Pedido #${ped.numero} — Loja`}, ${ped.valor}, NOW()::date, 'PENDENTE', NULL, NULL, 'Loja', ${ped.numero}, '[loja-auto]', ${ped.clienteId})
            `
          }
          await tx.$executeRaw`INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome") VALUES (${gid()}, ${id}, ${workspaceId}, 'APROVACAO', 'Pedido da loja aprovado (entrou no caixa)', ${usuarioNome})`.catch(() => {})
        }
        return NextResponse.json(serialize({ ok: true, aprovacao: 'aprovado' }))
      }

      // recusar / cancelar
      const upd = await tx.$executeRaw`
        UPDATE "Order" SET "camposExtras" = jsonb_set("camposExtras"::jsonb, '{loja,aprovacao}', '"recusado"'), "status" = 'CANCELADO', "updatedAt" = NOW()
        WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} AND COALESCE("camposExtras"::jsonb->'loja'->>'aprovacao','pendente') <> 'recusado'
      `
      // Remove o lançamento (se já tinha sido criado numa aprovação anterior).
      const del = await tx.$executeRaw`DELETE FROM "FinLancamento" WHERE "workspaceId" = ${workspaceId} AND "referencia" = ${ped.numero} AND "canal" = 'Loja'`
      // Estorna o estoque baixado na criação (SAIDA por 'Venda pela Loja Virtual') — idempotente.
      const saidas = await tx.$queryRaw`
        SELECT "variacaoId", "quantidade"::float AS q FROM "EstProdutoMovimento"
        WHERE "workspaceId" = ${workspaceId} AND "referencia" = ${ped.numero} AND "tipo" = 'SAIDA'
      ` as { variacaoId: string; q: number }[]
      let estornado = 0
      for (const s of saidas) {
        const [je] = await tx.$queryRaw`SELECT 1 FROM "EstProdutoMovimento" WHERE "workspaceId" = ${workspaceId} AND "referencia" = ${ped.numero} AND "variacaoId" = ${s.variacaoId} AND "tipo" = 'ENTRADA_ESTORNO' LIMIT 1` as any[]
        if (je) continue
        const [sal] = await tx.$queryRaw`SELECT "saldoAtual"::float AS sa FROM "EstProdutoSaldo" WHERE "workspaceId" = ${workspaceId} AND "variacaoId" = ${s.variacaoId}` as { sa: number }[]
        const novo = (Number(sal?.sa) || 0) + (Number(s.q) || 0)
        await tx.$executeRaw`UPDATE "EstProdutoSaldo" SET "saldoAtual" = ${novo}, "updatedAt" = NOW() WHERE "workspaceId" = ${workspaceId} AND "variacaoId" = ${s.variacaoId}`
        await tx.$executeRaw`INSERT INTO "EstProdutoMovimento" ("id","workspaceId","variacaoId","tipo","quantidade","saldoApos","motivo","referencia","usuarioNome") VALUES (${gid()}, ${workspaceId}, ${s.variacaoId}, 'ENTRADA_ESTORNO', ${s.q}, ${novo}, 'Estorno por recusa do pedido da loja', ${ped.numero}, ${usuarioNome})`
        estornado++
      }
      if (Number(upd) > 0) await tx.$executeRaw`INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome") VALUES (${gid()}, ${id}, ${workspaceId}, 'RECUSA', 'Pedido da loja recusado/cancelado', ${usuarioNome})`.catch(() => {})
      return NextResponse.json(serialize({ ok: true, aprovacao: 'recusado', lancamentosRemovidos: Number(del), estoqueEstornado: estornado }))
    })
  } catch (e: any) {
    console.error('[MINHA-LOJA aprovar/recusar]', e)
    return NextResponse.json({ error: e?.message || 'Erro ao processar' }, { status: 400 })
  }
}
