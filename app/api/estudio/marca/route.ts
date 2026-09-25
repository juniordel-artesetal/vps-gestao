// SOA Edition — KIT DA MARCA do workspace: paleta de cores, fontes e logos, aplicáveis com 1 clique
// em qualquer design. Um kit por workspace (fontes privadas do ateliê + as nativas; logos = assets).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio, gid } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'
const COR = /^#[0-9a-f]{6}$/i

export async function GET() {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const [k] = await prisma.$queryRawUnsafe<{ cores: string[]; fontes: string[]; logos: string[] }[]>(
    `SELECT "cores","fontes","logos" FROM "EstudioBrandKit" WHERE "workspaceId"=$1`, c.workspaceId)
  const logos = k?.logos?.length ? await prisma.$queryRawUnsafe(
    `SELECT "id","nome","url","meta" FROM "EstudioAsset" WHERE "workspaceId"=$1 AND "id" = ANY($2::text[])`, c.workspaceId, k.logos) : []
  return NextResponse.json(serialize({ cores: k?.cores || [], fontes: k?.fontes || [], logos }))
}

export async function PUT(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  const cores = Array.isArray(b.cores) ? [...new Set(b.cores.map(String).filter((x: string) => COR.test(x)).map((x: string) => x.toLowerCase()))].slice(0, 40) : []
  const fontes = Array.isArray(b.fontes) ? [...new Set(b.fontes.map(String).filter((x: string) => /^(u:)?[a-z0-9]{2,40}$/i.test(x)))].slice(0, 20) : []
  let logos: string[] = Array.isArray(b.logos) ? [...new Set(b.logos.map(String))].slice(0, 20) as string[] : []
  if (logos.length) { // só logos do próprio workspace
    const ok = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "EstudioAsset" WHERE "workspaceId"=$1 AND "id" = ANY($2::text[])`, c.workspaceId, logos)
    const set = new Set(ok.map(x => x.id)); logos = logos.filter(x => set.has(x))
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioBrandKit" ("id","workspaceId","cores","fontes","logos") VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb)
     ON CONFLICT ("workspaceId") DO UPDATE SET "cores"=EXCLUDED."cores","fontes"=EXCLUDED."fontes","logos"=EXCLUDED."logos","atualizadoEm"=now()`,
    gid(), c.workspaceId, JSON.stringify(cores), JSON.stringify(fontes), JSON.stringify(logos))
  return NextResponse.json({ ok: true, cores, fontes, logos })
}
