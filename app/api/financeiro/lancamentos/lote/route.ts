// Edição EM MASSA de lançamentos (ações aplicadas a vários ids de uma vez).
// Ações: pagar (quita PENDENTE e PARCIAL), pendente (estorna), data (vencimento),
// excluir, vincular conta, vincular categoria/subcategoria. Respeita o tipo na categoria.
// Idempotente. Prisma raw; escopo por workspaceId; sem SELECT *. Resposta padronizada
// { ok, atualizados, ignorados, motivo? } — nada de descarte silencioso.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
const ehData = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId

  const body = await req.json().catch(() => ({}))
  const { ids, categoriaId, contaId, acao } = body
  const idsArr = Array.isArray(ids) ? ids.map(String).filter(Boolean) : []
  if (idsArr.length === 0) return NextResponse.json({ error: 'Nenhum lançamento selecionado' }, { status: 400 })
  const total = idsArr.length

  // ── PAGAR/BAIXAR em massa: PENDENTE e PARCIAL viram PAGO, QUITANDO o saldo restante
  // (valorRealizado = valor). dataRealizada = informada senão a existente senão hoje. ──
  if (acao === 'pagar') {
    const dataPg = ehData(body.data) ? body.data : null
    const n = Number(await prisma.$executeRaw`
      UPDATE "FinLancamento"
      SET "status" = 'PAGO',
          "valorRealizado" = "valor",
          "dataRealizada" = COALESCE(${dataPg}::date, "dataRealizada", CURRENT_DATE)
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsArr}::text[]) AND "status" IN ('PENDENTE','PARCIAL')
    `)
    return NextResponse.json({ ok: true, atualizados: n, ignorados: total - n, motivo: total - n > 0 ? 'já estavam pagos' : undefined })
  }

  // ── ESTORNAR em massa: volta para PENDENTE e zera o realizado (desfaz pago/parcial). ──
  if (acao === 'pendente') {
    const n = Number(await prisma.$executeRaw`
      UPDATE "FinLancamento"
      SET "status" = 'PENDENTE', "valorRealizado" = NULL, "dataRealizada" = NULL
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsArr}::text[]) AND "status" <> 'PENDENTE'
    `)
    return NextResponse.json({ ok: true, atualizados: n, ignorados: total - n, motivo: total - n > 0 ? 'já estavam pendentes' : undefined })
  }

  // ── DATA/VENCIMENTO em massa (competência do lançamento). ──
  if (acao === 'data') {
    if (!ehData(body.data)) return NextResponse.json({ error: 'Data inválida (use AAAA-MM-DD)' }, { status: 400 })
    const n = Number(await prisma.$executeRaw`
      UPDATE "FinLancamento" SET "data" = ${body.data}::date
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsArr}::text[])
    `)
    return NextResponse.json({ ok: true, atualizados: n, ignorados: total - n })
  }

  // ── EXCLUIR em massa (só os ids selecionados; saldos/DRE recomputam sozinhos). ──
  if (acao === 'excluir') {
    const n = Number(await prisma.$executeRaw`
      DELETE FROM "FinLancamento"
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsArr}::text[])
    `)
    return NextResponse.json({ ok: true, atualizados: n, ignorados: total - n })
  }

  // ── Vincular CONTA em massa. Sem restrição de tipo; contaId null = desvincular. ──
  if (contaId !== undefined && categoriaId === undefined) {
    if (contaId) {
      const [c] = await prisma.$queryRaw`SELECT "id" FROM "FinConta" WHERE "id" = ${contaId} AND "workspaceId" = ${workspaceId} LIMIT 1` as { id: string }[]
      if (!c) return NextResponse.json({ error: 'Conta inválida' }, { status: 400 })
    }
    const n = Number(await prisma.$executeRaw`
      UPDATE "FinLancamento" SET "contaId" = ${contaId || null}
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsArr}::text[])
    `)
    return NextResponse.json({ ok: true, atualizados: n, ignorados: total - n })
  }

  if (!categoriaId) return NextResponse.json({ error: 'Escolha uma categoria' }, { status: 400 })

  // Categoria precisa existir no workspace; o tipo dela define quais lançamentos recebem.
  const [cat] = await prisma.$queryRaw`
    SELECT "tipo" FROM "FinCategoria" WHERE "id" = ${categoriaId} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as { tipo: string }[]
  if (!cat) return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 })

  // Aplica só aos lançamentos do MESMO tipo (RECEITA/DESPESA) — nunca vincula despesa a conta de receita.
  const n = Number(await prisma.$executeRaw`
    UPDATE "FinLancamento" SET "categoriaId" = ${categoriaId}
    WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsArr}::text[]) AND "tipo" = ${cat.tipo}
  `)
  return NextResponse.json({ ok: true, atualizados: n, ignorados: total - n, motivo: total - n > 0 ? 'de outro tipo' : undefined, tipo: cat.tipo })
}
