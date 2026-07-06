// app/api/producao/pedidos/consulta/route.ts
// Consulta de pedido por CÓDIGO (numero ou id) lido via QR/código de barras.
// SEMPRE scoped ao workspace da sessão — não acha pedido de outro workspace.
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

// GET ?codigo=  — busca por numero OU id, no workspace da sessão
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const codigo = (new URL(req.url).searchParams.get('codigo') || '').trim()
  if (!codigo) return NextResponse.json({ error: 'Código vazio' }, { status: 400 })

  const [o] = await prisma.$queryRaw`
    SELECT
      o."id", o."numero", o."destinatario", o."idCliente", o."canal",
      o."produto", o."quantidade"::int, o."valor", o."dataEntrada", o."dataEnvio",
      o."observacoes", o."prioridade", o."status", o."endereco", o."camposExtras",
      s."nome" AS "setor_atual_nome"
    FROM "Order" o
    LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
    LEFT JOIN "Setor" s ON s."id" = psa."setorId"
    WHERE o."workspaceId" = ${session.user.workspaceId}
      AND (o."numero" = ${codigo} OR o."id" = ${codigo})
    LIMIT 1
  ` as any[]

  if (!o) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  // Campos personalizados (camposExtras JSON, sem chaves internas _)
  let camposExtras: Record<string, any> = {}
  try {
    const parsed = typeof o.camposExtras === 'string' ? JSON.parse(o.camposExtras) : (o.camposExtras || {})
    camposExtras = Object.fromEntries(Object.entries(parsed).filter(([k]) => !k.startsWith('_')))
  } catch { camposExtras = {} }

  const { camposExtras: _drop, ...base } = o
  return NextResponse.json(serialize({ ...base, camposExtras }))
}
