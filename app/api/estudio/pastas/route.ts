// SOA Design — pastas de "Meus arquivos" (estilo Drive).
// GET                      → caminhos das pastas criadas (as que têm arquivo vêm do próprio EstudioAsset.pasta)
// POST   { caminho }       → cria (e as mães que faltarem)
// PATCH  { de, para }      → renomeia/move a pasta: ela, as subpastas e TODOS os arquivos dentro mudam de caminho
// DELETE ?caminho=         → apaga a pasta (e subpastas) SÓ se não houver arquivo dentro — nada some sem querer
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ctxEstudio, gid } from '@/lib/estudio/ctx'
import { normalizarCaminho, ancestrais } from '@/lib/estudio/pastas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const rows = await prisma.$queryRawUnsafe<{ caminho: string }[]>(
    `SELECT "caminho" FROM "EstudioPasta" WHERE "workspaceId"=$1 ORDER BY "caminho" LIMIT 2000`, c.workspaceId)
  return NextResponse.json({ pastas: rows.map(r => r.caminho) })
}

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  const caminho = normalizarCaminho(b.caminho)
  if (!caminho) return NextResponse.json({ error: 'Dê um nome à pasta.' }, { status: 400 })
  for (const p of ancestrais(caminho)) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "EstudioPasta" ("id","workspaceId","caminho") VALUES ($1,$2,$3) ON CONFLICT ("workspaceId","caminho") DO NOTHING`, gid(), c.workspaceId, p)
  }
  return NextResponse.json({ ok: true, caminho })
}

export async function PATCH(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  const de = normalizarCaminho(b.de), para = normalizarCaminho(b.para)
  if (!de || !para) return NextResponse.json({ error: 'Caminho inválido.' }, { status: 400 })
  if (de === para) return NextResponse.json({ ok: true, caminho: para })
  if (para === de || para.startsWith(de + '/')) return NextResponse.json({ error: 'Não dá para mover uma pasta para dentro dela mesma.' }, { status: 400 })
  const [ja] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT (SELECT count(*) FROM "EstudioPasta" WHERE "workspaceId"=$1 AND "caminho"=$2)
          + (SELECT count(*) FROM "EstudioAsset" WHERE "workspaceId"=$1 AND "pasta"=$2) AS n`, c.workspaceId, para)
  if (Number(ja?.n) > 0) return NextResponse.json({ error: `Já existe uma pasta “${para}”.` }, { status: 409 })
  const n = de.length
  await prisma.$transaction([
    // a pasta e as subpastas: troca o começo do caminho
    prisma.$executeRawUnsafe(
      `UPDATE "EstudioPasta" SET "caminho" = $3 || substr("caminho", $4)
       WHERE "workspaceId"=$1 AND ("caminho"=$2 OR "caminho" LIKE $5)`, c.workspaceId, de, para, n + 1, `${de.replace(/[\\%_]/g, '\\$&')}/%`),
    // os arquivos dentro (em qualquer nível)
    prisma.$executeRawUnsafe(
      `UPDATE "EstudioAsset" SET "pasta" = $3 || substr("pasta", $4)
       WHERE "workspaceId"=$1 AND ("pasta"=$2 OR "pasta" LIKE $5)`, c.workspaceId, de, para, n + 1, `${de.replace(/[\\%_]/g, '\\$&')}/%`),
  ])
  for (const p of ancestrais(para)) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "EstudioPasta" ("id","workspaceId","caminho") VALUES ($1,$2,$3) ON CONFLICT ("workspaceId","caminho") DO NOTHING`, gid(), c.workspaceId, p)
  }
  return NextResponse.json({ ok: true, caminho: para })
}

export async function DELETE(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const caminho = normalizarCaminho(new URL(req.url).searchParams.get('caminho'))
  if (!caminho) return NextResponse.json({ error: 'Caminho inválido.' }, { status: 400 })
  const like = `${caminho.replace(/[\\%_]/g, '\\$&')}/%`
  const [uso] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM "EstudioAsset" WHERE "workspaceId"=$1 AND ("pasta"=$2 OR "pasta" LIKE $3)`, c.workspaceId, caminho, like)
  if (Number(uso?.n) > 0) return NextResponse.json({ error: `A pasta tem ${uso.n} arquivo(s). Mova ou apague os arquivos antes — por segurança, pasta com arquivo não é apagada.` }, { status: 409 })
  await prisma.$executeRawUnsafe(`DELETE FROM "EstudioPasta" WHERE "workspaceId"=$1 AND ("caminho"=$2 OR "caminho" LIKE $3)`, c.workspaceId, caminho, like)
  return NextResponse.json({ ok: true })
}
