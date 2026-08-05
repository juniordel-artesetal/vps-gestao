// Artesã — retorna a enquete PENDENTE para o pop-up (ou null). Aplica a segmentação
// (público ativas/inativas, plano, módulo mais usado) e nunca traz o que ela já
// respondeu. Uma por vez (a mais recente). Sem sessão → null (não quebra).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureEnquetesSchema } from '@/lib/enquetes'
import { ensureUsoLogSchema } from '@/lib/usoLog'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.workspaceId) return NextResponse.json({ enquete: null })
    await ensureEnquetesSchema()
    await ensureUsoLogSchema()
    const workspaceId = session.user.workspaceId

    const [enq] = await prisma.$queryRaw`
      WITH ws AS (
        SELECT w."id",
               COALESCE(w."plano",'FREE') AS "plano",
               EXISTS(SELECT 1 FROM "LoginHistory" lh WHERE lh."workspaceId" = w."id" AND lh."sucesso" = true AND lh."createdAt" >= NOW() - INTERVAL '30 days') AS "ativa",
               (SELECT ul."modulo" FROM "UsoLog" ul WHERE ul."workspaceId" = w."id" GROUP BY ul."modulo" ORDER BY SUM(ul."acessos") DESC LIMIT 1) AS "moduloTop"
        FROM "Workspace" w WHERE w."id" = ${workspaceId}
      )
      SELECT e."id", e."titulo", e."descricao", e."perguntas"
      FROM "Enquete" e, ws
      WHERE e."ativo" = true AND e."canalPopup" = true
        AND NOT EXISTS (SELECT 1 FROM "EnqueteResposta" r WHERE r."enqueteId" = e."id" AND r."workspaceId" = ws."id")
        AND (e."publico" = 'todas'
             OR (e."publico" = 'ativas'   AND ws."ativa")
             OR (e."publico" = 'inativas' AND NOT ws."ativa"))
        AND (e."planos" IS NULL OR ws."plano" = ANY(string_to_array(e."planos", ',')))
        AND (e."modulo" IS NULL OR e."modulo" = ws."moduloTop")
      ORDER BY e."createdAt" DESC
      LIMIT 1
    ` as any[]

    return NextResponse.json({ enquete: enq ? serialize(enq) : null })
  } catch (e) {
    console.error('[ENQUETE-PENDENTE]', (e as Error)?.message)
    return NextResponse.json({ enquete: null })
  }
}
