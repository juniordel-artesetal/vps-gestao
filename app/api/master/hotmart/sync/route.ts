// Sincronização das assinaturas da Hotmart (só Master). Puxa TODAS (paginação completa)
// e faz upsert por código em HotmartAssinatura. Credenciais só em env (nunca no client/log).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { credenciaisConfiguradas, listarAssinaturas } from '@/lib/hotmart'

export const dynamic = 'force-dynamic'

async function ehMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// GET — status: credenciais configuradas? quantas assinaturas em cache? último sync?
export async function GET() {
  if (!await ehMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const [row] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total, MAX("atualizadoEm") AS "ultimoSync"
    FROM "HotmartAssinatura"
  ` as any[]
  return NextResponse.json({
    configurado: credenciaisConfiguradas(),
    total: row?.total ?? 0,
    ultimoSync: row?.ultimoSync ? new Date(row.ultimoSync).toISOString() : null,
  })
}

// POST — dispara a sincronização completa.
export async function POST(_req: NextRequest) {
  if (!await ehMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!credenciaisConfiguradas())
    return NextResponse.json({ error: 'Credenciais da Hotmart não configuradas no servidor (HOTMART_CLIENT_ID/SECRET).' }, { status: 400 })

  let gravadas = 0
  try {
    const { total, paginas } = await listarAssinaturas(async (lote) => {
      // Upsert incremental por página — progresso persiste mesmo se uma página futura falhar (retomável).
      for (const a of lote) {
        await prisma.$executeRaw`
          INSERT INTO "HotmartAssinatura"
            ("id","codigo","email","nomeAssinante","planoId","planoNome","status","valor","moeda","adesao","proximaCobranca","atualizadoEm")
          VALUES (${gerarId()}, ${a.codigo}, ${a.email}, ${a.nomeAssinante}, ${a.planoId}, ${a.planoNome},
                  ${a.status}, ${a.valor}, ${a.moeda}, ${a.adesao}, ${a.proximaCobranca}, NOW())
          ON CONFLICT ("codigo") DO UPDATE SET
            "email" = EXCLUDED."email", "nomeAssinante" = EXCLUDED."nomeAssinante",
            "planoId" = EXCLUDED."planoId", "planoNome" = EXCLUDED."planoNome",
            "status" = EXCLUDED."status", "valor" = EXCLUDED."valor", "moeda" = EXCLUDED."moeda",
            "adesao" = EXCLUDED."adesao", "proximaCobranca" = EXCLUDED."proximaCobranca",
            "atualizadoEm" = NOW()
        `
        gravadas++
      }
    })
    console.log(`[HOTMART SYNC] ${total} assinaturas em ${paginas} páginas`)
    return NextResponse.json({ ok: true, total, paginas, gravadas })
  } catch (e: any) {
    // Erro no meio → o que já foi gravado permanece (retomável num novo sync).
    console.error('[HOTMART SYNC] falhou:', e?.message)
    const msg = e?.message === 'HOTMART_OAUTH_FALHOU' ? 'Falha ao autenticar na Hotmart (confira as credenciais).'
      : e?.message === 'HOTMART_SEM_CREDENCIAIS' ? 'Credenciais da Hotmart não configuradas.'
      : 'Erro ao sincronizar com a Hotmart. Parte pode ter sido gravada — tente novamente.'
    return NextResponse.json({ error: msg, gravadas }, { status: 502 })
  }
}
