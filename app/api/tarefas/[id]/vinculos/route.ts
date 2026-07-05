import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

// Valida que a referência é do mesmo workspace e devolve um rótulo canônico (server-side).
async function validarReferencia(tipo: string, referenciaId: string, workspaceId: string): Promise<{ rotulo: string; href: string } | null> {
  if (tipo === 'pedido') {
    const [o] = await prisma.$queryRaw`SELECT "numero","destinatario" FROM "Order" WHERE "id"=${referenciaId} AND "workspaceId"=${workspaceId} LIMIT 1` as any[]
    if (!o) return null
    return { rotulo: `#${o.numero}${o.destinatario ? ' · ' + o.destinatario : ''}`, href: `/dashboard/pedidos/${referenciaId}` }
  }
  if (tipo === 'pagamento') {
    const [pg] = await prisma.$queryRaw`
      SELECT pg."valor"::float AS valor, pg."provedor", o."numero", o."id" AS "orderId"
      FROM "Pagamento" pg LEFT JOIN "Order" o ON o."id" = pg."orderId"
      WHERE pg."id"=${referenciaId} AND pg."workspaceId"=${workspaceId} LIMIT 1
    ` as any[]
    if (!pg) return null
    return { rotulo: `Pagamento ${brl(pg.valor)}${pg.numero ? ' · #' + pg.numero : ''}`, href: pg.orderId ? `/dashboard/pedidos/${pg.orderId}` : '#' }
  }
  return null
}

// GET — vínculos da tarefa
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  const rows = await prisma.$queryRaw`
    SELECT "id","tipo","referenciaId","rotulo","createdAt" FROM "TarefaVinculo"
    WHERE "tarefaId"=${id} AND "workspaceId"=${session.user.workspaceId} ORDER BY "createdAt" ASC
  ` as any[]
  // Recalcula href (não persistido) para cada vínculo
  const out = rows.map((v: any) => ({ ...v, href: v.tipo === 'pedido' ? `/dashboard/pedidos/${v.referenciaId}` : '#' }))
  return NextResponse.json(serialize(out))
}

// POST — cria vínculo (valida ownership da referência; rótulo canônico do servidor)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  const workspaceId = session.user.workspaceId
  const { tipo, referenciaId } = await req.json()
  if (!['pedido', 'pagamento'].includes(tipo) || !referenciaId) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  // Confirma que a tarefa é do workspace
  const t = await prisma.$queryRaw`SELECT "id" FROM "Tarefa" WHERE "id"=${id} AND "workspaceId"=${workspaceId} LIMIT 1` as any[]
  if (!t.length) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })

  // ★ISOLAMENTO★: referência precisa ser do mesmo workspace
  const ref = await validarReferencia(tipo, String(referenciaId), workspaceId)
  if (!ref) return NextResponse.json({ error: 'Item não encontrado neste workspace' }, { status: 404 })

  const vid = novoId()
  await prisma.$executeRaw`
    INSERT INTO "TarefaVinculo" ("id","tarefaId","workspaceId","tipo","referenciaId","rotulo","createdAt")
    VALUES (${vid}, ${id}, ${workspaceId}, ${tipo}, ${String(referenciaId)}, ${ref.rotulo}, NOW())
    ON CONFLICT ("tarefaId","tipo","referenciaId") DO NOTHING
  `
  return NextResponse.json({ ok: true, id: vid, rotulo: ref.rotulo, href: ref.href })
}

// DELETE ?vinculoId= — remove vínculo
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const vinculoId = searchParams.get('vinculoId')
  if (!vinculoId) return NextResponse.json({ error: 'vinculoId obrigatório' }, { status: 400 })
  await prisma.$executeRaw`DELETE FROM "TarefaVinculo" WHERE "id"=${vinculoId} AND "tarefaId"=${id} AND "workspaceId"=${session.user.workspaceId}`
  return NextResponse.json({ ok: true })
}
