// Master — criar e listar enquetes. Só o Master (master_token) cria.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { ensureEnquetesSchema, normalizarPerguntas, gid } from '@/lib/enquetes'

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
async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — lista de enquetes com nº de respostas.
export async function GET() {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensureEnquetesSchema()
  const lista = await prisma.$queryRaw`
    SELECT e."id", e."titulo", e."descricao", e."perguntas", e."publico", e."planos", e."modulo",
           e."canalPopup", e."canalEmail", e."ativo", e."createdAt",
           (SELECT COUNT(*)::int FROM "EnqueteResposta" r WHERE r."enqueteId" = e."id") AS "respostas"
    FROM "Enquete" e
    ORDER BY e."createdAt" DESC
  ` as any[]
  return NextResponse.json(serialize({ lista }))
}

// POST — cria uma enquete.
export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensureEnquetesSchema()
  const b = await req.json().catch(() => ({}))

  const titulo = String(b.titulo || '').trim().slice(0, 200)
  if (!titulo) return NextResponse.json({ error: 'Informe o título da enquete.' }, { status: 400 })
  const perguntas = normalizarPerguntas(b.perguntas)
  if (perguntas.length === 0) return NextResponse.json({ error: 'Adicione ao menos uma pergunta válida.' }, { status: 400 })

  const publico = ['todas', 'ativas', 'inativas'].includes(b.publico) ? b.publico : 'todas'
  const planos = Array.isArray(b.planos) && b.planos.length ? b.planos.map((x: any) => String(x).trim()).filter(Boolean).join(',') : null
  const modulo = b.modulo ? String(b.modulo).trim().slice(0, 60) : null
  const canalPopup = b.canalPopup !== false
  const canalEmail = b.canalEmail === true
  const id = gid()

  await prisma.$executeRaw`
    INSERT INTO "Enquete" ("id","titulo","descricao","perguntas","publico","planos","modulo","canalPopup","canalEmail","ativo")
    VALUES (${id}, ${titulo}, ${String(b.descricao || '').trim().slice(0, 500) || null},
            ${JSON.stringify(perguntas)}::jsonb, ${publico}, ${planos}, ${modulo}, ${canalPopup}, ${canalEmail}, true)
  `
  const [nova] = await prisma.$queryRaw`
    SELECT "id","titulo","descricao","perguntas","publico","planos","modulo","canalPopup","canalEmail","ativo","createdAt"
    FROM "Enquete" WHERE "id" = ${id}
  ` as any[]
  return NextResponse.json(serialize({ ok: true, enquete: nova }))
}
