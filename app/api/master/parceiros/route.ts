// Master — fila de parceiras (pendentes) + aprovadas com contadores. Guarda master.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { parceirasAtivo } from '@/lib/parceiras/atribuicao'
import { garantirColunasInfluenciadora } from '@/lib/influenciadora'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!parceirasAtivo()) return NextResponse.json({ error: 'Indisponível' }, { status: 404 })
  if (!(await verificarMaster())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await garantirColunasInfluenciadora() // colunas de selo/cortesia (aditivas, idempotente)

  const parceiros = await prisma.$queryRaw`
    SELECT p."id", p."nome", p."email", p."whatsapp", p."instagram", p."status", p."cupom", p."linkSlug",
           (p."walletId" IS NOT NULL) AS "temWallet",
           (p."senhaCripto" IS NOT NULL) AS "temSenha",
           (p."cupom" IS NOT NULL) AS "temCodigo",
           p."comissaoPercMensal"::float AS "percMensal", p."comissaoPercAnual"::float AS "percAnual",
           p."createdAt", p."aprovadoEm",
           -- Workspace da parceira (dual-identidade) + estado de INFLUENCIADORA/cortesia.
           w."id" AS "workspaceId", w."selo",
           (w."cortesiaAtivadaEm" IS NOT NULL AND w."liberacaoManual" = true) AS "cortesiaAtiva",
           (w."cortesiaEncerradaEm" IS NOT NULL) AS "cortesiaEncerrada",
           (SELECT COUNT(*)::int FROM "Lead" l WHERE l."parceiroId" = p."id") AS "indicacoes",
           (SELECT COUNT(*)::int FROM "Lead" l JOIN "Workspace" w ON w."id" = l."workspaceId"
              WHERE l."parceiroId" = p."id" AND w."assinaturaStatus" = 'ATIVA') AS "ativas",
           (SELECT COUNT(*)::int FROM "ParceiroClique" c WHERE c."parceiroId" = p."id") AS "cliques"
    FROM "Parceiro" p
    LEFT JOIN LATERAL (
      SELECT w2."id", w2."selo", w2."cortesiaAtivadaEm", w2."liberacaoManual", w2."cortesiaEncerradaEm"
      FROM "User" u JOIN "Workspace" w2 ON w2."id" = u."workspaceId"
      WHERE u."id" = p."userId" LIMIT 1
    ) w ON true
    ORDER BY (p."status" = 'pendente') DESC, p."createdAt" DESC
  ` as any[]

  const pendentes = parceiros.filter(p => p.status === 'pendente')
  const demais = parceiros.filter(p => p.status !== 'pendente')
  return NextResponse.json(serialize({ pendentes, aprovadas: demais }))
}
