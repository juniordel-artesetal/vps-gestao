// app/api/master/atendimento/[id]/route.ts
// Detalhe completo de um item da caixa (chamado OU feedback), incl. imagem/nota.
// Só o MASTER acessa. As AÇÕES (status/prioridade/responsável/etiquetas/responder)
// reutilizam os endpoints existentes: master/chamados/[id], master/feedback/[id],
// master/mensagens (thread).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
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
async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET ?tipo=CHAMADO|FEEDBACK — registro completo + nome do workspace
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const tipo = new URL(req.url).searchParams.get('tipo')

  if (tipo === 'FEEDBACK') {
    const [fb] = await prisma.$queryRaw`
      SELECT sf."id", sf."tipo" AS "subtipo", sf."protocolo", sf."titulo", sf."descricao",
             sf."imagem", sf."usuarioNome", sf."email", sf."whatsapp", sf."workspaceId",
             sf."status", COALESCE(sf."prioridade",'normal') AS "prioridade",
             sf."responsavelNome", sf."etiquetas", sf."notaInterna",
             sf."createdAt", sf."respondidoEm", w."nome" AS "workspaceNome"
      FROM "SuporteFeedback" sf LEFT JOIN "Workspace" w ON w."id" = sf."workspaceId"
      WHERE sf."id" = ${id}
    ` as any[]
    if (!fb) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json(serialize({ ...fb, tipo: 'FEEDBACK' }))
  }

  const [ch] = await prisma.$queryRaw`
    SELECT sc."id", sc."protocolo", sc."descricao", sc."respostaIA", sc."imagem",
           sc."usuarioNome", sc."email", sc."whatsapp", sc."workspaceId",
           sc."status", COALESCE(sc."prioridade",'normal') AS "prioridade",
           sc."responsavelNome", sc."etiquetas", sc."notaInterna",
           sc."createdAt", sc."respondidoEm", w."nome" AS "workspaceNome"
    FROM "SuporteChamado" sc LEFT JOIN "Workspace" w ON w."id" = sc."workspaceId"
    WHERE sc."id" = ${id}
  ` as any[]
  if (!ch) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(serialize({ ...ch, tipo: 'CHAMADO' }))
}
