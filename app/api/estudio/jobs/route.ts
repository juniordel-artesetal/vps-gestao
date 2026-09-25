// SOA Edition — registro dos lotes gerados. A geração roda NO NAVEGADOR; aqui fica só o
// histórico (quanto, em que formato, de onde veio a lista, link do ZIP se foi guardado).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio, gid, urlDoBlob } from '@/lib/estudio/ctx'
import { autorizadosNoLote } from '@/lib/estudio/cota'

export const dynamic = 'force-dynamic'
const ORIGENS = ['colar', 'xlsx', 'pedido', 'tema', 'editor']
const FORMATOS = ['png', 'jpg', 'pdf-individual', 'pdf-unico', 'zip']
const STATUS = ['pendente', 'processando', 'concluido', 'erro']

export async function GET() {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const rows = await prisma.$queryRawUnsafe(
    `SELECT j."id", j."templateId", j."origem", j."totalItens", j."formato", j."regraNome", j."status", j."zipUrl", j."pedidoId", j."createdAt", j."concluidoEm",
            t."nome" AS "templateNome"
     FROM "EstudioJob" j LEFT JOIN "EstudioTemplate" t ON t."id"=j."templateId"
     WHERE j."workspaceId"=$1 ORDER BY j."createdAt" DESC LIMIT 100`, c.workspaceId)
  return NextResponse.json(serialize({ jobs: rows }))
}

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  if (!ORIGENS.includes(b.origem) || !FORMATOS.includes(b.formato)) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  // Só registra lote que o SERVIDOR autorizou, e com no máximo o que foi autorizado.
  const autorizados = await autorizadosNoLote(c.userId, String(b.lote || ''))
  const total = Math.max(0, Number(b.totalItens) || 0)
  if (!autorizados || total > autorizados) return NextResponse.json({ error: 'Lote sem autorização de cota' }, { status: 403 })
  const id = gid()
  const status = STATUS.includes(b.status) ? b.status : 'pendente'
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioJob" ("id","workspaceId","templateId","origem","totalItens","formato","regraNome","status","zipUrl","pedidoId","concluidoEm")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $8 = 'concluido' THEN NOW() ELSE NULL END)`,
    id, c.workspaceId, b.templateId || null, b.origem, Math.max(0, Number(b.totalItens) || 0), b.formato,
    typeof b.regraNome === 'string' ? b.regraNome.slice(0, 200) : null,
    status, urlDoBlob(b.zipUrl) ? b.zipUrl : null, b.pedidoId || null)
  return NextResponse.json({ id })
}
