// Master — campanha de migração dos 130: acompanhar (stats) + semear (CSV) + dry-run.
// Guarda master (cookie master_token).
//   GET                       → { total, porEstado, enviados, envioReal, linkAsaas }
//   POST { acao:'semear', csv } → importa o CSV como 'pendente'
//   POST { acao:'dryrun' }      → roda a régua em DRY-RUN e devolve quem receberia
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { parseCsvCampanha, semearCampanha } from '@/lib/campanha/seed'
import { rodarCampanha } from '@/lib/campanha/regua'
import { linkAsaas, montarEmailCampanha, enviarEmailCampanha, type TipoEmailCampanha } from '@/lib/campanha/emails'

const AMOSTRA_PARA = 'juniordel@gmail.com'

export const dynamic = 'force-dynamic'

async function master(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export async function GET() {
  if (!(await master())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const porEstado = await prisma.$queryRaw`
    SELECT "estado", COUNT(*)::int AS n FROM "CampanhaMigracao" GROUP BY "estado" ORDER BY 2 DESC
  ` as { estado: string; n: number }[]
  const [{ total, enviados }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total, COALESCE(SUM("qtdEmailsEnviados"),0)::int AS enviados FROM "CampanhaMigracao"
  ` as { total: number; enviados: number }[]
  return NextResponse.json(serialize({
    total, enviados, porEstado,
    envioReal: String(process.env.CAMPANHA_MIGRACAO_ATIVO || '').toLowerCase() === 'on' && !!linkAsaas(),
    temLinkAsaas: !!linkAsaas(),
  }))
}

export async function POST(req: NextRequest) {
  if (!(await master())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (b.acao === 'semear') {
    const linhas = parseCsvCampanha(String(b.csv || ''))
    if (!linhas.length) return NextResponse.json({ error: 'CSV vazio ou sem coluna de e-mail.' }, { status: 400 })
    return NextResponse.json(await semearCampanha(linhas))
  }
  if (b.acao === 'dryrun') {
    return NextResponse.json(serialize(await rodarCampanha({ dryRun: true })))
  }
  if (b.acao === 'amostras') {
    // 1 de CADA tipo para o Júnior, com "[AMOSTRA]". NÃO toca na lista real nem conta na régua.
    const tipos: { tipo: TipoEmailCampanha; envio: number; rotulo: string }[] = [
      { tipo: 'fluxo', envio: 0, rotulo: '1º e-mail' },
      { tipo: 'fluxo', envio: 2, rotulo: 'lembrete (variação)' },
      { tipo: 'falta_cancelar', envio: 1, rotulo: 'só falta cancelar' },
      { tipo: 'falta_assinar', envio: 1, rotulo: 'só falta assinar' },
      { tipo: 'migrada', envio: 0, rotulo: 'boas-vindas (migrada)' },
    ]
    let enviados = 0
    for (const t of tipos) {
      const e = montarEmailCampanha(t.tipo, { email: AMOSTRA_PARA, primeiroNome: 'Júnior', envio: t.envio })
      const ok = await enviarEmailCampanha(AMOSTRA_PARA, `[AMOSTRA · ${t.rotulo}] ${e.assunto}`, e.html)
      if (ok) enviados++
    }
    return NextResponse.json({ ok: true, para: AMOSTRA_PARA, enviados, tipos: tipos.length })
  }
  return NextResponse.json({ error: 'Ação inválida (semear|dryrun|amostras).' }, { status: 400 })
}
