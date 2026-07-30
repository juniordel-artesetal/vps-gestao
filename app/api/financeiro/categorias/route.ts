// app/api/financeiro/categorias/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureFinContas, listarPlano, semearPlanoContas, moduloAtivo, setModulo } from '@/lib/finContas'

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const tipo  = searchParams.get('tipo')
  const vTipo = ['RECEITA', 'DESPESA'].includes(tipo || '') ? tipo : null
  await ensureFinContas()

  // Árvore (conta > subconta) para o plano de contas.
  if (searchParams.get('arvore') === '1') {
    return NextResponse.json(serialize({ contas: await listarPlano(workspaceId, vTipo), modulo: await moduloAtivo(workspaceId) }))
  }

  // Lista flat (compatível com o que já existe) — colunas explícitas.
  const rows = vTipo
    ? await prisma.$queryRaw`SELECT "id","workspaceId","nome","tipo","cor","icone","parentId","grupoDRE" FROM "FinCategoria" WHERE "workspaceId"=${workspaceId} AND "tipo"=${vTipo} ORDER BY "ordem","nome"`
    : await prisma.$queryRaw`SELECT "id","workspaceId","nome","tipo","cor","icone","parentId","grupoDRE" FROM "FinCategoria" WHERE "workspaceId"=${workspaceId} ORDER BY "tipo","ordem","nome"`
  return NextResponse.json(serialize(rows))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const body = await req.json()
  await ensureFinContas()

  // Semear o plano de contas padrão (idempotente) + ativar o módulo.
  if (body.acao === 'semear') {
    const r = await semearPlanoContas(workspaceId)
    await setModulo(workspaceId, true)
    return NextResponse.json(serialize({ ok: true, ...r, modulo: true, contas: await listarPlano(workspaceId) }))
  }
  // Liga/desliga o uso do plano de contas no lançamento.
  if (body.acao === 'modulo') {
    await setModulo(workspaceId, !!body.ativo)
    return NextResponse.json({ ok: true, modulo: !!body.ativo })
  }

  const { nome, tipo, cor, icone, parentId, grupoDRE } = body
  if (!nome || !tipo) return NextResponse.json({ error: 'nome e tipo são obrigatórios' }, { status: 400 })

  // Subconta: valida que a conta pai existe, é conta (sem parentId) e é do mesmo tipo/workspace.
  let parent: string | null = null
  let grupo: string | null = grupoDRE ?? null
  if (parentId) {
    const [p] = await prisma.$queryRaw`
      SELECT "id","tipo","grupoDRE" FROM "FinCategoria"
      WHERE "id"=${parentId} AND "workspaceId"=${workspaceId} AND "parentId" IS NULL
    ` as { id: string; tipo: string; grupoDRE: string | null }[]
    if (!p || p.tipo !== tipo) return NextResponse.json({ error: 'Conta pai inválida' }, { status: 400 })
    parent = p.id
    grupo = grupoDRE ?? p.grupoDRE   // subconta herda o grupo do DRE da conta
  }

  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "FinCategoria" ("id","workspaceId","nome","tipo","cor","icone","parentId","grupoDRE","padrao","ordem")
    VALUES (${id}, ${workspaceId}, ${nome}, ${tipo}, ${cor ?? '#f97316'}, ${icone ?? '📁'}, ${parent}, ${grupo}, false, 99)
  `
  const [row] = await prisma.$queryRaw`SELECT "id","workspaceId","nome","tipo","cor","icone","parentId","grupoDRE" FROM "FinCategoria" WHERE "id"=${id}` as any[]
  return NextResponse.json(serialize(row), { status: 201 })
}
