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

// GET — público (lê só ativos com imagem)
export async function GET() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, titulo, imagem, link, "linkexterno", ativo, ordem, "tempoExibicao"
      FROM "MarketingBanner"
      WHERE ativo = true AND imagem != ''
      ORDER BY ordem ASC, "createdAt" ASC
    ` as any[]
    return NextResponse.json(serialize(rows))
  } catch { return NextResponse.json([]) }
}

// POST — somente master
export async function POST(req: NextRequest) {
  if (!await isMaster()) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    const body = await req.json()
    const { titulo, imagem, link, linkexterno, ativo, ordem, tempoExibicao } = body
    if (!imagem) return NextResponse.json({ error: 'Imagem obrigatória' }, { status: 400 })
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await prisma.$executeRaw`
      INSERT INTO "MarketingBanner"
        ("id","titulo","imagem","link","linkexterno","ativo","ordem","tempoExibicao","createdAt","updatedAt")
      VALUES
        (${id}, ${titulo||null}, ${imagem}, ${link||null},
         ${linkexterno??true}, ${ativo??true}, ${ordem??0}, ${tempoExibicao??5}, NOW(), NOW())
    `
    const rows = await prisma.$queryRaw`SELECT * FROM "MarketingBanner" WHERE id=${id}` as any[]
    return NextResponse.json(serialize(rows[0]), { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
