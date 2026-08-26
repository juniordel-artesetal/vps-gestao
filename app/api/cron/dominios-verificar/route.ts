// Cron — auto-verifica domínios próprios PENDENTE/VERIFICANDO e ativa sozinho (a artesã não
// precisa clicar "verificar"). Ao virar ATIVO, notifica (lib compartilhada). Autorizado por
// CRON_SECRET (Bearer, como a Vercel envia, ou ?secret=). Agendar a cada ~30 min.
// Só olha domínios recentes (≤14 dias) pra não ficar verificando eternamente os abandonados.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureLojaDominioSchema } from '@/lib/lojaDominio'
import { verificarEAtivarDominio } from '@/lib/lojaDominioVerificar'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || new URL(req.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  await ensureLojaDominioSchema()
  const pendentes = await prisma.$queryRaw`
    SELECT "workspaceId" FROM "LojaDominio"
    WHERE "status" IN ('PENDENTE','VERIFICANDO') AND "criadoEm" > NOW() - INTERVAL '14 days'
    ORDER BY "criadoEm" ASC
    LIMIT 100
  ` as { workspaceId: string }[]

  let ativados = 0, verificados = 0
  for (const p of pendentes) {
    try {
      const r = await verificarEAtivarDominio(p.workspaceId)
      if (r) { verificados++; if (r.ativouAgora) ativados++ }
    } catch (e: any) {
      // env ausente ou erro pontual da Vercel — não derruba o lote
      if (e?.message === 'CONFIG_VERCEL_AUSENTE') break
      console.error('[CRON dominios-verificar]', p.workspaceId, e?.message)
    }
  }

  return NextResponse.json({ ok: true, pendentes: pendentes.length, verificados, ativados })
}
