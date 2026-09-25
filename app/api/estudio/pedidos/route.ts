// SOA Edition — pedidos como FONTE DE DADOS do lote (o diferencial: a lista de nomes já vem
// do pedido). Devolve os campos personalizados achatados ("Nome da Criança", "Idade", "Tema"…,
// que é como ficam em camposExtras) + os campos-base do pedido, prontos para virar {variáveis}.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

/** Achata camposExtras: só valores simples; ignora internos (_freelancers…) e a lista de produtos. */
function camposDo(extras: unknown): Record<string, string> {
  let o: any = extras
  if (typeof o === 'string') { try { o = JSON.parse(o) } catch { return {} } }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(o || {})) {
    if (k.startsWith('_') || k === 'produtos') continue
    if (v === null || v === undefined || typeof v === 'object') continue
    const s = String(v).trim()
    if (s) out[k] = s
  }
  return out
}

export async function GET(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const q = new URL(req.url).searchParams
  const busca = (q.get('busca') || '').trim()
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT o."id", o."numero", o."destinatario", o."produto", o."quantidade", o."canal", o."status",
            TO_CHAR(o."dataEnvio",'DD/MM/YYYY') AS "dataEnvio", o."camposExtras"
     FROM "Order" o
     WHERE o."workspaceId"=$1 AND o."status" <> 'CANCELADO'
       AND ($2 = '' OR o."numero" ILIKE '%'||$2||'%' OR o."destinatario" ILIKE '%'||$2||'%' OR o."produto" ILIKE '%'||$2||'%')
     ORDER BY o."createdAt" DESC LIMIT 60`, c.workspaceId, busca)
  const pedidos = rows.map(r => ({
    id: r.id, numero: r.numero, destinatario: r.destinatario, produto: r.produto,
    quantidade: Number(r.quantidade) || 1, canal: r.canal, status: r.status, dataEnvio: r.dataEnvio,
    campos: camposDo(r.camposExtras),
  }))
  return NextResponse.json(serialize({ pedidos }))
}
