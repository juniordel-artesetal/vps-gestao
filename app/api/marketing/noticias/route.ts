import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

async function isMaster(): Promise<boolean> {
  try {
    const token = (await cookies()).get('master_token')?.value
    return !!token && token === process.env.MASTER_SECRET_TOKEN
  } catch { return false }
}

// GET — público (ativo + dentro do período) OU ?admin=1 (master: tudo)
export async function GET(req: NextRequest) {
  try {
    const admin = new URL(req.url).searchParams.get('admin') === '1' && await isMaster()
    if (admin) {
      const rows = await prisma.$queryRaw`
        SELECT id, emoji, titulo, descricao, link, "linkTexto", ativo, ordem, "dataInicio", "dataFim"
        FROM "MarketingNoticia" ORDER BY ordem ASC, "createdAt" DESC
      ` as any[]
      return NextResponse.json(serialize(rows))
    }
    const rows = await prisma.$queryRaw`
      SELECT id, emoji, titulo, descricao, link, "linkTexto", ativo, ordem, "dataInicio", "dataFim"
      FROM "MarketingNoticia"
      WHERE ativo = true
        AND ("dataInicio" IS NULL OR "dataInicio" <= CURRENT_DATE)
        AND ("dataFim" IS NULL OR "dataFim" >= CURRENT_DATE)
      ORDER BY ordem ASC, "createdAt" DESC
    ` as any[]
    return NextResponse.json(serialize(rows))
  } catch { return NextResponse.json([]) }
}

export async function POST(req: NextRequest) {
  if (!await isMaster()) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    const body = await req.json()
    const { emoji, titulo, descricao, link, linkTexto, ativo, ordem, dataInicio, dataFim } = body
    if (!titulo?.trim()) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await prisma.$executeRaw`
      INSERT INTO "MarketingNoticia" ("id","emoji","titulo","descricao","link","linkTexto","ativo","ordem","dataInicio","dataFim","createdAt")
      VALUES (${id}, ${emoji||'📰'}, ${titulo.trim()}, ${descricao||null}, ${link||null}, ${linkTexto||'Saiba mais →'}, ${ativo??true}, ${ordem??0},
              ${dataInicio ? String(dataInicio) : null}::date, ${dataFim ? String(dataFim) : null}::date, NOW())
    `
    const rows = await prisma.$queryRaw`
      SELECT id, emoji, titulo, descricao, link, "linkTexto", ativo, ordem, "dataInicio", "dataFim"
      FROM "MarketingNoticia" WHERE id=${id}
    ` as any[]
    return NextResponse.json(serialize(rows[0]), { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
