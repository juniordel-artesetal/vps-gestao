import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureLojaGaleria, MAX_IMAGENS_LOJA } from '@/lib/lojaGaleria'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// Confirma que o dono (produto/variação) pertence ao workspace.
async function donoValido(tipo: string, id: string, workspaceId: string): Promise<boolean> {
  if (tipo === 'produto') {
    const r = await prisma.$queryRaw`SELECT 1 FROM "PrecProduto" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1` as any[]
    return r.length > 0
  }
  if (tipo === 'variacao') {
    const r = await prisma.$queryRaw`
      SELECT 1 FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
      WHERE v."id" = ${id} AND p."workspaceId" = ${workspaceId} LIMIT 1` as any[]
    return r.length > 0
  }
  return false
}

// GET ?tipo=produto|variacao&id=... → lista (id, ordem, capa) — SEM o base64
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    await ensureLojaGaleria()
    const workspaceId = session.user.workspaceId
    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo') || ''
    const id   = searchParams.get('id') || ''
    if (!id || !(await donoValido(tipo, id, workspaceId))) return NextResponse.json({ imagens: [] })

    const col = tipo === 'produto' ? 'produtoId' : 'variacaoId'
    const imgs = await prisma.$queryRawUnsafe(
      `SELECT "id","ordem","capa" FROM "LojaImagem" WHERE "${col}" = $1 AND "workspaceId" = $2 ORDER BY "capa" DESC, "ordem" ASC, "createdAt" ASC`,
      id, workspaceId
    ) as any[]
    return NextResponse.json({ imagens: imgs, max: MAX_IMAGENS_LOJA })
  } catch (e) {
    console.error('[config/loja/imagens GET]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST { tipo, id, imagem } → adiciona (limite 10 por dono; 1ª vira capa)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    await ensureLojaGaleria()
    const workspaceId = session.user.workspaceId
    const { tipo, id, imagem } = await req.json()
    if (!id || !imagem || !(tipo === 'produto' || tipo === 'variacao'))
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    if (!/^data:image\/[a-zA-Z+]+;base64,/.test(String(imagem)))
      return NextResponse.json({ error: 'Imagem inválida' }, { status: 400 })
    if (!(await donoValido(tipo, id, workspaceId)))
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })

    const col = tipo === 'produto' ? 'produtoId' : 'variacaoId'
    const [agg] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n, COALESCE(MAX("ordem"),-1)::int AS "maxOrdem" FROM "LojaImagem" WHERE "${col}" = $1`, id
    ) as any[]
    if (Number(agg.n) >= MAX_IMAGENS_LOJA)
      return NextResponse.json({ error: `Máximo de ${MAX_IMAGENS_LOJA} fotos por item` }, { status: 400 })

    const novoId = gerarId()
    const ehCapa = Number(agg.n) === 0   // primeira vira capa
    const ordem  = Number(agg.maxOrdem) + 1
    const outroCol = tipo === 'produto' ? 'variacaoId' : 'produtoId'
    await prisma.$executeRawUnsafe(
      `INSERT INTO "LojaImagem" ("id","workspaceId","${col}","${outroCol}","imagem","ordem","capa") VALUES ($1,$2,$3,NULL,$4,$5,$6)`,
      novoId, workspaceId, id, String(imagem), ordem, ehCapa
    )
    return NextResponse.json({ id: novoId, ordem, capa: ehCapa })
  } catch (e) {
    console.error('[config/loja/imagens POST]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
