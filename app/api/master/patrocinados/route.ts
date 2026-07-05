import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}
async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — lista patrocinados com métricas
export async function GET() {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const rows = await prisma.$queryRaw`
    SELECT "id","nome","link","palavrasChave","precoExibido","prioridade","ativo","impressoes","cliques","createdAt"
    FROM "PesquisaPatrocinado" ORDER BY "ativo" DESC, "prioridade" DESC, "createdAt" DESC
  ` as any[]
  return NextResponse.json(serialize(rows))
}

// POST — cria patrocinado
export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json()
  if (!b.nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  const id = novoId()
  await prisma.$executeRaw`
    INSERT INTO "PesquisaPatrocinado" ("id","nome","link","imagem","palavrasChave","precoExibido","prioridade","ativo","impressoes","cliques","createdAt")
    VALUES (${id}, ${b.nome.trim()}, ${b.link || null}, ${b.imagem || null}, ${b.palavrasChave || null}, ${b.precoExibido || null}, ${Number(b.prioridade) || 0}, ${b.ativo !== false}, 0, 0, NOW())
  `
  return NextResponse.json({ ok: true, id })
}
