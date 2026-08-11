// Master — detalhe + RESULTADOS agregados de uma enquete; ativar/desativar; excluir.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { ensureEnquetesSchema, type Pergunta } from '@/lib/enquetes'

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

// GET — enquete + resultados (contagem/percentual por opção; textos listados).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensureEnquetesSchema()
  const { id } = await params

  const [enquete] = await prisma.$queryRaw`
    SELECT "id","titulo","descricao","perguntas","publico","planos","modulo","canalPopup","canalEmail","ativo","createdAt"
    FROM "Enquete" WHERE "id" = ${id}
  ` as any[]
  if (!enquete) return NextResponse.json({ error: 'Enquete não encontrada' }, { status: 404 })

  const respostas = await prisma.$queryRaw`
    SELECT r."respostas", r."usuarioNome", r."createdAt", w."nome" AS "workspaceNome"
    FROM "EnqueteResposta" r
    LEFT JOIN "Workspace" w ON w."id" = r."workspaceId"
    WHERE r."enqueteId" = ${id}
    ORDER BY r."createdAt" DESC
  ` as { respostas: any; usuarioNome: string | null; createdAt: Date; workspaceNome: string | null }[]

  const perguntas: Pergunta[] = Array.isArray(enquete.perguntas) ? enquete.perguntas : []
  const totalRespostas = respostas.length

  // Agrega por pergunta (em JS — nº de respostas é limitado pelo nº de workspaces).
  const resultados = perguntas.map(p => {
    if (p.tipo === 'multipla') {
      const contagem: Record<string, number> = {}
      for (const o of (p.opcoes || [])) contagem[o] = 0
      for (const r of respostas) {
        const v = r.respostas?.[p.id]
        if (v != null && v !== '') contagem[String(v)] = (contagem[String(v)] || 0) + 1
      }
      const opcoes = Object.entries(contagem).map(([opcao, n]) => ({
        opcao, n, pct: totalRespostas ? Math.round((n / totalRespostas) * 100) : 0,
      }))
      return { perguntaId: p.id, texto: p.texto, tipo: p.tipo, opcoes }
    }
    if (p.tipo === 'escala') {
      const dist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
      let soma = 0, n = 0
      for (const r of respostas) {
        const v = Number(r.respostas?.[p.id])
        if (v >= 1 && v <= 5) { dist[String(v)]++; soma += v; n++ }
      }
      const opcoes = [1, 2, 3, 4, 5].map(k => ({ opcao: String(k), n: dist[String(k)], pct: n ? Math.round((dist[String(k)] / n) * 100) : 0 }))
      return { perguntaId: p.id, texto: p.texto, tipo: p.tipo, media: n ? Math.round((soma / n) * 100) / 100 : null, respondentes: n, opcoes }
    }
    // texto
    const textos = respostas
      .map(r => ({ texto: String(r.respostas?.[p.id] || '').trim(), quem: r.workspaceNome || r.usuarioNome || '—' }))
      .filter(t => t.texto)
    return { perguntaId: p.id, texto: p.texto, tipo: p.tipo, textos }
  })

  return NextResponse.json(serialize({ enquete, totalRespostas, resultados }))
}

// PUT — editar leve (ativar/desativar; título/descrição).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensureEnquetesSchema()
  const { id } = await params
  const b = await req.json().catch(() => ({}))

  if (b.ativo !== undefined)
    await prisma.$executeRaw`UPDATE "Enquete" SET "ativo" = ${!!b.ativo}, "updatedAt" = NOW() WHERE "id" = ${id}`
  if (typeof b.titulo === 'string' && b.titulo.trim())
    await prisma.$executeRaw`UPDATE "Enquete" SET "titulo" = ${b.titulo.trim().slice(0, 200)}, "updatedAt" = NOW() WHERE "id" = ${id}`
  if (typeof b.descricao === 'string')
    await prisma.$executeRaw`UPDATE "Enquete" SET "descricao" = ${b.descricao.trim().slice(0, 500) || null}, "updatedAt" = NOW() WHERE "id" = ${id}`

  return NextResponse.json({ ok: true })
}

// DELETE — remove a enquete e suas respostas.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensureEnquetesSchema()
  const { id } = await params
  await prisma.$executeRaw`DELETE FROM "EnqueteResposta" WHERE "enqueteId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "Enquete" WHERE "id" = ${id}`
  return NextResponse.json({ ok: true })
}
