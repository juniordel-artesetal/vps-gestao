// Dashboard da parceira — escopo ESTRITO por parceiroId da sessão.
//
// 🔒 TRAVA LGPD: só retorna 1º nome + status + datas + AGREGADOS. NUNCA e-mail,
// telefone, CPF ou valor pago individual. O primeiro nome é derivado no servidor
// (split → token[0]); o nome completo nunca sai daqui.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { parceirasAtivo } from '@/lib/parceiras/atribuicao'

export const dynamic = 'force-dynamic'

const primeiroNome = (n: string | null) => (String(n || '').trim().split(/\s+/)[0] || 'Alguém')

export async function GET() {
  if (!parceirasAtivo()) return NextResponse.json({ error: 'Indisponível' }, { status: 404 })
  const session = await getServerSession(authOptions)
  const parceiroId = (session?.user as any)?.parceiroId
  if (!session || (session.user as any).role !== 'parceira' || !parceiroId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Identidade + material de divulgação.
  const [p] = await prisma.$queryRaw`
    SELECT "nome","cupom","linkSlug" FROM "Parceiro" WHERE "id" = ${parceiroId} LIMIT 1
  ` as { nome: string; cupom: string | null; linkSlug: string | null }[]
  if (!p) return NextResponse.json({ error: 'Parceira não encontrada' }, { status: 404 })

  // Funil (agregados) — cliques via ParceiroClique; o resto via Lead + estado.
  const [funil] = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM "ParceiroClique" WHERE "parceiroId" = ${parceiroId}) AS cliques,
      (SELECT COUNT(*)::int FROM "Lead" WHERE "parceiroId" = ${parceiroId}) AS cadastros,
      (SELECT COUNT(*)::int FROM "Lead" l JOIN "Workspace" w ON w."id" = l."workspaceId"
         WHERE l."parceiroId" = ${parceiroId} AND w."assinaturaStatus" = 'TRIAL') AS "emTrial",
      (SELECT COUNT(*)::int FROM "Lead" l JOIN "Workspace" w ON w."id" = l."workspaceId"
         WHERE l."parceiroId" = ${parceiroId} AND w."assinaturaStatus" = 'ATIVA') AS assinaram,
      (SELECT COUNT(*)::int FROM "Lead" l JOIN "Workspace" w ON w."id" = l."workspaceId"
         WHERE l."parceiroId" = ${parceiroId} AND w."assinaturaStatus" IN ('CANCELADA','CORTADA')) AS cancelaram
  ` as any[]

  // Ganhos (agregados). recebido = split efetivamente pago; pendente = repasse
  // manual em aberto (base × percentual, já que a linha 'pendente' guarda valor 0).
  const [ganhos] = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM("valor") FILTER (WHERE "status" = 'pago_via_split'),0)::float AS recebido,
      COALESCE(SUM("base" * "percentual" / 100) FILTER (WHERE "status" = 'pendente'),0)::float AS pendente
    FROM "ParceiroComissao" WHERE "parceiroId" = ${parceiroId}
  ` as any[]

  // Timeline — SÓ 1º nome + status + data. Sem e-mail/telefone/CPF.
  const eventos = await prisma.$queryRaw`
    SELECT u."nome" AS "nomeCompleto", w."assinaturaStatus" AS status,
           GREATEST(w."updatedAt", l."createdAt") AS quando
    FROM "Lead" l
    JOIN "Workspace" w ON w."id" = l."workspaceId"
    LEFT JOIN LATERAL (
      SELECT "nome" FROM "User" WHERE "workspaceId" = w."id" AND "role" = 'ADMIN' AND "ativo" = true
      ORDER BY "createdAt" ASC LIMIT 1
    ) u ON true
    WHERE l."parceiroId" = ${parceiroId}
    ORDER BY quando DESC LIMIT 20
  ` as { nomeCompleto: string | null; status: string; quando: Date }[]

  const timeline = eventos.map(e => ({ nome: primeiroNome(e.nomeCompleto), status: e.status, quando: e.quando }))

  return NextResponse.json(serialize({
    parceira: { nome: primeiroNome(p.nome) },
    material: { linkSlug: p.linkSlug, cupom: p.cupom },
    funil,
    ganhos: { recebido: ganhos.recebido, pendente: ganhos.pendente, ativas: funil.assinaram },
    timeline,
  }))
}
