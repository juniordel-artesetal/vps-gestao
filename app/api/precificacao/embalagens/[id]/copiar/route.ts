import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// POST — copia a embalagem com todos os seus itens (nome = "<nome> (cópia)").
// Espelha o copiar de produto. Cópia independente; raw; escopado por workspaceId.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const [orig] = await prisma.$queryRaw`
      SELECT "nome", "descricao", "custoTotal"::float AS "custoTotal"
      FROM "PrecEmbalagem" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
    ` as { nome: string; descricao: string | null; custoTotal: number }[]
    if (!orig) return NextResponse.json({ error: 'Embalagem não encontrada' }, { status: 404 })

    const itens = await prisma.$queryRaw`
      SELECT "materialId", "nomeMaterial", "qtdUsada"::float AS "qtdUsada",
             "custoUnit"::float AS "custoUnit", "rendimento"::float AS "rendimento"
      FROM "PrecEmbalagemItem" WHERE "embalagemId" = ${id}
    ` as { materialId: string | null; nomeMaterial: string; qtdUsada: number; custoUnit: number; rendimento: number | null }[]

    const novoId = gerarId()
    const novoNome = `${orig.nome} (cópia)`
    await prisma.$executeRaw`
      INSERT INTO "PrecEmbalagem" ("id","workspaceId","nome","descricao","custoTotal","ativo","createdAt","updatedAt")
      VALUES (${novoId}, ${workspaceId}, ${novoNome}, ${orig.descricao ?? null}, ${orig.custoTotal || 0}, true, NOW(), NOW())
    `
    for (const it of itens) {
      await prisma.$executeRaw`
        INSERT INTO "PrecEmbalagemItem" ("id","embalagemId","materialId","nomeMaterial","qtdUsada","custoUnit","rendimento")
        VALUES (${gerarId()}, ${novoId}, ${it.materialId ?? null}, ${it.nomeMaterial}, ${Number(it.qtdUsada) || 0}, ${Number(it.custoUnit) || 0}, ${Number(it.rendimento) || 1})
      `
    }

    return NextResponse.json({ ok: true, novaEmbalagemId: novoId, nome: novoNome }, { status: 201 })
  } catch (err) {
    console.error('[POST copiar embalagem]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
